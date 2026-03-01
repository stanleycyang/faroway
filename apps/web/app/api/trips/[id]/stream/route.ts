/**
 * POST /api/trips/[id]/stream — Direct-streaming trip generation
 *
 * Runs the multi-agent pipeline directly and streams SSE events as results
 * arrive. This eliminates the DB-polling latency of the old GET handler.
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
import { createClient, getSupabase } from "@/lib/supabase/server";
import { executeTravelSearch } from "@/lib/search/workflow";
import {
  mapSearchResultsToItinerary,
  type MappedItinerary,
} from "@/lib/search/bridge";
import {
  buildSummaryBlocks,
  buildHotelBlocks,
  buildItineraryBlocks,
  buildBudgetBlocks,
  type JsonRenderComponent,
  type HotelInput,
  type ActivityInput,
  type ItineraryDayInput,
} from "@/lib/json-render/build-spec";
import type { SearchInput, TravelerType } from "@faroway/types";

export const maxDuration = 300;

type Params = { params: Promise<{ id: string }> };

async function resolveUser(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
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
  aggregator: {
    searching: "Crafting your perfect itinerary...",
    done: "Itinerary composed",
  },
  saving: { searching: "Saving your itinerary...", done: "Saved" },
};

function calcPercent(sp: Record<string, string>): number {
  let p = 0;
  for (const stage of STAGES) {
    if (sp[stage] === "done") p += 20;
    else if (sp[stage] === "searching") p += 10;
  }
  return Math.min(100, p);
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

// ─── POST: Direct streaming generation ────────────────────────────────────────

export async function POST(request: NextRequest, { params }: Params) {
  const { id: tripId } = await params;
  const userId = await resolveUser();
  const db = getSupabase();

  let tripQuery = db
    .from("trips")
    .select(
      "id, status, search_id, destination, start_date, end_date, travelers, budget_tier, vibes, preferences",
    )
    .eq("id", tripId);
  if (userId) tripQuery = tripQuery.eq("user_id", userId);
  else tripQuery = tripQuery.is("user_id", null);

  const { data: trip, error: tripError } = await tripQuery.single();

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
        if (trip.status === "generated") {
          send("progress", {
            step: "complete",
            progress: 100,
            message: "Your itinerary is ready!",
          });
          send("complete", { tripId });
          controller.close();
          return;
        }

        const searchId = trip.search_id;
        if (!searchId) {
          send("error", {
            message: "No search linked to this trip. Please try again.",
          });
          controller.close();
          return;
        }

        const { data: search } = await db
          .from("searches")
          .select("status")
          .eq("id", searchId)
          .single();

        if (search?.status === "completed") {
          send("progress", {
            step: "complete",
            progress: 100,
            message: "Your itinerary is ready!",
          });
          send("complete", { tripId });
          controller.close();
          return;
        }

        if (search?.status === "error") {
          send("error", {
            message: "Generation previously failed. Please retry.",
          });
          controller.close();
          return;
        }

        // Atomic claim — only one stream runs agents at a time
        const { data: claimed } = await db
          .from("searches")
          .update({
            status: "searching",
            progress: {
              orchestrator: "searching",
              hotels: "pending",
              activities: "pending",
              dining: "pending",
              aggregator: "pending",
            },
          })
          .eq("id", searchId)
          .eq("status", "pending")
          .select("id")
          .single();

        if (!claimed) {
          await pollAndStream(controller, send, db, searchId, tripId, request);
          return;
        }

        // ── Run agents directly ────────────────────────────────────

        const searchInput: SearchInput = {
          destination: trip.destination,
          startDate: trip.start_date,
          endDate: trip.end_date,
          travelers: trip.travelers || 2,
          vibes: trip.vibes || [],
          budget:
            (trip.budget_tier as "budget" | "moderate" | "luxury") ||
            "moderate",
          travelerType: (trip.preferences as Record<string, unknown>)
            ?.travelerType as TravelerType | undefined,
        };

        // Track accumulated json-render blocks for progressive mobile streaming
        const accumulatedBlocks: JsonRenderComponent[] = [];

        // Send initial summary block immediately
        const summaryBlocks = buildSummaryBlocks({
          destination: trip.destination,
          startDate: trip.start_date,
          endDate: trip.end_date,
          travelers: trip.travelers || 2,
          budget: trip.budget_tier || undefined,
        });
        accumulatedBlocks.push(...summaryBlocks);
        send("spec-block", { blocks: summaryBlocks });

        const progressState: Record<string, string> = {
          orchestrator: "pending",
          hotels: "pending",
          activities: "pending",
          dining: "pending",
          aggregator: "pending",
        };

        const onProgress = async (
          stage: string,
          status: "searching" | "done",
        ) => {
          if (request.signal.aborted) return;
          progressState[stage] = status;

          send("progress", {
            step: stage,
            status,
            progress: calcPercent(progressState),
            message: STEP_MESSAGES[stage]?.[status] || "Processing...",
            searchProgress: { ...progressState },
          });

          db.from("searches")
            .update({ progress: { ...progressState } })
            .eq("id", searchId)
            .then(() => {});
        };

        // Micro-progress for more granular feedback
        const onMicroProgress = (data: {
          stage: string;
          message: string;
          detail?: string;
        }) => {
          if (request.signal.aborted) return;
          send("micro", data);
        };

        // Track agent results for budget calculation
        let _capturedHotels: HotelInput[] = [];
        let capturedActivities: ActivityInput[] = [];
        let capturedTopHotel: HotelInput | undefined;

        const onAgentResult = async (stage: string, data: unknown) => {
          if (request.signal.aborted) return;

          if (stage === "hotels") {
            const hotels = data as HotelInput[];
            _capturedHotels = hotels;
            const topHotel = hotels[0] || null;
            capturedTopHotel = topHotel || undefined;

            send("hotels", { topHotel, count: hotels.length });

            // Send hotel spec-block for mobile
            const hotelBlocks = buildHotelBlocks({
              topHotel: topHotel || undefined,
              otherHotels: hotels.slice(1),
            });
            accumulatedBlocks.push(...hotelBlocks);
            send("spec-block", { blocks: hotelBlocks });
          } else if (stage === "activities") {
            capturedActivities = data as ActivityInput[];
            send("activities", { count: capturedActivities.length });
          } else if (stage === "dining") {
            send("dining", { count: (data as unknown[]).length });
          } else if (stage === "aggregator") {
            const itineraryData = data as {
              days?: ItineraryDayInput[];
              topHotel?: HotelInput;
              totalEstimatedCost?: number;
            };
            send("itinerary", data);

            // Send itinerary spec-block for mobile
            const days = itineraryData.days || [];
            const itineraryBlocks = buildItineraryBlocks(days);
            accumulatedBlocks.push(...itineraryBlocks);
            send("spec-block", { blocks: itineraryBlocks });

            // Send budget spec-block for mobile
            const nights = Math.ceil(
              (new Date(trip.end_date).getTime() -
                new Date(trip.start_date).getTime()) /
                (1000 * 60 * 60 * 24),
            );
            const budgetBlocks = buildBudgetBlocks({
              topHotel: capturedTopHotel || itineraryData.topHotel,
              activities: capturedActivities,
              totalEstimatedCost: itineraryData.totalEstimatedCost || 0,
              nights,
              currency: "USD",
            });
            accumulatedBlocks.push(...budgetBlocks);
            send("spec-block", { blocks: budgetBlocks });
          }
        };

        const searchResult = await executeTravelSearch(searchId, searchInput, {
          onProgress,
          onAgentResult,
          onMicroProgress,
        });

        if (searchResult.status === "error" || !searchResult.results) {
          const errorMsg = searchResult.error || "Generation failed";
          send("error", { message: errorMsg });

          await Promise.allSettled([
            db
              .from("searches")
              .update({ status: "error", error_message: errorMsg })
              .eq("id", searchId),
            db
              .from("trips")
              .update({
                status: "failed",
                updated_at: new Date().toISOString(),
              })
              .eq("id", tripId),
          ]);

          controller.close();
          return;
        }

        // ── Save results ───────────────────────────────────────────

        send("progress", {
          step: "saving",
          progress: 95,
          message: "Saving your itinerary...",
          searchProgress: progressState,
        });

        const results = searchResult.results;
        const topHotel =
          results.itinerary?.[0]?.hotel || results.hotels[0] || null;
        const mapped = mapSearchResultsToItinerary(results, topHotel);

        const itineraryDays = mapped.days.map((day) => ({
          dayNumber: day.dayNumber,
          date: day.date,
          title: day.title,
          summary: day.summary || `Day ${day.dayNumber}`,
          morning: day.morning,
          afternoon: day.afternoon,
          evening: day.evening,
          totalEstimatedCost: day.totalEstimatedCost,
          tips: day.tips || [],
        }));

        const { data: savedItinerary } = await db
          .from("itineraries")
          .insert({
            trip_id: tripId,
            user_id: userId || null,
            destination: trip.destination,
            start_date: trip.start_date,
            end_date: trip.end_date,
            overview: `Your personalized trip to ${trip.destination}`,
            total_cost: mapped.totalEstimatedCost || 0,
            days: itineraryDays,
            packing_list: [],
            general_tips: [],
            generated_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        await Promise.all([
          db
            .from("searches")
            .update({
              status: "completed",
              completed_at: new Date().toISOString(),
              intermediate_results: null,
              progress: {
                orchestrator: "done",
                hotels: "done",
                activities: "done",
                dining: "done",
                aggregator: "done",
              },
            })
            .eq("id", searchId),

          db
            .from("trips")
            .update({
              status: "generated",
              itinerary_id: savedItinerary?.id || null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", tripId),
        ]);

        // Send full spec for caching/fallback (mobile can use this if blocks were missed)
        send("spec-complete", { spec: accumulatedBlocks });

        // Non-critical saves (including json-render spec for mobile polling fallback)
        Promise.allSettled([
          saveSearchResults(db, searchId, mapped),
          db
            .from("searches")
            .update({ json_render_spec: accumulatedBlocks })
            .eq("id", searchId),
          db.from("workflow_progress").upsert(
            {
              trip_id: tripId,
              step: "complete",
              progress: 100,
              message: "Your itinerary is ready!",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "trip_id" },
          ),
          ...(userId && savedItinerary
            ? [
                db.from("notifications").insert({
                  user_id: userId,
                  type: "itinerary_ready",
                  title: "Your Itinerary is Ready!",
                  message: `Your trip itinerary to ${trip.destination} has been generated.`,
                  data: {
                    trip_id: tripId,
                    itinerary_id: savedItinerary.id,
                    search_id: searchId,
                  },
                  read: false,
                }),
              ]
            : []),
        ]).catch(() => {});

        send("progress", {
          step: "complete",
          progress: 100,
          message: "Your itinerary is ready!",
        });
        send("complete", { tripId });
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Stream error";
        console.error(`[Stream POST] Error for trip ${tripId}:`, error);
        try {
          send("error", { message: msg });
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
  const userId = await resolveUser();
  const db = getSupabase();

  let tripQuery = db
    .from("trips")
    .select("id, status, search_id")
    .eq("id", tripId);
  if (userId) tripQuery = tripQuery.eq("user_id", userId);
  else tripQuery = tripQuery.is("user_id", null);

  const { data: trip, error: tripError } = await tripQuery.single();

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
        if (trip.status === "generated") {
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
          request,
        );
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Stream error";
        try {
          send("error", { message: msg });
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
  request: NextRequest,
) {
  let lastProgressJson = "";
  let sentHotels = false;
  let sentActivities = false;
  let sentDining = false;
  let sentItinerary = false;
  const MAX_POLLS = 180;

  for (let i = 0; i < MAX_POLLS; i++) {
    if (request.signal.aborted) break;

    const { data: search } = await db
      .from("searches")
      .select("status, progress, error_message, intermediate_results")
      .eq("id", searchId)
      .single();

    if (!search) {
      send("error", { message: "Search record not found" });
      break;
    }

    if (search.status === "error") {
      send("error", { message: search.error_message || "Generation failed" });
      break;
    }

    const sp = (search.progress || {}) as Record<string, string>;
    const pj = JSON.stringify(sp);
    if (pj !== lastProgressJson) {
      lastProgressJson = pj;
      const stage = getCurrentStage(sp);
      send("progress", {
        step: stage,
        status: sp[stage] || "pending",
        progress: calcPercent(sp),
        message: STEP_MESSAGES[stage]?.[sp[stage]] || "Processing...",
        searchProgress: sp,
      });
    }

    const ir = (search.intermediate_results || {}) as Record<string, unknown>;

    if (!sentHotels && ir.hotels) {
      const hotels = ir.hotels as unknown[];
      send("hotels", {
        topHotel: ir.topHotel || hotels[0] || null,
        count: hotels.length,
      });
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
    if (!sentItinerary && ir.days) {
      send("itinerary", { days: ir.days, topHotel: ir.topHotel || null });
      sentItinerary = true;
    }

    if (search.status === "completed") {
      send("progress", {
        step: "complete",
        progress: 100,
        message: "Your itinerary is ready!",
      });
      send("complete", { tripId });
      controller.close();
      return;
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  if (!lastProgressJson.includes('"completed"')) {
    send("error", { message: "Generation timed out" });
  }

  try {
    controller.close();
  } catch {
    /* */
  }
}

