import {
  evaluateVendorExperiences,
  type VendorExpectation,
} from "./vendor-quality";
import {
  isTimingNote,
  readDayTiming,
} from "../../../packages/types/src/day-timing";
import { inclusiveDays } from "./briefs";

export interface PlanQuality {
  /** This evaluator checks saved-plan structure, not independently sourced facts. */
  scope: "saved-plan-contracts";
  travelerQuality: "not_evaluated";
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
  const items = Array.isArray(value)
    ? value
    : key === "meals" && record?.meal
      ? [record.meal]
      : [];
  // Ideas and malformed placeholders must not satisfy a usable day's supply.
  // A named candidate still requires separate provenance/venue review.
  return items.filter((item) => {
    const candidate = asRecord(item);
    return (
      candidate?.planningIdea !== true &&
      typeof candidate?.name === "string" &&
      candidate.name.trim().length > 0
    );
  }).length;
}

export function evaluateSavedPlan(
  body: unknown,
  dates: {
    startDate: string;
    endDate: string;
    /** Frozen live briefs currently describe full days, without arrival limits. */
    requireFullDayMeals?: boolean;
    vendorExpectation?: VendorExpectation;
  },
): PlanQuality {
  const failures: string[] = [];
  const notes: string[] = [
    "saved-plan contracts only; traveler usefulness, venue facts, route feasibility and requirement suitability are not evaluated",
  ];
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
  if (dates.vendorExpectation) {
    const vendors = evaluateVendorExperiences(days, dates.vendorExpectation);
    failures.push(...vendors.failures);
    notes.push(
      `${vendors.count} distinct vendor experiences with photo/link metadata`,
    );
  }
  let fallbackDays = 0;
  for (const [dayIndex, day] of days.entries()) {
    const record = asRecord(day);
    const title = typeof record?.title === "string" ? record.title : "";
    const summary = typeof record?.summary === "string" ? record.summary : "";
    const tips = Array.isArray(record?.tips) ? record.tips : [];
    if (
      record?.timingProposal === undefined &&
      tips.some((tip) => typeof tip === "string" && isTimingNote(tip))
    ) {
      failures.push(
        `${title || "day"} has timing notes without a timing proposal`,
      );
    }
    if (record?.timingProposal !== undefined) {
      const timing = readDayTiming(record);
      if (!timing)
        failures.push(
          `${title || "day"} has an invalid or stale timing proposal`,
        );
      else if (!timing.fitsPolicy)
        failures.push(`${title || "day"} has an unresolved timing conflict`);
    }
    if (
      record?.provenance === "backup_draft" ||
      summary.startsWith("Backup draft:") ||
      (/^Day \d+ in /.test(title) &&
        (/^Explore .+ with a mix of activities and dining\.$/.test(summary) ||
          /^Suggested visits: .+ Keep the remaining time flexible\.$/.test(
            summary,
          ))) ||
      tips.some(
        (tip) =>
          typeof tip === "string" &&
          tip.startsWith("The day descriptions could not be generated."),
      )
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
    if (dates.requireFullDayMeals) {
      for (const [period, meal] of [
        ["morning", "breakfast"],
        ["afternoon", "lunch"],
        ["evening", "dinner"],
      ] as const) {
        if (slotCount(record?.[period], "meals") === 0)
          failures.push(`${title || "day"} has no usable ${meal} suggestion`);
      }
    }
    if (record?.transport && dayIndex !== 0) {
      failures.push("transport is present after day 1");
    }
  }
  if (fallbackDays > 0) {
    failures.push(
      `${fallbackDays} day(s) use an aggregator fallback template or unavailable narration`,
    );
  }
  const reservationUrls: string[] = [];
  collectReservationUrls(itinerary, reservationUrls);
  if (reservationUrls.length > 0) {
    notes.push(
      `${reservationUrls.length} OpenTable reservation URL(s) require a HEAD check`,
    );
  } else notes.push("no OpenTable reservation URLs");
  notes.push(`${days.length} days`);
  return {
    scope: "saved-plan-contracts",
    travelerQuality: "not_evaluated",
    ok: failures.length === 0,
    failures,
    notes,
    reservationUrls,
  };
}
