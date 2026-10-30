import { inclusiveDays } from "./briefs";

export interface PlanQuality {
  ok: boolean;
  failures: string[];
  notes: string[];
  reservationUrls: string[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function collectReservationUrls(value: unknown, found: string[]): void {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectReservationUrls(item, found);
    return;
  }
  const record = value as Record<string, unknown>;
  for (const [key, child] of Object.entries(record)) {
    if (
      (key === "reservationUrl" || key === "url") &&
      typeof child === "string" &&
      child.includes("opentable.com")
    ) {
      found.push(child);
    } else collectReservationUrls(child, found);
  }
}

function slotCount(slot: unknown, key: "activities" | "meals"): number {
  const record = asRecord(slot);
  const value = record?.[key];
  if (Array.isArray(value)) return value.length;
  if (key === "meals" && record?.meal) return 1;
  return 0;
}

export function evaluateSavedPlan(
  body: unknown,
  dates: { startDate: string; endDate: string },
): PlanQuality {
  const failures: string[] = [];
  const notes: string[] = [];
  const root = asRecord(body);
  const trip = asRecord(root?.trip);
  const itinerary = asRecord(root?.itinerary) ?? asRecord(trip?.itinerary);
  const days = Array.isArray(itinerary?.days) ? itinerary.days : [];
  const expected = inclusiveDays(dates.startDate, dates.endDate);
  if (trip?.status !== "planned") failures.push("trip status is not planned");
  if (days.length !== expected.length) {
    failures.push(`expected ${expected.length} days, found ${days.length}`);
  }
  const actualDates = days.map((day) => {
    const record = asRecord(day);
    return typeof record?.date === "string" ? record.date : "";
  });
  if (actualDates.join() !== expected.join()) {
    failures.push(
      `dates ${actualDates.join(",") || "(none)"} != ${expected.join(",")}`,
    );
  }
  let fallbackDays = 0;
  for (const day of days) {
    const record = asRecord(day);
    const title = typeof record?.title === "string" ? record.title : "";
    const summary = typeof record?.summary === "string" ? record.summary : "";
    if (
      /^Day \d+ in /.test(title) &&
      /^Explore .+ with a mix of activities and dining\.$/.test(summary)
    ) {
      fallbackDays += 1;
    }
    const activities =
      slotCount(record?.morning, "activities") +
      slotCount(record?.afternoon, "activities") +
      slotCount(record?.evening, "activities");
    const meals =
      slotCount(record?.morning, "meals") +
      slotCount(record?.afternoon, "meals") +
      slotCount(record?.evening, "meals");
    if (activities < 1) failures.push(`${title || "day"} has no activities`);
    if (meals < 1) failures.push(`${title || "day"} has no meals`);
    if (
      record?.transport &&
      record?.dayNumber !== 1 &&
      record?.date !== expected[0]
    ) {
      failures.push("transport is present after day 1");
    }
  }
  if (days.length > 0 && fallbackDays === days.length) {
    failures.push("saved plan matches the aggregator fallback template");
  }
  const reservationUrls: string[] = [];
  collectReservationUrls(itinerary, reservationUrls);
  if (reservationUrls.length > 0) {
    notes.push(
      `${reservationUrls.length} OpenTable reservation URL(s) require a HEAD check`,
    );
  } else notes.push("no OpenTable reservation URLs");
  notes.push(`${days.length} days`);
  return { ok: failures.length === 0, failures, notes, reservationUrls };
}
