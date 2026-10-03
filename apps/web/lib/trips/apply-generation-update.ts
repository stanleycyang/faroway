import { createFatalWorkflowError } from "@/lib/workflow/runtime";
import { getSupabase } from "@/lib/supabase/server";

export async function applyGenerationUpdate(
  tripId: string,
  searchId: string,
  state: "progress" | "failed" | "planned",
  payload: Record<string, unknown>,
) {
  const { data, error } = await getSupabase().rpc(
    "apply_trip_generation_update",
    {
      p_trip_id: tripId,
      p_search_id: searchId,
      p_state: state,
      p_payload: payload,
    },
  );
  if (error) throw new Error("Could not save the active planning attempt");
  if (state === "progress" && data !== true)
    throw createFatalWorkflowError("This planning attempt is no longer active");
  return data === true;
}
