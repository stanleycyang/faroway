import { readDayTiming } from "../../../packages/types/src/day-timing";

/** Authored reference constraints, not facts inferred from model output. */
export interface DayAvailability {
  date: string;
  earliestMinute: number;
  latestMinute: number;
  allowEmptyDay?: boolean;
}
const parts = {
  morning: [0, 720],
  afternoon: [720, 1080],
  evening: [1080, 1440],
} as const;
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};

export function validateDayAvailability(
  windows: readonly DayAvailability[],
  dates: readonly string[],
): void {
  const seen = new Set<string>();
  for (const window of windows) {
    if (
      seen.has(window.date) ||
      !dates.includes(window.date) ||
      !Number.isInteger(window.earliestMinute) ||
      !Number.isInteger(window.latestMinute) ||
      window.earliestMinute < 0 ||
      window.latestMinute > 1440 ||
      window.earliestMinute >= window.latestMinute ||
      (window.allowEmptyDay !== undefined &&
        typeof window.allowEmptyDay !== "boolean")
    )
      throw new Error("Invalid reference day availability");
    seen.add(window.date);
  }
}

/** Day parts establish only coarse contradictions, never exact clock feasibility. */
export function evaluateDayAvailability(
  rawDay: unknown,
  window: DayAvailability,
): { violations: string[]; unknowns: string[] } {
  const day = object(rawDay);
  if (day.date !== window.date)
    throw new Error("Reference day availability date mismatch");
  const violations: string[] = [];
  const unknowns: string[] = [];
  const timing = readDayTiming(day);
  if (timing?.fitsPolicy) {
    for (const event of timing.events) {
      if (
        event.startMinute < window.earliestMinute ||
        event.endMinute > window.latestMinute
      )
        violations.push(`event_outside_availability:${event.id}`);
    }
    return { violations, unknowns };
  }
  for (const [name, [start, end]] of Object.entries(parts)) {
    const slot = object(day[name]);
    const activities = Array.isArray(slot.activities) ? slot.activities : [];
    if (!activities.length && !slot.meal) continue;
    if (end <= window.earliestMinute || start >= window.latestMinute)
      violations.push(`day_part_outside_availability:${name}`);
    else unknowns.push(`availability_clock_times_unverified:${name}`);
  }
  return { violations, unknowns };
}
