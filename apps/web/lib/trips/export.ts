import type { GeneratedItinerary, TripDay } from "@faroway/types";

export interface TripExportTrip {
  destination: string;
  start_date: string;
  end_date: string;
  travelers: number;
  status: string;
}

type ExportCost =
  GeneratedItinerary["totalEstimatedCost"] | number | null | undefined;
type ExportItinerary =
  | (Omit<Partial<GeneratedItinerary>, "days" | "totalEstimatedCost"> & {
      days?: TripDay[];
      totalEstimatedCost?: ExportCost;
    })
  | null;

function formatExportDate(dateStr: string) {
  const date = new Date(dateStr);
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
  const currency = typeof cost === "number" ? "USD" : cost.currency;
  if (!amount || amount <= 0) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatExportSlot(
  label: string,
  slot: Partial<TripDay["morning"]> | null | undefined,
) {
  const lines: string[] = [];
  const activities = Array.isArray(slot?.activities) ? slot.activities : [];
  const meals = Array.isArray(slot?.meals) ? slot.meals : [];

  if (activities.length === 0 && meals.length === 0) return lines;

  lines.push(`${label}:`);
  for (const activity of activities) {
    lines.push(`  - ${activity.name}`);
  }
  for (const meal of meals) {
    lines.push(`  - ${meal.name}`);
  }
  return lines;
}

export function buildTripExportText(
  trip: TripExportTrip,
  itinerary: ExportItinerary,
  exportedAt = new Date(),
) {
  const lines = [
    "Faroway Trip Export",
    `Destination: ${trip.destination}`,
    `Dates: ${formatExportDate(trip.start_date)} to ${formatExportDate(trip.end_date)}`,
    `Travelers: ${trip.travelers}`,
    `Status: ${trip.status}`,
    `Exported: ${exportedAt.toISOString()}`,
  ];

  if (!itinerary) {
    lines.push("", "Itinerary details are not available yet.");
    return lines.join("\n");
  }

  const totalCost = formatExportCost(itinerary.totalEstimatedCost);
  if (totalCost) lines.push(`Estimated total: ${totalCost}`);
  if (itinerary.overview) lines.push("", "Overview", itinerary.overview);

  for (const day of itinerary.days || []) {
    lines.push("", `Day ${day.dayNumber}: ${day.title}`);
    lines.push(`Date: ${formatExportDate(day.date)}`);
    if (day.summary) lines.push(day.summary);
    lines.push(
      ...formatExportSlot("Morning", day.morning),
      ...formatExportSlot("Afternoon", day.afternoon),
      ...formatExportSlot("Evening", day.evening),
    );

    if (day.transport) {
      lines.push(
        "Transport:",
        `  - ${day.transport.provider} ${day.transport.type} from ${day.transport.departure.city} to ${day.transport.arrival.city}`,
      );
    }

    const dayCost = formatExportCost(day.totalEstimatedCost);
    if (dayCost) lines.push(`Day estimate: ${dayCost}`);
    if (day.tips?.length) {
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

  if (itinerary.generalTips?.length) {
    lines.push(
      "",
      "General Tips",
      ...itinerary.generalTips.map((tip) => `- ${tip}`),
    );
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
