import type { ActivityResult, DiningResult, SearchPlan } from "./types";

const dietClaim =
  /\b(?:allerg\w*|anaphyla\w*|c(?:o)?eliac\w*|cross[ -]?(?:contact|contaminat\w*)|(?:gluten|wheat|nuts?|tree[ -]?nuts?|peanuts?|shellfish|fish|dairy|milk|lactose|eggs?|soy|sesame|sulfites?)[ -]?(?:free|safe|friendly)|allergy[ -]?(?:safe|friendly)|vegan|vegetarian|halal|kosher)\b/i;
const accessPromise =
  /\b(?:wheelchair[ -](?:accessible|friendly)|step[ -]free|stair[ -]free|fully accessible)\b/i;

const ACCESS_NEED_PATTERN =
  /\b(?:stroller(?:\s+access)?|wheelchair(?:\s+access)?|step[- ]free(?:\s+access|\s+entrance|\s+routes?)?|stair[- ]free)\b/i;
const ACCESS_NEGATION_PATTERN =
  /\b(?:not\s+required|not\s+needed|no\s+(?:wheelchair|stroller|step[- ]free|stair[- ]free)(?:\s+access)?\s+(?:needed|required)|unnecessary)\b/i;

export const DIETARY_UNVERIFIED_NOTE =
  "Suitability for dietary restrictions has not been verified. Contact the venue before relying on this suggestion.";
export const ACCESS_UNVERIFIED_NOTE =
  "Access for this stop has not been verified with the venue. A draft label is not evidence that the entrance, route or seating meets your request.";

type MobilityPlanInput = {
  mobilityNeeds?: string;
  requirements?: {
    allergies?: readonly string[];
    dietaryPreferences?: readonly string[];
    accessibility?: readonly string[];
    mobilityNotes?: string;
  };
};

export function stepFreeTextRequested(plan: MobilityPlanInput): boolean {
  const clauses = [plan.mobilityNeeds, plan.requirements?.mobilityNotes]
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim().length > 0,
    )
    .flatMap((value) =>
      value
        .normalize("NFKC")
        .toLowerCase()
        .split(/[.;\n]/),
    )
    .map((clause) => clause.trim())
    .filter(Boolean);
  return clauses.some(
    (clause) =>
      ACCESS_NEED_PATTERN.test(clause) && !ACCESS_NEGATION_PATTERN.test(clause),
  );
}

export function stepFreeRequested(plan: MobilityPlanInput): boolean {
  return (
    Boolean(plan.requirements?.accessibility?.includes("step_free_entrance")) ||
    stepFreeTextRequested(plan)
  );
}

export function accessRequested(
  plan: Pick<SearchPlan, "mobilityNeeds" | "requirements">,
) {
  return (
    Boolean(plan.requirements?.accessibility?.length) ||
    stepFreeTextRequested(plan)
  );
}

function withoutClaims(text: string, claim: RegExp) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !claim.test(sentence))
    .join(" ");
}

function withoutClaimPhrase(text: string, claim: RegExp) {
  return text
    .replace(new RegExp(claim.source, "gi"), " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim()
    .replace(/^[\s,.;:-]+|[\s,.;:-]+$/g, "");
}

/** Drop unsupported suitability labels from a scheduled meal. The venue can
 * stay; the claim cannot be read as confirmed. */
export function corroborateDiningClaim(meal: DiningResult): {
  meal: DiningResult;
  stripped: boolean;
} {
  const options = (meal.dietaryOptions ?? []).filter((item) => item.trim());
  const descriptionClaims = dietClaim.test(meal.description ?? "");
  const nameClaims = dietClaim.test(meal.name ?? "");
  const cuisineClaims = (meal.cuisineTypes ?? []).some((item) =>
    dietClaim.test(item),
  );
  if (!options.length && !descriptionClaims && !nameClaims && !cuisineClaims)
    return { meal, stripped: false };
  return {
    stripped: true,
    meal: {
      ...meal,
      name: nameClaims
        ? withoutClaimPhrase(meal.name, dietClaim) || "Restaurant"
        : meal.name,
      dietaryOptions: [],
      cuisineTypes: (meal.cuisineTypes ?? []).filter(
        (item) => !dietClaim.test(item),
      ),
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
  const nameClaims = accessPromise.test(activity.name ?? "");
  const vibeClaims = (activity.vibeMatch ?? []).some((label) =>
    accessPromise.test(label),
  );
  if (!descriptionClaims && !nameClaims && !vibeClaims)
    return { activity, stripped: false };
  return {
    stripped: true,
    activity: {
      ...activity,
      name: nameClaims
        ? withoutClaimPhrase(activity.name, accessPromise) || "Visit"
        : activity.name,
      description: [
        withoutClaims(activity.description ?? "", accessPromise),
        ACCESS_UNVERIFIED_NOTE,
      ]
        .filter(Boolean)
        .join(" "),
      vibeMatch: (activity.vibeMatch ?? []).filter(
        (label) => !accessPromise.test(label),
      ),
    },
  };
}
