import {
  evidenceTextSha256,
  parseOrdinaryDailyHours,
} from "./activity-hours-evidence";

const months = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];
const weekdays = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];
const normalize = (text: string) =>
  text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
function calendarDate(text: string): string | null {
  const match =
    /^(?:(sunday|monday|tuesday|wednesday|thursday|friday|saturday),? )?(\d{1,2}) ([a-z]+) (\d{4})$/.exec(
      normalize(text),
    );
  if (!match) return null;
  const month = months.indexOf(match[3]);
  if (month < 0) return null;
  const iso = `${match[4]}-${String(month + 1).padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  const stamp = Date.parse(`${iso}T00:00:00Z`);
  if (
    !Number.isFinite(stamp) ||
    new Date(stamp).toISOString().slice(0, 10) !== iso ||
    (match[1] && weekdays[new Date(stamp).getUTCDay()] !== match[1])
  )
    return null;
  return iso;
}
export function parsePublishedHoursPeriod(text: string) {
  const normalized = normalize(text);
  if (normalized.startsWith("current to ")) {
    const through = calendarDate(normalized.slice("current to ".length));
    return through ? { from: null, through } : null;
  }
  const parts = normalized.split(" to ");
  if (parts.length !== 2) return null;
  const from = calendarDate(parts[0]);
  const through = calendarDate(parts[1]);
  return from && through && from <= through ? { from, through } : null;
}

/** Extract one directly adjacent hours line per dated heading, within one retained
 * segment. This is source-text structure, not identity/authority or availability
 * adjudication. Footnotes are marked, never silently treated as unconditional.
 */
export function extractDatedHoursSections(excerpt: string) {
  const result: Array<{
    period: NonNullable<ReturnType<typeof parsePublishedHoursPeriod>>;
    periodQuote: string;
    periodStart: number;
    periodEnd: number;
    hoursQuote: string;
    hoursStart: number;
    hoursEnd: number;
    hours: NonNullable<ReturnType<typeof parseOrdinaryDailyHours>>;
    excerptSha256: string;
    unresolvedFootnote: boolean;
    exceptionContextPresent: boolean;
    omittedContextPresent: boolean;
  }> = [];
  if (!excerpt || excerpt.length > 20000) return result;
  const exceptionContextPresent =
    /\b(?:except|holidays?|special dates|special opening|by appointment)\b/i.test(
      excerpt,
    );
  const omittedContextPresent = /(?:^|\n)\s*(?:\.{3}|…)\s*(?:\n|$)/.test(
    excerpt,
  );
  let offset = 0;
  let pending:
    | {
        period: NonNullable<ReturnType<typeof parsePublishedHoursPeriod>>;
        quote: string;
        start: number;
      }
    | undefined;
  for (const line of excerpt.split("\n")) {
    const trimmed = line.trim();
    const period = parsePublishedHoursPeriod(trimmed);
    if (period)
      pending = {
        period,
        quote: trimmed,
        start: offset + line.indexOf(trimmed),
      };
    else if (trimmed && pending) {
      const hoursQuote = trimmed.replace(/^(?:\*|-|•)\s+/, "");
      const unresolvedFootnote = /(?:am|pm)\\?\*/i.test(hoursQuote);
      const hours = parseOrdinaryDailyHours(
        hoursQuote.replace(/(am|pm)\\?\*/gi, "$1"),
      );
      if (hours) {
        const hoursStart = offset + line.indexOf(hoursQuote);
        result.push({
          period: pending.period,
          periodQuote: pending.quote,
          periodStart: pending.start,
          periodEnd: pending.start + pending.quote.length,
          hoursQuote,
          hoursStart,
          hoursEnd: hoursStart + hoursQuote.length,
          hours,
          excerptSha256: evidenceTextSha256(excerpt),
          unresolvedFootnote,
          exceptionContextPresent,
          omittedContextPresent,
        });
      }
      // Any intervening nonblank text breaks adjacency, including ellipses,
      // an unrecognized date heading or unrelated venue/tour prose.
      pending = undefined;
    }
    offset += line.length + 1;
  }
  return result;
}

export function selectDatedHoursSection(excerpt: string, date: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(date)) ||
    new Date(date).toISOString().slice(0, 10) !== date
  )
    throw Error("A valid local calendar date is required");
  const sections = extractDatedHoursSections(excerpt);
  const matching = sections.filter(
    (section) =>
      (!section.period.from || section.period.from <= date) &&
      date <= section.period.through,
  );
  return {
    status:
      matching.length === 1 && matching[0].period.from
        ? ("candidate" as const)
        : ("unresolved" as const),
    reason:
      matching.length > 1
        ? "overlapping_periods"
        : !matching.length
          ? "no_period_for_date"
          : !matching[0].period.from
            ? "period_start_not_established"
            : "one_explicit_period",
    sections: matching,
    qualityAccepted: false as const,
  };
}
