import {
  readDayTiming,
  type GeneratedItinerary,
  type ItineraryActivity,
  type Restaurant,
  type TripDay,
} from "@faroway/types";

export interface TripExportInput {
  destination: string;
  start_date: string;
  end_date?: string;
  travelers?: number;
  status?: string;
}

type IcsItineraryInput =
  | GeneratedItinerary
  | (Omit<Partial<GeneratedItinerary>, "days"> & { days?: TripDay[] })
  | null;

interface ScheduledIcsEvent {
  uidSuffix: string;
  summary: string;
  description: string;
  location?: string;
  startMinute: number;
  endMinute: number;
}

const CRLF = "\r\n";
const MAX_LINE_OCTETS = 75;
const MAX_DAY_MINUTE = 23 * 60 + 59;

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= MAX_LINE_OCTETS) {
    return line;
  }

  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;

  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    const limit = chunks.length === 0 ? MAX_LINE_OCTETS : MAX_LINE_OCTETS - 1;
    if (currentBytes + charBytes > limit && current.length > 0) {
      chunks.push(current);
      current = char;
      currentBytes = charBytes;
    } else {
      current += char;
      currentBytes += charBytes;
    }
  }
  if (current.length > 0) {
    chunks.push(current);
  }
  return chunks.join(`${CRLF} `);
}

function formatUtcTimestamp(date: Date): string {
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${safeDate.getUTCFullYear()}` +
    `${pad(safeDate.getUTCMonth() + 1)}` +
    `${pad(safeDate.getUTCDate())}T` +
    `${pad(safeDate.getUTCHours())}` +
    `${pad(safeDate.getUTCMinutes())}` +
    `${pad(safeDate.getUTCSeconds())}Z`
  );
}

function parseCalendarDate(
  value?: string,
): { year: number; month: number; day: number } | null {
  if (!value || typeof value !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function addDays(
  base: { year: number; month: number; day: number },
  offset: number,
): { year: number; month: number; day: number } {
  const date = new Date(Date.UTC(base.year, base.month - 1, base.day + offset));
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function formatLocalDateTime(
  date: { year: number; month: number; day: number },
  minuteOfDay: number,
): string {
  const clamped = Math.max(
    0,
    Math.min(MAX_DAY_MINUTE, Math.round(minuteOfDay)),
  );
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.year}${pad(date.month)}${pad(date.day)}T${pad(hours)}${pad(minutes)}00`;
}

function safeSlot(block: unknown): {
  activities: ItineraryActivity[];
  meals: Restaurant[];
} {
  if (!block || typeof block !== "object") {
    return { activities: [], meals: [] };
  }
  const rec = block as Record<string, unknown>;
  const rawActivities = Array.isArray(rec.activities) ? rec.activities : [];
  const rawMeals = Array.isArray(rec.meals)
    ? rec.meals
    : rec.meal && typeof rec.meal === "object"
      ? [rec.meal]
      : [];

  return {
    activities: rawActivities.filter(
      (a): a is ItineraryActivity =>
        a != null &&
        typeof a === "object" &&
        typeof (a as ItineraryActivity).name === "string",
    ),
    meals: rawMeals.filter(
      (m): m is Restaurant =>
        m != null &&
        typeof m === "object" &&
        typeof (m as Restaurant).name === "string",
    ),
  };
}

function formatLocation(
  location?: { name?: string; address?: string } | null,
  destination?: string,
): string | undefined {
  if (!location) return destination?.trim() || undefined;
  const name = location.name?.trim();
  const address = location.address?.trim();
  if (name && address && address.toLowerCase() !== name.toLowerCase()) {
    return `${name}, ${address}`;
  }
  return address || name || destination?.trim() || undefined;
}

