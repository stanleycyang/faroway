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
import {
  reconcileGeneration,
  STARTUP_UNCONFIRMED,
} from "@/lib/trips/reconcile-generation";
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
      const recovery = trip.search_id
        ? await reconcileGeneration(tripId, userId, trip.search_id)
        : { state: "unconfirmed" };
      return NextResponse.json(
        {
          error: "Itinerary generation already in progress",
          recovery: recovery.state,
          searchId: trip.search_id,
        },
        { status: 409 },
      );
    }

    if (["planned", "generated", "completed"].includes(trip.status)) {
      return NextResponse.json({
        success: true,
        tripId,
        searchId: trip.search_id,
        status: trip.status,
      });
    }
    if (!["draft", "failed"].includes(trip.status))
      return NextResponse.json(
        { error: "Trip is not ready for generation" },
        { status: 409 },
      );

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

    // Only one concurrent caller may claim the observed trip state. A losing
    // request never starts a workflow, even when both read the same draft.
    let claim = adminClient
      .from("trips")
      .update({
        status: "generating",
        search_id: searchId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", tripId)
      .eq("user_id", userId)
      .eq("status", trip.status);
    claim = trip.search_id
      ? claim.eq("search_id", trip.search_id)
      : claim.is("search_id", null);
    const { data: claimed, error: claimError } = await claim
      .select("id")
      .maybeSingle();
    if (claimError) {
      // A failed reply is not proof the conditional write failed. Only this
      // request knows this newly-created search ID; read it back before dispatch.
      const { data: observed, error: readError } = await adminClient
        .from("trips")
        .select("search_id, status")
        .eq("id", tripId)
        .eq("user_id", userId)
        .single();
      if (
        readError ||
        observed?.search_id !== searchId ||
        observed.status !== "generating"
      ) {
        // Preserve the candidate. Deleting it could clear an already-committed
        // trip.search_id through the foreign key's ON DELETE SET NULL action.
        return NextResponse.json(
          {
            error:
              "Planning startup could not be confirmed. Reopen your saved trip to check progress.",
          },
          { status: 503 },
        );
      }
    } else if (!claimed) {
      await adminClient
        .from("searches")
        .delete()
        .eq("id", searchId)
        .eq("user_id", userId);
      return NextResponse.json(
        { error: "Planning state changed. Reopen your trip to continue." },
        { status: 409 },
      );
    }

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
      const run = await startWorkflow<{ runId: string }>(planTripWorkflow, [
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
      // The workflow also records its own ID in its first step, closing the
      // window where the caller loses the successful start response.
      await adminClient
        .from("searches")
        .update({ workflow_run_id: run.runId })
        .eq("id", searchId)
        .eq("user_id", userId);
    } catch (workflowError) {
      const message =
        workflowError instanceof Error
          ? workflowError.message
          : "Workflow failed to start";
      // Dispatch failures can be ambiguous: the workflow may already exist.
      // Keep the claim so a retry cannot start a second paid workflow.
      await adminClient
        .from("searches")
        .update({
          error_message: STARTUP_UNCONFIRMED,
        })
        .eq("id", searchId)
        .eq("user_id", userId);
      logger.error("[API] Workflow startup unconfirmed", {
        tripId,
        searchId,
        message,
      });
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

    const recovery =
      trip.status === "generating"
        ? await reconcileGeneration(tripId, userId, trip.search_id)
        : null;

    // Read from searches table — this is the new unified path
    const { data: search, error: searchError } = await adminClient
      .from("searches")
      .select("id, status, progress, error_message, created_at, completed_at")
      .eq("id", trip.search_id)
      .eq("user_id", userId)
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
      recovery: recovery?.state,
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
      message:
        recovery?.state === "unconfirmed"
          ? "We are checking whether planning started. Your saved trip is safe; another run will not be started while its status is uncertain."
          : message,
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
