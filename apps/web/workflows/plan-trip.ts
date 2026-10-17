import { matchesTransportProjection } from "@/lib/search/transport-reference";
import { applyGenerationUpdate } from "@/lib/trips/apply-generation-update";
import { getWorkflowMetadata } from "workflow";
import { viatorContentMetadata } from "@/lib/affiliates/viator-policy";
/**
 * Trip Planning Workflow
 * Uses the multi-agent search system with structured output (generateObject)
 * for reliable, schema-validated results.
 *
 * Steps:
 *   1. createSearchPlan  – Mark search as started
 *   2. searchAffiliates  – Run multi-agent system (orchestrator → hotels/activities/dining → aggregator)
 *   3. composeItinerary  – Mark aggregation as done
 *   4. buildAndSaveSpec  – Build json-render spec, bridge to itineraries table
 */

import { runOrchestratorAgent } from "@/lib/search/agents/orchestrator";
import { runHotelsAgent } from "@/lib/search/agents/hotels";
import { runActivitiesAgent } from "@/lib/search/agents/activities";
import { runDiningAgent } from "@/lib/search/agents/dining";
import { runTransportAgent } from "@/lib/search/agents/transport";
import { runAggregatorAgent } from "@/lib/search/agents/aggregator";
import { runSearchEnrichment } from "@/lib/search/enrichment";
import {
  mapSearchResultsToItinerary,
  type MappedItinerary,
} from "@/lib/search/bridge";
import {
  buildJsonRenderSpec,
  BuildSpecInput,
} from "@/lib/json-render/build-spec";
import { getSupabase } from "@/lib/supabase/server";
import type {
  SearchInput,
  SearchPlan,
  SearchResults,
  HotelResult,
  ActivityResult,
  DiningResult,
  TransportResult,
  ItineraryActivity,
  Restaurant as FarowayRestaurant,
} from "@faroway/types";

// Types
interface TripPlanInput {
  searchId: string;
  tripId?: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  adults?: number;
  children?: number;
  interests?: string[];
  travelerType?: SearchInput["travelerType"];
  vibes?: string[];
  budget?: string;
  originCity?: string;
  originAirport?: string;
  userId?: string;
}

interface TripPlanOutput {
  searchId: string;
  tripId?: string;
  status: "completed" | "error";
  result?: MappedItinerary;
  error?: string;
}

/**
 * Main workflow function – orchestrates the trip planning process
 */
