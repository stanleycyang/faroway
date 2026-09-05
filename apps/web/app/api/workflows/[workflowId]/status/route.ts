/**
 * GET /api/workflows/[workflowId]/status
 *
 * Returns the status and progress of a workflow run.
 * Clients poll this endpoint to track generation progress.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

type Params = {
  params: Promise<{
    workflowId: string;
  }>;
};

export interface WorkflowStatusResponse {
  workflowId: string;
  tripId: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: number;
  step: string;
  message: string;
  startedAt: string;
  completedAt?: string;
  result?: {
    itineraryId?: string;
    error?: string;
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { workflowId } = await params;
    const supabase = await createClientFromRequest(request);

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const adminClient = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Get workflow run
    const { data: workflowRun, error: runError } = await adminClient
      .from("workflow_runs")
      .select("*")
      .eq("id", workflowId)
      .eq("user_id", user.id)
      .single();

    if (runError || !workflowRun) {
      return NextResponse.json(
        { error: "Workflow not found" },
        { status: 404 },
      );
    }

    // Get progress details
    const { data: progress } = await adminClient
      .from("workflow_progress")
      .select("*")
      .eq("trip_id", workflowRun.trip_id)
      .single();

    // Check if itinerary was generated (workflow complete)
    let result: WorkflowStatusResponse["result"] | undefined;

    if (workflowRun.status === "completed") {
      const { data: itinerary } = await adminClient
        .from("itineraries")
        .select("id")
        .eq("trip_id", workflowRun.trip_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (itinerary) {
        result = { itineraryId: itinerary.id };
      }
    } else if (workflowRun.status === "failed") {
      result = { error: "Workflow failed. Please try again." };
    }

    const response: WorkflowStatusResponse = {
      workflowId,
      tripId: workflowRun.trip_id,
      status: workflowRun.status,
      progress:
        workflowRun.status === "completed"
          ? 100
          : workflowRun.status === "failed"
            ? 0
            : progress?.progress || 0,
      step:
        workflowRun.status === "failed" ? "error" : progress?.step || "unknown",
      message:
        workflowRun.status === "failed"
          ? "Generation failed. Please try again."
          : progress?.message || "Processing...",
      startedAt: workflowRun.started_at,
      completedAt: workflowRun.completed_at,
      result,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[API] Error fetching workflow status:", error);
    return NextResponse.json(
      { error: "Failed to fetch workflow status" },
      { status: 500 },
    );
  }
}
