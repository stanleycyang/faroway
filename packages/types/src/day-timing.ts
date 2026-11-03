/** A proposed local-clock schedule, never a verified route or reservation. */
export interface DayTimingProposal {
  policy: "midday-rest-v1";
  basis: string;
  fitsPolicy: boolean;
  verified: false;
  events: Array<{
    id: string;
    kind: "activity" | "meal" | "rest";
    durationMinutes: number;
    startMinute: number;
    endMinute: number;
    bufferBeforeMinutes: number;
  }>;
  conflict: { eventId: string; overrunMinutes: number } | null;
}
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

/** Stable across agent and saved-day meal shapes; not a security signature. */
export function dayTimingBasis(value: unknown): string {
  const day = record(value);
  return JSON.stringify({
    date: day.date,
    slots: ["morning", "afternoon", "evening"].map((slot) => {
      const block = record(day[slot]);
      const meals = Array.isArray(block.meals)
        ? block.meals
        : block.meal
          ? [block.meal]
          : [];
      return {
        activities: list(block.activities).map((value) => {
          const a = record(value);
          return [a.id, a.name, a.duration];
        }),
        meals: meals.map((value) => {
          const meal = record(value);
          return [meal.id, meal.name];
        }),
      };
    }),
  });
}

/** Reject stale or malformed proposals at mapping boundaries, without rewriting input. */
export function readDayTiming(value: unknown): DayTimingProposal | undefined {
  const day = record(value),
    timing = record(day.timingProposal);
  if (
    timing.policy !== "midday-rest-v1" ||
    timing.verified !== false ||
    typeof timing.fitsPolicy !== "boolean" ||
    timing.basis !== dayTimingBasis(day) ||
    !Array.isArray(timing.events)
  )
    return undefined;
  if (!timing.fitsPolicy) {
    const conflict = record(timing.conflict);
    if (
      timing.events.length ||
      typeof conflict.eventId !== "string" ||
      !Number.isInteger(conflict.overrunMinutes) ||
      (conflict.overrunMinutes as number) <= 0
    )
      return undefined;
    return timing as unknown as DayTimingProposal;
  }
  if (timing.conflict !== null) return undefined;
  const expected: Array<{
    id: string;
    kind: string;
    duration: unknown;
    start: number;
    end: number;
  }> = [];
  const meal = (slot: string, duration: number) => {
    const block = record(day[slot]);
    const meals = Array.isArray(block.meals)
      ? block.meals
      : block.meal
        ? [block.meal]
        : [];
    for (const item of meals)
      expected.push({
        id: `meal:${slot}:${record(item).id}`,
        kind: "meal",
        duration,
        start: slot === "morning" ? 480 : slot === "afternoon" ? 720 : 1080,
        end: slot === "morning" ? 600 : slot === "afternoon" ? 840 : 1320,
      });
  };
  const visits = (slot: string) => {
    for (const item of list(record(day[slot]).activities)) {
      const activity = record(item);
      expected.push({
        id: `activity:${activity.id}`,
        kind: "activity",
        duration: activity.duration,
        start: slot === "morning" ? 540 : slot === "afternoon" ? 840 : 1080,
        end: slot === "morning" ? 780 : slot === "afternoon" ? 1080 : 1320,
      });
    }
  };
  meal("morning", 45);
  visits("morning");
  meal("afternoon", 60);
  expected.push({
    id: "rest:midday",
    kind: "rest",
    duration: 60,
    start: 780,
    end: 900,
  });
  visits("afternoon");
  visits("evening");
  meal("evening", 60);
  if (timing.events.length !== expected.length) return undefined;
  let previousEnd = 0;
  const ids = new Set<string>();
  for (let i = 0; i < expected.length; i++) {
    const event = record(timing.events[i]),
      wanted = expected[i];
    if (
      event.id !== wanted.id ||
      ids.has(wanted.id) ||
      event.kind !== wanted.kind ||
      event.durationMinutes !== wanted.duration ||
      ![
        event.startMinute,
        event.endMinute,
        event.durationMinutes,
        event.bufferBeforeMinutes,
      ].every(Number.isInteger)
    )
      return undefined;
    const start = event.startMinute as number,
      end = event.endMinute as number,
      duration = event.durationMinutes as number,
      buffer = event.bufferBeforeMinutes as number;
    if (
      duration <= 0 ||
      buffer !== (i > 0 && event.kind !== "rest" ? 30 : 0) ||
      start < previousEnd + buffer ||
      start < wanted.start ||
      end > wanted.end ||
      end - start !== duration ||
      (event.kind === "rest" && (start < 780 || end > 900))
    )
      return undefined;
    previousEnd = end;
    ids.add(wanted.id);
  }
  return timing as unknown as DayTimingProposal;
}

export function dayTimingTips(value: unknown): string[] {
  const day = record(value);
  const tips = list(day.tips).filter(
    (tip): tip is string => typeof tip === "string" && !!tip.trim(),
  );
  if (day.timingProposal === undefined || readDayTiming(day)) return tips;
  return [
    "Proposed times need a fresh review.",
    ...tips.filter(
      (tip) =>
        !/^(Proposed local timing:|This draft reserves a suggested one-hour midday rest\.|The selected visits do not fit the proposed meal, buffer and one-hour midday-rest windows\.)/.test(
          tip,
        ),
    ),
  ];
}

export function isTimingNote(tip: string): boolean {
  return /^(Proposed local timing:|This draft reserves a suggested one-hour midday rest\.|The selected visits do not fit the proposed meal, buffer and one-hour midday-rest windows\.)/.test(
    tip,
  );
}

export function timingPresentation(
  proposal: DayTimingProposal,
  names: Record<string, string>,
) {
  const clock = (minute: number) =>
    `${Math.floor(minute / 60)
      .toString()
      .padStart(2, "0")}:${(minute % 60).toString().padStart(2, "0")}`;
  return {
    heading: proposal.fitsPolicy ? "Suggested timing" : "Timing needs review",
    description: proposal.fitsPolicy
      ? "Local times, not confirmed bookings. Check opening hours and routes."
      : "These visits do not fit the proposed meal, buffer and midday-rest windows. Review the schedule before using it.",
    rows: proposal.fitsPolicy
      ? proposal.events.map((event) => ({
          id: event.id,
          kind: event.kind,
          time: `${clock(event.startMinute)}–${clock(event.endMinute)}`,
          label:
            event.kind === "rest"
              ? "Midday rest"
              : names[event.id] || (event.kind === "meal" ? "Meal" : "Visit"),
        }))
      : [],
    assumptions:
      "One-hour rest near lunch; 45 minutes for breakfast, one hour for other meals, and 30-minute planning buffers. Actual travel and any hotel return need checking.",
  };
}
