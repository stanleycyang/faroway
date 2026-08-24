/**
 * POST /api/trips/[id]/generate
 *
 * Creates a search record, links it to the trip, and marks status as 'generating'.
 * The durable agent pipeline starts here; the stream endpoint observes progress.
 *
 * GET /api/trips/[id]/generate
 *
 * Returns generation status by reading from the searches table.
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { getSupabase } from "@/lib/supabase/server";
import { requireUserIdFromRequest } from "@/lib/auth/middleware";
import { startWorkflow } from "@/lib/workflow/runtime";
import { planTripWorkflow } from "@/workflows/plan-trip";
import { buildInstantPreview } from "@/lib/search/preview";
import { checkRateLimitAsync } from "@/lib/security/rate-limit";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

type TravelerType = "solo" | "couple" | "family" | "friends" | "business";

const TRAVELER_TYPES = new Set<TravelerType>([
  "solo",
  "couple",
  "family",
  "friends",
  "business",
]);

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;
    const auth = await requireUserIdFromRequest(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    // Rate limit: 5 per hour per user.
    const hourlyLimit = await checkRateLimitAsync(`generate:hour:${userId}`, {
      maxRequests: 5,
      windowMs: 60 * 60 * 1000,
      failClosed: true,
    });
    if (!hourlyLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "Too many generation requests. Please wait before generating another trip.",
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(hourlyLimit.resetIn / 1000)),
          },
        },
      );
    }

    const adminClient = getSupabase();

    const { data: trip, error: tripError } = await adminClient
      .from("trips")
      .select(
        "id, destination, start_date, end_date, status, travelers, budget_tier, vibes, interests, dietary_restrictions, mobility_needs, user_id, search_id, preferences",
      )
      .eq("id", tripId)
      .eq("user_id", userId)
      .single();

    if (tripError || !trip) {
      return NextResponse.json(
        { error: "Trip not found or access denied" },
        { status: 404 },
      );
    }

    // Check if generation is already in progress
    if (trip.status === "generating") {
      return NextResponse.json(
        {
          error: "Itinerary generation already in progress",
          searchId: trip.search_id,
        },
        { status: 409 },
      );
    }

    // Parse optional preferences from request body
    let bodyPreferences: Record<string, unknown> = {};
    try {
      const body = await request.json().catch(() => ({}));
      bodyPreferences = body.preferences || {};
    } catch {
      // No body or invalid JSON, use trip defaults
    }

    const tripPreferences = (trip.preferences || {}) as Record<string, unknown>;
    const bodyVibes = normalizeStringArray(bodyPreferences.vibes, 10, 50);
    const tripVibes = Array.isArray(trip.vibes) ? trip.vibes : [];
    const vibes = bodyVibes ?? tripVibes;
    const travelerType =
      normalizeTravelerType(bodyPreferences.travelerType) ||
      normalizeTravelerType(tripPreferences.travelerType);
    const originCity =
      normalizeString(bodyPreferences.originCity, 200) ||
      normalizeString(tripPreferences.originCity, 200);
    const originAirport =
      normalizeString(bodyPreferences.originAirport, 10) ||
      normalizeString(tripPreferences.originAirport, 10);

    // Create a search record in the searches table
    const { data: search, error: searchError } = await adminClient
      .from("searches")
      .insert({
        user_id: userId,
        destination: trip.destination,
        start_date: trip.start_date,
        end_date: trip.end_date,
        travelers: trip.travelers || 2,
        traveler_type: travelerType || null,
        vibes,
        budget: trip.budget_tier || "moderate",
        status: "pending",
      })
      .select("id")
      .single();

    if (searchError || !search) {
      logger.error("[API] Failed to create search record:", searchError);
      return NextResponse.json(
        { error: "Failed to initialize search" },
        { status: 500 },
      );
    }

    const searchId = search.id;

    // Link search to trip and update status
    await adminClient
      .from("trips")
      .update({
        status: "generating",
        search_id: searchId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId);

    // Store instant preview so loader can render within a few seconds.
    const previewDays = buildInstantPreview({
      destination: trip.destination,
      startDate: trip.start_date,
      endDate: trip.end_date,
      travelers: trip.travelers || 2,
      vibes,
    });
    await adminClient.rpc("merge_intermediate_results", {
      p_search_id: searchId,
      p_key: "days",
      p_value: previewDays,
    });
    await adminClient.rpc("merge_intermediate_results", {
      p_search_id: searchId,
      p_key: "previewReady",
      p_value: true,
    });

    // Kick off durable workflow immediately (stream route only observes state).
    try {
      await startWorkflow(planTripWorkflow, [
        {
          searchId,
          tripId,
          destination: trip.destination,
          startDate: trip.start_date,
          endDate: trip.end_date,
          travelers: trip.travelers || 2,
          travelerType,
          vibes,
          budget: trip.budget_tier || "moderate",
          originCity,
          originAirport,
          userId,
        },
      ]);
    } catch (workflowError) {
      const message =
        workflowError instanceof Error
          ? workflowError.message
          : "Workflow failed to start";
      await Promise.allSettled([
        adminClient
          .from("searches")
          .update({
            status: "error",
            error_message: message,
          })
          .eq("id", searchId),
        adminClient
          .from("trips")
          .update({
            status: "failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", tripId),
      ]);
      throw workflowError;
    }

    logger.info(
      `[API] Created search ${searchId} for trip ${tripId} — workflow started`,
    );

    return NextResponse.json({
      success: true,
      tripId,
      searchId,
      message:
        "Trip planning started — connect to the stream endpoint for real-time updates",
      streamUrl: `/api/trips/${tripId}/stream`,
    });
  } catch (error) {
    logger.error("[API] Error starting trip planning:", error);
    return NextResponse.json(
      { error: "Failed to start trip planning" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/trips/[id]/generate
 *
 * Check generation status by reading from searches table progress.
 */
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;
    const auth = await requireUserIdFromRequest(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    const adminClient = getSupabase();

    const { data: trip, error: tripError } = await adminClient
      .from("trips")
      .select("id, status, search_id")
      .eq("id", tripId)
      .eq("user_id", userId)
      .single();

    if (tripError || !trip) {
      return NextResponse.json(
        {
          tripId,
          status: "not_found",
          message: "Trip not found",
        },
        { status: 404 },
      );
    }

    // If no search linked, check old workflow_progress table for backward compat
    if (!trip.search_id) {
      const { data: progress } = await adminClient
        .from("workflow_progress")
        .select("step, progress, message")
        .eq("trip_id", tripId)
        .single();

      const { data: workflowRun } = await adminClient
        .from("workflow_runs")
        .select("id, status, started_at, completed_at")
        .eq("trip_id", tripId)
        .order("started_at", { ascending: false })
        .limit(1)
        .single();

      return NextResponse.json({
        tripId,
        workflowId: workflowRun?.id,
        status: workflowRun?.status || trip.status || "not_started",
        progress: progress?.progress || 0,
        step: progress?.step || "unknown",
        message: progress?.message || "Processing...",
        startedAt: workflowRun?.started_at,
        completedAt: workflowRun?.completed_at,
      });
    }

    // Read from searches table — this is the new unified path
    const { data: search, error: searchError } = await adminClient
      .from("searches")
      .select("id, status, progress, error_message, created_at, completed_at")
      .eq("id", trip.search_id)
      .single();

    if (searchError || !search) {
      return NextResponse.json({
        tripId,
        status: "not_started",
        message: "No generation has been started for this trip",
      });
    }

    // Map search progress to a flat progress percentage
    const searchProgress = (search.progress || {}) as Record<string, string>;
    const stages = [
      "orchestrator",
      "hotels",
      "activities",
      "dining",
      "transport",
      "enrichment",
      "aggregator",
    ];
    const doneWeight = 100 / stages.length;
    const searchingWeight = doneWeight / 2;
    let progressPercent = 0;
    for (const stage of stages) {
      if (searchProgress[stage] === "done") {
        progressPercent += doneWeight;
      } else if (searchProgress[stage] === "searching") {
        progressPercent += searchingWeight;
      }
    }

    // Determine current step for display
    let currentStep = "queued";
    let message = "Starting trip planning...";
    for (let i = stages.length - 1; i >= 0; i--) {
      if (searchProgress[stages[i]] === "searching") {
        currentStep = stages[i];
        message = getStepMessage(stages[i], "searching");
        break;
      }
      if (searchProgress[stages[i]] === "done") {
        currentStep = stages[i];
        message = getStepMessage(stages[i], "done");
        break;
      }
    }

    if (search.status === "completed") {
      progressPercent = 100;
      currentStep = "complete";
      message = "Your itinerary is ready!";
    } else if (search.status === "error") {
      currentStep = "error";
      message = search.error_message || "Something went wrong";
    }

    return NextResponse.json({
      tripId,
      searchId: search.id,
      status:
        search.status === "completed"
          ? "completed"
          : search.status === "error"
            ? "failed"
            : "running",
      progress: Math.min(100, Math.round(progressPercent)),
      step: currentStep,
      searchProgress,
      message,
      startedAt: search.created_at,
      completedAt: search.completed_at,
    });
  } catch (error) {
    logger.error("[API] Error fetching generation status:", error);
    return NextResponse.json(
      { error: "Failed to fetch generation status" },
      { status: 500 },
    );
  }
}

