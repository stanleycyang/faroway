import { differenceInCalendarDays } from "date-fns";
import {
  readDayTiming,
  type GeneratedItinerary,
  type ItineraryActivity,
  type Restaurant,
  type TripDay,
} from "@faroway/types";
import { parseTripDate } from "@/lib/trips/date-duration";

export const COMPANION_SLOTS = ["morning", "afternoon", "evening"] as const;
export type CompanionSlot = (typeof COMPANION_SLOTS)[number];

export interface BookingReadinessStop {
  name: string;
  dayNumber: number;
  reason: string;
}

export interface BookingReadinessReport {
  daysUntilTrip: number | null;
  urgentStops: BookingReadinessStop[];
  headline: string;
  urgency: "high" | "medium" | "low" | "on_trip" | "past";
}

export interface OnTripUpNext {
  dayNumber: number;
  dayIndex: number;
  dayTitle: string;
  date: string;
  slot: CompanionSlot;
  stop: {
    name: string;
    address?: string;
    locationName?: string;
    description?: string;
    coordinates?: { lat: number; lng: number };
  };
}

const TIMED_ENTRY_KEYWORDS = [
  "museum",
  "gallery",
  "observation deck",
  "skytree",
  "tower",
  "boat",
  "cruise",
  "ferry",
  "guided tour",
  "tour",
  "michelin",
  "fine dining",
  "tasting menu",
  "omakase",
  "opera",
  "theater",
  "theatre",
  "concert",
  "aquarium",
  "palace",
  "castle",
  "cathedral",
  "basilica",
  "sagrada",
  "louvre",
  "uffizi",
  "colosseum",
  "alhambra",
  "teamlab",
  "ghibli",
  "shibuya sky",
  "cooking class",
] as const;

const TIMED_ENTRY_PATTERNS = TIMED_ENTRY_KEYWORDS.map((kw) => ({
  kw,
  pattern: new RegExp(
    `\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}\\b`,
    "i",
  ),
}));

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getSlotActivities(
  day: TripDay,
  slot: CompanionSlot,
): ItineraryActivity[] {
  const block = day[slot];
  if (!block || !Array.isArray(block.activities)) return [];
  return block.activities;
}

function getSlotMeals(day: TripDay, slot: CompanionSlot): Restaurant[] {
  const block = day[slot] as
    | { meals?: Restaurant[]; meal?: Restaurant }
    | undefined;
  if (!block) return [];
  if (Array.isArray(block.meals) && block.meals.length > 0) return block.meals;
  if (block.meal) return [block.meal];
  return [];
}

function classifyTimedEntryReason(
  item: {
    name?: string;
    description?: string;
    bookingInfo?: { requiresReservation?: boolean; bookingUrl?: string };
    reservationInfo?: { recommended?: boolean };
  },
  isRestaurant: boolean,
): string | null {
  if (item.bookingInfo?.requiresReservation || item.bookingInfo?.bookingUrl) {
    return "Timed-entry or advance ticket recommended";
  }
  if (isRestaurant && item.reservationInfo?.recommended) {
    return "Advance dining reservation recommended";
  }
  const text = `${item.name ?? ""} ${item.description ?? ""}`;
  const matched = TIMED_ENTRY_PATTERNS.find(({ pattern }) =>
    pattern.test(text),
  )?.kw;
  if (!matched) return null;
  if (
    ["michelin", "fine dining", "tasting menu", "omakase"].includes(matched)
  ) {
    return "Popular dining spot — often books out early";
  }
  if (
    [
      "boat",
      "cruise",
      "ferry",
      "guided tour",
      "tour",
      "cooking class",
    ].includes(matched)
  ) {
    return "Scheduled departure or small-group capacity";
  }
  return "Popular timed-entry attraction";
}

