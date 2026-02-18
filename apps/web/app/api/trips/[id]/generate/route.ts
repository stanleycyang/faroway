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
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { id: tripId } = await params;
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Fetch trip from database
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .eq('user_id', user.id)
      .single();

    if (tripError || !trip) {
      return NextResponse.json(
        { error: 'Trip not found or access denied' },
        { status: 404 }
      );
    }

    // Check if generation is already in progress
    if (trip.status === 'generating') {
      // Return existing workflow info if available
      const adminClient = createSupabaseAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );
      
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
      userId: user.id,
    };

    // Initialize progress tracking
    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await adminClient
      .from('workflow_progress')
      .upsert({
        trip_id: tripId,
        user_id: user.id,
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
        user_id: user.id,
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
    const supabase = await createClient();
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get latest workflow run for this trip
    const { data: workflowRun, error: runError } = await adminClient
      .from('workflow_runs')
      .select('*')
      .eq('trip_id', tripId)
      .eq('user_id', user.id)
      .order('started_at', { ascending: false })
      .limit(1)
      .single();

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
      .select('*')
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
