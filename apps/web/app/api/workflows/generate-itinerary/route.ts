/**
 * POST /api/workflows/generate-itinerary
 * 
 * Starts the itinerary generation workflow.
 * Returns immediately with a workflow ID for status polling.
 */

import { NextRequest, NextResponse } from 'next/server';
import { start } from 'workflow/api';
import { generateItineraryWorkflow, GenerateItineraryInput } from '@/workflows/generate-itinerary';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { z } from 'zod';

// Input validation schema
const GenerateItineraryRequestSchema = z.object({
  tripId: z.string().uuid(),
  destination: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  travelers: z.object({
    adults: z.number().int().min(1),
    children: z.number().int().min(0),
  }),
  budget: z.enum(['budget', 'moderate', 'luxury']),
  preferences: z.object({
    vibes: z.array(z.string()).min(1),
    interests: z.array(z.string()).optional(),
    dietaryRestrictions: z.array(z.string()).optional(),
    mobilityNeeds: z.string().optional(),
  }),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = GenerateItineraryRequestSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request body',
          details: validationResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const input = validationResult.data;

    // Verify trip belongs to user
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select('id, status')
      .eq('id', input.tripId)
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
      return NextResponse.json(
        { error: 'Itinerary generation already in progress' },
        { status: 409 }
      );
    }

    // Initialize workflow progress tracking
    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Create initial progress record
    await adminClient
      .from('workflow_progress')
      .upsert({
        trip_id: input.tripId,
        user_id: user.id,
        step: 'queued',
        progress: 0,
        message: 'Workflow queued...',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'trip_id' });

    // Update trip status
    await adminClient
      .from('trips')
      .update({ status: 'generating' })
      .eq('id', input.tripId);

    // Prepare workflow input
    const workflowInput: GenerateItineraryInput = {
      ...input,
      userId: user.id,
    };

    // Start the workflow (executes asynchronously)
    const workflowRun = await start(generateItineraryWorkflow, [workflowInput]);

    // Get workflow run ID - handle both possible API shapes
    const workflowRunId = typeof workflowRun === 'object' && workflowRun !== null && 'id' in workflowRun 
      ? (workflowRun as { id: string }).id 
      : String(workflowRun);

    console.log(`[API] Started workflow for trip ${input.tripId}, run ID: ${workflowRunId}`);

    // Store workflow run ID for status tracking
    await adminClient
      .from('workflow_runs')
      .insert({
        id: workflowRunId,
        trip_id: input.tripId,
        user_id: user.id,
        status: 'running',
        started_at: new Date().toISOString(),
      });

    return NextResponse.json({
      success: true,
      workflowId: workflowRunId,
      tripId: input.tripId,
      message: 'Itinerary generation started',
      statusUrl: `/api/workflows/${workflowRunId}/status`,
    });
  } catch (error) {
    console.error('[API] Error starting workflow:', error);
    return NextResponse.json(
      { error: 'Failed to start workflow' },
      { status: 500 }
    );
  }
}