function buildDescription(
  rawDescription: string | undefined,
  dayNumber: number,
  slotNote?: string,
): string {
  const parts: string[] = [];
  if (rawDescription?.trim()) {
    parts.push(rawDescription.trim());
  }
  if (slotNote) {
    parts.push(slotNote);
  }
  parts.push(
    `Day ${dayNumber} · Planned via Faroway. Suggested local time — confirm opening hours and availability with the venue.`,
  );
  return parts.join("\n\n");
}

function clampDuration(minutes: unknown, fallback: number): number {
  if (
    typeof minutes !== "number" ||
    !Number.isFinite(minutes) ||
    minutes <= 0
  ) {
    return fallback;
  }
  return Math.max(15, Math.min(360, Math.round(minutes)));
}

function scheduleDayEvents(
  day: TripDay,
  destination: string,
): ScheduledIcsEvent[] {
  const morning = safeSlot(day.morning);
  const afternoon = safeSlot(day.afternoon);
  const evening = safeSlot(day.evening);

  // Prefer validated timingProposal minutes when available and policy-fitting.
  const validTiming = readDayTiming(day);
  if (validTiming?.fitsPolicy && validTiming.events.length > 0) {
    const activityMap = new Map<string, ItineraryActivity>();
    const mealMap = new Map<string, Restaurant>();
    const slotEntries: Array<
      ["morning" | "afternoon" | "evening", ReturnType<typeof safeSlot>]
    > = [
      ["morning", morning],
      ["afternoon", afternoon],
      ["evening", evening],
    ];

    for (const [slotName, block] of slotEntries) {
      for (const act of block.activities) {
        if (act.id) activityMap.set(`activity:${act.id}`, act);
      }
      for (const meal of block.meals) {
        if (meal.id) mealMap.set(`meal:${slotName}:${meal.id}`, meal);
      }
    }

    return validTiming.events.map((event, idx) => {
      if (event.kind === "rest") {
        return {
          uidSuffix: `rest-${idx}`,
          summary: "Midday rest",
          description: buildDescription(
            "Reserved break to recharge before afternoon stops.",
            day.dayNumber,
          ),
          location: destination.trim() || undefined,
          startMinute: event.startMinute,
          endMinute: event.endMinute,
        };
      }

      if (event.kind === "meal") {
        const meal = mealMap.get(event.id);
        return {
          uidSuffix: `meal-${idx}`,
          summary: meal?.name || "Meal",
          description: buildDescription(meal?.description, day.dayNumber),
          location: formatLocation(meal?.location, destination),
          startMinute: event.startMinute,
          endMinute: event.endMinute,
        };
      }

      const activity = activityMap.get(event.id);
      return {
        uidSuffix: `act-${idx}`,
        summary: activity?.name || "Planned visit",
        description: buildDescription(activity?.description, day.dayNumber),
        location: formatLocation(activity?.location, destination),
        startMinute: event.startMinute,
        endMinute: event.endMinute,
      };
    });
  }

  // Fallback sensible local-time slot windows.
  const events: ScheduledIcsEvent[] = [];
  let cursor = 0;

  const pushEvent = (
    uidSuffix: string,
    summary: string,
    description: string,
    location: string | undefined,
    preferredStart: number,
    duration: number,
  ) => {
    const startMinute = Math.min(
      MAX_DAY_MINUTE - 15,
      Math.max(preferredStart, cursor > 0 ? cursor + 15 : preferredStart),
    );
    const endMinute = Math.min(MAX_DAY_MINUTE, startMinute + duration);
    cursor = endMinute;
    events.push({
      uidSuffix,
      summary,
      description,
      location,
      startMinute,
      endMinute: Math.max(startMinute + 15, endMinute),
    });
  };

  // Morning: breakfast -> morning activities
  morning.meals.forEach((meal, idx) => {
    pushEvent(
      `m-meal-${idx}`,
      meal.name,
      buildDescription(meal.description, day.dayNumber, "Morning meal"),
      formatLocation(meal.location, destination),
      8 * 60 + 30,
      45,
    );
  });
  morning.activities.forEach((activity, idx) => {
    pushEvent(
      `m-act-${idx}`,
      activity.name,
      buildDescription(activity.description, day.dayNumber, "Morning"),
      formatLocation(activity.location, destination),
      9 * 60 + 30,
      clampDuration(activity.duration, 90),
    );
  });

  // Afternoon: lunch -> afternoon activities
  afternoon.meals.forEach((meal, idx) => {
    pushEvent(
      `a-meal-${idx}`,
      meal.name,
      buildDescription(meal.description, day.dayNumber, "Lunch"),
      formatLocation(meal.location, destination),
      12 * 60 + 30,
      60,
    );
  });
  afternoon.activities.forEach((activity, idx) => {
    pushEvent(
      `a-act-${idx}`,
      activity.name,
      buildDescription(activity.description, day.dayNumber, "Afternoon"),
      formatLocation(activity.location, destination),
      14 * 60,
      clampDuration(activity.duration, 90),
    );
  });

  // Evening: evening activities -> dinner
  evening.activities.forEach((activity, idx) => {
    pushEvent(
      `e-act-${idx}`,
      activity.name,
      buildDescription(activity.description, day.dayNumber, "Evening"),
      formatLocation(activity.location, destination),
      17 * 60 + 30,
      clampDuration(activity.duration, 90),
    );
  });
  evening.meals.forEach((meal, idx) => {
    pushEvent(
      `e-meal-${idx}`,
      meal.name,
      buildDescription(meal.description, day.dayNumber, "Dinner"),
      formatLocation(meal.location, destination),
      19 * 60 + 30,
      75,
    );
  });

  return events;
}

