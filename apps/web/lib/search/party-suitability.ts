import { GENERATED_ACCESS_CONCERN_NOTE } from "./generated-activity-copy";

/** Explicit public-transport instruction versus a private motor-tour title.
 * Does not certify any timetable or infer a route from a transport preference.
 */
export function activityTransportReviewReason(
  needs: { mobilityNeeds?: string; requirements?: { mobilityNotes?: string } },
  title: string,
): "private_transport_conflicts_with_request" | null {
  const request = [needs.mobilityNeeds, needs.requirements?.mobilityNotes]
    .filter(Boolean)
    .join(". ")
    .normalize("NFKC")
    .toLowerCase();
  const publicOnly =
    /(?:^|[.;!?]\s*)(?:(?:use|only use|travel by)\s+public transport(?:ation)?\b|public transport only\b)/.test(
      request,
    );
  return publicOnly &&
    /\b(?:taxi|chauffeur|private car|private driver)\b/i.test(title)
    ? "private_transport_conflicts_with_request"
    : null;
}
/**
 * Conservative title screening for shared itineraries that include children.
 * These are reasons to seek suitability evidence, not legal age restrictions.
 * No match means unknown suitability, never "family-safe".
 */
export function familyActivityReviewReason(
  title: string,
): "adult_only_label" | "alcohol_focused_title" | null {
  const text = title.normalize("NFKC").toLowerCase();
  if (/\badults?[ -]only\b|\b(?:18|21)\s*\+/.test(text))
    return "adult_only_label";
  // An explicitly non-alcoholic activity title is not an alcohol-focused offer.
  // This does not certify that children can attend it.
  if (/^(?:non[ -]?alcoholic|alcohol[ -]?free|zero[ -]?proof)\b/.test(text))
    return null;
  if (
    /\b(?:wine|beer|whisky|whiskey|spirits?|gin|rum|vodka|tequila|cocktails?)\s+(?:tastings?|pairings?|experience|tour|workshop|class)\b/.test(
      text,
    ) ||
    /\b(?:pub|bar)\s+(?:crawl|hopping)\b/.test(text) ||
    /\b(?:brewery|distillery)\s+(?:tour|tasting)\b/.test(text) ||
    /\bmixology\s+(?:class|workshop|experience)\b/.test(text)
  )
    return "alcohol_focused_title";
  return null;
}

/** Narrow contradiction screen over supplied descriptions, not an accessibility verifier. */
export function activityMobilityReviewReason(
  needs: {
    mobilityNeeds?: string;
    requirements?: { accessibility?: readonly string[] };
  },
  description = "",
  title = "",
): "supplied_access_conflict" | "boarding_access_requires_review" | null {
  const request = (needs.mobilityNeeds ?? "").normalize("NFKC").toLowerCase();
  const explicitRequest =
    /^(?:stroller access|wheelchair access|step[- ]free)\b/.test(
      request.trim(),
    ) && !/\b(?:not required|not needed|unnecessary)\b/.test(request);
  if (
    !needs.requirements?.accessibility?.includes("step_free_entrance") &&
    !explicitRequest
  )
    return null;
  // A generated boat title cannot establish accessible boarding. This applies
  // across departure-name variants; a waterfront walk is not a boat journey.
  if (
    /\b(?:canal\s+(?:tours?|cruises?)|boat\s+(?:tours?|trips?|cruises?)|ferry\s+(?:rides?|trips?))\b/i.test(
      title,
    )
  )
    return "boarding_access_requires_review";
  if (description.includes(GENERATED_ACCESS_CONCERN_NOTE))
    return "supplied_access_conflict";
  const text = description.normalize("NFKC").toLowerCase();
  if (
    /\b(?:not wheelchair accessible|not stroller accessible|no step[- ]free access)\b/.test(
      text,
    )
  )
    return "supplied_access_conflict";
  // Preserve negated requirements. Optional stairs alone do not establish a conflict.
  const positive = text.replace(
    /\b(?:(?:does|do) not|doesn't|don't)\s+(?:have|include|require|involve)\s+[^.;!?]*/g,
    "",
  );
  return /\b(?:has|have|includes?|requires?|involves?)\s+(?:(?:some|many|several|steep|narrow|unavoidable|multiple|a flight of)\s+){0,3}(?:stairs|steps)\b/.test(
    positive,
  )
    ? "supplied_access_conflict"
    : null;
}