export async function planTripWorkflow(
  input: TripPlanInput,
): Promise<TripPlanOutput> {
  "use workflow";

  const {
    searchId,
    tripId,
    destination,
    startDate,
    endDate,
    travelers,
    adults,
    children,
    interests,
    travelerType,
    vibes,
    budget,
    originCity,
    originAirport,
    userId,
  } = input;

  try {
    // ── Step 1: Create Search Plan ──────────────────────────────────
    await createSearchPlan(searchId, tripId, { destination, vibes, budget });

    // ── Step 2: Build Search Plan ───────────────────────────────────
    const searchPlan = await buildSearchPlanStep({
      searchId,
      tripId,
      destination,
      startDate,
      endDate,
      travelers,
      adults,
      children,
      interests,
      travelerType,
      vibes,
      budget,
      originCity,
      originAirport,
    });

    // ── Step 3: Fan-out specialized sources in parallel ─────────────
    await setProgressState(
      searchId,
      tripId,
      {
        orchestrator: "done",
        hotels: "searching",
        activities: "searching",
        dining: "searching",
        transport: "searching",
        enrichment: "searching",
        aggregator: "pending",
      },
      {
        step: "hotels",
        progress: 25,
        message: "Searching providers in parallel...",
      },
    );

    const [hotelsRes, activitiesRes, diningRes, transportRes, enrichmentRes] =
      await Promise.allSettled([
        runHotelsStep(searchId, searchPlan),
        runActivitiesStep(searchId, searchPlan),
        runDiningStep(searchId, searchPlan),
        runTransportStep(searchId, searchPlan, travelers),
        runEnrichmentStep(searchId, searchPlan),
      ]);

    const hotels = fulfilledOrEmpty(hotelsRes);
    const activities = fulfilledOrEmpty(activitiesRes);
    const dining = fulfilledOrEmpty(diningRes);
    const transport = fulfilledOrEmpty(transportRes);
    const enrichment = fulfilledOrFallback(enrichmentRes, {
      activities: [],
      dining: [],
      notes: [],
    });

    await setProgressState(
      searchId,
      tripId,
      {
        orchestrator: "done",
        hotels: hotelsRes.status === "fulfilled" ? "done" : "pending",
        activities: activitiesRes.status === "fulfilled" ? "done" : "pending",
        dining: diningRes.status === "fulfilled" ? "done" : "pending",
        transport: transportRes.status === "fulfilled" ? "done" : "pending",
        enrichment: enrichmentRes.status === "fulfilled" ? "done" : "pending",
        aggregator: "searching",
      },
      {
        step: "aggregator",
        progress: 80,
        message: "Composing the final itinerary...",
      },
    );

    // ── Step 4: Aggregate itinerary from combined candidates ────────
    const result = await aggregateItineraryStep({
      searchId,
      tripId,
      plan: searchPlan,
      hotels,
      activities: [...activities, ...enrichment.activities],
      dining: [...dining, ...enrichment.dining],
      transport,
      enrichmentNotes: enrichment.notes,
    });

    // ── Step 5: Compose Itinerary (already done by aggregator) ──────
    await markItineraryComposed(searchId, tripId);

    // ── Step 6: Build spec + save to database ──────────────────────
    await buildAndSaveSpec(searchId, result, {
      tripId,
      destination,
      startDate,
      endDate,
      travelers,
      budget,
      userId,
    });

    if (tripId) {
      try {
        await notifyItineraryReadyStep(tripId, searchId);
      } catch {
        // The plan is already saved. Optional notification/queue failure cannot
        // turn a completed generation into an error or trigger replanning.
      }
    }

    return {
      searchId,
      tripId,
      status: "completed",
      result,
    };
  } catch (error) {
    const errorMessage =
      typeof error === "object" &&
      error !== null &&
      "message" in error &&
      typeof error.message === "string"
        ? error.message
        : "Unknown error";

    await updateSearchStatus(searchId, "error", {}, errorMessage);

    await recordTripFailure(searchId, tripId, errorMessage);

    return {
      searchId,
      tripId,
      status: "error",
      error: errorMessage,
    };
  }
}

async function recordTripFailure(
  searchId: string,
  tripId: string | undefined,
  errorMessage: string,
) {
  "use step";
  if (tripId)
    await applyGenerationUpdate(tripId, searchId, "failed", {
      message: errorMessage,
    });
}

// ─── Step 1: Create Search Plan ─────────────────────────────────────────────

async function createSearchPlan(
  searchId: string,
  tripId: string | undefined,
  params: { destination: string; vibes?: string[]; budget?: string },
): Promise<void> {
  "use step";

  console.log(
    `[Workflow] Step 1: Creating search plan for ${params.destination}`,
  );

  const { error: identityError } = await getSupabase()
    .from("searches")
    .update({
      status: "searching",
      workflow_run_id: getWorkflowMetadata().workflowRunId,
      workflow_run_verified: true,
      error_message: null,
      progress: {
        orchestrator: "searching",
        hotels: "pending",
        activities: "pending",
        dining: "pending",
        transport: "pending",
        enrichment: "pending",
        aggregator: "pending",
      },
    })
    .eq("id", searchId);
  if (identityError)
    throw new Error("Could not record the planning run identity");

  // Update workflow_progress for trip-based polling
  if (tripId) {
    await applyGenerationUpdate(tripId, searchId, "progress", {
      trip_id: tripId,
      step: "orchestrator",
      progress: 5,
      message: "Analyzing your preferences...",
      updated_at: new Date().toISOString(),
    });
  }

  console.log(`[Workflow] Step 1 complete for search ${searchId}`);
}

