/**
 * Trip Planning Workflow
 * Uses Vercel Workflow for durable execution with granular steps.
 *
 * Steps:
 *   1. createSearchPlan  – AI analyzes input and creates a search plan
 *   2. searchAffiliates  – Calls Booking.com + Viator (+ dining) in parallel
 *   3. composeItinerary  – AI organizes results into day-by-day plan
 *   4. buildAndSaveSpec  – Builds json-render spec, saves everything to Supabase
 */

import { planTrip, TravelPlanResult } from '@/lib/agents/travel-agent';
import { buildJsonRenderSpec, BuildSpecInput } from '@/lib/json-render/build-spec';
import { getSupabase } from '@/lib/supabase/server';

// Types
interface TripPlanInput {
  searchId: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  vibes?: string[];
  budget?: string;
  userId?: string;
}

interface TripPlanOutput {
  searchId: string;
  status: 'completed' | 'error';
  result?: TravelPlanResult;
  error?: string;
}

/**
 * Main workflow function – orchestrates the trip planning process
 */
export async function planTripWorkflow(input: TripPlanInput): Promise<TripPlanOutput> {
  'use workflow';

  const { searchId, destination, startDate, endDate, travelers, vibes, budget, userId } = input;

  try {
    // ── Step 1: Create Search Plan ──────────────────────────────────
    await createSearchPlan(searchId, { destination, vibes, budget });

    // ── Step 2: Search Affiliates ───────────────────────────────────
    const result = await searchAffiliates({
      searchId,
      destination,
      startDate,
      endDate,
      travelers,
      vibes,
      budget,
    });

    // ── Step 3: Compose Itinerary (already done by the agent) ──────
    await markItineraryComposed(searchId);

    // ── Step 4: Build spec + save to database ──────────────────────
    await buildAndSaveSpec(searchId, result, {
      destination,
      startDate,
      endDate,
      travelers,
      budget,
      userId,
    });

    return {
      searchId,
      status: 'completed',
      result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await updateSearchStatus(searchId, 'error', {}, errorMessage);

    return {
      searchId,
      status: 'error',
      error: errorMessage,
    };
  }
}

// ─── Step 1: Create Search Plan ─────────────────────────────────────────────

async function createSearchPlan(
  searchId: string,
  params: { destination: string; vibes?: string[]; budget?: string },
): Promise<void> {
  'use step';

  console.log(`[Workflow] Step 1: Creating search plan for ${params.destination}`);

  await getSupabase()
    .from('searches')
    .update({
      status: 'searching',
      progress: {
        orchestrator: 'searching',
        hotels: 'pending',
        activities: 'pending',
        dining: 'pending',
        aggregator: 'pending',
      },
    })
    .eq('id', searchId);

  // The AI agent will handle the search plan as part of its tool loop,
  // so this step mainly signals that orchestration has begun.
  await getSupabase()
    .from('searches')
    .update({
      progress: {
        orchestrator: 'done',
        hotels: 'pending',
        activities: 'pending',
        dining: 'pending',
        aggregator: 'pending',
      },
    })
    .eq('id', searchId);

  console.log(`[Workflow] Step 1 complete for search ${searchId}`);
}

// ─── Step 2: Search Affiliates ──────────────────────────────────────────────

async function searchAffiliates(params: {
  searchId: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  vibes?: string[];
  budget?: string;
}): Promise<TravelPlanResult> {
  'use step';

  const { searchId, destination, startDate, endDate, travelers, vibes, budget } = params;

  console.log(`[Workflow] Step 2: Running affiliate searches for ${searchId}`);

  // Mark affiliate searches as in-progress
  await getSupabase()
    .from('searches')
    .update({
      progress: {
        orchestrator: 'done',
        hotels: 'searching',
        activities: 'searching',
        dining: 'searching',
        aggregator: 'pending',
      },
    })
    .eq('id', searchId);

  // The travel planning agent internally calls searchHotels, searchActivities,
  // and searchDining tools which now use real Booking.com + Viator APIs
  // with graceful fallback to mock data.
  const result = await planTrip({
    destination,
    startDate,
    endDate,
    travelers,
    vibes,
    budget,
  });

  // Mark affiliate searches as done
  await getSupabase()
    .from('searches')
    .update({
      progress: {
        orchestrator: 'done',
        hotels: 'done',
        activities: 'done',
        dining: 'done',
        aggregator: 'pending',
      },
    })
    .eq('id', searchId);

  console.log(`[Workflow] Step 2 complete for search ${searchId}`);

  return result;
}

// ─── Step 3: Mark Itinerary Composed ────────────────────────────────────────

async function markItineraryComposed(searchId: string): Promise<void> {
  'use step';

  console.log(`[Workflow] Step 3: Itinerary composed for ${searchId}`);

  await getSupabase()
    .from('searches')
    .update({
      progress: {
        orchestrator: 'done',
        hotels: 'done',
        activities: 'done',
        dining: 'done',
        aggregator: 'searching',
      },
    })
    .eq('id', searchId);
}

// ─── Step 4: Build Spec & Save ──────────────────────────────────────────────

async function buildAndSaveSpec(
  searchId: string,
  result: TravelPlanResult,
  meta: {
    destination: string;
    startDate: string;
    endDate: string;
    travelers: number;
    budget?: string;
    userId?: string;
  },
): Promise<void> {
  'use step';

  console.log(`[Workflow] Step 4: Building spec and saving for ${searchId}`);

  // Build the json-render spec from the agent's results
  const specInput: BuildSpecInput = {
    destination: meta.destination,
    startDate: meta.startDate,
    endDate: meta.endDate,
    travelers: meta.travelers,
    budget: meta.budget,
    hotels: result.hotels || [],
    activities: result.activities || [],
    restaurants: result.restaurants || [],
    days: result.itinerary?.days || [],
    totalEstimatedCost: result.itinerary?.totalEstimatedCost,
    currency: result.itinerary?.currency,
    summary: result.summary,
  };

  const jsonRenderSpec = buildJsonRenderSpec(specInput);

  // Save search results to database
  await saveSearchResults(searchId, result);

  // Save the json-render spec and mark as completed
  await getSupabase()
    .from('searches')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      json_render_spec: jsonRenderSpec,
      progress: {
        orchestrator: 'done',
        hotels: 'done',
        activities: 'done',
        dining: 'done',
        aggregator: 'done',
      },
    })
    .eq('id', searchId);

  console.log(`[Workflow] Step 4 complete – search ${searchId} done`);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function updateSearchStatus(
  searchId: string,
  status: string,
  progress: Record<string, string>,
  errorMessage?: string,
): Promise<void> {
  'use step';

  const update: Record<string, unknown> = { status };

  if (Object.keys(progress).length > 0) {
    update.progress = progress;
  }

  if (status === 'completed') {
    update.completed_at = new Date().toISOString();
  }

  if (errorMessage) {
    update.error_message = errorMessage;
  }

  await getSupabase().from('searches').update(update).eq('id', searchId);
}

