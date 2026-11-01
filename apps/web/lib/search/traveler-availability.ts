import type { SearchPlan } from "./types";

export interface TravelerDayWindow {
  earliestMinute: number;
  latestMinute: number;
}
const CLOCK =
  "((?:[01]?\\d|2[0-3]):[0-5]\\d|(?:1[0-2]|[1-9])(?::[0-5]\\d)?\\s*(?:am|pm))";
const minute = (text: string): number => {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(text)!;
  const hour = Number(match[1]);
  return (
    (match[3] ? (hour % 12) + (match[3] === "pm" ? 12 : 0) : hour) * 60 +
    Number(match[2] ?? 0)
  );
};

/** Narrow, deterministic interpretation of explicit local-clock instructions.
 * Reads only preserved traveler fields, never venue descriptions or eval references.
 * Unrecognized wording remains a review issue rather than inferred availability.
 */
export function travelerAvailability(
  plan: Pick<SearchPlan, "mobilityNeeds" | "requirements">,
  days: number,
) {
  const windows: Array<TravelerDayWindow | undefined> = Array.from({
    length: days,
  });
  const unresolvedClauses: string[] = [];
  const sources = [plan.mobilityNeeds, plan.requirements?.mobilityNotes].filter(
    (text): text is string => Boolean(text),
  );
  const set = (day: number, lower: number, upper: number) => {
    const prior = windows[day] ?? { earliestMinute: 0, latestMinute: 1440 };
    windows[day] = {
      earliestMinute: Math.max(prior.earliestMinute, lower),
      latestMinute: Math.min(prior.latestMinute, upper),
    };
  };
  for (const source of sources)
    for (const raw of source
      .normalize("NFKC")
      .toLowerCase()
      .split(/[.;\n]/)) {
      const clause = raw.trim();
      const arrival =
        new RegExp(
          `^(?:arrive|arrival)(?: on)? (?:the )?(?:first day|day 1) (?:at )?${CLOCK}$`,
        ).exec(clause) ??
        new RegExp(`^(?:first[- ]day|day 1) arrival (?:at )?${CLOCK}$`).exec(
          clause,
        );
      const departure =
        new RegExp(
          `^(?:depart|departure)(?: on)? (?:the )?(?:final|last) day (?:at )?${CLOCK}$`,
        ).exec(clause) ??
        new RegExp(
          `^(?:depart|departure) (?:at )?${CLOCK} on (?:the )?(?:final|last) day$`,
        ).exec(clause);
      const lateStart = new RegExp(`^no starts? before ${CLOCK}$`).exec(clause);
      if (arrival) set(0, minute(arrival[1]), 1440);
      else if (departure) set(days - 1, 0, minute(departure[1]));
      else if (lateStart)
        for (let day = 0; day < days; day++)
          set(day, minute(lateStart[1]), 1440);
      else if (
        /\b(?:arriv(?:e|al)|depart(?:ure)?|starts? before|working)\b/.test(
          clause,
        )
      )
        unresolvedClauses.push(clause);
    }
  const needsReview = unresolvedClauses.some(
    (clause) =>
      !(
        clause === "no activities before arrival" &&
        (windows[0]?.earliestMinute ?? 0) > 0
      ),
  );
  return { windows, needsReview };
}

/** Conservative planning envelopes, not venue hours or verified transfer times. */
const SLOT_WINDOWS = [
  [480, 720],
  [720, 1080],
  [1080, 1320],
] as const;
export function availableSlotMinutes(
  window: TravelerDayWindow | undefined,
  slot: number,
): number {
  if (!window) return Infinity;
  const [start, end] = SLOT_WINDOWS[slot];
  return Math.max(
    0,
    Math.min(end, window.latestMinute) - Math.max(start, window.earliestMinute),
  );
}