function fulfilledOrEmpty<T>(result: PromiseSettledResult<T[]>): T[] {
  return result.status === "fulfilled" ? result.value : [];
}

function fulfilledOrFallback<T>(
  result: PromiseSettledResult<T>,
  fallback: T,
): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

async function mergeIntermediateResult(
  searchId: string,
  key: string,
  value: unknown,
): Promise<void> {
  "use step";
  await getSupabase().rpc("merge_intermediate_results", {
    p_search_id: searchId,
    p_key: key,
    p_value: value,
  });
}

async function buildSearchPlanStep(params: {
  searchId: string;
  tripId?: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  adults?: number;
  children?: number;
  interests?: string[];
  travelerType?: SearchInput["travelerType"];
  vibes?: string[];
  budget?: string;
  originCity?: string;
  originAirport?: string;
}): Promise<SearchPlan> {
  "use step";
  const startedAt = Date.now();
  const {
    searchId,
    tripId,
    destination,
    startDate,
    endDate,
    travelers,
    adults,
    children,
    interests,
    travelerType,
    vibes,
    budget,
    originCity,
    originAirport,
  } = params;
  const searchInput: SearchInput = {
    destination,
    startDate,
    endDate,
    travelers,
    adults,
    children,
    interests,
    travelerType,
    vibes: vibes || [],
    budget: (budget as "budget" | "moderate" | "luxury") || "moderate",
    originCity,
    originAirport,
  };

  const plan = await runOrchestratorAgent(searchInput);

  await getSupabase()
    .from("searches")
    .update({
      progress: {
        orchestrator: "done",
        hotels: "pending",
        activities: "pending",
        dining: "pending",
        transport: "pending",
        enrichment: "pending",
        aggregator: "pending",
      },
    })
    .eq("id", searchId);
  await mergeIntermediateResult(searchId, "searchPlan", plan);

  if (tripId) {
    await applyGenerationUpdate(tripId, searchId, "progress", {
      trip_id: tripId,
      step: "orchestrator",
      progress: 15,
      message: "Search plan ready. Running providers in parallel...",
      updated_at: new Date().toISOString(),
    });
  }
  console.log(
    `[WorkflowTiming] search=${searchId} stage=build_search_plan duration_ms=${Date.now() - startedAt}`,
  );
  return plan;
}

async function runHotelsStep(
  searchId: string,
  plan: SearchPlan,
): Promise<HotelResult[]> {
  "use step";
  const startedAt = Date.now();
  const hotels = await runHotelsAgent(plan, 10);
  await Promise.all([
    mergeIntermediateResult(searchId, "hotels", hotels),
    mergeIntermediateResult(searchId, "topHotel", hotels[0] || null),
  ]);
  console.log(
    `[WorkflowTiming] search=${searchId} stage=hotels duration_ms=${Date.now() - startedAt}`,
  );
  return hotels;
}

async function runActivitiesStep(
  searchId: string,
  plan: SearchPlan,
): Promise<ActivityResult[]> {
  "use step";
  const startedAt = Date.now();
  const activities = await runActivitiesAgent(plan, 15);
  await Promise.all([
    mergeIntermediateResult(searchId, "activitiesCount", activities.length),
  ]);
  console.log(
    `[WorkflowTiming] search=${searchId} stage=activities duration_ms=${Date.now() - startedAt}`,
  );
  return activities;
}

async function runDiningStep(
  searchId: string,
  plan: SearchPlan,
): Promise<DiningResult[]> {
  "use step";
  const startedAt = Date.now();
  const dining = await runDiningAgent(plan, 12);
  await Promise.all([
    mergeIntermediateResult(searchId, "diningCount", dining.length),
  ]);
  console.log(
    `[WorkflowTiming] search=${searchId} stage=dining duration_ms=${Date.now() - startedAt}`,
  );
  return dining;
}

