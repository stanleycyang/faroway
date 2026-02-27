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

import { executeTravelSearch } from '@/lib/search/workflow';
import { mapSearchResultsToItinerary, type MappedItinerary } from '@/lib/search/bridge';
import { buildJsonRenderSpec, BuildSpecInput } from '@/lib/json-render/build-spec';
import { getSupabase } from '@/lib/supabase/server';
import type { SearchInput, TripDay, ItineraryActivity, Restaurant as FarowayRestaurant } from '@faroway/types';

// Types
interface TripPlanInput {
  searchId: string;
  tripId?: string;
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
  tripId?: string;
  status: 'completed' | 'error';
  result?: MappedItinerary;
  error?: string;
}

/**
 * Main workflow function – orchestrates the trip planning process
 */
export async function planTripWorkflow(input: TripPlanInput): Promise<TripPlanOutput> {
  'use workflow';

  const { searchId, tripId, destination, startDate, endDate, travelers, vibes, budget, userId } = input;

  try {
    // ── Step 1: Create Search Plan ──────────────────────────────────
    await createSearchPlan(searchId, tripId, { destination, vibes, budget });

    // ── Step 2: Search Affiliates ───────────────────────────────────
    const result = await searchAffiliates({
      searchId,
      tripId,
      destination,
      startDate,
      endDate,
      travelers,
      vibes,
      budget,
    });

    // ── Step 3: Compose Itinerary (already done by the aggregator agent) ──────
    await markItineraryComposed(searchId, tripId);

    // ── Step 4: Build spec + save to database ──────────────────────
    await buildAndSaveSpec(searchId, result, {
      tripId,
      destination,
      startDate,
      endDate,
      travelers,
      budget,
      userId,
    });

    return {
      searchId,
      tripId,
      status: 'completed',
      result,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await updateSearchStatus(searchId, 'error', {}, errorMessage);

    // Also update trip status if we have a tripId
    if (tripId) {
      await getSupabase()
        .from('trips')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', tripId);

      // Update workflow_progress for backward compat
      await getSupabase()
        .from('workflow_progress')
        .upsert({
          trip_id: tripId,
          step: 'error',
          progress: 0,
          message: errorMessage,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'trip_id' });
    }

    return {
      searchId,
      tripId,
      status: 'error',
      error: errorMessage,
    };
  }
}

// ─── Step 1: Create Search Plan ─────────────────────────────────────────────

async function createSearchPlan(
  searchId: string,
  tripId: string | undefined,
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

  // Update workflow_progress for trip-based polling
  if (tripId) {
    await getSupabase()
      .from('workflow_progress')
      .upsert({
        trip_id: tripId,
        step: 'orchestrator',
        progress: 5,
        message: 'Analyzing your preferences...',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'trip_id' });
  }

  console.log(`[Workflow] Step 1 complete for search ${searchId}`);
}

// ─── Step 2: Search Affiliates ──────────────────────────────────────────────

async function searchAffiliates(params: {
  searchId: string;
  tripId?: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  vibes?: string[];
  budget?: string;
}): Promise<MappedItinerary> {
  'use step';

  const { searchId, tripId, destination, startDate, endDate, travelers, vibes, budget } = params;

  console.log(`[Workflow] Step 2: Running multi-agent search for ${searchId}`);

  // Construct SearchInput for the multi-agent system
  const searchInput: SearchInput = {
    destination,
    startDate,
    endDate,
    travelers,
    vibes: vibes || [],
    budget: (budget as 'budget' | 'moderate' | 'luxury') || 'moderate',
  };

  // Persistent progress state — survives across parallel onProgress calls
  const progressState: Record<string, string> = {
    orchestrator: 'done',
    hotels: 'pending',
    activities: 'pending',
    dining: 'pending',
    aggregator: 'pending',
  };

  const onProgress = async (stage: string, status: 'searching' | 'done') => {
    progressState[stage] = status;

    await getSupabase()
      .from('searches')
      .update({ progress: { ...progressState } })
      .eq('id', searchId);

    // Map stage → progress percentage for trip polling
    if (tripId) {
      const progressMap: Record<string, number> = {
        orchestrator: 10,
        hotels: 30,
        activities: 40,
        dining: 50,
        aggregator: 70,
      };
      const messageMap: Record<string, string> = {
        orchestrator: 'Analyzing your preferences...',
        hotels: 'Searching for the best hotels...',
        activities: 'Finding activities & attractions...',
        dining: 'Discovering restaurants...',
        aggregator: 'Crafting your perfect itinerary...',
      };

      await getSupabase()
        .from('workflow_progress')
        .upsert({
          trip_id: tripId,
          step: stage,
          progress: progressMap[stage] || 30,
          message: messageMap[stage] || 'Searching...',
          updated_at: new Date().toISOString(),
        }, { onConflict: 'trip_id' });
    }
  };

  // Callback: save intermediate results for progressive SSE streaming
  const onAgentResult = async (stage: string, data: unknown) => {
    const db = getSupabase();
    if (stage === 'hotels') {
      await db.rpc('merge_intermediate_results', {
        p_search_id: searchId,
        p_key: 'hotels',
        p_value: JSON.stringify(data),
      });
    } else if (stage === 'activities') {
      await db.rpc('merge_intermediate_results', {
        p_search_id: searchId,
        p_key: 'activitiesCount',
        p_value: JSON.stringify((data as unknown[]).length),
      });
    } else if (stage === 'dining') {
      await db.rpc('merge_intermediate_results', {
        p_search_id: searchId,
        p_key: 'diningCount',
        p_value: JSON.stringify((data as unknown[]).length),
      });
    } else if (stage === 'aggregator') {
      const { days, topHotel } = data as { days: unknown[]; topHotel: unknown };
      await db.rpc('merge_intermediate_results', {
        p_search_id: searchId,
        p_key: 'days',
        p_value: JSON.stringify(days),
      });
      if (topHotel) {
        await db.rpc('merge_intermediate_results', {
          p_search_id: searchId,
          p_key: 'topHotel',
          p_value: JSON.stringify(topHotel),
        });
      }
    }
  };

  // Run the multi-agent system
  const searchResult = await executeTravelSearch(searchId, searchInput, { onProgress, onAgentResult });

  if (searchResult.status === 'error' || !searchResult.results) {
    throw new Error(searchResult.error || 'Multi-agent search failed');
  }

  // Extract top hotel from the itinerary days (the aggregator picks it)
  const topHotel = searchResult.results.itinerary?.[0]?.hotel || searchResult.results.hotels[0] || null;

  // Bridge search results → frontend TripDay format
  const mapped = mapSearchResultsToItinerary(searchResult.results, topHotel);

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

  console.log(`[Workflow] Step 2 complete for search ${searchId} — ${mapped.days.length} days`);

  return mapped;
}

// ─── Step 3: Mark Itinerary Composed ────────────────────────────────────────

async function markItineraryComposed(searchId: string, tripId?: string): Promise<void> {
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
        aggregator: 'done',
      },
    })
    .eq('id', searchId);

  if (tripId) {
    await getSupabase()
      .from('workflow_progress')
      .upsert({
        trip_id: tripId,
        step: 'composing',
        progress: 85,
        message: 'Finalizing your itinerary...',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'trip_id' });
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
    budget?: string;
    userId?: string;
  },
): Promise<void> {
  'use step';

  console.log(`[Workflow] Step 4: Building spec and saving for ${searchId}`);

  // Map hotels for build-spec
  const hotelInputs = result.hotels.map(h => ({
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
  const activityInputs = result.activities.map(a => ({
    id: a.id,
    name: a.name,
    description: a.description,
    duration: a.duration,
    price: a.price,
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
  const restaurantInputs = result.dining.map(d => ({
    id: d.id,
    name: d.name,
    cuisine: d.cuisineTypes.join(', '),
    priceLevel: d.priceLevel,
    rating: d.rating,
    reviewCount: d.reviewCount,
    description: d.description,
    reservationUrl: d.reservationUrl,
    images: d.images,
  }));

  // Map days for build-spec: each slot's meals[0] → meal
  const dayInputs = result.days.map((day: TripDay) => ({
    dayNumber: day.dayNumber,
    date: day.date,
    title: day.title,
    morning: {
      activities: day.morning.activities.map((a: ItineraryActivity) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        duration: a.duration / 60, // minutes → hours for build-spec
        price: a.estimatedCost.amount,
        currency: a.estimatedCost.currency,
        rating: undefined,
        category: a.category,
        affiliateUrl: a.bookingInfo?.bookingUrl,
        location: { name: a.location.name },
      })),
      meal: day.morning.meals[0]
        ? {
            name: day.morning.meals[0].name,
            cuisine: day.morning.meals[0].cuisineType.join(', '),
            priceLevel: day.morning.meals[0].priceLevel,
            rating: undefined,
            description: day.morning.meals[0].description,
            reservationUrl: day.morning.meals[0].reservationInfo?.url,
          }
        : undefined,
    },
    afternoon: {
      activities: day.afternoon.activities.map((a: ItineraryActivity) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        duration: a.duration / 60,
        price: a.estimatedCost.amount,
        currency: a.estimatedCost.currency,
        rating: undefined,
        category: a.category,
        affiliateUrl: a.bookingInfo?.bookingUrl,
        location: { name: a.location.name },
      })),
      meal: day.afternoon.meals[0]
        ? {
            name: day.afternoon.meals[0].name,
            cuisine: day.afternoon.meals[0].cuisineType.join(', '),
            priceLevel: day.afternoon.meals[0].priceLevel,
            rating: undefined,
            description: day.afternoon.meals[0].description,
            reservationUrl: day.afternoon.meals[0].reservationInfo?.url,
          }
        : undefined,
    },
    evening: {
      activities: day.evening.activities.map((a: ItineraryActivity) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        duration: a.duration / 60,
        price: a.estimatedCost.amount,
        currency: a.estimatedCost.currency,
        rating: undefined,
        category: a.category,
        affiliateUrl: a.bookingInfo?.bookingUrl,
        location: { name: a.location.name },
      })),
      meal: day.evening.meals[0]
        ? {
            name: day.evening.meals[0].name,
            cuisine: day.evening.meals[0].cuisineType.join(', '),
            priceLevel: day.evening.meals[0].priceLevel,
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

  // Save the json-render spec, mark as completed, and clear intermediate results
  await getSupabase()
    .from('searches')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
      json_render_spec: jsonRenderSpec,
      intermediate_results: null,
      progress: {
        orchestrator: 'done',
        hotels: 'done',
        activities: 'done',
        dining: 'done',
        aggregator: 'done',
      },
    })
    .eq('id', searchId);

  // ── Bridge to itineraries table (for web trip detail page) ────────
  if (meta.tripId) {
    await bridgeToItineraries(searchId, meta.tripId, meta.userId, result, meta);
  }

  console.log(`[Workflow] Step 4 complete – search ${searchId} done`);
}

/**
 * Bridge search results to the itineraries table so the existing web trip
 * detail page can still render via the traditional itinerary format.
 * Also marks the trip as 'generated' and sends a completion notification.
 */
async function bridgeToItineraries(
  searchId: string,
  tripId: string,
  userId: string | undefined,
  result: MappedItinerary,
  meta: { destination: string; startDate: string; endDate: string },
): Promise<void> {
  const db = getSupabase();

  // The bridge output (result.days) is already in TripDay format with
  // proper { activities: ItineraryActivity[], meals: Restaurant[] } structure
  // thanks to mapSearchResultsToItinerary, so we can use them directly.
  const itineraryDays = result.days.map(day => ({
    dayNumber: day.dayNumber,
    date: day.date,
    title: day.title,
    summary: day.summary || `Day ${day.dayNumber} in ${meta.destination}`,
    morning: day.morning,
    afternoon: day.afternoon,
    evening: day.evening,
    totalEstimatedCost: day.totalEstimatedCost,
    tips: day.tips || [],
  }));

  // Insert itinerary
  const { data: savedItinerary, error: insertError } = await db
    .from('itineraries')
    .insert({
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
    })
    .select('id')
    .single();

  if (insertError) {
    console.error(`[Workflow] Failed to bridge itinerary: ${insertError.message}`);
    // Non-fatal — search results are already saved
  }

  // Update trip status to generated
  await db
    .from('trips')
    .update({
      status: 'generated',
      itinerary_id: savedItinerary?.id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tripId);

  // Update workflow_progress to 100%
  await db
    .from('workflow_progress')
    .upsert({
      trip_id: tripId,
      step: 'complete',
      progress: 100,
      message: 'Your itinerary is ready!',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'trip_id' });

  // Update workflow run status
  await db
    .from('workflow_runs')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('trip_id', tripId)
    .eq('status', 'running');

  // Insert notification (only for authenticated users)
  if (userId && savedItinerary) {
    await db
      .from('notifications')
      .insert({
        user_id: userId,
        type: 'itinerary_ready',
        title: 'Your Itinerary is Ready!',
        message: `Your trip itinerary to ${meta.destination} has been generated and is ready to view.`,
        data: {
          trip_id: tripId,
          itinerary_id: savedItinerary.id,
          search_id: searchId,
        },
        read: false,
      });
  }

  console.log(`[Workflow] Bridged itinerary for trip ${tripId}`);
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
  result: MappedItinerary,
): Promise<void> {
  // Build all result rows and batch insert
  const resultRows = [
    ...(result.hotels || []).map(hotel => ({
      search_id: searchId,
      category: 'hotel' as const,
      name: hotel.name,
      description: `${hotel.userRating?.toFixed(1)} stars, ${hotel.reviewCount} reviews`,
      data: hotel,
      affiliate_url: hotel.affiliateUrl,
      affiliate_partner: hotel.affiliatePartner,
      price_amount: hotel.pricePerNight,
      price_currency: hotel.currency || 'USD',
      rating: hotel.userRating,
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
    ...(result.dining || []).map(restaurant => ({
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
  if (result.days.length > 0) {
    const itineraryRows = result.days.map((day: TripDay) => ({
      search_id: searchId,
      day_number: day.dayNumber,
      date: day.date,
      title: day.title,
      summary: day.summary,
      morning_activities: day.morning.activities.map((a: ItineraryActivity) => a.id),
      afternoon_activities: day.afternoon.activities.map((a: ItineraryActivity) => a.id),
      evening_activities: day.evening.activities.map((a: ItineraryActivity) => a.id),
      meals: [
        ...day.morning.meals.map((m: FarowayRestaurant) => m.id),
        ...day.afternoon.meals.map((m: FarowayRestaurant) => m.id),
        ...day.evening.meals.map((m: FarowayRestaurant) => m.id),
      ].filter(Boolean),
      estimated_cost: day.totalEstimatedCost?.amount || 0,
      cost_currency: day.totalEstimatedCost?.currency || 'USD',
      tips: day.tips || [],
    }));

    await getSupabase().from('search_itineraries').insert(itineraryRows);
  }
}
