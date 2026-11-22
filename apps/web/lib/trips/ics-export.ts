import { AFFILIATE_DISCLOSURE_SHORT } from "@faroway/constants";
import {
  readDayTiming,
  type GeneratedItinerary,
  type ItineraryActivity,
  type Restaurant,
  type TripDay,
} from "@faroway/types";
import {
  isExportItemDisplayable,
  sanitizeExportAffiliateUrl,
  sanitizeExportEssentials,
  type TripExportOptions,
} from "./export-links";

export interface TripExportInput {
  id?: string;
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
  url?: string;
  startMinute: number;
  endMinute: number;
}

const CRLF = "\r\n";
const MAX_LINE_OCTETS = 75;
const MAX_DAY_MINUTE = 23 * 60 + 59;

function escapeIcsText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
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

function safeSlot(
  block: unknown,
  viatorContentEnabled?: boolean,
): {
  activities: ItineraryActivity[];
  meals: Restaurant[];
  blockedActivityIds: Set<string>;
  blockedMealIds: Set<string>;
} {
  if (!block || typeof block !== "object") {
    return {
      activities: [],
      meals: [],
      blockedActivityIds: new Set(),
      blockedMealIds: new Set(),
    };
  }
  const rec = block as Record<string, unknown>;
  const rawActivities = Array.isArray(rec.activities) ? rec.activities : [];
  const rawMeals = Array.isArray(rec.meals)
    ? rec.meals
    : rec.meal && typeof rec.meal === "object"
      ? [rec.meal]
      : [];

  const activities: ItineraryActivity[] = [];
  const blockedActivityIds = new Set<string>();
  for (const candidate of rawActivities) {
    if (
      candidate == null ||
      typeof candidate !== "object" ||
      typeof (candidate as ItineraryActivity).name !== "string"
    ) {
      continue;
    }
    if (isExportItemDisplayable(candidate, viatorContentEnabled)) {
      activities.push(candidate as ItineraryActivity);
    } else if (typeof (candidate as ItineraryActivity).id === "string") {
      blockedActivityIds.add((candidate as ItineraryActivity).id);
    }
  }

  const meals: Restaurant[] = [];
  const blockedMealIds = new Set<string>();
  for (const candidate of rawMeals) {
    if (
      candidate == null ||
      typeof candidate !== "object" ||
      typeof (candidate as Restaurant).name !== "string"
    ) {
      continue;
    }
    if (isExportItemDisplayable(candidate, viatorContentEnabled)) {
      meals.push(candidate as Restaurant);
    } else if (typeof (candidate as Restaurant).id === "string") {
      blockedMealIds.add((candidate as Restaurant).id);
    }
  }

  return { activities, meals, blockedActivityIds, blockedMealIds };
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
  bookingUrl?: string,
): string {
  const parts: string[] = [];
  if (rawDescription?.trim()) {
    parts.push(rawDescription.trim());
  }
  if (slotNote) {
    parts.push(slotNote);
  }
  if (bookingUrl) {
    parts.push(`Book / Reserve: ${bookingUrl}\n${AFFILIATE_DISCLOSURE_SHORT}`);
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

function parseIsoStartMinute(dateTime?: string): number | null {
  if (!dateTime || typeof dateTime !== "string") return null;
  const match = /T(\d{2}):(\d{2})/.exec(dateTime);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function buildTransportEvent(
  day: TripDay,
  destination: string,
): ScheduledIcsEvent | null {
  if (!day.transport) return null;
  const t = day.transport;
  const url = sanitizeExportAffiliateUrl(t.affiliateUrl, "export_ics");
  const from = t.departure.airport || t.departure.city;
  const to = t.arrival.airport || t.arrival.city;
  const summary =
    from && to ? `${t.provider}: ${from} to ${to}` : `${t.provider} ${t.type}`;
  const startMinute = parseIsoStartMinute(t.departure.dateTime) ?? 9 * 60;
  const duration = clampDuration(t.duration, 90);
  const endMinute = Math.min(
    MAX_DAY_MINUTE,
    Math.max(startMinute + 15, startMinute + duration),
  );
  const detail = `${t.provider} ${t.type} from ${t.departure.city} (${t.departure.airport}) to ${t.arrival.city} (${t.arrival.airport}).`;
  return {
    uidSuffix: "transport",
    summary,
    description: buildDescription(detail, day.dayNumber, "Transport", url),
    location: from || destination.trim() || undefined,
    url,
    startMinute,
    endMinute,
  };
}

function buildHotelEvent(
  day: TripDay,
  dayIndex: number,
  topHotel: GeneratedItinerary["topHotel"],
  destination: string,
): ScheduledIcsEvent | null {
  const hotel = day.hotel || (dayIndex === 0 ? topHotel : null);
  if (!hotel) return null;
  const url = sanitizeExportAffiliateUrl(hotel.affiliateUrl, "export_ics");
  if (!url) return null;
  return {
    uidSuffix: "hotel",
    summary: `Stay: ${hotel.name}`,
    description: buildDescription(
      hotel.description,
      day.dayNumber,
      "Accommodation",
      url,
    ),
    location: formatLocation(hotel.location, destination),
    url,
    startMinute: 15 * 60,
    endMinute: 15 * 60 + 30,
  };
}

function scheduleDayEvents(
  day: TripDay,
  destination: string,
  options?: TripExportOptions,
): ScheduledIcsEvent[] {
  const viatorEnabled = options?.viatorContentEnabled;
  const morning = safeSlot(day.morning, viatorEnabled);
  const afternoon = safeSlot(day.afternoon, viatorEnabled);
  const evening = safeSlot(day.evening, viatorEnabled);

  const blockedActivityIds = new Set([
    ...morning.blockedActivityIds,
    ...afternoon.blockedActivityIds,
    ...evening.blockedActivityIds,
  ]);
  const blockedMealIds = new Set([
    ...morning.blockedMealIds,
    ...afternoon.blockedMealIds,
    ...evening.blockedMealIds,
  ]);

  const events: ScheduledIcsEvent[] = [];

  if (day.dayNumber === 1 && options?.essentials?.length) {
    const essentials = sanitizeExportEssentials(
      options.essentials,
      "export_ics",
      options.viatorContentEnabled,
    );
    if (essentials.length > 0) {
      const lines = essentials.map((item) => `${item.label}: ${item.url}`);
      events.push({
        uidSuffix: "essentials",
        summary: "Trip Essentials & Booking Links",
        description: buildDescription(
          `${lines.join("\n")}\n\n${AFFILIATE_DISCLOSURE_SHORT}`,
          day.dayNumber,
          "Trip Essentials",
        ),
        location: destination.trim() || undefined,
        url: essentials[0]?.url,
        startMinute: 8 * 60,
        endMinute: 8 * 60 + 15,
      });
    }
  }

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

    for (let idx = 0; idx < validTiming.events.length; idx++) {
      const event = validTiming.events[idx];
      if (event.kind === "rest") {
        events.push({
          uidSuffix: `rest-${idx}`,
          summary: "Midday rest",
          description: buildDescription(
            "Reserved break to recharge before afternoon stops.",
            day.dayNumber,
          ),
          location: destination.trim() || undefined,
          startMinute: event.startMinute,
          endMinute: event.endMinute,
        });
        continue;
      }

      if (event.kind === "meal") {
        const mealId = event.id.split(":").slice(2).join(":");
        if (blockedMealIds.has(mealId)) continue;
        const meal = mealMap.get(event.id);
        const url = sanitizeExportAffiliateUrl(
          meal?.reservationInfo?.url,
          "export_ics",
        );
        events.push({
          uidSuffix: `meal-${idx}`,
          summary: meal?.name || "Meal",
          description: buildDescription(
            meal?.description,
            day.dayNumber,
            undefined,
            url,
          ),
          location: formatLocation(meal?.location, destination),
          url,
          startMinute: event.startMinute,
          endMinute: event.endMinute,
        });
        continue;
      }

      const actId = event.id.replace(/^activity:/, "");
      if (blockedActivityIds.has(actId)) continue;
      const activity = activityMap.get(event.id);
      const url = sanitizeExportAffiliateUrl(
        activity?.bookingInfo?.bookingUrl,
        "export_ics",
      );
      events.push({
        uidSuffix: `act-${idx}`,
        summary: activity?.name || "Planned visit",
        description: buildDescription(
          activity?.description,
          day.dayNumber,
          undefined,
          url,
        ),
        location: formatLocation(activity?.location, destination),
        url,
        startMinute: event.startMinute,
        endMinute: event.endMinute,
      });
    }

    const transportEvent = buildTransportEvent(day, destination);
    if (transportEvent) events.push(transportEvent);

    return events;
  }

  // Fallback sensible local-time slot windows.
  let cursor = 0;

  const pushEvent = (
    uidSuffix: string,
    summary: string,
    description: string,
    location: string | undefined,
    preferredStart: number,
    duration: number,
    url?: string,
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
      url,
      startMinute,
      endMinute: Math.max(startMinute + 15, endMinute),
    });
  };

  // Morning: breakfast -> morning activities
  morning.meals.forEach((meal, idx) => {
    const url = sanitizeExportAffiliateUrl(
      meal.reservationInfo?.url,
      "export_ics",
    );
    pushEvent(
      `m-meal-${idx}`,
      meal.name,
      buildDescription(meal.description, day.dayNumber, "Morning meal", url),
      formatLocation(meal.location, destination),
      8 * 60 + 30,
      45,
      url,
    );
  });
  morning.activities.forEach((activity, idx) => {
    const url = sanitizeExportAffiliateUrl(
      activity.bookingInfo?.bookingUrl,
      "export_ics",
    );
    pushEvent(
      `m-act-${idx}`,
      activity.name,
      buildDescription(activity.description, day.dayNumber, "Morning", url),
      formatLocation(activity.location, destination),
      9 * 60 + 30,
      clampDuration(activity.duration, 90),
      url,
    );
  });

  // Afternoon: lunch -> afternoon activities
  afternoon.meals.forEach((meal, idx) => {
    const url = sanitizeExportAffiliateUrl(
      meal.reservationInfo?.url,
      "export_ics",
    );
    pushEvent(
      `a-meal-${idx}`,
      meal.name,
      buildDescription(meal.description, day.dayNumber, "Lunch", url),
      formatLocation(meal.location, destination),
      12 * 60 + 30,
      60,
      url,
    );
  });
  afternoon.activities.forEach((activity, idx) => {
    const url = sanitizeExportAffiliateUrl(
      activity.bookingInfo?.bookingUrl,
      "export_ics",
    );
    pushEvent(
      `a-act-${idx}`,
      activity.name,
      buildDescription(activity.description, day.dayNumber, "Afternoon", url),
      formatLocation(activity.location, destination),
      14 * 60,
      clampDuration(activity.duration, 90),
      url,
    );
  });

  // Evening: evening activities -> dinner
  evening.activities.forEach((activity, idx) => {
    const url = sanitizeExportAffiliateUrl(
      activity.bookingInfo?.bookingUrl,
      "export_ics",
    );
    pushEvent(
      `e-act-${idx}`,
      activity.name,
      buildDescription(activity.description, day.dayNumber, "Evening", url),
      formatLocation(activity.location, destination),
      17 * 60 + 30,
      clampDuration(activity.duration, 90),
      url,
    );
  });
  evening.meals.forEach((meal, idx) => {
    const url = sanitizeExportAffiliateUrl(
      meal.reservationInfo?.url,
      "export_ics",
    );
    pushEvent(
      `e-meal-${idx}`,
      meal.name,
      buildDescription(meal.description, day.dayNumber, "Dinner", url),
      formatLocation(meal.location, destination),
      19 * 60 + 30,
      75,
      url,
    );
  });

  const transportEvent = buildTransportEvent(day, destination);
  if (transportEvent) events.push(transportEvent);

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
  options?: TripExportOptions,
): string {
  const dtstamp = formatUtcTimestamp(exportedAt);
  const destination = trip.destination?.trim() || "Trip";
  const destSlug = slugifyDestination(destination) || "trip";
  const tripIdSlug =
    typeof trip.id === "string" && trip.id.trim()
      ? trip.id
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9-]+/g, "")
          .slice(0, 36)
      : "";
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

    const scheduledEvents = scheduleDayEvents(day, destination, options);
    const hotelEvent = buildHotelEvent(
      day,
      dayIndex,
      itinerary?.topHotel ?? null,
      destination,
    );
    if (hotelEvent) {
      scheduledEvents.push(hotelEvent);
    }

    const dateStamp = `${dayDate.year}${String(dayDate.month).padStart(2, "0")}${String(dayDate.day).padStart(2, "0")}`;
    for (const event of scheduledEvents) {
      const safeStart = Math.max(
        0,
        Math.min(MAX_DAY_MINUTE - 15, event.startMinute),
      );
      const safeEnd = Math.min(
        MAX_DAY_MINUTE,
        Math.max(safeStart + 15, event.endMinute),
      );
      const uidPrefix = tripIdSlug ? `${tripIdSlug}-${destSlug}` : destSlug;
      const uid = `faroway-${uidPrefix}-${dateStamp}-d${dayNumber}-${event.uidSuffix}@faroway.ai`;
      lines.push("BEGIN:VEVENT");
      lines.push(foldIcsLine(`UID:${uid}`));
      lines.push(`DTSTAMP:${dtstamp}`);
      lines.push(`DTSTART:${formatLocalDateTime(dayDate, safeStart)}`);
      lines.push(`DTEND:${formatLocalDateTime(dayDate, safeEnd)}`);
      lines.push(foldIcsLine(`SUMMARY:${escapeIcsText(event.summary)}`));
      if (event.location) {
        lines.push(foldIcsLine(`LOCATION:${escapeIcsText(event.location)}`));
      }
      if (event.url) {
        lines.push(foldIcsLine(`URL:${event.url}`));
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
