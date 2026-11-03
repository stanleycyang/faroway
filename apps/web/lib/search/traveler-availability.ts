import type { SearchPlan } from "./types";

/** Visit-only day-part restrictions never remove meal slots. Unrecognized scope
 * (specific days, negation or alternatives) requires review rather than guessing.
 */
export function travelerVisitSlots(
  plan: Pick<SearchPlan, "mobilityNeeds" | "requirements">,
) {
  let allowed = ["morning", "afternoon", "evening"];
  let restricted = false;
  let needsReview = false;
  for (const source of [plan.mobilityNeeds, plan.requirements?.mobilityNotes]) {
    if (!source) continue;
    for (const raw of source
      .normalize("NFKC")
      .toLowerCase()
      .split(/[.;\n]/)) {
      const clause = raw.trim();
      const match =
        /^only (morning|afternoon|evening) (?:visits|activities)(?: (?:daily|each day|every day))?$/.exec(
          clause,
        ) ??
        /^(morning|afternoon|evening) (?:visits|activities) only(?: (?:daily|each day|every day))?$/.exec(
          clause,
        );
      const eveningSightseeing =
        /^sightseeing only after (?:18:00|6\s*pm)$/.test(clause);
      if (match || eveningSightseeing) {
        allowed = allowed.filter((slot) => slot === (match?.[1] ?? "evening"));
        restricted = true;
      } else if (
        /\bonly\b/.test(clause) &&
        /\b(?:visits|activities|sightseeing)\b/.test(clause) &&
        /\b(?:morning|afternoon|evening|after|before)\b/.test(clause)
      ) {
        needsReview = true;
      }
    }
  }
  return { allowed, restricted, needsReview: needsReview || !allowed.length };
}

export interface TravelerDayWindow {
  earliestMinute: number;
  latestMinute: number;
  unavailable?: Array<[number, number]>;
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
      ...prior,
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
      const working =
        new RegExp(
          `^working ${CLOCK}\\s*[-–—]\\s*${CLOCK} (?:daily|(?:on )?(?:each|every)(?: trip)? day)$`,
        ).exec(clause) ??
        new RegExp(
          `^(?:business )?meetings (?:daily|(?:on )?(?:each|every)(?: trip)? day) from ${CLOCK}\\s*(?:to|[-–—])\\s*${CLOCK}(?: in [a-z]+(?: [a-z]+){0,3} (?:cbd|city cent(?:er|re)))?$`,
        ).exec(clause);
      if (working) {
        const lower = minute(working[1]),
          upper = minute(working[2]);
        if (lower >= upper) unresolvedClauses.push(clause);
        else
          for (let day = 0; day < days; day++) {
            set(day, 0, 1440);
            (windows[day]!.unavailable ??= []).push([lower, upper]);
          }
      } else if (arrival) set(0, minute(arrival[1]), 1440);
      else if (departure) set(days - 1, 0, minute(departure[1]));
      else if (lateStart)
        for (let day = 0; day < days; day++)
          set(day, minute(lateStart[1]), 1440);
      else if (
        /\b(?:arriv(?:e|al)|depart(?:ure)?|starts? before|working|meetings)\b/.test(
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
/** Intersections preserve gaps: durations cannot be added across a work block. */
export function availableIntervals(
  window: TravelerDayWindow | undefined,
  start: number,
  end: number,
): Array<[number, number]> {
  const lower = Math.max(start, window?.earliestMinute ?? 0);
  const upper = Math.min(end, window?.latestMinute ?? 1440);
  let intervals: Array<[number, number]> =
    lower < upper ? [[lower, upper]] : [];
  for (const [blockedStart, blockedEnd] of window?.unavailable ?? [])
    intervals = intervals.flatMap(
      ([a, b]): Array<[number, number]> =>
        blockedEnd <= a || blockedStart >= b
          ? [[a, b]]
          : [
              ...(a < blockedStart
                ? [[a, blockedStart] as [number, number]]
                : []),
              ...(blockedEnd < b ? [[blockedEnd, b] as [number, number]] : []),
            ],
    );
  return intervals;
}

export function availableSlotMinutes(
  window: TravelerDayWindow | undefined,
  slot: number,
): number {
  if (!window) return Infinity;
  const [start, end] = SLOT_WINDOWS[slot];
  return Math.max(
    0,
    ...availableIntervals(window, start, end).map(([a, b]) => b - a),
  );
}

/** Work blocks must not move lunch to the end of the broad afternoon visit slot.
 * These are the same provisional meal windows used by the timing proposal.
 */
export function availableMealMinutes(
  window: TravelerDayWindow | undefined,
  slot: number,
) {
  if (!window?.unavailable?.length) return availableSlotMinutes(window, slot);
  const [start, end] = [
    [480, 600],
    [720, 840],
    [1080, 1320],
  ][slot];
  return Math.max(
    0,
    ...availableIntervals(window, start, end).map(([a, b]) => b - a),
  );
}

/** Explicit English daily visit-duration ceilings from preserved traveler text.
 * Does not read generated venue prose or evaluation reference limits.
 */
export function travelerActivityBudget(
  plan: Pick<SearchPlan, "mobilityNeeds" | "requirements">,
) {
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
  };
  const number = (value: string) => words[value] ?? Number(value);
  const clauses = [plan.mobilityNeeds, plan.requirements?.mobilityNotes]
    .filter((text): text is string => Boolean(text))
    .flatMap((text) =>
      text
        .normalize("NFKC")
        .toLowerCase()
        .split(/[,;\n]|\.(?!\d)/),
    )
    .map((clause) => clause.trim().replace(/^and\s+/, ""));
  const ceilings: number[] = [];
  let minimum: { count: number; kind: string } | undefined;
  let needsReview = false;
  for (const clause of clauses) {
    const ceiling =
      /^(?:no more than|at most|maximum of) ([a-z]+|\d+(?:\.\d+)?) (hours?|minutes?) of (?:scheduled )?(?:activities|visits|sightseeing) (?:daily|each day|every day|per day)$/.exec(
        clause,
      );
    const request =
      /^at least ([a-z]+|\d+) (museums|visits|activities) (?:daily|each day|every day|per day)$/.exec(
        clause,
      );
    if (ceiling) {
      const minutes =
        number(ceiling[1]) * (ceiling[2].startsWith("hour") ? 60 : 1);
      if (Number.isInteger(minutes) && minutes > 0 && minutes <= 1440)
        ceilings.push(minutes);
      else needsReview = true;
    } else if (
      /\b(?:no more than|at most|maximum)\b.*\b(?:hours?|minutes?)\b.*\b(?:activities|visits|sightseeing)\b/.test(
        clause,
      )
    )
      needsReview = true;
    if (request) {
      const count = number(request[1]);
      if (
        Number.isInteger(count) &&
        count > 0 &&
        count <= 100 &&
        (!minimum || count > minimum.count)
      )
        minimum = { count, kind: request[2] };
    }
  }
  return {
    maxMinutes: ceilings.length ? Math.min(...ceilings) : undefined,
    minimum,
    needsReview,
  };
}
