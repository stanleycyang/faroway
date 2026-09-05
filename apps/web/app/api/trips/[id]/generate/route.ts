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
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { getSupabase } from "@/lib/supabase/server";
import { requireUserIdFromRequest } from "@/lib/auth/middleware";
import { startWorkflow } from "@/lib/workflow/runtime";
import { planTripWorkflow } from "@/workflows/plan-trip";
import { buildInstantPreview } from "@/lib/search/preview";
import { getRateLimitBucketKey } from "@/lib/security/rate-limit";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

type TravelerType = "solo" | "couple" | "family" | "friends" | "business";

const GenerationClaimSchema = z.discriminatedUnion("outcome", [
  z.object({
    outcome: z.literal("created"),
    searchId: z.string().min(1),
    status: z.string(),
  }),
  z.object({
    outcome: z.literal("replayed"),
    searchId: z.string().min(1),
    status: z.string(),
  }),
  z.object({
    outcome: z.literal("in_progress"),
    searchId: z.string().nullable(),
  }),
  z.object({ outcome: z.literal("not_found") }),
  z.object({ outcome: z.literal("key_conflict") }),
  z.object({ outcome: z.literal("trip_changed") }),
  z.object({
    outcome: z.literal("rate_limited"),
    retryAfter: z.number().int().nonnegative(),
  }),
]);

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
    const requestKey = request.headers.get("Idempotency-Key") ?? randomUUID();
    if (!/^[A-Za-z0-9._:-]{1,128}$/.test(requestKey)) {
      return NextResponse.json(
        { error: "Invalid Idempotency-Key" },
        { status: 400 },
      );
    }
    const text = await request.text();
    let body: unknown = {};
    try {
      if (text.trim()) body = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }
    const parsed = z
      .object({ preferences: z.record(z.unknown()).optional() })
      .passthrough()
      .safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    const bodyPreferences = parsed.data.preferences ?? {};

    const adminClient = getSupabase();
    const { data: trip, error: tripError } = await adminClient
      .from("trips")
      .select(
        "id, destination, start_date, end_date, status, travelers, budget_tier, vibes, interests, dietary_restrictions, mobility_needs, user_id, search_id, preferences, updated_at",
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

    const tripPreferences = z
      .record(z.unknown())
      .catch({})
      .parse(trip.preferences);
    const vibes =
      normalizeStringArray(bodyPreferences.vibes, 10, 50) ??
      normalizeStringArray(trip.vibes, 10, 50) ??
      [];
    const travelerType =
      normalizeTravelerType(bodyPreferences.travelerType) ||
      normalizeTravelerType(tripPreferences.travelerType);
    const originCity =
      normalizeString(bodyPreferences.originCity, 200) ||
      normalizeString(tripPreferences.originCity, 200);
    const originAirport =
      normalizeString(bodyPreferences.originAirport, 10) ||
      normalizeString(tripPreferences.originAirport, 10);
    const input = {
      tripId,
      userId,
      destination: trip.destination,
      startDate: trip.start_date,
      endDate: trip.end_date,
      travelers: trip.travelers || 2,
      travelerType,
      vibes,
      budget: trip.budget_tier || "moderate",
      originCity,
      originAirport,
    };
    const preview = buildInstantPreview(input);

    // Ownership, optimistic input validation, rate consumption, search/tracking
    // creation and trip linkage commit together under the trip's row lock.
    const { data, error } = await adminClient.rpc("begin_trip_generation", {
      p_trip_id: tripId,
      p_user_id: userId,
      p_request_key: requestKey,
      p_input: input,
      p_preview: preview,
      p_expected_updated_at: trip.updated_at,
      p_rate_limit_key: getRateLimitBucketKey(`generate:hour:${userId}`),
      // Compare caller intent, not defaults re-read from a subsequently edited trip.
      p_request_fingerprint: bodyPreferences,
    });
    if (error)
      throw new Error("Failed to initialize trip generation", { cause: error });
    const claim = GenerationClaimSchema.parse(data);
    switch (claim.outcome) {
      case "not_found":
        return NextResponse.json(
          { error: "Trip not found or access denied" },
          { status: 404 },
        );
      case "key_conflict":
        return NextResponse.json(
          {
            error:
              "Idempotency-Key was already used with different trip inputs",
          },
          { status: 409 },
        );
      case "trip_changed":
        return NextResponse.json(
          {
            error:
              "Trip changed while starting generation. Reload and try again.",
          },
          { status: 409 },
        );
      case "rate_limited":
        return NextResponse.json(
          {
            error:
              "Too many generation requests. Please wait before generating another trip.",
          },
          { status: 429, headers: { "Retry-After": String(claim.retryAfter) } },
        );
      case "in_progress":
        return NextResponse.json(
          {
            error: "Itinerary generation already in progress",
            searchId: claim.searchId,
          },
          { status: 409 },
        );
    }

    const searchId = claim.searchId;
    if (claim.outcome === "created") {
      try {
        await startWorkflow(planTripWorkflow, [{ ...input, searchId }]);
      } catch (workflowError) {
        // The runtime may have accepted work before losing its response. Fence
        // this attempt so a delayed worker cannot overwrite a subsequent retry.
        const failure = await adminClient.rpc("fail_trip_generation", {
          p_trip_id: tripId,
          p_search_id: searchId,
        });
        if (failure.error)
          logger.error(
            "[API] Failed to record workflow startup failure",
            failure.error,
          );
        logger.error("[API] Workflow startup failed", workflowError);
        return NextResponse.json(
          {
            error: "Failed to start trip planning",
            tripId,
            searchId,
            workflowId: searchId,
            statusUrl: `/api/workflows/${searchId}/status`,
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      tripId,
      searchId,
      workflowId: searchId,
      statusUrl: `/api/workflows/${searchId}/status`,
      streamUrl: `/api/trips/${tripId}/stream`,
      status: claim.status,
      replayed: claim.outcome === "replayed",
      message:
        claim.outcome === "replayed"
          ? "Returning the existing generation"
          : "Trip planning started",
    });
  } catch (error) {
    logger.error("[API] Error starting trip planning:", error);
    return NextResponse.json(
      { error: "Failed to initialize trip generation" },
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