async function saveSearchResults(
  searchId: string,
  result: TravelPlanResult,
): Promise<void> {
  // Build all result rows and batch insert
  const resultRows = [
    ...(result.hotels || []).map(hotel => ({
      search_id: searchId,
      category: 'hotel' as const,
      name: hotel.name,
      description: `${hotel.rating?.toFixed(1)} stars, ${hotel.reviewCount} reviews`,
      data: hotel,
      affiliate_url: hotel.affiliateUrl,
      affiliate_partner: hotel.affiliatePartner,
      price_amount: hotel.pricePerNight,
      price_currency: hotel.currency || 'USD',
      rating: hotel.rating,
    })),
    ...(result.activities || []).map(activity => ({
      search_id: searchId,
      category: 'activity' as const,
      name: activity.name,
      description: activity.description,
      data: activity,
      affiliate_url: activity.affiliateUrl,
      affiliate_partner: activity.affiliatePartner,
      price_amount: activity.price,
      price_currency: activity.currency || 'USD',
      rating: activity.rating,
    })),
    ...(result.restaurants || []).map(restaurant => ({
      search_id: searchId,
      category: 'dining' as const,
      name: restaurant.name,
      description: restaurant.description,
      data: restaurant,
      affiliate_url: restaurant.reservationUrl,
      affiliate_partner: restaurant.affiliatePartner,
      rating: restaurant.rating,
    })),
  ];

  if (resultRows.length > 0) {
    await getSupabase().from('search_results').insert(resultRows);
  }

  // Save itinerary days (batch)
  if (result.itinerary?.days?.length) {
    const itineraryRows = result.itinerary.days.map(day => ({
      search_id: searchId,
      day_number: day.dayNumber,
      date: day.date,
      title: day.title,
      summary: `Day ${day.dayNumber} in ${result.itinerary!.destination}`,
      morning_activities: day.morning?.activities?.map((a: any) => a.id) || [],
      afternoon_activities: day.afternoon?.activities?.map((a: any) => a.id) || [],
      evening_activities: day.evening?.activities?.map((a: any) => a.id) || [],
      meals: [day.morning?.meal?.id, day.afternoon?.meal?.id, day.evening?.meal?.id].filter(Boolean),
      estimated_cost: day.estimatedCost,
      cost_currency: day.currency || 'USD',
      tips: day.tips || [],
    }));

    await getSupabase().from('search_itineraries').insert(itineraryRows);
  }
}
