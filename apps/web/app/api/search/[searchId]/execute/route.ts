/**
 * POST /api/search/[searchId]/execute
 * Execute the search workflow (internal endpoint)
 * This runs all agents and saves results to the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';

// Allow up to 60 seconds for AI generation (requires Vercel Pro plan)
// On Hobby plan, this will be capped at 10 seconds
export const maxDuration = 60;
import { SearchInput, SearchProgress, SearchResults } from '@/lib/search/types';
import {
  runOrchestratorAgent,
  runHotelsAgent,
  runActivitiesAgent,
  runDiningAgent,
  runAggregatorAgent,
} from '@/lib/search/agents';


// Helper to update progress
async function updateProgress(searchId: string, progress: Partial<SearchProgress>) {
  const { data: current } = await getSupabase()
    .from('searches')
    .select('progress')
    .eq('id', searchId)
    .single();

  const newProgress = { ...current?.progress, ...progress };

  await getSupabase()
    .from('searches')
    .update({ progress: newProgress })
    .eq('id', searchId);
}

// Helper to save results
async function saveResult(
  searchId: string,
  category: string,
  item: any
) {
  await getSupabase().from('search_results').insert({
    search_id: searchId,
    category,
    name: item.name,
    description: item.description,
    data: item,
    affiliate_url: item.affiliateUrl || item.reservationUrl,
    affiliate_partner: item.affiliatePartner,
    price_amount: item.pricePerNight || item.price || null,
    price_currency: item.currency || 'USD',
    vibe_score: item.vibeScore,
    rating: item.rating || item.userRating,
    location_name: item.location?.name,
    location_address: item.location?.address,
    location_lat: item.location?.lat,
    location_lng: item.location?.lng,
    image_url: item.images?.[0],
    images: item.images || [],
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ searchId: string }> }
) {
  const { searchId } = await params;

  try {
    const input: SearchInput = await request.json();

    console.log(`[Search Execute] Starting search ${searchId} for ${input.destination}`);

    // Step 1: Orchestrator
    await updateProgress(searchId, { orchestrator: 'searching' });
    const searchPlan = await runOrchestratorAgent(input);
    await updateProgress(searchId, { orchestrator: 'done' });
    console.log(`[Search Execute] Orchestrator complete for ${searchId}`);

    // Step 2: Run agents in parallel
    await updateProgress(searchId, {
      hotels: 'searching',
      activities: 'searching',
      dining: 'searching',
    });

    const [hotels, activities, dining] = await Promise.all([
      runHotelsAgent(searchPlan, 10).then(async results => {
        await updateProgress(searchId, { hotels: 'done' });
        console.log(`[Search Execute] Hotels complete: ${results.length} results`);
        return results;
      }),
      runActivitiesAgent(searchPlan, 15).then(async results => {
        await updateProgress(searchId, { activities: 'done' });
        console.log(`[Search Execute] Activities complete: ${results.length} results`);
        return results;
      }),
      runDiningAgent(searchPlan, 12).then(async results => {
        await updateProgress(searchId, { dining: 'done' });
        console.log(`[Search Execute] Dining complete: ${results.length} results`);
        return results;
      }),
    ]);

    // Step 3: Aggregator
    await updateProgress(searchId, { aggregator: 'searching' });
    const { days, topHotel } = await runAggregatorAgent(searchPlan, hotels, activities, dining);
    await updateProgress(searchId, { aggregator: 'done' });
    console.log(`[Search Execute] Aggregator complete: ${days.length} days`);

    // Step 4: Save all results to database
    console.log(`[Search Execute] Saving results for ${searchId}`);

    // Save hotels
    for (const hotel of hotels) {
      await saveResult(searchId, 'hotel', hotel);
    }

    // Save activities
    for (const activity of activities) {
      await saveResult(searchId, 'activity', activity);
    }

    // Save dining
    for (const restaurant of dining) {
      await saveResult(searchId, 'dining', restaurant);
    }

    // Save itinerary days
    for (const day of days) {
      await getSupabase().from('search_itineraries').insert({
        search_id: searchId,
        day_number: day.dayNumber,
        date: day.date,
        title: day.title,
        summary: day.summary,
        morning_activities: day.morning.activities.map(a => a.id),
        afternoon_activities: day.afternoon.activities.map(a => a.id),
        evening_activities: day.evening.activities.map(a => a.id),
        meals: [
          day.morning.meal?.id,
          day.afternoon.meal?.id,
          day.evening.meal?.id,
        ].filter(Boolean),
        estimated_cost: day.estimatedCost,
        cost_currency: day.currency,
        tips: day.tips,
      });
    }

    // Mark search as completed
    await getSupabase()
      .from('searches')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', searchId);

    console.log(`[Search Execute] Search ${searchId} completed successfully`);

    const results: SearchResults = {
      searchId,
      hotels,
      activities,
      dining,
      itinerary: days,
    };

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error(`[Search Execute] Error for ${searchId}:`, error);

    // Mark search as failed
    await getSupabase()
      .from('searches')
      .update({
        status: 'error',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      })
      .eq('id', searchId);

    return NextResponse.json(
      { error: 'Search execution failed' },
      { status: 500 }
    );
  }
}
