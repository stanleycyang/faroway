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
