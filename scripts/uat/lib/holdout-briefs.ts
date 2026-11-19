import holdout from "../../fixtures/agentic-holdout-briefs.json";
import type { UatBrief } from "./briefs";

/** Reserved for a final run. Do not import this module from prompt tuning or the default suite. */
export const HOLDOUT_BRIEFS: UatBrief[] = holdout.holdout.map(
  (item) => item.brief as UatBrief,
);

export const HOLDOUT_REVIEW = holdout.holdout;
