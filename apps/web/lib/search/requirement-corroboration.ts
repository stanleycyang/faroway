import type { ActivityResult, DiningResult, SearchPlan } from "./types";

const dietClaim =
  /\b(?:allerg\w*|anaphyla\w*|c(?:o)?eliac\w*|cross[ -]?(?:contact|contaminat\w*)|(?:gluten|nuts?|peanuts?|shellfish|dairy)[ -]?free|allergy[ -]safe)\b/i;
const accessPromise =
  /\b(?:wheelchair[ -](?:accessible|friendly)|step[ -]free|stair[ -]free|fully accessible)\b/i;

export const DIETARY_UNVERIFIED_NOTE =
  "Suitability for dietary restrictions has not been verified. Contact the venue before relying on this suggestion.";
export const ACCESS_UNVERIFIED_NOTE =
  "Access for this stop has not been verified with the venue. A draft label is not evidence that the entrance, route or seating meets your request.";

export function accessRequested(
  plan: Pick<SearchPlan, "mobilityNeeds" | "requirements">,
) {
  const request = (plan.mobilityNeeds ?? "").normalize("NFKC").toLowerCase();
  const explicit =
    /^(?:stroller access|wheelchair access|step[- ]free)\b/.test(
      request.trim(),
    ) && !/\b(?:not required|not needed|unnecessary)\b/.test(request);
  return Boolean(plan.requirements?.accessibility?.length) || explicit;
}

function withoutClaims(text: string, claim: RegExp) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !claim.test(sentence))
    .join(" ");
}

/** Drop unsupported suitability labels from a scheduled meal. The venue can
 * stay; the claim cannot be read as confirmed. */
export function corroborateDiningClaim(meal: DiningResult): {
  meal: DiningResult;
  stripped: boolean;
} {
  const options = (meal.dietaryOptions ?? []).filter((item) => item.trim());
  const descriptionClaims = dietClaim.test(meal.description ?? "");
  if (!options.length && !descriptionClaims) return { meal, stripped: false };
  return {
    stripped: true,
    meal: {
      ...meal,
      dietaryOptions: [],
      description: [
        withoutClaims(meal.description ?? "", dietClaim),
        DIETARY_UNVERIFIED_NOTE,
      ]
        .filter(Boolean)
        .join(" "),
    },
  };
}

/** A requested access need is not met by a generated or supplier adjective. */
export function corroborateAccessClaim(
  activity: ActivityResult,
  requested: boolean,
): { activity: ActivityResult; stripped: boolean } {
  if (!requested) return { activity, stripped: false };
  const descriptionClaims = accessPromise.test(activity.description ?? "");
  const vibeClaims = (activity.vibeMatch ?? []).some((label) =>
    accessPromise.test(label),
  );
  if (!descriptionClaims && !vibeClaims) return { activity, stripped: false };
  return {
    stripped: true,
    activity: {
      ...activity,
      description: [
        withoutClaims(activity.description ?? "", accessPromise),
        ACCESS_UNVERIFIED_NOTE,
      ]
        .filter(Boolean)
        .join(" "),
      vibeMatch: activity.vibeMatch.filter(
        (label) => !accessPromise.test(label),
      ),
    },
  };
}
