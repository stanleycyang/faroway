/** Explicit uncertainty in an event title is a review lead, not a dated visit.
 * This narrow screen does not verify unflagged events or ordinary opening hours.
 */
export function isSpeculativeEventTitle(title: string): boolean {
  const text = title.normalize("NFKC").toLowerCase();
  return (
    /\b(?:exhibition|concert|performance|festival|show|event)\b/.test(text) &&
    /\b(?:check (?:local )?schedules?|dates? (?:to be confirmed|tbc|tbd)|if (?:available|running|scheduled)|subject to (?:schedule|confirmation))\b/.test(
      text,
    )
  );
}

/** A venue or broad show category does not identify a particular performance. */
export function isGenericEventTitle(title: string): boolean {
  const text = title.normalize("NFKC").toLowerCase().trim();
  return (
    /^(?:a )?broadway show$/.test(text) ||
    /^(?:classical (?:music )?)?(?:performance|concert|show) at (?!.*\b(?:with|featuring)\b)[^:;()]+$/.test(
      text,
    )
  );
}

/** Special admission needs dated opening evidence, not ordinary venue hours.
 * Outdoor evening walks and ordinary evening visits do not imply special admission.
 * This is a bounded review screen, not an opening-hours verifier.
 */
export function isSpecialOpeningTitle(title: string): boolean {
  return /\b(?:late[-\s]+(?:view(?:ing)?s?|openings?)|after[-\s]+hours?\s+(?:admission|access|visit|viewing|opening|tour)s?)\b/i.test(
    title.normalize("NFKC"),
  );
}

/** A recurring weekday label is not evidence that an event runs on this trip.
 * Deliberately bounded to weekday + event/day-part phrases, not every proper
 * name containing a weekday. Named venues still need their own verification.
 */
export function isWeekdayEventTitle(title: string): boolean {
  const day = "(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)s?";
  const event =
    "(?:nights?|evenings?|mornings?|markets?|concerts?|performances?|festivals?|shows?|tours?|openings?)";
  return new RegExp(
    `\\b(?:${day}[-\\s]+${event}|${event}\\s+on\\s+${day})\\b`,
    "i",
  ).test(title.normalize("NFKC"));
}
