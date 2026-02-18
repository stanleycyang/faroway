/**
 * Trip Planning Workflow
 * Uses Vercel Workflow for durable execution with AI SDK agents
 */

import { sleep } from 'workflow';
import { planTrip, TravelPlanResult } from '@/lib/agents/travel-agent';
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
 * Main workflow function - orchestrates the trip planning process
 * Marked with "use workflow" for durable execution
 */
export async function planTripWorkflow(input: TripPlanInput): Promise<TripPlanOutput> {
  'use workflow';

  const { searchId, destination, startDate, endDate, travelers, vibes, budget, userId } = input;

  try {
    // Update status to searching
    await updateSearchStatus(searchId, 'searching', { orchestrator: 'running' });

    // Run the AI agent to plan the trip
    const result = await runTravelAgent({
      searchId,
      destination,
      startDate,
      endDate,
      travelers,
      vibes,
      budget,
    });

    // Save results to database
    await saveSearchResults(searchId, result, userId);

    // Update status to completed
    await updateSearchStatus(searchId, 'completed', {
      orchestrator: 'done',
      hotels: 'done',
      activities: 'done',
      dining: 'done',
      aggregator: 'done',
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

/**
 * Step: Run the travel planning agent
 * Marked with "use step" for automatic retries
 */
async function runTravelAgent(params: {
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

  console.log(`[Workflow] Running travel agent for search ${searchId}`);

  // Update progress
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

  // Run the AI agent
  const result = await planTrip({
    destination,
    startDate,
    endDate,
    travelers,
    vibes,
    budget,
  });

  console.log(`[Workflow] Agent completed for search ${searchId}`);

  return result;
}

/**
 * Step: Update search status in database
 */
async function updateSearchStatus(
  searchId: string,
  status: string,
  progress: Record<string, string>,
  errorMessage?: string
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

/**
 * Step: Save search results to database
 */
async function saveSearchResults(
  searchId: string,
  result: TravelPlanResult,
  userId?: string
): Promise<void> {
  'use step';

  console.log(`[Workflow] Saving results for search ${searchId}`);

  // Save hotels
  for (const hotel of result.hotels || []) {
    await getSupabase().from('search_results').insert({
      search_id: searchId,
      category: 'hotel',
      name: hotel.name,
      description: `${hotel.rating?.toFixed(1)} stars, ${hotel.reviewCount} reviews`,
      data: hotel,
      affiliate_url: hotel.affiliateUrl,
      affiliate_partner: hotel.affiliatePartner,
      price_amount: hotel.pricePerNight,
      price_currency: hotel.currency || 'USD',
      rating: hotel.rating,
    });
  }

  // Save activities
  for (const activity of result.activities || []) {
    await getSupabase().from('search_results').insert({
      search_id: searchId,
      category: 'activity',
      name: activity.name,
      description: activity.description,
      data: activity,
      affiliate_url: activity.affiliateUrl,
      affiliate_partner: activity.affiliatePartner,
      price_amount: activity.price,
      price_currency: activity.currency || 'USD',
      rating: activity.rating,
    });
  }

  // Save restaurants
  for (const restaurant of result.restaurants || []) {
    await getSupabase().from('search_results').insert({
      search_id: searchId,
      category: 'dining',
      name: restaurant.name,
      description: restaurant.description,
      data: restaurant,
      affiliate_url: restaurant.reservationUrl,
      affiliate_partner: restaurant.affiliatePartner,
      rating: restaurant.rating,
    });
  }

  // Save itinerary days
  if (result.itinerary?.days) {
    for (const day of result.itinerary.days) {
      await getSupabase().from('search_itineraries').insert({
        search_id: searchId,
        day_number: day.dayNumber,
        date: day.date,
        title: day.title,
        summary: `Day ${day.dayNumber} in ${result.itinerary.destination}`,
        morning_activities: day.morning?.activities?.map((a: any) => a.id) || [],
        afternoon_activities: day.afternoon?.activities?.map((a: any) => a.id) || [],
        evening_activities: day.evening?.activities?.map((a: any) => a.id) || [],
        meals: [day.morning?.meal?.id, day.afternoon?.meal?.id, day.evening?.meal?.id].filter(Boolean),
        estimated_cost: day.estimatedCost,
        cost_currency: day.currency || 'USD',
        tips: day.tips || [],
      });
    }
  }

  console.log(`[Workflow] Results saved for search ${searchId}`);
}