async function runTransportStep(
  searchId: string,
  plan: SearchPlan,
  travelers: number,
): Promise<TransportResult[]> {
  "use step";
  const startedAt = Date.now();
  const transport = await runTransportAgent(plan, travelers || 1, 5);
  await Promise.all([
    mergeIntermediateResult(searchId, "transportCount", transport.length),
  ]);
  console.log(
    `[WorkflowTiming] search=${searchId} stage=transport duration_ms=${Date.now() - startedAt}`,
  );
  return transport;
}

async function runEnrichmentStep(
  searchId: string,
  plan: SearchPlan,
): Promise<{
  activities: ActivityResult[];
  dining: DiningResult[];
  notes: string[];
}> {
  "use step";
  const startedAt = Date.now();
  const merged = await runSearchEnrichment(plan, searchId);
  await Promise.all([
    mergeIntermediateResult(
      searchId,
      "enrichedActivitiesCount",
      merged.activities.length,
    ),
    mergeIntermediateResult(
      searchId,
      "enrichedDiningCount",
      merged.dining.length,
    ),
    mergeIntermediateResult(searchId, "enrichmentNotes", merged.notes),
  ]);
  console.log(
    `[WorkflowTiming] search=${searchId} stage=enrichment duration_ms=${Date.now() - startedAt}`,
  );
  return merged;
}

async function aggregateItineraryStep(params: {
  searchId: string;
  tripId?: string;
  plan: SearchPlan;
  hotels: HotelResult[];
  activities: ActivityResult[];
  dining: DiningResult[];
  transport: TransportResult[];
  enrichmentNotes: string[];
}): Promise<MappedItinerary> {
  "use step";
  const startedAt = Date.now();
  const { days, topHotel } = await runAggregatorAgent(
    params.plan,
    params.hotels,
    params.activities,
    params.dining,
    params.transport,
  );

  const searchResults: SearchResults = {
    searchId: params.searchId,
    hotels: params.hotels,
    activities: params.activities,
    dining: params.dining,
    transport: params.transport,
    itinerary: days,
  };
  const mapped = mapSearchResultsToItinerary(
    searchResults,
    topHotel || params.hotels[0] || null,
  );

  await Promise.all([
    mergeIntermediateResult(params.searchId, "days", mapped.days),
    mergeIntermediateResult(params.searchId, "topHotel", mapped.topHotel),
    mergeIntermediateResult(
      params.searchId,
      "enrichmentNotes",
      params.enrichmentNotes,
    ),
    setProgressState(
      params.searchId,
      params.tripId,
      {
        orchestrator: "done",
        hotels: "done",
        activities: "done",
        dining: "done",
        transport: "done",
        enrichment: "done",
        aggregator: "done",
      },
      {
        step: "aggregator",
        progress: 90,
        message: "Itinerary composed. Saving now...",
      },
    ),
  ]);
  console.log(
    `[WorkflowTiming] search=${params.searchId} stage=aggregator duration_ms=${Date.now() - startedAt}`,
  );
  return mapped;
}

// ─── Step 3: Mark Itinerary Composed ────────────────────────────────────────

async function markItineraryComposed(
  searchId: string,
  tripId?: string,
): Promise<void> {
  "use step";

  console.log(`[Workflow] Step 3: Itinerary composed for ${searchId}`);

  await getSupabase()
    .from("searches")
    .update({
      progress: {
        orchestrator: "done",
        hotels: "done",
        activities: "done",
        dining: "done",
        transport: "done",
        enrichment: "done",
        aggregator: "done",
      },
    })
    .eq("id", searchId);

  if (tripId) {
    await applyGenerationUpdate(tripId, searchId, "progress", {
      trip_id: tripId,
      step: "composing",
      progress: 85,
      message: "Finalizing your itinerary...",
      updated_at: new Date().toISOString(),
    });
  }
}

