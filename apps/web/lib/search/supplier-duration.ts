import type { SearchPlan } from "./types";

/** City pace ceiling sent to supplier search. Nature and explicit day-trip
 * briefs do not impose it. This does not prove a returned product fits the day. */
export function supplierDurationCeilingMinutes(
  plan: Pick<SearchPlan, "activityCriteria" | "vibeInterpretation">,
): number | undefined {
  const dayTrip =
    plan.vibeInterpretation.vibes.some((vibe) =>
      ["nature", "adventure"].includes(vibe),
    ) ||
    [...plan.activityCriteria.interests, ...plan.activityCriteria.mustSee].some(
      (interest) =>
        /\b(nature|outdoors?|hiking|day trip|day tour|full.day|mountain|fuji|hakone)\b/i.test(
          interest,
        ),
    );
  if (dayTrip) return undefined;
  return plan.activityCriteria.pacePreference === "relaxed"
    ? 180
    : plan.activityCriteria.pacePreference === "packed"
      ? 360
      : 240;
}
