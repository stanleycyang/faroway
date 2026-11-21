import { haversineDistanceKm, isValidCoordinate } from "./maps-route";

export interface ExplainableStopInput {
  name: string;
  description?: string;
  category?: string;
  location?: {
    neighborhood?: string;
    lat?: number;
    lng?: number;
    name?: string;
    address?: string;
    coordinates?: {
      lat?: number;
      lng?: number;
    };
  };
  rating?: number;
  duration?: number;
  vibeMatch?: {
    matchedVibes?: string[];
    reasoning?: string;
  };
  cuisineType?: string[];
  mealType?: string;
}

export interface ExplainStopContext {
  vibes?: string[];
  previousStop?: {
    name: string;
    lat?: number;
    lng?: number;
  };
  requirements?: {
    allergies?: string[];
    dietaryPreferences?: string[];
    accessibility?: string[];
    mobilityNotes?: string;
  };
}

const WALKING_SPEED_KM_PER_HOUR = 4.8;
const MAX_RATIONALE_ITEMS = 2;

const VIBE_MATCHERS: Array<{
  vibes: string[];
  categories?: string[];
  keywords: RegExp;
}> = [
  {
    vibes: ["foodie", "food", "culinary", "gastronomy", "dining"],
    keywords:
      /\b(restaurant|cafe|café|bakery|ramen|sushi|bistro|trattoria|izakaya|market|street food|food|tasting|wine|coffee|patisserie|tapas|brunch|dinner|lunch|breakfast|cuisine|noodle|bar)\b/i,
  },
  {
    vibes: ["culture", "cultural", "history", "historical", "art", "heritage"],
    categories: ["cultural"],
    keywords:
      /\b(museum|temple|shrine|gallery|cathedral|palace|castle|historic|heritage|monument|opera|architecture|ruins|basilica|exhibit|ancient)\b/i,
  },
  {
    vibes: ["adventure", "outdoors", "nature", "active", "hiking"],
    categories: ["adventure"],
    keywords:
      /\b(hike|trail|mountain|kayak|snorkel|climb|bike|cycling|canyon|waterfall|cliff|national park|outdoor|rafting|zip|trek)\b/i,
  },
  {
    vibes: ["relaxation", "relaxed", "wellness", "slow", "chill", "beach"],
    categories: ["relaxation"],
    keywords:
      /\b(spa|onsen|beach|garden|botanical|stroll|promenade|tea house|bath|lounge|park|waterfront|sunset|thermal)\b/i,
  },
  {
    vibes: ["nightlife", "entertainment", "music", "social"],
    categories: ["entertainment"],
    keywords:
      /\b(bar|jazz|club|theater|theatre|cocktail|live music|rooftop|comedy|show|pub|concert|cabaret|night market)\b/i,
  },
  {
    vibes: ["shopping", "fashion", "design", "craft"],
    categories: ["shopping"],
    keywords:
      /\b(shop|shopping|boutique|market|arcade|vintage|craft|bazaar|souk|artisan|district|design|concept store)\b/i,
  },
  {
    vibes: ["sightseeing", "iconic", "photography", "landmarks", "city"],
    categories: ["sightseeing"],
    keywords:
      /\b(viewpoint|tower|bridge|overlook|landmark|square|plaza|old town|panorama|observatory|skyline|walking tour)\b/i,
  },
  {
    vibes: ["romantic", "luxury", "upscale"],
    keywords:
      /\b(sunset|cruise|rooftop|wine|scenic|garden|palace|fine dining|tasting menu|viewpoint|gondola|canal|terrace)\b/i,
  },
  {
    vibes: ["family", "kids", "kid-friendly"],
    keywords:
      /\b(aquarium|zoo|park|science|interactive|garden|ferris|boat|playground|planetarium|museum)\b/i,
  },
];