function getStepMessage(step: string, status: string): string {
  const messages: Record<string, Record<string, string>> = {
    orchestrator: {
      searching: "Understanding your preferences...",
      done: "Preferences analyzed",
    },
    hotels: {
      searching: "Searching for the best hotels...",
      done: "Hotels found",
    },
    activities: {
      searching: "Finding activities & attractions...",
      done: "Activities discovered",
    },
    dining: {
      searching: "Discovering restaurants...",
      done: "Restaurants found",
    },
    transport: {
      searching: "Checking transport options...",
      done: "Transport options ready",
    },
    enrichment: {
      searching: "Adding local picks...",
      done: "Local picks added",
    },
    aggregator: {
      searching: "Crafting your personalized itinerary...",
      done: "Itinerary composed",
    },
  };
  return messages[step]?.[status] || "Processing...";
}

function normalizeTravelerType(value: unknown): TravelerType | undefined {
  return typeof value === "string" && TRAVELER_TYPES.has(value as TravelerType)
    ? (value as TravelerType)
    : undefined;
}

function normalizeString(
  value: unknown,
  maxLength: number,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return undefined;
  return trimmed;
}

function normalizeStringArray(
  value: unknown,
  maxItems: number,
  maxItemLength: number,
): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= maxItemLength)
    .slice(0, maxItems);
}
