/** Bounded English screen for model-authored access claims, not a venue verifier.
 * Provider/source copy must never enter this generated-only boundary.
 */
const accessTopic =
  /\b(?:accessib\w*|wheelchairs?|step[ -]free|stair[ -]free|ramps?|elevators?|lifts?)\b|\bwithout (?:stairs|steps)\b|\b(?:no|without)\s+(?:steep|sloped|uneven|narrow)\s+(?:paths?|routes?|surfaces?|terrain|entrances?|passages?)\b|\b(?:level|flat|flatter|smooth)\s+(?:walking\s+)?(?:interiors?|entrances?|paths?|routes?|surfaces?|floors?|terrain|environment)\b|\b(?:interiors?|entrances?|paths?|routes?|surfaces?|floors?|terrain)\s+(?:(?:is|are|remains?|largely|mostly|generally|relatively|completely)\s+){1,3}(?:level|flat|smooth)\b|\b(?:improved|easy|easier|seamless)\s+(?:connectivity|movement|access)\s+between\s+floors\b/i;
const obstacle =
  /\binaccessible\b|\bno wheelchair access\b|\b(?:not|never)\s+(?:(?:wheelchair|stroller)[ -])?accessible\b|\b(?:no|without)\s+(?:step[ -]free access|lifts?|elevators?|ramps?)\b|\b(?:has|have|includes?|requires?|involves?)\s+(?:(?:some|many|several|steep|narrow|unavoidable|multiple|small|raised|a flight of)\s+){0,3}(?:stairs|steps|thresholds)\b|\b(?:steep|sloped|uneven|narrow)\s+(?:paths?|routes?|surfaces?|terrain|entrances?|passages?)\b|\b(?:paths?|routes?|surfaces?|terrain|sections)\s+(?:(?:is|are|can be|sometimes|quite)\s+){1,2}(?:steep|sloped|uneven|narrow)\b/i;
const normalize = (text: string) =>
  text.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "");
const hasObstacle = (text: string) =>
  obstacle.test(
    normalize(text)
      .replace(
        /\b(?:no|without)\s+(?:steep|sloped|uneven|narrow)\s+(?:paths?|routes?|surfaces?|terrain|entrances?|passages?)\b/gi,
        "",
      )
      .replace(
        /\b(?:(?:does|do) not|doesn't|don't)\s+(?:have|include|require|involve)\s+[^.;!?]*/gi,
        "",
      ),
  );
const sentences = new Intl.Segmenter("en", { granularity: "sentence" });
export const GENERATED_ACCESS_REVIEW_NOTE =
  "Access has not been verified. Confirm entrances, internal routes, lifts, toilets and any boarding assistance directly with the venue before relying on this suggestion.";
export const GENERATED_ACCESS_CONCERN_NOTE =
  "The generated description reports an access obstacle. This suggestion needs access review before use; confirm the obstacle and any alternative route directly with the venue.";

function screenGeneratedAccessCopy<
  T extends { name: string; description: string; vibeMatch: string[] },
>(candidate: T): T {
  const priorConcern = candidate.description.endsWith(
    GENERATED_ACCESS_CONCERN_NOTE,
  );
  const note = priorConcern
    ? GENERATED_ACCESS_CONCERN_NOTE
    : candidate.description.endsWith(GENERATED_ACCESS_REVIEW_NOTE)
      ? GENERATED_ACCESS_REVIEW_NOTE
      : "";
  const content = note
    ? candidate.description.slice(0, -note.length).trim()
    : candidate.description;
  const concerned =
    priorConcern ||
    [candidate.name, content, ...candidate.vibeMatch].some(hasObstacle);
  const flagged =
    concerned ||
    [candidate.name, content, ...candidate.vibeMatch].some((text) =>
      accessTopic.test(normalize(text)),
    );
  if (!flagged && !note) return { ...candidate };
  const kept = [...sentences.segment(content)]
    .map(({ segment }) => segment.trim())
    .filter(
      (text) =>
        text && !accessTopic.test(normalize(text)) && !hasObstacle(text),
    );
  // Remove generated access promises from the title while preserving stable IDs.
  const name = hasObstacle(candidate.name)
    ? candidate.name
    : normalize(candidate.name)
        .replace(
          /\b(?:wheelchair[ -]accessible|accessible|step[ -]free|stair[ -]free)\s*/gi,
          "",
        )
        .trim();
  return {
    ...candidate,
    name: name || "Activity requiring access review",
    description: [
      ...kept,
      concerned ? GENERATED_ACCESS_CONCERN_NOTE : GENERATED_ACCESS_REVIEW_NOTE,
    ].join(" "),
    vibeMatch: candidate.vibeMatch.filter(
      (label) => !accessTopic.test(normalize(label)) && !hasObstacle(label),
    ),
  };
}

// Bounded English operating-hours screen, not semantic verification. The agent
// has no source for operating times. Keep visit-duration estimates and ordinary
// experience prose; never convert a generated closing time into scheduling data.
const operatingHours =
  /\b(?:opening|closing|operating|business)\s+(?:hours|times?)\b|\blast\s+(?:entry|admission)\b|\b(?:opens?|closes?|closed|closing)\s+(?:(?:typically|usually|normally|daily|every day)\s+)?(?:at|by|from|until|on|for|during|after|before|\d)\b|\bopen\s+(?:until|till|from|daily|nightly|late|24|all day|around the clock|every|on weekdays|on weekends)\b/i;

export function screenGeneratedActivityCopy<
  T extends { name: string; description: string; vibeMatch: string[] },
>(candidate: T): T {
  // Access concerns are retained before removing any mixed hours/access prose.
  const screened = screenGeneratedAccessCopy(candidate);
  const original = [...sentences.segment(screened.description)].map(
    ({ segment }) => segment.trim(),
  );
  const kept = original.filter((text) => !operatingHours.test(normalize(text)));
  if (kept.length === original.length) return screened;
  return {
    ...screened,
    description: kept.join(" ") || "Explore this suggested stop.",
  };
}