function formatVibeLabel(vibe: string): string {
  return vibe
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function getStopCoords(
  location?: ExplainableStopInput["location"],
): { lat: number; lng: number } | null {
  if (!location) return null;
  const lat = location.lat ?? location.coordinates?.lat;
  const lng = location.lng ?? location.coordinates?.lng;
  if (isValidCoordinate(lat, lng)) {
    return { lat, lng: lng as number };
  }
  return null;
}

function matchUserVibe(
  stop: ExplainableStopInput,
  vibes?: string[],
): string | null {
  if (!Array.isArray(vibes) || vibes.length === 0) return null;

  const cleanVibes = vibes
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim());
  if (cleanVibes.length === 0) return null;

  // 1. Direct intersection with explicit stop.vibeMatch.matchedVibes
  if (Array.isArray(stop.vibeMatch?.matchedVibes)) {
    const matchedLower = new Set(
      stop.vibeMatch.matchedVibes
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim().toLowerCase()),
    );
    for (const userVibe of cleanVibes) {
      if (matchedLower.has(userVibe.toLowerCase())) {
        return formatVibeLabel(userVibe);
      }
    }
  }

  // 2. Factual match against stop category, meal/cuisine metadata, name & description
  const textCorpus = [
    stop.name,
    stop.description || "",
    stop.category || "",
    stop.mealType || "",
    ...(Array.isArray(stop.cuisineType) ? stop.cuisineType : []),
  ]
    .join(" ")
    .toLowerCase();
  const categoryLower = (stop.category || "").toLowerCase();

  for (const userVibe of cleanVibes) {
    const vibeLower = userVibe.toLowerCase();

    if (
      (vibeLower.includes("food") ||
        vibeLower.includes("culinary") ||
        vibeLower.includes("dining")) &&
      (stop.mealType ||
        (Array.isArray(stop.cuisineType) && stop.cuisineType.length > 0))
    ) {
      return formatVibeLabel(userVibe);
    }

    for (const rule of VIBE_MATCHERS) {
      const ruleApplies = rule.vibes.some(
        (token) => vibeLower === token || vibeLower.includes(token),
      );
      if (!ruleApplies) continue;
      if (rule.categories && rule.categories.includes(categoryLower)) {
        return formatVibeLabel(userVibe);
      }
      if (rule.keywords.test(textCorpus)) {
        return formatVibeLabel(userVibe);
      }
    }

    if (vibeLower.length >= 4 && textCorpus.includes(vibeLower)) {
      return formatVibeLabel(userVibe);
    }
  }

  return null;
}

function buildProximityRationale(
  stop: ExplainableStopInput,
  previousStop?: ExplainStopContext["previousStop"],
): string | null {
  if (!previousStop?.name?.trim()) return null;
  if (
    previousStop.name.trim().toLowerCase() === stop.name.trim().toLowerCase()
  ) {
    return null;
  }

  const stopCoords = getStopCoords(stop.location);
  if (!stopCoords || !isValidCoordinate(previousStop.lat, previousStop.lng)) {
    return null;
  }

  const km = haversineDistanceKm(
    previousStop.lat,
    previousStop.lng as number,
    stopCoords.lat,
    stopCoords.lng,
  );

  const walkMinutes = Math.max(
    1,
    Math.round((km / WALKING_SPEED_KM_PER_HOUR) * 60),
  );
  if (walkMinutes <= 20) {
    return `${walkMinutes} min walk from ${previousStop.name.trim()}`;
  }
  if (km <= 6) {
    return `${km.toFixed(1)} km from ${previousStop.name.trim()}`;
  }
  return null;
}

function formatDurationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round((minutes / 60) * 2) / 2;
  return `${hours} hr`;
}

/**
 * Produces 1–2 crisp, strictly factual rationale strings explaining why a stop
 * fits the traveler's plan. Never fabricates allergen, dietary, or accessibility
 * safety guarantees.
 */
export function explainStopSelection(
  stop: ExplainableStopInput,
  context: ExplainStopContext = {},
): string[] {
  if (!stop || typeof stop !== "object" || !stop.name?.trim()) {
    return [];
  }

  const reasons: string[] = [];

  // 1. Vibe alignment (based on explicit vibeMatch or factual stop attributes)
  const matchedVibe = matchUserVibe(stop, context.vibes);
  if (matchedVibe) {
    reasons.push(`Matches your ${matchedVibe} vibe`);
  }

  // 2. Proximity to previous stop (computed from real coordinates only)
  const proximity = buildProximityRationale(stop, context.previousStop);
  if (proximity && reasons.length < MAX_RATIONALE_ITEMS) {
    reasons.push(proximity);
  }

  // 3. Verified high rating when reported
  if (
    reasons.length < MAX_RATIONALE_ITEMS &&
    typeof stop.rating === "number" &&
    Number.isFinite(stop.rating) &&
    stop.rating >= 4.5 &&
    stop.rating <= 5
  ) {
    reasons.push(`Highly rated (${stop.rating.toFixed(1)}★)`);
  }

  // 4. Neighborhood anchor (factual location field only)
  const neighborhood = stop.location?.neighborhood?.trim();
  if (reasons.length < MAX_RATIONALE_ITEMS && neighborhood) {
    reasons.push(`In ${neighborhood}`);
  }

  // 5. Factual duration pacing hint when no higher-signal rationale filled the slot
  if (
    reasons.length === 0 &&
    typeof stop.duration === "number" &&
    Number.isFinite(stop.duration) &&
    stop.duration > 0
  ) {
    if (stop.duration <= 60) {
      reasons.push(`Quick ${formatDurationLabel(stop.duration)} stop`);
    } else if (stop.duration >= 120) {
      reasons.push(`${formatDurationLabel(stop.duration)} anchor visit`);
    } else {
      reasons.push(`${formatDurationLabel(stop.duration)} visit`);
    }
  }

  // Note: context.requirements (allergies, dietaryPreferences, accessibility,
  // mobilityNotes) is intentionally NEVER converted into safety or compliance
  // guarantees because venue-level verification is not confirmed here.
  return reasons.slice(0, MAX_RATIONALE_ITEMS);
}