// ─── Save helpers ─────────────────────────────────────────────────────────────

async function saveSearchResults(
  db: DB,
  searchId: string,
  result: MappedItinerary,
) {
  const rows = [
    ...(result.hotels || []).map((h) => ({
      search_id: searchId,
      category: "hotel" as const,
      name: h.name,
      description: `${h.userRating?.toFixed(1) || "?"} stars, ${h.reviewCount || 0} reviews`,
      data: h,
      affiliate_url: h.affiliateUrl,
      affiliate_partner: h.affiliatePartner,
      price_amount: h.pricePerNight,
      price_currency: h.currency || "USD",
      rating: h.userRating,
    })),
    ...(result.activities || []).map((a) => ({
      search_id: searchId,
      category: "activity" as const,
      name: a.name,
      description: a.description,
      data: a,
      affiliate_url: a.affiliateUrl,
      affiliate_partner: a.affiliatePartner,
      price_amount: a.price,
      price_currency: a.currency || "USD",
      rating: a.rating,
    })),
    ...(result.dining || []).map((d) => ({
      search_id: searchId,
      category: "dining" as const,
      name: d.name,
      description: d.description,
      data: d,
      affiliate_url: d.reservationUrl,
      affiliate_partner: d.affiliatePartner,
      rating: d.rating,
    })),
  ];

  if (rows.length > 0) {
    await db.from("search_results").insert(rows);
  }
}
