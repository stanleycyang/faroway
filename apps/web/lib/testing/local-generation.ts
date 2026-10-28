import { getSupabase } from "@/lib/supabase/server";
import { applyGenerationUpdate } from "@/lib/trips/apply-generation-update";

export function localGenerationScenario(
  env: Record<string, string | undefined> = process.env,
): "success" | "failure" | "timeout" | null {
  const mode = env.FAROWAY_TEST_GENERATION;
  if (!mode) return null;
  const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL || "http://invalid");
  if (
    env.NODE_ENV !== "development" ||
    env.VERCEL ||
    url.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password ||
    !["success", "failure", "timeout"].includes(mode)
  ) {
    throw new Error(
      "Fixture generation requires local development and loopback Supabase",
    );
  }
  return mode as "success" | "failure" | "timeout";
}

export async function completeLocalGeneration(
  input: {
    tripId: string;
    searchId: string;
    destination: string;
    startDate: string;
    endDate: string;
    userId: string;
  },
  scenario: "success" | "failure" | "timeout",
) {
  if (localGenerationScenario() !== scenario)
    throw new Error("Fixture configuration changed");
  const db = getSupabase();
  if (scenario === "timeout") return;
  if (scenario === "failure") {
    const { error } = await db
      .from("searches")
      .update({
        status: "error",
        error_message: "Synthetic planning failure",
        workflow_run_verified: true,
      })
      .eq("id", input.searchId)
      .eq("user_id", input.userId);
    if (error) throw error;
    if (
      !(await applyGenerationUpdate(input.tripId, input.searchId, "failed", {
        message: "Synthetic planning failure",
      }))
    )
      throw new Error("Fixture attempt superseded");
    return;
  }
  const start = Date.parse(`${input.startDate}T00:00:00Z`);
  const end = Date.parse(`${input.endDate}T00:00:00Z`);
  const count = Math.floor((end - start) / 86400000) + 1;
  if (!Number.isFinite(count) || count < 1 || count > 31)
    throw new Error("Fixture supports 1–31 days");
  const days = Array.from({ length: count }, (_, i) => ({
    dayNumber: i + 1,
    date: new Date(start + i * 86400000).toISOString().slice(0, 10),
    title: `TEST PLAN — Day ${i + 1}`,
    summary: `Synthetic itinerary for ${input.destination}; no real venues or bookings.`,
    morning: {
      activities: [
        {
          id: `test-walk-${i}`,
          name: "Synthetic neighborhood walk",
          description: "Test fixture only. Verify real plans separately.",
          duration: "1 hour",
          category: "sightseeing",
          location: { name: input.destination },
          tips: [],
        },
      ],
      meals: [],
    },
    afternoon: { activities: [], meals: [] },
    evening: { activities: [], meals: [] },
    tips: ["TEST DATA — not travel advice"],
  }));
  const saved = await applyGenerationUpdate(
    input.tripId,
    input.searchId,
    "planned",
    {
      trip_id: input.tripId,
      user_id: input.userId,
      destination: input.destination,
      start_date: input.startDate,
      end_date: input.endDate,
      overview:
        "TEST PLAN — deterministic fixture; no live AI or supplier calls.",
      days,
      packing_list: [],
      general_tips: ["Synthetic test data only"],
      generated_at: new Date().toISOString(),
    },
  );
  if (!saved) throw new Error("Fixture attempt superseded");
  const { error } = await db
    .from("searches")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      workflow_run_verified: true,
      intermediate_results: { days },
      progress: Object.fromEntries(
        [
          "orchestrator",
          "hotels",
          "activities",
          "dining",
          "transport",
          "enrichment",
          "aggregator",
        ].map((key) => [key, "done"]),
      ),
    })
    .eq("id", input.searchId)
    .eq("user_id", input.userId);
  if (error) throw error;
}
