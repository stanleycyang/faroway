/**
 * POST /api/workflows/generate-itinerary
 *
 * Starts the itinerary generation workflow.
 * Returns immediately with a workflow ID for status polling.
 */

import { NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { planTripWorkflow } from "@/workflows/plan-trip";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";
import { z } from "zod";

interface SupabaseFilterBuilder {
  eq(column: string, value: unknown): SupabaseFilterBuilder;
}

interface SupabaseTableBuilder {
  insert(values: Record<string, unknown>): SupabaseTableBuilder;
  select(columns?: string): SupabaseTableBuilder;
  single(): PromiseLike<{
    data: { id: string } | null;
    error: { message?: string } | null;
  }>;
  update(values: Record<string, unknown>): SupabaseFilterBuilder;
  upsert(
    values: Record<string, unknown>,
    options?: { onConflict?: string },
  ): PromiseLike<unknown>;
}

interface SupabaseAdminClient {
  from(table: string): SupabaseTableBuilder;
}

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
  budget: z.enum(["budget", "moderate", "luxury"]),
  preferences: z.object({
    vibes: z.array(z.string()).min(1),
    interests: z.array(z.string()).optional(),
    dietaryRestrictions: z.array(z.string()).optional(),
    mobilityNeeds: z.string().optional(),
  }),
});

export async function POST(request: NextRequest) {
  let adminClient: SupabaseAdminClient | null = null;
  let generatingTripId: string | null = null;
  let workflowStarted = false;

  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = GenerateItineraryRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validationResult.error.flatten(),
        },
        { status: 400 },
      );
    }

    const input = validationResult.data;
    const travelerCount = input.travelers.adults + input.travelers.children;

    // Verify trip belongs to user
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, status")
      .eq("id", input.tripId)
      .eq("user_id", user.id)
      .single();

    if (tripError || !trip) {
      return NextResponse.json(
        { error: "Trip not found or access denied" },
        { status: 404 },
      );
    }

    // Check if generation is already in progress
    if (trip.status === "generating") {
      return NextResponse.json(
        { error: "Itinerary generation already in progress" },
        { status: 409 },
      );
    }

    // Initialize workflow progress tracking
    adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    ) as unknown as SupabaseAdminClient;

    // Create initial progress record
    await adminClient.from("workflow_progress").upsert(
      {
        trip_id: input.tripId,
        user_id: user.id,
        step: "queued",
        progress: 0,
        message: "Workflow queued...",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "trip_id" },
    );

    const { data: search, error: searchError } = await adminClient
      .from("searches")
      .insert({
        user_id: user.id,
        destination: input.destination,
        start_date: input.startDate,
        end_date: input.endDate,
        travelers: travelerCount,
        vibes: input.preferences.vibes,
        budget: input.budget,
        status: "pending",
        progress: {
          orchestrator: "pending",
          hotels: "pending",
          activities: "pending",
          dining: "pending",
          transport: "pending",
          enrichment: "pending",
          aggregator: "pending",
        },
      })
      .select("id")
      .single();

    if (searchError || !search) {
      throw new Error(searchError?.message || "Failed to create search record");
    }

    // Update trip status
    await adminClient
      .from("trips")
      .update({ status: "generating", search_id: search.id })
      .eq("id", input.tripId);
    generatingTripId = input.tripId;

    const workflowInput = {
      searchId: search.id,
      tripId: input.tripId,
      destination: input.destination,
      startDate: input.startDate,
      endDate: input.endDate,
      travelers: travelerCount,
      vibes: input.preferences.vibes,
      budget: input.budget,
      userId: user.id,
    };

    // Start the workflow (executes asynchronously)
    const workflowRun = await start(planTripWorkflow, [workflowInput]);
    workflowStarted = true;

    // Get workflow run ID - handle both possible API shapes
    const workflowRunId =
      typeof workflowRun === "object" &&
      workflowRun !== null &&
      "id" in workflowRun
        ? (workflowRun as { id: string }).id
        : String(workflowRun);

    console.log(
      `[API] Started workflow for trip ${input.tripId}, run ID: ${workflowRunId}`,
    );

    // Store workflow run ID for status tracking
    await adminClient.from("workflow_runs").insert({
      id: workflowRunId,
      trip_id: input.tripId,
      user_id: user.id,
      status: "running",
      started_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      workflowId: workflowRunId,
      tripId: input.tripId,
      message: "Itinerary generation started",
      statusUrl: `/api/workflows/${workflowRunId}/status`,
    });
  } catch (error) {
    console.error("[API] Error starting workflow:", error);
    if (adminClient && generatingTripId && !workflowStarted) {
      const message =
        error instanceof Error ? error.message : "Failed to start workflow";
      await markWorkflowStartFailed(adminClient, generatingTripId, message);
    }
    return NextResponse.json(
      { error: "Failed to start workflow" },
      { status: 500 },
    );
  }
}

async function markWorkflowStartFailed(
  adminClient: SupabaseAdminClient,
  tripId: string,
  message: string,
): Promise<void> {
  try {
    const now = new Date().toISOString();
    await Promise.all([
      adminClient
        .from("trips")
        .update({ status: "failed", updated_at: now })
        .eq("id", tripId),
      adminClient.from("workflow_progress").upsert(
        {
          trip_id: tripId,
          step: "error",
          progress: 0,
          message,
          updated_at: now,
        },
        { onConflict: "trip_id" },
      ),
    ]);
  } catch (updateError) {
    console.error(
      "[API] Failed to mark workflow start as failed:",
      updateError,
    );
  }
}
