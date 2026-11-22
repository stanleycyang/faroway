import { AFFILIATE_DISCLOSURE_SHORT } from "@faroway/constants";
import type { GeneratedItinerary, TripDay } from "@faroway/types";
import {
  isExportItemDisplayable,
  sanitizeExportAffiliateUrl,
  sanitizeExportEssentials,
  type TripEssentialExportLink,
  type TripExportOptions,
} from "./export-links";
import { parseTripDate } from "./date-duration";
import { knownEstimate } from "./budget";

export interface TripExportTrip {
  destination: string;
  start_date: string;
  end_date: string;
  travelers: number;
  status: string;
}

type ExportCost =
  | GeneratedItinerary["totalEstimatedCost"]
  | number
  | null
  | undefined;
type ExportItinerary =
  | (Omit<Partial<GeneratedItinerary>, "days" | "totalEstimatedCost"> & {
      days?: TripDay[];
      totalEstimatedCost?: ExportCost;
    })
  | null;

function formatExportDate(dateStr: string) {
  const date = parseTripDate(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatExportCost(cost: ExportCost) {
  if (!cost) return null;
  const amount = typeof cost === "number" ? cost : cost.amount;
  const rawCurrency = typeof cost === "number" ? "USD" : cost.currency;
  const normalizedCurrency =
    typeof rawCurrency === "string"
      ? rawCurrency.trim().toUpperCase()
      : rawCurrency;
  const status =
    typeof cost === "object" && cost !== null && "status" in cost
      ? (cost as { status?: unknown }).status
      : undefined;
  const valid = knownEstimate(amount, normalizedCurrency, status);
  if (!valid) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: valid.currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(valid.amount);
  } catch {
    return null;
  }
}

function formatExportSlot(
  label: string,
  slot: Partial<TripDay["morning"]> | null | undefined,
  viatorContentEnabled: boolean | undefined,
): { lines: string[]; removedAny: boolean; emittedLink: boolean } {
  const lines: string[] = [];
  const rawActivities = Array.isArray(slot?.activities) ? slot.activities : [];
  const rawMeals = Array.isArray(slot?.meals) ? slot.meals : [];

  const activities = rawActivities.filter((a) =>
    isExportItemDisplayable(a, viatorContentEnabled),
  );
  const meals = rawMeals.filter((m) =>
    isExportItemDisplayable(m, viatorContentEnabled),
  );
  const removedAny =
    activities.length < rawActivities.length || meals.length < rawMeals.length;

  if (activities.length === 0 && meals.length === 0) {
    return { lines, removedAny, emittedLink: false };
  }

  let emittedLink = false;
  lines.push(`${label}:`);
  for (const activity of activities) {
    lines.push(`  - ${activity.name}`);
    const safeUrl = sanitizeExportAffiliateUrl(
      activity.bookingInfo?.bookingUrl,
      "export_txt",
    );
    if (safeUrl) {
      lines.push(`    Book: ${safeUrl}`);
      emittedLink = true;
    }
  }
  for (const meal of meals) {
    lines.push(`  - ${meal.name}`);
    const safeUrl = sanitizeExportAffiliateUrl(
      meal.reservationInfo?.url,
      "export_txt",
    );
    if (safeUrl) {
      lines.push(`    Reserve: ${safeUrl}`);
      emittedLink = true;
    }
  }
  return { lines, removedAny, emittedLink };
}

export function buildTripExportText(
  trip: TripExportTrip,
  itinerary: ExportItinerary,
  exportedAt = new Date(),
  options?: TripExportOptions,
) {
  const lines = [
    "Faroway Trip Export",
    `Destination: ${trip.destination}`,
    `Dates: ${formatExportDate(trip.start_date)} to ${formatExportDate(trip.end_date)}`,
    `Travelers: ${trip.travelers}`,
    `Status: ${trip.status}`,
    `Exported: ${exportedAt.toISOString()}`,
  ];

  let emittedAffiliateLink = false;

  if (!itinerary) {
    const essentials = sanitizeExportEssentials(
      options?.essentials,
      "export_txt",
      options?.viatorContentEnabled,
    );
    if (essentials.length > 0) {
      lines.push(
        "",
        "Trip Essentials",
        ...essentials.map((item) => `- ${item.label}: ${item.url}`),
        "",
        AFFILIATE_DISCLOSURE_SHORT,
      );
    }
    lines.push("", "Itinerary details are not available yet.");
    return lines.join("\n");
  }

  const totalCost = formatExportCost(itinerary.totalEstimatedCost);
  if (totalCost) lines.push(`Estimated total: ${totalCost}`);

  const dayResults = (itinerary.days || []).map((day) => {
    const morning = formatExportSlot(
      "Morning",
      day.morning,
      options?.viatorContentEnabled,
    );
    const afternoon = formatExportSlot(
      "Afternoon",
      day.afternoon,
      options?.viatorContentEnabled,
    );
    const evening = formatExportSlot(
      "Evening",
      day.evening,
      options?.viatorContentEnabled,
    );
    return {
      day,
      morning,
      afternoon,
      evening,
      removedAny:
        morning.removedAny || afternoon.removedAny || evening.removedAny,
    };
  });

  const anyDayRemoved = dayResults.some((d) => d.removedAny);
  if (itinerary.overview && !anyDayRemoved) {
    lines.push("", "Overview", itinerary.overview);
  }

  if (itinerary.topHotel) {
    lines.push("", `Top Hotel: ${itinerary.topHotel.name}`);
    if (itinerary.topHotel.location?.address) {
      lines.push(`Address: ${itinerary.topHotel.location.address}`);
    }
    const hotelUrl = sanitizeExportAffiliateUrl(
      itinerary.topHotel.affiliateUrl,
      "export_txt",
    );
    if (hotelUrl) {
      lines.push(`Book: ${hotelUrl}`);
      emittedAffiliateLink = true;
    }
  }

  for (const { day, morning, afternoon, evening, removedAny } of dayResults) {
    const dayTitle = removedAny
      ? `Day ${day.dayNumber}: Day ${day.dayNumber}`
      : `Day ${day.dayNumber}: ${day.title}`;
    lines.push("", dayTitle);
    lines.push(`Date: ${formatExportDate(day.date)}`);
    if (day.summary && !removedAny) lines.push(day.summary);

    if (morning.emittedLink || afternoon.emittedLink || evening.emittedLink) {
      emittedAffiliateLink = true;
    }

    lines.push(...morning.lines, ...afternoon.lines, ...evening.lines);

    if (day.hotel) {
      const dayHotelUrl = sanitizeExportAffiliateUrl(
        day.hotel.affiliateUrl,
        "export_txt",
      );
      if (dayHotelUrl) {
        lines.push(`Stay: ${day.hotel.name}`, `  - Book: ${dayHotelUrl}`);
        emittedAffiliateLink = true;
      }
    }

    if (day.transport) {
      lines.push(
        "Transport:",
        `  - ${day.transport.provider} ${day.transport.type} from ${day.transport.departure.city} to ${day.transport.arrival.city}`,
      );
      const transportUrl = sanitizeExportAffiliateUrl(
        day.transport.affiliateUrl,
        "export_txt",
      );
      if (transportUrl) {
        lines.push(`    Book transport: ${transportUrl}`);
        emittedAffiliateLink = true;
      }
    }

    const dayCost = formatExportCost(day.totalEstimatedCost);
    if (dayCost) lines.push(`Day estimate: ${dayCost}`);
    if (day.tips?.length && !removedAny) {
      lines.push("Tips:", ...day.tips.map((tip) => `  - ${tip}`));
    }
  }

  if (itinerary.packingList?.length) {
    lines.push(
      "",
      "Packing Suggestions",
      ...itinerary.packingList.map((item) => `- ${item}`),
    );
  }

  if (itinerary.generalTips?.length && !anyDayRemoved) {
    lines.push(
      "",
      "General Tips",
      ...itinerary.generalTips.map((tip) => `- ${tip}`),
    );
  }

  const essentials = sanitizeExportEssentials(
    options?.essentials,
    "export_txt",
    options?.viatorContentEnabled,
  );
  if (essentials.length > 0) {
    lines.push(
      "",
      "Trip Essentials",
      ...essentials.map((item) => `- ${item.label}: ${item.url}`),
    );
    emittedAffiliateLink = true;
  }

  if (emittedAffiliateLink) {
    lines.push("", AFFILIATE_DISCLOSURE_SHORT);
  }

  return lines.join("\n");
}

export function buildTripExportFilename(trip: TripExportTrip) {
  const destination = trip.destination
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `faroway-${destination || "trip"}-${trip.start_date}.txt`;
}

export {
  buildTripIcsContent,
  buildTripIcsFilename,
  type TripExportInput,
} from "./ics-export";
export type { TripEssentialExportLink, TripExportOptions };
