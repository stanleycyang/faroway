import { mappedDaysToSpec } from "@/lib/json-render/mapped-days";
import { reconcileGeneration } from "@/lib/trips/reconcile-generation";
import { filterViatorDisplay } from "@/lib/affiliates/viator-policy";
/**
 * POST /api/trips/[id]/stream — Observe durable generation via SSE
 *
 * Streams progress and intermediate results from DB while the durable workflow
 * runs in the background.
 *
 * GET /api/trips/[id]/stream — Lightweight DB-polling fallback
 *
 * Used by mobile clients or when another POST stream is already running.
 *
 * SSE event protocol:
 *   event: progress     — { step, status, progress, message, searchProgress }
 *   event: micro        — { stage, message, detail? } (granular progress updates)
 *   event: hotels       — { topHotel, count }
 *   event: activities   — { count }
 *   event: dining       — { count }
 *   event: itinerary    — { days, topHotel }
 *   event: spec-block   — { blocks: JsonRenderComponent[] } (progressive for mobile)
 *   event: spec-complete— { spec: JsonRenderComponent[] } (full spec for caching)
 *   event: complete     — { tripId }
 *   event: error        — { message }
 */

import { NextRequest } from "next/server";
import { createClientFromRequest, getSupabase } from "@/lib/supabase/server";
import { checkRateLimitAsync } from "@/lib/security/rate-limit";
import {
  buildSummaryBlocks,
  buildHotelBlocks,
  buildItineraryBlocks,
  buildBudgetBlocks,
  type HotelInput,
  type ActivityInput,
} from "@/lib/json-render/build-spec";

export const maxDuration = 300;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Params = { params: Promise<{ id: string }> };

async function resolveUserId(request: NextRequest): Promise<string | null> {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

function unauthorizedSseResponse(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
};

const STAGES = [
  "orchestrator",
  "hotels",
  "activities",
  "dining",
  "transport",
  "enrichment",
  "aggregator",
] as const;

const STEP_MESSAGES: Record<string, Record<string, string>> = {
  orchestrator: {
    searching: "Analyzing your preferences...",
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
    searching: "Adding local non-bookable gems...",
    done: "Local picks added",
  },
  aggregator: {
    searching: "Crafting your perfect itinerary...",
    done: "Itinerary composed",
  },
  saving: { searching: "Saving your itinerary...", done: "Saved" },
};

function calcPercent(sp: Record<string, string>): number {
  const doneWeight = 100 / STAGES.length;
  const searchingWeight = doneWeight / 2;
  let p = 0;
  for (const stage of STAGES) {
    if (sp[stage] === "done") p += doneWeight;
    else if (sp[stage] === "searching") p += searchingWeight;
  }
  return Math.min(100, Math.round(p));
}

function getCurrentStage(sp: Record<string, string>): string {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (sp[STAGES[i]] === "searching" || sp[STAGES[i]] === "done")
      return STAGES[i];
  }
  return "orchestrator";
}

type DB = ReturnType<typeof getSupabase>;
type SendFn = (event: string, data: unknown) => void;
type TripStreamMeta = {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  budget?: string;
};
type SearchStreamRecord = {
  status: string;
  progress: Record<string, string> | null;
  error_message: string | null;
  intermediate_results?: Record<string, unknown> | null;
  json_render_spec?: unknown;
};
type SearchQueryResult = {
  search: SearchStreamRecord | null;
  error: { code?: string; message?: string } | null;
};

// ─── POST: Observe generation state ───────────────────────────────────────────

