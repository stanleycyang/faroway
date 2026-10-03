import { applyGenerationUpdate } from "@/lib/trips/apply-generation-update";
import { getSupabase } from "@/lib/supabase/server";
import { getWorkflowRunStatus } from "@/lib/workflow/runtime";

export const STARTUP_UNCONFIRMED =
  "Workflow startup could not be confirmed. Check progress before retrying.";

/** Positive terminal evidence is required before releasing an in-flight claim.
 * A missing run, missing run ID or backend outage never authorizes a new run.
 */
export async function reconcileGeneration(
  tripId: string,
  userId: string,
  searchId: string,
) {
  const db = getSupabase();
  const { data: search, error } = await db
    .from("searches")
    .select("id, status, workflow_run_id, error_message")
    .eq("id", searchId)
    .eq("user_id", userId)
    .single();
  if (error || !search) return { state: "unconfirmed" as const };
  if (search.status === "completed") return { state: "settled" as const };
  if (!search.workflow_run_id)
    return {
      state:
        search.error_message === STARTUP_UNCONFIRMED
          ? ("unconfirmed" as const)
          : ("pending" as const),
    };
  let status: string;
  try {
    status = await getWorkflowRunStatus(search.workflow_run_id);
  } catch {
    return { state: "unconfirmed" as const };
  }
  if (
    status !== "failed" &&
    status !== "cancelled" &&
    !(status === "completed" && search.status === "error")
  )
    return {
      state:
        status === "completed"
          ? ("unconfirmed" as const)
          : ("running" as const),
    };
  const message =
    "The previous planning run stopped. Your trip is saved and you can try planning again.";
  const { error: searchError } = await db
    .from("searches")
    .update({ status: "error", error_message: message })
    .eq("id", searchId)
    .eq("user_id", userId)
    .eq("workflow_run_id", search.workflow_run_id)
    .eq("status", search.status);
  if (searchError) return { state: "unconfirmed" as const };
  try {
    const changed = await applyGenerationUpdate(tripId, searchId, "failed", {
      message,
    });
    return {
      state: changed ? ("retry_available" as const) : ("settled" as const),
    };
  } catch {
    return { state: "unconfirmed" as const };
  }
}
