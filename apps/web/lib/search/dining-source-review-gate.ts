import { compiledScheduleExperimentEnabled } from "./schedule-experiment-gate";

/** Shared by provider dispatch and the disclosure served to web/native clients. */
export function diningSourceReviewEnabled(
  env: Record<string, string | undefined> = process.env,
) {
  return (
    env.FAROWAY_DINING_SOURCE_EXPERIMENT === "public-review-v1" &&
    compiledScheduleExperimentEnabled(env) &&
    Boolean(env.AI_GATEWAY_API_KEY)
  );
}
