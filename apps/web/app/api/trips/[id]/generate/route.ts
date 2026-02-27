/**
 * POST /api/trips/[id]/generate
 *
 * Triggers trip planning via planTripWorkflow (multi-agent with real affiliate data).
 * Creates a search record, links it to the trip, and starts the workflow.
 *
 * GET /api/trips/[id]/generate
 *
 * Returns generation status by reading from the searches table.
 */

import { NextRequest, NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { planTripWorkflow } from '@/workflows/plan-trip';
import { createClient, getSupabase } from '@/lib/supabase/server';

type Params = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * Resolve user ID if authenticated, or null for anonymous.
 */
async function resolveUser(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { id: tripId } = await params;
    const userId = await resolveUser();

    const adminClient = getSupabase();

    // Fetch trip — strictly scoped to user's own trips
    let query = adminClient.from('trips').select('id, destination, start_date, end_date, status, travelers, budget_tier, vibes, interests, dietary_restrictions, mobility_needs, user_id, search_id, preferences').eq('id', tripId);
    if (userId) {
      query = query.eq('user_id', userId);
    } else {
      query = query.is('user_id', null);
    }

    const { data: trip, error: tripError } = await query.single();

    if (tripError || !trip) {
      return NextResponse.json(
        { error: 'Trip not found or access denied' },
        { status: 404 }
      );
    }

    // Check if generation is already in progress
    if (trip.status === 'generating') {
      return NextResponse.json(
        {
          error: 'Itinerary generation already in progress',
          searchId: trip.search_id,
        },
        { status: 409 }
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

    // Create a search record in the searches table
    const { data: search, error: searchError } = await adminClient
      .from('searches')
      .insert({
        user_id: userId,
        destination: trip.destination,
        start_date: trip.start_date,
        end_date: trip.end_date,
        travelers: trip.travelers || 2,
        traveler_type: (trip.preferences as Record<string, unknown>)?.travelerType as string || null,
        vibes: trip.vibes || (bodyPreferences.vibes as string[]) || [],
        budget: trip.budget_tier || 'moderate',
        status: 'pending',
      })
      .select('id')
      .single();

    if (searchError || !search) {
      console.error('[API] Failed to create search record:', searchError);
      return NextResponse.json(
        { error: 'Failed to initialize search' },
        { status: 500 }
      );
    }

    const searchId = search.id;

    // Link search to trip and update status
    await adminClient
      .from('trips')
      .update({
        status: 'generating',
        search_id: searchId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId);

    // Initialize workflow progress tracking
    await adminClient
      .from('workflow_progress')
      .upsert({
        trip_id: tripId,
        user_id: userId,
        step: 'queued',
        progress: 0,
        message: 'Starting trip planning...',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'trip_id' });

    // Build workflow input
    const workflowInput = {
      searchId,
      tripId,
      destination: trip.destination,
      startDate: trip.start_date,
      endDate: trip.end_date,
      travelers: trip.travelers || 2,
      vibes: trip.vibes || (bodyPreferences.vibes as string[]) || [],
      budget: trip.budget_tier || 'moderate',
      userId: userId || undefined,
    };

    // Start the planTripWorkflow asynchronously
    const workflowRun = await start(planTripWorkflow, [workflowInput]);

    // Extract workflow run ID — handle various return shapes from the workflow SDK
    let workflowRunId: string;
    if (typeof workflowRun === 'string') {
      workflowRunId = workflowRun;
    } else if (workflowRun && typeof workflowRun === 'object') {
      const run = workflowRun as Record<string, unknown>;
      workflowRunId = String(run.id ?? run.runId ?? run.workflowRunId ?? `wf_${searchId}_${Date.now()}`);
    } else {
      workflowRunId = `wf_${searchId}_${Date.now()}`;
    }

    console.log(`[API] Started planTripWorkflow for trip ${tripId}, search ${searchId}, run ID: ${workflowRunId}`);

    // Store workflow run for status tracking (only for authenticated users,
    // since workflow_runs.user_id is NOT NULL)
    if (userId) {
      await adminClient
        .from('workflow_runs')
        .insert({
          id: workflowRunId,
          trip_id: tripId,
          user_id: userId,
          status: 'running',
          started_at: new Date().toISOString(),
        });
    }

    // Update search with workflow run ID
    await adminClient
      .from('searches')
      .update({ workflow_run_id: workflowRunId })
      .eq('id', searchId);

    return NextResponse.json({
      success: true,
      tripId,
      searchId,
      workflowId: workflowRunId,
      message: 'Trip planning started',
      streamUrl: `/api/trips/${tripId}/stream`,
      pollInterval: 2000,
    });
  } catch (error) {
    console.error('[API] Error starting trip planning:', error);
    return NextResponse.json(
      { error: 'Failed to start trip planning' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/trips/[id]/generate
 *
 * Check generation status by reading from searches table progress.
 */
export async function GET(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { id: tripId } = await params;
    const userId = await resolveUser();

    const adminClient = getSupabase();

    // Get trip to find search_id
    let tripQuery = adminClient
      .from('trips')
      .select('id, status, search_id')
      .eq('id', tripId);

    if (userId) {
      tripQuery = tripQuery.eq('user_id', userId);
    } else {
      tripQuery = tripQuery.is('user_id', null);
    }

    const { data: trip, error: tripError } = await tripQuery.single();

    if (tripError || !trip) {
      return NextResponse.json({
        tripId,
        status: 'not_found',
        message: 'Trip not found',
      }, { status: 404 });
    }

    // If no search linked, check old workflow_progress table for backward compat
    if (!trip.search_id) {
      const { data: progress } = await adminClient
        .from('workflow_progress')
        .select('step, progress, message')
        .eq('trip_id', tripId)
        .single();

      const { data: workflowRun } = await adminClient
        .from('workflow_runs')
        .select('id, status, started_at, completed_at')
        .eq('trip_id', tripId)
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      return NextResponse.json({
        tripId,
        workflowId: workflowRun?.id,
        status: workflowRun?.status || trip.status || 'not_started',
        progress: progress?.progress || 0,
        step: progress?.step || 'unknown',
        message: progress?.message || 'Processing...',
        startedAt: workflowRun?.started_at,
        completedAt: workflowRun?.completed_at,
      });
    }

    // Read from searches table — this is the new unified path
    const { data: search, error: searchError } = await adminClient
      .from('searches')
      .select('id, status, progress, error_message, created_at, completed_at')
      .eq('id', trip.search_id)
      .single();

    if (searchError || !search) {
      return NextResponse.json({
        tripId,
        status: 'not_started',
        message: 'No generation has been started for this trip',
      });
    }

    // Map search progress to a flat progress percentage
    const searchProgress = (search.progress || {}) as Record<string, string>;
    const stages = ['orchestrator', 'hotels', 'activities', 'dining', 'aggregator'];
    let progressPercent = 0;
    for (const stage of stages) {
      if (searchProgress[stage] === 'done') {
        progressPercent += 20;
      } else if (searchProgress[stage] === 'searching') {
        progressPercent += 10;
      }
    }

    // Determine current step for display
    let currentStep = 'queued';
    let message = 'Starting trip planning...';
    for (let i = stages.length - 1; i >= 0; i--) {
      if (searchProgress[stages[i]] === 'searching') {
        currentStep = stages[i];
        message = getStepMessage(stages[i], 'searching');
        break;
      }
      if (searchProgress[stages[i]] === 'done') {
        currentStep = stages[i];
        message = getStepMessage(stages[i], 'done');
        break;
      }
    }

    if (search.status === 'completed') {
      progressPercent = 100;
      currentStep = 'complete';
      message = 'Your itinerary is ready!';
    } else if (search.status === 'error') {
      currentStep = 'error';
      message = search.error_message || 'Something went wrong';
    }

    return NextResponse.json({
      tripId,
      searchId: search.id,
      status: search.status === 'completed' ? 'completed' :
              search.status === 'error' ? 'failed' :
              'running',
      progress: Math.min(100, progressPercent),
      step: currentStep,
      searchProgress,
      message,
      startedAt: search.created_at,
      completedAt: search.completed_at,
    });
  } catch (error) {
    console.error('[API] Error fetching generation status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch generation status' },
      { status: 500 }
    );
  }
}

function getStepMessage(step: string, status: string): string {
  const messages: Record<string, Record<string, string>> = {
    orchestrator: {
      searching: 'Understanding your preferences...',
      done: 'Preferences analyzed',
    },
    hotels: {
      searching: 'Searching for the best hotels...',
      done: 'Hotels found',
    },
    activities: {
      searching: 'Finding activities & attractions...',
      done: 'Activities discovered',
    },
    dining: {
      searching: 'Discovering restaurants...',
      done: 'Restaurants found',
    },
    aggregator: {
      searching: 'Crafting your perfect itinerary...',
      done: 'Itinerary composed',
    },
  };
  return messages[step]?.[status] || 'Processing...';
}