export function analyzeBookingReadiness(
  itinerary: GeneratedItinerary | null,
  startDate: string,
  endDate?: string,
  now?: Date | null,
): BookingReadinessReport {
  const urgentStops: BookingReadinessStop[] = [];
  const seen = new Set<string>();

  for (const day of itinerary?.days ?? []) {
    for (const slot of COMPANION_SLOTS) {
      for (const act of getSlotActivities(day, slot)) {
        if (!act?.name || act.planningIdea) continue;
        const key = normalizeName(act.name);
        if (seen.has(key)) continue;
        const reason = classifyTimedEntryReason(act, false);
        if (reason) {
          seen.add(key);
          urgentStops.push({
            name: act.name,
            dayNumber: day.dayNumber,
            reason,
          });
        }
      }
      for (const meal of getSlotMeals(day, slot)) {
        if (!meal?.name || meal.planningIdea) continue;
        const key = normalizeName(meal.name);
        if (seen.has(key)) continue;
        const reason = classifyTimedEntryReason(meal, true);
        if (reason) {
          seen.add(key);
          urgentStops.push({
            name: meal.name,
            dayNumber: day.dayNumber,
            reason,
          });
        }
      }
    }
  }

  const parsedStart = parseTripDate(startDate);
  const parsedEnd = endDate ? parseTripDate(endDate) : null;
  const startValid = !Number.isNaN(parsedStart.getTime());
  const effectiveNow = now === undefined ? new Date() : now;
  const daysUntilTrip =
    startValid && effectiveNow
      ? differenceInCalendarDays(parsedStart, effectiveNow)
      : null;

  let urgency: BookingReadinessReport["urgency"] = "low";
  if (daysUntilTrip !== null && effectiveNow) {
    const endDiff =
      parsedEnd && !Number.isNaN(parsedEnd.getTime())
        ? differenceInCalendarDays(parsedEnd, effectiveNow)
        : daysUntilTrip;
    if (daysUntilTrip <= 0 && endDiff >= 0) {
      urgency = "on_trip";
    } else if (endDiff < 0) {
      urgency = "past";
    } else if (daysUntilTrip <= 14) {
      urgency = "high";
    } else if (daysUntilTrip <= 45) {
      urgency = "medium";
    } else {
      urgency = "low";
    }
  }

  const count = urgentStops.length;
  const stopPhrase =
    count === 1
      ? "1 timed-entry stop typically sells out early"
      : `${count} timed-entry stops typically sell out early`;

  let headline: string;
  if (urgency === "on_trip") {
    headline =
      count > 0
        ? `You're on your trip · Double-check entry times for ${count} timed-entry stop${count > 1 ? "s" : ""}`
        : "You're on your trip · Tap any stop for address and directions";
  } else if (urgency === "past") {
    headline =
      count > 0
        ? `${count} timed-entry stop${count > 1 ? "s" : ""} noted in this saved trip`
        : "Saved trip archive";
  } else if (daysUntilTrip !== null && daysUntilTrip > 0) {
    const dayLabel =
      daysUntilTrip === 1 ? "1 day out" : `${daysUntilTrip} days out`;
    headline =
      count > 0
        ? `${dayLabel} · ${stopPhrase}`
        : `${dayLabel} · No high-demand timed-entry bottlenecks spotted`;
  } else {
    headline =
      count > 0 ? stopPhrase : "No high-demand timed-entry bottlenecks spotted";
  }

  return {
    daysUntilTrip,
    urgentStops,
    headline,
    urgency,
  };
}

export function findOnTripUpNext(
  itinerary: GeneratedItinerary | null,
  startDate: string,
  endDate: string,
  now?: Date | null,
): OnTripUpNext | null {
  if (!itinerary?.days?.length) return null;
  const effectiveNow = now === undefined ? new Date() : now;
  if (!effectiveNow) return null;
  const start = parseTripDate(startDate);
  const end = parseTripDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const daysSinceStart = differenceInCalendarDays(effectiveNow, start);
  const daysUntilEnd = differenceInCalendarDays(end, effectiveNow);
  if (daysSinceStart < 0 || daysUntilEnd < 0) return null;

  const todayIso = `${effectiveNow.getFullYear()}-${String(effectiveNow.getMonth() + 1).padStart(2, "0")}-${String(effectiveNow.getDate()).padStart(2, "0")}`;
  let dayIndex = itinerary.days.findIndex(
    (d) => typeof d.date === "string" && d.date.slice(0, 10) === todayIso,
  );
  if (dayIndex === -1) {
    dayIndex = Math.min(daysSinceStart, itinerary.days.length - 1);
  }
  const day = itinerary.days[dayIndex];
  if (!day) return null;

  const hour = effectiveNow.getHours();
  const nowMinutes = hour * 60 + effectiveNow.getMinutes();

  // Check explicit proposed event times first when available so we never
  // direct travelers back to stops whose scheduled window has already ended.
  const timing = readDayTiming(day);
  const timingEndById = new Map<string, number>();
  if (timing?.events?.length) {
    for (const ev of timing.events) {
      if (typeof ev.endMinute === "number" && Number.isFinite(ev.endMinute)) {
        const prev = timingEndById.get(ev.id);
        if (prev === undefined || ev.endMinute > prev) {
          timingEndById.set(ev.id, ev.endMinute);
        }
      }
    }
  }

  // Forward-only slot progression: never fall back to already-elapsed earlier slots.
  const remainingSlots: CompanionSlot[] =
    hour < 12
      ? ["morning", "afternoon", "evening"]
      : hour < 17
        ? ["afternoon", "evening"]
        : ["evening"];

  const isNotEnded = (timingId: string | null): boolean => {
    if (!timingId) return true;
    const endMinute = timingEndById.get(timingId);
    return endMinute === undefined || endMinute > nowMinutes;
  };

  for (const slot of remainingSlots) {
    const acts = getSlotActivities(day, slot);
    const nextAct = acts.find(
      (a) => a?.name && isNotEnded(a.id ? `activity:${a.id}` : null),
    );
    if (nextAct) {
      return {
        dayNumber: day.dayNumber,
        dayIndex,
        dayTitle: day.title || `Day ${day.dayNumber}`,
        date: day.date || todayIso,
        slot,
        stop: {
          name: nextAct.name,
          address: nextAct.location?.address,
          locationName: nextAct.location?.name,
          description: nextAct.description,
          coordinates: nextAct.location?.coordinates,
        },
      };
    }
    const meals = getSlotMeals(day, slot);
    const nextMeal = meals.find(
      (m) => m?.name && isNotEnded(m.id ? `meal:${slot}:${m.id}` : null),
    );
    if (nextMeal) {
      return {
        dayNumber: day.dayNumber,
        dayIndex,
        dayTitle: day.title || `Day ${day.dayNumber}`,
        date: day.date || todayIso,
        slot,
        stop: {
          name: nextMeal.name,
          address: nextMeal.location?.address,
          locationName: nextMeal.location?.name,
          description: nextMeal.description,
          coordinates: nextMeal.location?.coordinates,
        },
      };
    }
  }

  return null;
}