function slugifyDestination(destination: string): string {
  return destination
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function buildTripIcsFilename(
  trip: Pick<TripExportInput, "destination" | "start_date">,
): string {
  const destination = slugifyDestination(trip.destination || "");
  const safeDate = (trip.start_date || "")
    .trim()
    .replace(/[^0-9a-zA-Z-]+/g, "");
  return `faroway-${destination || "trip"}-${safeDate || "itinerary"}.ics`;
}

export function buildTripIcsContent(
  trip: TripExportInput,
  itinerary: IcsItineraryInput,
  exportedAt = new Date(),
): string {
  const dtstamp = formatUtcTimestamp(exportedAt);
  const destination = trip.destination?.trim() || "Trip";
  const destSlug = slugifyDestination(destination) || "trip";
  const tripStart = parseCalendarDate(trip.start_date);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Faroway//Trip Itinerary//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    foldIcsLine(`X-WR-CALNAME:${escapeIcsText(`${destination} Trip`)}`),
  ];

  const days = Array.isArray(itinerary?.days) ? itinerary.days : [];
  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const day = days[dayIndex];
    if (!day || typeof day !== "object") continue;

    const dayNumber =
      typeof day.dayNumber === "number" && day.dayNumber > 0
        ? day.dayNumber
        : dayIndex + 1;
    const dayDate =
      parseCalendarDate(day.date) ||
      (tripStart ? addDays(tripStart, dayNumber - 1) : null);
    if (!dayDate) continue;

    const scheduledEvents = scheduleDayEvents(day, destination);
    for (const event of scheduledEvents) {
      const uid = `faroway-${destSlug}-d${dayNumber}-${event.uidSuffix}@faroway.ai`;
      lines.push("BEGIN:VEVENT");
      lines.push(foldIcsLine(`UID:${uid}`));
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART:${formatLocalDateTime(dayDate, event.startMinute)}`);
      lines.push(`DTEND:${formatLocalDateTime(dayDate, event.endMinute)}`);
      lines.push(foldIcsLine(`SUMMARY:${escapeIcsText(event.summary)}`));
      if (event.location) {
        lines.push(foldIcsLine(`LOCATION:${escapeIcsText(event.location)}`));
      }
      lines.push(
        foldIcsLine(`DESCRIPTION:${escapeIcsText(event.description)}`),
      );
      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");
  return `${lines.join(CRLF)}${CRLF}`;
}