export async function POST(request: NextRequest, { params }: Params) {
  const { id: tripId } = await params;
  if (!UUID_PATTERN.test(tripId)) {
    return new Response(JSON.stringify({ error: "Invalid trip ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const userId = await resolveUserId(request);
  if (!userId) return unauthorizedSseResponse();
  const rl = await checkRateLimitAsync(`trip-stream:${userId}`, {
    maxRequests: 10,
    windowMs: 60_000,
    failClosed: true,
  });
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: "Too many stream connections. Please wait." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.max(1, Math.ceil(rl.resetIn / 1000))),
        },
      },
    );
  }
  const db = getSupabase();

  const { data: trip, error: tripError } = await db
    .from("trips")
    .select(
      "id, status, search_id, destination, start_date, end_date, travelers, budget_tier, vibes, preferences",
    )
    .eq("id", tripId)
    .eq("user_id", userId)
    .single();

  if (tripError || !trip) {
    return new Response(
      JSON.stringify({ error: "Trip not found or access denied" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send: SendFn = (event, data) => {
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          /* controller closed */
        }
      };

      try {
        const searchId = trip.search_id;
        if (
          (trip.status === "planned" || trip.status === "generated") &&
          !searchId
        ) {
          send("progress", {
            step: "complete",
            progress: 100,
            message: "Your itinerary is ready!",
          });
          send("complete", { tripId });
          controller.close();
          return;
        }

        if (!searchId) {
          send("progress", {
            step: "waiting",
            status: "pending",
            progress: 0,
            message: "Waiting for generation to start...",
          });
          controller.close();
          return;
        }

        // Keep mobile progressive contract: emit initial summary block.
        const summaryBlocks = buildSummaryBlocks({
          destination: trip.destination,
          startDate: trip.start_date,
          endDate: trip.end_date,
          travelers: trip.travelers || 2,
          budget: trip.budget_tier || undefined,
        });
        send("spec-block", { chapter: "summary", blocks: summaryBlocks });

        await pollAndStream(
          controller,
          send,
          db,
          searchId,
          tripId,
          {
            destination: trip.destination,
            startDate: trip.start_date,
            endDate: trip.end_date,
            travelers: trip.travelers || 2,
            budget: trip.budget_tier || undefined,
          },
          request,
          userId,
        );
        return;
      } catch (error) {
        console.error(`[Stream POST] Error for trip ${tripId}:`, error);
        try {
          send("error", { message: "Stream connection interrupted" });
        } catch {
          /* */
        }
      }

      try {
        controller.close();
      } catch {
        /* */
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

// ─── GET: DB-polling fallback ─────────────────────────────────────────────────

export async function GET(request: NextRequest, { params }: Params) {
  const { id: tripId } = await params;
  if (!UUID_PATTERN.test(tripId)) {
    return new Response(JSON.stringify({ error: "Invalid trip ID" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const userId = await resolveUserId(request);
  if (!userId) return unauthorizedSseResponse();
  const rl = await checkRateLimitAsync(`trip-stream:${userId}`, {
    maxRequests: 10,
    windowMs: 60_000,
    failClosed: true,
  });
  if (!rl.allowed) {
    return new Response(
      JSON.stringify({ error: "Too many stream connections. Please wait." }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(Math.max(1, Math.ceil(rl.resetIn / 1000))),
        },
      },
    );
  }
  const db = getSupabase();

  const { data: trip, error: tripError } = await db
    .from("trips")
    .select("id, status, search_id")
    .eq("id", tripId)
    .eq("user_id", userId)
    .single();

  if (tripError || !trip) {
    return new Response(
      JSON.stringify({ error: "Trip not found or access denied" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send: SendFn = (event, data) => {
        try {
          controller.enqueue(
            encoder.encode(
              `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`,
            ),
          );
        } catch {
          /* */
        }
      };

      try {
        if (
          (trip.status === "planned" || trip.status === "generated") &&
          !trip.search_id
        ) {
          send("progress", {
            step: "complete",
            progress: 100,
            message: "Your itinerary is ready!",
          });
          send("complete", { tripId });
          controller.close();
          return;
        }

        if (!trip.search_id) {
          send("progress", {
            step: "waiting",
            status: "pending",
            progress: 0,
            message: "Waiting for generation to start...",
          });
          controller.close();
          return;
        }

        await pollAndStream(
          controller,
          send,
          db,
          trip.search_id,
          tripId,
          null,
          request,
          userId,
        );
      } catch (error) {
        console.error(`[Stream GET] Error for trip ${tripId}:`, error);
        try {
          send("error", { message: "Stream connection interrupted" });
        } catch {
          /* */
        }
        try {
          controller.close();
        } catch {
          /* */
        }
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

// ─── Shared: DB-polling stream ────────────────────────────────────────────────

async function pollAndStream(
  controller: ReadableStreamDefaultController,
  send: SendFn,
  db: DB,
  searchId: string,
  tripId: string,
  tripMeta: TripStreamMeta | null,
  request: NextRequest,
  userId: string,
) {
  let lastProgressJson = "";
  let clientDisconnected = false;
  let terminalEventSent = false;
  let sentHotels = false;
  let sentActivities = false;
  let sentDining = false;
  let sentTransport = false;
  let sentSpecComplete = false;
  let sentDayOneJson = "";
  const sentDiscoverySignatures = new Map<string, string>();
  let lastItineraryJson = "";
  const MAX_POLLS = 180;

  for (let i = 0; i < MAX_POLLS; i++) {
    if (request.signal.aborted) {
      clientDisconnected = true;
      break;
    }

    // Reconcile known terminal workflow runs while SSE is connected, too.
    // No new run is ever dispatched by observation; backend uncertainty keeps
    // the existing claim. Limit the workflow backend check to once per 30 polls.
    if (i % 30 === 0) await reconcileGeneration(tripId, userId, searchId);
    const { search, error } = await loadSearchForStream(db, searchId, userId);

    if (error) {
      console.error("[Stream] Failed to read search progress:", error);
      send("error", { message: "Unable to read search progress" });
      terminalEventSent = true;
      break;
    }

    if (!search) {
      send("error", { message: "Search record not found" });
      terminalEventSent = true;
      break;
    }

    if (search.status === "error") {
      send("error", { message: search.error_message || "Generation failed" });
      terminalEventSent = true;
      break;
    }

    const sp = (search.progress || {}) as Record<string, string>;
    const pj = JSON.stringify(sp);
    if (pj !== lastProgressJson) {
      lastProgressJson = pj;
      const stage = getCurrentStage(sp);
      const unfinished = STAGES.filter(
        (name) => sp[name] === "error" || sp[name] === "failed",
      );
      send("progress", {
        step: stage,
        status: sp[stage] || "pending",
        progress: calcPercent(sp),
        message: unfinished.length
          ? `${unfinished.join(", ")} did not finish. Nothing was retried automatically.`
          : STEP_MESSAGES[stage]?.[sp[stage]] || "Processing...",
        searchProgress: sp,
      });
    }

    const ir = filterViatorDisplay(search.intermediate_results || {});

    // Forward grounded per-stage discoveries emitted by plan-trip.ts
    const rawDiscoveries: Array<Record<string, unknown>> = [];
    if (Array.isArray(ir.discoveries)) {
      for (const item of ir.discoveries) {
        if (item && typeof item === "object" && !Array.isArray(item)) {
          rawDiscoveries.push(item as Record<string, unknown>);
        }
      }
    }
    for (const key of [
      "discovery_orchestrator",
      "discovery_hotels",
      "discovery_activities",
      "discovery_dining",
      "discovery_transport",
      "discovery_enrichment",
      "discovery_aggregator",
    ] as const) {
      const val = (ir as Record<string, unknown>)[key];
      if (Array.isArray(val)) {
        for (const item of val) {
          if (item && typeof item === "object" && !Array.isArray(item)) {
            rawDiscoveries.push(item as Record<string, unknown>);
          }
        }
      } else if (val && typeof val === "object") {
        rawDiscoveries.push(val as Record<string, unknown>);
      }
    }
    const newlyArrivedDiscoveries: Array<Record<string, unknown>> = [];
    for (const disc of rawDiscoveries) {
      const discId = typeof disc.id === "string" ? disc.id : "";
      if (!discId) continue;
      const sig = JSON.stringify(disc);
      if (sentDiscoverySignatures.get(discId) !== sig) {
        sentDiscoverySignatures.set(discId, sig);
        newlyArrivedDiscoveries.push(disc);
      }
    }
    if (newlyArrivedDiscoveries.length > 0) {
      send("discovery", { discoveries: newlyArrivedDiscoveries });
    }

    if (ir.dayOne && typeof ir.dayOne === "object") {
      const normalizedDayOne = normalizeItineraryDays([ir.dayOne]);
      const dayOne = normalizedDayOne?.[0] as
        | Record<string, unknown>
        | undefined;
      const dayOneStops = dayOne
        ? (["morning", "afternoon", "evening"] as const).reduce((sum, slot) => {
            const block = dayOne[slot] as
              | { activities?: unknown[]; meals?: unknown[]; meal?: unknown }
              | undefined;
            const acts = Array.isArray(block?.activities)
              ? block.activities.length
              : 0;
            const meals = Array.isArray(block?.meals)
              ? block.meals.length
              : block?.meal
                ? 1
                : 0;
            return sum + acts + meals;
          }, 0)
        : 0;
      if (dayOne && dayOneStops > 0) {
        const dayOneJson = JSON.stringify(dayOne);
        if (dayOneJson !== sentDayOneJson) {
          sentDayOneJson = dayOneJson;
          send("day_ready", {
            day: dayOne,
            discovery: (ir as Record<string, unknown>).discovery_aggregator,
          });
        }
      }
    }

    if (!sentHotels && ir.hotels) {
      const hotels = ir.hotels as HotelInput[];
      send("hotels", {
        topHotel: ir.topHotel || hotels[0] || null,
        count: hotels.length,
      });
      const blocks = buildHotelBlocks({
        topHotel: (ir.topHotel as HotelInput | undefined) || hotels[0],
        otherHotels: hotels.slice(1),
      });
      if (blocks.length > 0) send("spec-block", { chapter: "hotels", blocks });
      sentHotels = true;
    }
    if (!sentActivities && ir.activitiesCount != null) {
      send("activities", { count: ir.activitiesCount });
      sentActivities = true;
    }
    if (!sentDining && ir.diningCount != null) {
      send("dining", { count: ir.diningCount });
      sentDining = true;
    }
    if (!sentTransport && ir.transportCount != null) {
      send("transport", { count: ir.transportCount });
      sentTransport = true;
    }
    if (ir.days != null) {
      const days = normalizeItineraryDays(ir.days);
      if (!days) {
        send("error", { message: "Malformed itinerary partial output" });
        terminalEventSent = true;
        break;
      }
      const itineraryJson = JSON.stringify(days);
      if (itineraryJson !== lastItineraryJson) {
        lastItineraryJson = itineraryJson;
        send("itinerary", { days, topHotel: ir.topHotel || null });
        const itineraryBlocks = buildItineraryBlocks(mappedDaysToSpec(days));
        if (itineraryBlocks.length > 0) {
          send("spec-block", { chapter: "itinerary", blocks: itineraryBlocks });
        }
        if (tripMeta) {
          const nights = Math.ceil(
            (new Date(tripMeta.endDate).getTime() -
              new Date(tripMeta.startDate).getTime()) /
              (1000 * 60 * 60 * 24),
          );
          const budgetBlocks = buildBudgetBlocks({
            topHotel: (ir.topHotel as HotelInput | undefined) || undefined,
            activities: ((ir.activities as ActivityInput[]) || []).slice(0, 20),
            nights,
          });
          if (budgetBlocks.length > 0) {
            send("spec-block", { chapter: "budget", blocks: budgetBlocks });
          }
        }
      }
    }
    if (!sentSpecComplete && search.json_render_spec != null) {
      if (!Array.isArray(search.json_render_spec)) {
        send("error", { message: "Malformed json-render spec output" });
        terminalEventSent = true;
        break;
      }
      send("spec-complete", { spec: search.json_render_spec });
      sentSpecComplete = true;
    }

    if (search.status === "completed") {
      const unfinished = STAGES.filter(
        (stage) => sp[stage] === "error" || sp[stage] === "failed",
      );
      send("progress", {
        step: "complete",
        progress: 100,
        message: unfinished.length
          ? "Your itinerary is ready, with gaps where a search did not finish. Review those stops before you rely on them."
          : "Your itinerary is ready!",
        searchProgress: sp,
      });
      send("complete", { tripId });
      controller.close();
      return;
    }

    const shouldContinue = await waitForNextPoll(1000, request.signal);
    if (!shouldContinue) {
      clientDisconnected = true;
      break;
    }
  }

  if (
    !clientDisconnected &&
    !terminalEventSent &&
    !lastProgressJson.includes('"completed"')
  ) {
    send("progress", {
      step: "running",
      status: "searching",
      progress: 99,
      message: "Still generating in background. Reconnect for updates.",
    });
  }

  try {
    controller.close();
  } catch {
    /* */
  }
}

function normalizeItineraryDays(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return filterViatorDisplay(value);
  if (typeof value !== "string") return null;

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? filterViatorDisplay(parsed) : null;
  } catch {
    return null;
  }
}

async function loadSearchForStream(
  db: DB,
  searchId: string,
  userId: string,
): Promise<SearchQueryResult> {
  const attempts = [
    "status, progress, error_message, intermediate_results, json_render_spec",
    "status, progress, error_message, json_render_spec",
    "status, progress, error_message, intermediate_results",
    "status, progress, error_message",
  ];

  let lastMissingColumnError: { code?: string; message?: string } | null = null;

  for (const select of attempts) {
    const { data, error } = await db
      .from("searches")
      .select(select)
      .eq("id", searchId)
      .eq("user_id", userId)
      .single();

    if (!error) {
      const search = data as unknown as SearchStreamRecord | null;
      return {
        search: filterViatorDisplay(search) ?? null,
        error: null,
      };
    }

    if (isMissingColumnError(error)) {
      lastMissingColumnError = error;
      continue;
    }

    return { search: null, error };
  }

  return { search: null, error: lastMissingColumnError };
}

function isMissingColumnError(error: { code?: string; message?: string }) {
  return (
    error.code === "42703" ||
    error.message?.toLowerCase().includes("does not exist")
  );
}

function waitForNextPoll(ms: number, signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve(true);
    }, ms);

    const onAbort = () => {
      clearTimeout(timeout);
      resolve(false);
    };

    signal.addEventListener("abort", onAbort, { once: true });
  });
}
