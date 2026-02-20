/**
 * POST /api/trips/[id]/generate
 *
 * Triggers AI-powered itinerary generation for a trip.
 * Uses Vercel Workflows for async processing.
 * Returns immediately with workflow ID for status polling.
 */

import { NextRequest, NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { generateItineraryWorkflow, GenerateItineraryInput } from '@/workflows/generate-itinerary';
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

    // Fetch trip — allow owned trips or anonymous trips
    let query = adminClient.from('trips').select('id, destination, start_date, end_date, status, travelers, budget, vibes, interests, dietary_restrictions, mobility_needs, user_id').eq('id', tripId);
    if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
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
      const { data: existingRun } = await adminClient
        .from('workflow_runs')
        .select('id')
        .eq('trip_id', tripId)
        .eq('status', 'running')
        .order('started_at', { ascending: false })
        .limit(1)
        .single();

      return NextResponse.json(
        {
          error: 'Itinerary generation already in progress',
          workflowId: existingRun?.id,
          statusUrl: existingRun ? `/api/workflows/${existingRun.id}/status` : undefined,
        },
        { status: 409 }
      );
    }

    // Parse optional preferences from request body
    let bodyPreferences = {};
    try {
      const body = await request.json().catch(() => ({}));
      bodyPreferences = body.preferences || {};
    } catch {
      // No body or invalid JSON, use trip defaults
    }

    // Build workflow input from trip data
    const workflowInput: GenerateItineraryInput = {
      tripId: trip.id,
      destination: trip.destination,
      startDate: trip.start_date,
      endDate: trip.end_date,
      travelers: trip.travelers || { adults: 2, children: 0 },
      budget: trip.budget || 'moderate',
      preferences: {
        vibes: trip.vibes || ['adventure', 'cultural'],
        interests: trip.interests,
        dietaryRestrictions: trip.dietary_restrictions,
        mobilityNeeds: trip.mobility_needs,
        ...bodyPreferences,
      },
      userId: userId || undefined,
    };

    // Initialize progress tracking
    await adminClient
      .from('workflow_progress')
      .upsert({
        trip_id: tripId,
        user_id: userId,
        step: 'queued',
        progress: 0,
        message: 'Starting itinerary generation...',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'trip_id' });

    // Update trip status
    await adminClient
      .from('trips')
      .update({
        status: 'generating',
        updated_at: new Date().toISOString(),
      })
      .eq('id', tripId);

    // Start the workflow asynchronously
    const workflowRun = await start(generateItineraryWorkflow, [workflowInput]);

    // Get workflow run ID - handle both possible API shapes
    const workflowRunId = typeof workflowRun === 'object' && workflowRun !== null && 'id' in workflowRun
      ? (workflowRun as { id: string }).id
      : String(workflowRun);

    console.log(`[API] Started workflow for trip ${tripId}, run ID: ${workflowRunId}`);

    // Store workflow run for status tracking
    await adminClient
      .from('workflow_runs')
      .insert({
        id: workflowRunId,
        trip_id: tripId,
        user_id: userId,
        status: 'running',
        started_at: new Date().toISOString(),
      });

    return NextResponse.json({
      success: true,
      tripId,
      workflowId: workflowRunId,
      message: 'Itinerary generation started',
      statusUrl: `/api/workflows/${workflowRunId}/status`,
      pollInterval: 2000, // Suggested poll interval in ms
    });
  } catch (error) {
    console.error('[API] Error starting itinerary generation:', error);
    return NextResponse.json(
      { error: 'Failed to start itinerary generation' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/trips/[id]/generate
 *
 * Check generation status for a trip
 */
export async function GET(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { id: tripId } = await params;
    const userId = await resolveUser();

    const adminClient = getSupabase();

    // Get latest workflow run for this trip
    let query = adminClient
      .from('workflow_runs')
      .select('id, trip_id, user_id, status, started_at, completed_at, error_message')
      .eq('trip_id', tripId)
      .order('started_at', { ascending: false })
      .limit(1);

    if (userId) {
      query = query.or(`user_id.eq.${userId},user_id.is.null`);
    } else {
      query = query.is('user_id', null);
    }

    const { data: workflowRun, error: runError } = await query.single();

    if (runError || !workflowRun) {
      return NextResponse.json({
        tripId,
        status: 'not_started',
        message: 'No generation has been started for this trip',
      });
    }

    // Get progress
    const { data: progress } = await adminClient
      .from('workflow_progress')
      .select('step, progress, message')
      .eq('trip_id', tripId)
      .single();

    return NextResponse.json({
      tripId,
      workflowId: workflowRun.id,
      status: workflowRun.status,
      progress: progress?.progress || 0,
      step: progress?.step || 'unknown',
      message: progress?.message || 'Processing...',
      startedAt: workflowRun.started_at,
      completedAt: workflowRun.completed_at,
      statusUrl: `/api/workflows/${workflowRun.id}/status`,
    });
  } catch (error) {
    console.error('[API] Error fetching generation status:', error);
    return NextResponse.json(
      { error: 'Failed to fetch generation status' },
      { status: 500 }
    );
  }
}
