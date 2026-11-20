import type { TripDay } from "@faroway/types";

interface PreviewInput {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  vibes?: string[];
}

const MORNING_THEMES = [
  "Neighborhood walk",
  "Local coffee and orientation",
  "Landmark highlights",
  "Scenic lookout",
];
const AFTERNOON_THEMES = [
  "Culture and museums",
  "Street food and markets",
  "Parks and hidden corners",
  "Shopping and design spots",
];
const EVENING_THEMES = [
  "Sunset viewpoints",
  "Dinner in a local district",
  "Live music and nightlife",
  "Relaxed evening stroll",
];

function getDateRange(startDate: string, endDate: string): string[] {
  const startMs = Date.parse(`${startDate}T00:00:00Z`);
  const endMs = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) {
    return [];
  }
  const dates: string[] = [];
  for (let cursor = startMs; cursor <= endMs; cursor += 86400000) {
    dates.push(new Date(cursor).toISOString().slice(0, 10));
  }
  return dates;
}

export function buildInstantPreview(input: PreviewInput): TripDay[] {
  const dates = getDateRange(input.startDate, input.endDate);
  const vibeText =
    input.vibes && input.vibes.length > 0
      ? input.vibes.slice(0, 2).join(" + ")
      : "signature";

  return dates.map((date, index) => {
    const dayNumber = index + 1;
    const morningTitle = MORNING_THEMES[index % MORNING_THEMES.length];
    const afternoonTitle = AFTERNOON_THEMES[index % AFTERNOON_THEMES.length];
    const eveningTitle = EVENING_THEMES[index % EVENING_THEMES.length];

    return {
      dayNumber,
      date,
      title: `Day ${dayNumber}: ${vibeText} ${input.destination}`,
      summary: `Draft preview while we enrich your personalized itinerary.`,
      morning: { activities: [], meals: [] },
      afternoon: { activities: [], meals: [] },
      evening: { activities: [], meals: [] },
      tips: [
        `${morningTitle} in ${input.destination}`,
        `${afternoonTitle} matched to your vibe`,
        `${eveningTitle} for ${input.travelers} traveler${input.travelers === 1 ? "" : "s"}`,
      ],
    };
  });
}