// ─── Step 4: Build Spec & Save ──────────────────────────────────────────────

async function buildAndSaveSpec(
  searchId: string,
  result: MappedItinerary,
  meta: {
    tripId?: string;
    destination: string;
    startDate: string;
    endDate: string;
    travelers: number;
    adults?: number;
    children?: number;
    interests?: string[];
    budget?: string;
    userId?: string;
  },
): Promise<void> {
  "use step";

  console.log(`[Workflow] Step 4: Building spec and saving for ${searchId}`);

  // Map hotels for build-spec
  const hotelInputs = result.hotels.map((h) => ({
    id: h.id,
    name: h.name,
    rating: h.userRating,
    reviewCount: h.reviewCount,
    pricePerNight: h.pricePerNight,
    currency: h.currency,
    amenities: h.amenities,
    description: h.description,
    affiliateUrl: h.affiliateUrl,
    images: h.images,
  }));

  // Map activities for build-spec
  const activityInputs = result.activities.map((a) => ({
    ...viatorContentMetadata(a),
    id: a.id,
    name: a.name,
    description: a.description,
    duration: a.duration,
    price: a.price,
    priceStatus: a.priceStatus,
    currency: a.currency,
    rating: a.rating,
    reviewCount: a.reviewCount,
    category: a.category,
    affiliateUrl: a.affiliateUrl,
    images: a.images,
    location: {
      name: a.location?.name,
      neighborhood: a.location?.neighborhood,
      city: a.location?.name,
    },
  }));

  // Map restaurants for build-spec
  const restaurantInputs = result.dining.map((d) => ({
    id: d.id,
    name: d.name,
    cuisine: d.cuisineTypes.join(", "),
    priceLevel: d.priceLevel,
    priceStatus: d.priceStatus,
    rating: d.rating,
    reviewCount: d.reviewCount,
    description: d.description,
    reservationUrl: d.reservationUrl,
    images: d.images,
  }));

  // Map days for build-spec: each slot's meals[0] → meal
  const dayInputs = result.days.map((day) => ({
    dayNumber: day.dayNumber,
    date: day.date,
    title: day.title,
    morning: {
      activities: day.morning.activities.map((a: ItineraryActivity) => ({
        ...viatorContentMetadata(a),
        id: a.id,
        name: a.name,
        description: a.description,
        duration: a.duration / 60, // minutes → hours for build-spec
        price: a.estimatedCost.amount,
        priceStatus: a.estimatedCost.status,
        currency: a.estimatedCost.currency,
        rating: undefined,
        category: a.category,
        affiliateUrl: a.bookingInfo?.bookingUrl,
        location: { name: a.location.name },
      })),
      meal: day.morning.meals[0]
        ? {
            name: day.morning.meals[0].name,
            cuisine: day.morning.meals[0].cuisineType.join(", "),
            priceLevel: day.morning.meals[0].priceLevel,
            priceStatus: day.morning.meals[0].estimatedCost.status,
            rating: undefined,
            description: day.morning.meals[0].description,
            reservationUrl: day.morning.meals[0].reservationInfo?.url,
          }
        : undefined,
    },
    afternoon: {
      activities: day.afternoon.activities.map((a: ItineraryActivity) => ({
        ...viatorContentMetadata(a),
        id: a.id,
        name: a.name,
        description: a.description,
        duration: a.duration / 60,
        price: a.estimatedCost.amount,
        priceStatus: a.estimatedCost.status,
        currency: a.estimatedCost.currency,
        rating: undefined,
        category: a.category,
        affiliateUrl: a.bookingInfo?.bookingUrl,
        location: { name: a.location.name },
      })),
      meal: day.afternoon.meals[0]
        ? {
            name: day.afternoon.meals[0].name,
            cuisine: day.afternoon.meals[0].cuisineType.join(", "),
            priceLevel: day.afternoon.meals[0].priceLevel,
            priceStatus: day.afternoon.meals[0].estimatedCost.status,
            rating: undefined,
            description: day.afternoon.meals[0].description,
            reservationUrl: day.afternoon.meals[0].reservationInfo?.url,
          }
        : undefined,
    },
    evening: {
      activities: day.evening.activities.map((a: ItineraryActivity) => ({
        ...viatorContentMetadata(a),
        id: a.id,
        name: a.name,
        description: a.description,
        duration: a.duration / 60,
        price: a.estimatedCost.amount,
        priceStatus: a.estimatedCost.status,
        currency: a.estimatedCost.currency,
        rating: undefined,
        category: a.category,
        affiliateUrl: a.bookingInfo?.bookingUrl,
        location: { name: a.location.name },
      })),
      meal: day.evening.meals[0]
        ? {
            name: day.evening.meals[0].name,
            cuisine: day.evening.meals[0].cuisineType.join(", "),
            priceLevel: day.evening.meals[0].priceLevel,
            priceStatus: day.evening.meals[0].estimatedCost.status,
            rating: undefined,
            description: day.evening.meals[0].description,
            reservationUrl: day.evening.meals[0].reservationInfo?.url,
          }
        : undefined,
    },
    estimatedCost: day.totalEstimatedCost?.amount,
    currency: day.totalEstimatedCost?.currency,
  }));

  // Build the json-render spec
  const specInput: BuildSpecInput = {
    destination: meta.destination,
    startDate: meta.startDate,
    endDate: meta.endDate,
    travelers: meta.travelers,
    budget: meta.budget,
    hotels: hotelInputs,
    activities: activityInputs,
    restaurants: restaurantInputs,
    days: dayInputs,
    topHotel: result.topHotel
      ? {
          id: result.topHotel.id,
          name: result.topHotel.name,
          rating: result.topHotel.userRating,
          reviewCount: result.topHotel.reviewCount,
          pricePerNight: result.topHotel.pricePerNight,
          currency: result.topHotel.currency,
          amenities: result.topHotel.amenities,
          description: result.topHotel.description,
          affiliateUrl: result.topHotel.affiliateUrl,
          images: result.topHotel.images,
          starRating: result.topHotel.starRating,
        }
      : undefined,
    totalEstimatedCost: result.totalEstimatedCost,
    currency: result.currency,
    summary: `Your personalized ${result.days.length}-day trip to ${meta.destination}`,
  };

  const jsonRenderSpec = buildJsonRenderSpec(specInput);

  // Save search results to database
  await saveSearchResults(searchId, result);

  // Save the json-render spec and mark as completed. Keep intermediate results
  // so reconnecting SSE clients can still hydrate final itinerary events.
  await getSupabase()
    .from("searches")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      json_render_spec: jsonRenderSpec,
      progress: {
        orchestrator: "done",
        hotels: "done",
        activities: "done",
        dining: "done",
        transport: "done",
        enrichment: "done",
        aggregator: "done",
      },
    })
    .eq("id", searchId);

  // ── Bridge to itineraries table (for web trip detail page) ────────
  if (meta.tripId) {
    await bridgeToItineraries(searchId, meta.tripId, meta.userId, result, meta);
  }

  console.log(`[Workflow] Step 4 complete – search ${searchId} done`);
}

