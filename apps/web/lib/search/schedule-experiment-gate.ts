/** Explicit staging-only integration. The small reviewed fixture is not general grounding. */
export function compiledScheduleExperimentEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (
    env.FAROWAY_SCHEDULE_EXPERIMENT !== "compiled-narrated-v1" ||
    !["low", "minimal"].includes(env.PLANNING_THINKING_AGGREGATOR ?? "")
  )
    return false;
  if (
    env.VERCEL_ENV !== "preview" &&
    !(env.NODE_ENV === "development" && !env.VERCEL_ENV)
  )
    return false;
  if (
    env.PLANNING_MODEL_AGGREGATOR &&
    env.PLANNING_MODEL_AGGREGATOR !== "google/gemini-3-flash"
  )
    return false;
  if (
    env.PLANNING_MAX_OUTPUT_TOKENS_AGGREGATOR &&
    env.PLANNING_MAX_OUTPUT_TOKENS_AGGREGATOR !== "2000"
  )
    return false;
  try {
    const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    return (
      url.origin === "https://omovikloadpvzijoaqus.supabase.co" &&
      !url.username &&
      !url.password &&
      url.pathname === "/" &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}
