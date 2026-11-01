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