/**
 * Bridge search results to the itineraries table so the existing web trip
 * detail page can still render via the traditional itinerary format.
 * Also marks the trip as 'planned' and sends a completion notification.
 */
async function bridgeToItineraries(
  searchId: string,
  tripId: string,
  userId: string | undefined,
  result: MappedItinerary,
  meta: { destination: string; startDate: string; endDate: string },
): Promise<void> {
  // The bridge output (result.days) is already in TripDay format with
  // proper { activities: ItineraryActivity[], meals: Restaurant[] } structure
  // thanks to mapSearchResultsToItinerary, so we can use them directly.
  const itineraryDays = result.days.map((day) => ({
    dayNumber: day.dayNumber,
    date: day.date,
    title: day.title,
    summary: day.summary || `Day ${day.dayNumber} in ${meta.destination}`,
    morning: day.morning,
    afternoon: day.afternoon,
    evening: day.evening,
    transport: day.transport,
    hotel: day.hotel,
    totalEstimatedCost: day.totalEstimatedCost,
    tips: day.tips || [],
  }));

  const itineraryPayload = {
    trip_id: tripId,
    user_id: userId || null,
    destination: meta.destination,
    start_date: meta.startDate,
    end_date: meta.endDate,
    overview: `Your personalized trip to ${meta.destination}`,
    total_cost: result.totalEstimatedCost || 0,
    days: itineraryDays,
    packing_list: [],
    general_tips: [],
    generated_at: new Date().toISOString(),
  };
  await applyGenerationUpdate(tripId, searchId, "planned", itineraryPayload);

  console.log(`[Workflow] Bridged itinerary for trip ${tripId}`);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function setProgressState(
  searchId: string,
  tripId: string | undefined,
  progress: Record<string, string>,
  workflow?: {
    step: string;
    progress: number;
    message: string;
  },
): Promise<void> {
  "use step";
  const db = getSupabase();
  await db.from("searches").update({ progress }).eq("id", searchId);

  if (!tripId || !workflow) return;
  await applyGenerationUpdate(tripId, searchId, "progress", {
    trip_id: tripId,
    step: workflow.step,
    progress: workflow.progress,
    message: workflow.message,
    updated_at: new Date().toISOString(),
  });
}

async function updateSearchStatus(
  searchId: string,
  status: string,
  progress: Record<string, string>,
  errorMessage?: string,
): Promise<void> {
  "use step";

  const update: Record<string, unknown> = { status };

  if (Object.keys(progress).length > 0) {
    update.progress = progress;
  }

  if (status === "completed") {
    update.completed_at = new Date().toISOString();
  }

  if (errorMessage) {
    update.error_message = errorMessage;
  }

  await getSupabase().from("searches").update(update).eq("id", searchId);
}

export async function saveSearchResults(
  searchId: string,
  result: MappedItinerary,
): Promise<void> {
  // Validate before writing results or marking this search completed. Reloads
  // correlate slot metadata by the day number/date pair.
  const dayIdentities = new Set<string>();
  for (const day of result.days) {
    const identity = JSON.stringify([day.dayNumber, day.date]);
    if (dayIdentities.has(identity))
      throw new Error("Search itinerary has duplicate day identities");
    dayIdentities.add(identity);
  }

  // Build all result rows and batch insert
  const resultRows = [
    ...(result.hotels || []).map((hotel) => ({
      search_id: searchId,
      category: "hotel" as const,
      name: hotel.name,
      description: `${hotel.userRating?.toFixed(1)} stars, ${hotel.reviewCount} reviews`,
      data: hotel,
      affiliate_url: hotel.affiliateUrl,
      affiliate_partner: hotel.affiliatePartner,
      price_amount: hotel.pricePerNight,
      price_currency: hotel.currency || "USD",
      rating: hotel.userRating,
    })),
    ...(result.activities || []).map((activity) => ({
      search_id: searchId,
      category: "activity" as const,
      name: activity.name,
      description: activity.description,
      data: activity,
      affiliate_url: activity.affiliateUrl,
      affiliate_partner: activity.affiliatePartner,
      price_amount: activity.price,
      price_currency: activity.currency || "USD",
      rating: activity.rating,
    })),
    ...(result.dining || []).map((restaurant) => ({
      search_id: searchId,
      category: "dining" as const,
      name: restaurant.name,
      description: restaurant.description,
      data: restaurant,
      affiliate_url: restaurant.reservationUrl,
      affiliate_partner: restaurant.affiliatePartner,
      rating: restaurant.rating,
    })),
    ...(result.transport || []).map((transport) => ({
      search_id: searchId,
      category: "transport" as const,
      name: `${transport.departure.airport} to ${transport.arrival.airport}`,
      description: `${transport.provider}, ${transport.stops} stop${transport.stops === 1 ? "" : "s"}`,
      data: transport,
      affiliate_url: transport.affiliateUrl,
      affiliate_partner: transport.affiliatePartner,
      price_amount: transport.price,
      price_currency: transport.currency || "USD",
      rating: null,
    })),
  ];

  const resultIds = new Map<string, string | null>();
  const resultKey = (category: string, id: unknown) =>
    JSON.stringify([category, id]);
  if (resultRows.length > 0) {
    const { data: inserted, error } = await getSupabase()
      .from("search_results")
      .insert(resultRows)
      .select("id, category, data");
    if (error) throw new Error("Search results could not be saved");
    for (const row of inserted ?? []) {
      if (typeof row.data?.id !== "string") continue;
      const key = resultKey(row.category, row.data.id);
      // A logical identity must resolve to exactly one inserted result row.
      resultIds.set(key, resultIds.has(key) ? null : row.id);
    }
  }
  const reference = (category: string, id: unknown) => {
    const rowId = resultIds.get(resultKey(category, id));
    if (
      !rowId ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        rowId,
      )
    )
      throw new Error(
        `Search itinerary has a missing or ambiguous ${category} reference`,
      );
    return rowId;
  };

  const transportReference = (day: MappedItinerary["days"][number]) => {
    if (!day.transport) return null;
    if (day.transport.id !== undefined)
      return reference("transport", day.transport.id);
    // Durable checkpoints from older workers contain only the display projection.
    const matches = result.transport.filter((candidate) =>
      matchesTransportProjection(candidate, day.transport!),
    );
    if (matches.length !== 1)
      throw new Error(
        "Search itinerary has a missing or ambiguous transport reference",
      );
    return reference("transport", matches[0].id);
  };

  // Save itinerary days (batch)
  if (result.days.length > 0) {
    const itineraryRows = result.days.map((day) => ({
      search_id: searchId,
      day_number: day.dayNumber,
      hotel_id: day.hotel ? reference("hotel", day.hotel.id) : null,
      transport_id: transportReference(day),
      date: day.date,
      title: day.title,
      summary: day.summary,
      morning_activities: day.morning.activities.map((a: ItineraryActivity) =>
        reference("activity", a.id),
      ),
      afternoon_activities: day.afternoon.activities.map(
        (a: ItineraryActivity) => reference("activity", a.id),
      ),
      evening_activities: day.evening.activities.map((a: ItineraryActivity) =>
        reference("activity", a.id),
      ),
      meals: [
        ...day.morning.meals.map((m: FarowayRestaurant) =>
          reference("dining", m.id),
        ),
        ...day.afternoon.meals.map((m: FarowayRestaurant) =>
          reference("dining", m.id),
        ),
        ...day.evening.meals.map((m: FarowayRestaurant) =>
          reference("dining", m.id),
        ),
      ],
      estimated_cost: day.totalEstimatedCost?.amount ?? null,
      cost_currency: day.totalEstimatedCost?.currency || "USD",
      tips: day.tips || [],
    }));

    const { error } = await getSupabase()
      .from("search_itineraries")
      .insert(itineraryRows);
    if (error) throw new Error("Search itinerary could not be saved");
  }
}

async function notifyItineraryReadyStep(tripId: string, searchId: string) {
  "use step";
  const { dispatchItineraryReady } =
    await import("@/lib/notifications/itinerary-dispatch");
  return dispatchItineraryReady(tripId, searchId);
}
