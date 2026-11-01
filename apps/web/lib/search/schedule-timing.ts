import type { TravelerDayWindow } from "./traveler-availability";
import { dayTimingBasis } from "@faroway/types";
import {
  proposeTiming,
  type TimingEvent,
} from "../../../../scripts/uat/lib/timing-proposal";
import type { SearchPlan, SuggestedDay } from "./types";

/** Conservative trigger, not a general interpreter of traveler scheduling preferences. */
export function requestsMiddayRest(
  plan: Pick<SearchPlan, "mobilityNeeds" | "requirements">,
) {
  const text = [plan.mobilityNeeds, plan.requirements?.mobilityNotes]
    .filter(Boolean)
    .join(". ")
    .toLowerCase();
  if (
    /\b(?:no|without|skip|omit|avoid|no need for)\s+(?:a\s+)?midday\s+rest\b|\b(?:do not|don't)\s+(?:need|want|schedule|include)\s+(?:a\s+)?midday\s+rest\b|midday\s+rest\s+(?:is\s+)?(?:not needed|not required|optional)/.test(
      text,
    )
  )
    return false;
  return /\bmidday\s+rest\s+(?:every|each)\s+day\b|\b(?:need|require|include|schedule)\s+(?:a\s+)?(?:daily\s+)?midday\s+rest\b/.test(
    text,
  );
}

/** Proposed local windows only. Never infers opening hours or route durations. */
export function proposeRestDayTiming(
  day: SuggestedDay,
  availability?: TravelerDayWindow,
) {
  const events: TimingEvent[] = [];
  const labels = new Map<string, string>();
  const add = (
    id: string,
    label: string,
    kind: TimingEvent["kind"],
    durationMinutes: number,
    earliestStart: number,
    latestEnd: number,
  ) => {
    labels.set(id, label);
    events.push({
      id,
      kind,
      durationMinutes,
      earliestStart: Math.max(earliestStart, availability?.earliestMinute ?? 0),
      latestEnd: Math.min(latestEnd, availability?.latestMinute ?? 1440),
      bufferBeforeMinutes: events.length && kind !== "rest" ? 30 : 0,
    });
  };
  const meal = (
    slot: "morning" | "afternoon" | "evening",
    label: string,
    duration: number,
    start: number,
    end: number,
  ) => {
    if (day[slot].meal)
      add(
        `meal:${slot}:${day[slot].meal.id}`,
        label,
        "meal",
        duration,
        start,
        end,
      );
  };
  const visits = (
    slot: "morning" | "afternoon" | "evening",
    start: number,
    end: number,
  ) => {
    for (const visit of day[slot].activities)
      add(
        `activity:${visit.id}`,
        visit.name,
        "activity",
        visit.duration,
        start,
        end,
      );
  };
  meal("morning", "Breakfast", 45, 480, 600);
  visits("morning", 540, 780);
  meal("afternoon", "Lunch", 60, 720, 840);
  add("rest:midday", "Midday rest", "rest", 60, 780, 900);
  visits("afternoon", 840, 1080);
  visits("evening", 1080, 1320);
  meal("evening", "Dinner", 60, 1080, 1320);
  const impossible = events.find(
    (event) => event.earliestStart >= event.latestEnd,
  );
  const result = impossible
    ? {
        fitsPolicy: false as const,
        verified: false as const,
        events: [],
        conflict: {
          eventId: impossible.id,
          earliestPossibleStart: impossible.earliestStart,
          requiredEnd: impossible.earliestStart + impossible.durationMinutes,
          latestEnd: impossible.latestEnd,
          overrunMinutes:
            impossible.earliestStart +
            impossible.durationMinutes -
            impossible.latestEnd,
        },
      }
    : proposeTiming(events);
  const clock = (minute: number) =>
    `${Math.floor(minute / 60)
      .toString()
      .padStart(2, "0")}:${(minute % 60).toString().padStart(2, "0")}`;
  const tips = result.fitsPolicy
    ? [
        `Proposed local timing: ${result.events.map((event) => `${clock(event.startMinute)}–${clock(event.endMinute)} ${labels.get(event.id)}`).join("; ")}.`,
        "This draft reserves a suggested one-hour midday rest. Meal lengths and 30-minute buffers are planning assumptions, not opening hours or travel estimates. Rest is assumed near lunch; a hotel return needs separate travel time. Confirm these details before using the times.",
      ]
    : [
        "The selected visits do not fit the proposed meal, buffer and one-hour midday-rest windows within your available hours. Review the visits and timing before using this day; your rest request remains unresolved. No visits have been shortened or removed.",
      ];
  return {
    policy: "midday-rest-v1" as const,
    basis: dayTimingBasis(day),
    date: day.date,
    ...result,
    tips,
  };
}
