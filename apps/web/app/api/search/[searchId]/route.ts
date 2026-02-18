/**
 * GET /api/search/[searchId]
 * Get search status and results
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';
import { SearchStatusResponse, SearchResults, HotelResult, ActivityResult, DiningResult, SuggestedDay } from '@/lib/search/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ searchId: string }> }
) {
  const { searchId } = await params;

  try {
    // Get search record
    const { data: search, error: searchError } = await getSupabase()
      .from('searches')
      .select('*')
      .eq('id', searchId)
      .single();

    if (searchError || !search) {
      return NextResponse.json(
        { error: 'Search not found' },
        { status: 404 }
      );
    }

    // Base response
    const response: SearchStatusResponse = {
      searchId: search.id,
      status: search.status,
      progress: search.progress,
      createdAt: search.created_at,
      completedAt: search.completed_at || undefined,
    };

    // If completed, include results
    if (search.status === 'completed') {
      // Get all results
      const { data: resultsData } = await getSupabase()
        .from('search_results')
        .select('*')
        .eq('search_id', searchId)
        .order('vibe_score', { ascending: false });

      // Get itinerary
      const { data: itineraryData } = await getSupabase()
        .from('search_itineraries')
        .select('*')
        .eq('search_id', searchId)
        .order('day_number', { ascending: true });

      if (resultsData) {
        // Parse results by category
        const hotels: HotelResult[] = resultsData
          .filter(r => r.category === 'hotel')
          .map(r => ({
            ...r.data,
            id: r.id,
          }));

        const activities: ActivityResult[] = resultsData
          .filter(r => r.category === 'activity')
          .map(r => ({
            ...r.data,
            id: r.id,
          }));

        const dining: DiningResult[] = resultsData
          .filter(r => r.category === 'dining')
          .map(r => ({
            ...r.data,
            id: r.id,
          }));

        // Build itinerary from stored data
        const itinerary: SuggestedDay[] = (itineraryData || []).map(day => ({
          dayNumber: day.day_number,
          date: day.date,
          title: day.title,
          summary: day.summary,
          hotel: hotels[0], // Top hotel for all days
          morning: {
            activities: activities.filter(a => 
              (day.morning_activities || []).includes(a.id)
            ),
            meal: dining.find(d => 
              (day.meals || []).includes(d.id) && d.mealTypes?.includes('breakfast')
            ),
          },
          afternoon: {
            activities: activities.filter(a => 
              (day.afternoon_activities || []).includes(a.id)
            ),
            meal: dining.find(d => 
              (day.meals || []).includes(d.id) && d.mealTypes?.includes('lunch')
            ),
          },
          evening: {
            activities: activities.filter(a => 
              (day.evening_activities || []).includes(a.id)
            ),
            meal: dining.find(d => 
              (day.meals || []).includes(d.id) && d.mealTypes?.includes('dinner')
            ),
          },
          estimatedCost: day.estimated_cost,
          currency: day.cost_currency,
          tips: day.tips || [],
        }));

        response.results = {
          searchId,
          hotels,
          activities,
          dining,
          itinerary,
        };
      }
    }

    // If error, include error message
    if (search.status === 'error') {
      response.error = search.error_message || 'An error occurred';
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Search Status] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/search/[searchId]
 * Update search status (internal use)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ searchId: string }> }
) {
  const { searchId } = await params;

  try {
    const body = await request.json();
    const { status, progress, errorMessage } = body;

    const updates: any = {};
    
    if (status) {
      updates.status = status;
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }
    }

    if (progress) {
      // Merge with existing progress
      const { data: current } = await getSupabase()
        .from('searches')
        .select('progress')
        .eq('id', searchId)
        .single();

      updates.progress = { ...current?.progress, ...progress };
    }

    if (errorMessage) {
      updates.error_message = errorMessage;
    }

    const { error } = await getSupabase()
      .from('searches')
      .update(updates)
      .eq('id', searchId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Search Update] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
