import type { ActivityResult, DiningResult, SearchPlan } from "@faroway/types";
import { fetchWithTimeout } from "@/lib/search/runtime";
import { searchGooglePlacesActivities } from "@/lib/search/agents/activities";
import { searchGooglePlacesDining } from "@/lib/search/agents/dining";

export interface EnrichmentOutput {
  activities: ActivityResult[];
  dining: DiningResult[];
  notes: string[];
}

interface TavilyResult {
  title?: string;
  content?: string;
  url?: string;
  score?: number;
}

function hasTavilyConfig(): boolean {
  return Boolean(process.env.TAVILY_API_KEY);
}

function normalizeId(prefix: string, value: string, index: number): string {
  return `${prefix}_${value.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${index}`;
}

function buildFallbackActivities(plan: SearchPlan): ActivityResult[] {
  const base = [
    "Self-guided neighborhood walk",
    "Local market exploration",
    "Sunset viewpoint",
  ];
  return base.map((name, index) => ({
    id: normalizeId("enriched_activity", name, index),
    name: `${name} in ${plan.destination}`,
    description:
      "Quality-first suggestion to improve authenticity while affiliate inventory loads.",
    category: "sightseeing",
    duration: 90,
    price: 0,
    currency: "USD",
    rating: 4.5,
    reviewCount: 0,
    location: { name: plan.destination, address: "", lat: 0, lng: 0 },
    images: [],
    affiliateUrl: undefined,
    affiliatePartner: undefined,
    bestTimeOfDay: "any",
    vibeScore: 78 - index * 4,
    vibeMatch: plan.vibeInterpretation.vibes.slice(0, 2),
    bookingRequired: false,
  }));
}

function buildFallbackDining(plan: SearchPlan): DiningResult[] {
  const cuisines = plan.diningCriteria.cuisineTypes.length
    ? plan.diningCriteria.cuisineTypes
    : ["local"];
  return cuisines.slice(0, 3).map((cuisine, index) => ({
    id: normalizeId("enriched_dining", cuisine, index),
    name: `${cuisine} neighborhood spot`,
    description:
      "Non-affiliate local recommendation included to improve quality and variety.",
    cuisineTypes: [cuisine],
    priceLevel: 2,
    dietaryOptions: plan.diningCriteria.dietaryNeeds || [],
    mealTypes: ["lunch", "dinner"],
    location: { name: plan.destination, address: "", lat: 0, lng: 0 },
    images: [],
    reservationUrl: undefined,
    affiliatePartner: undefined,
    vibeScore: 74 - index * 3,
    vibeMatch: plan.vibeInterpretation.vibes.slice(0, 2),
    rating: 4.4,
    reviewCount: 0,
  }));
}

async function fetchTavilyResults(
  query: string,
  limit: number,
): Promise<TavilyResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetchWithTimeout("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        max_results: limit,
      }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: TavilyResult[] };
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  }
}

export async function enrichNonAffiliateCandidates(
  plan: SearchPlan,
): Promise<EnrichmentOutput> {
  const notes: string[] = [];
  let tavilyActivities: ActivityResult[] = [];

  if (hasTavilyConfig()) {
    const tavily = await fetchTavilyResults(
      `best local experiences and hidden gems in ${plan.destination}`,
      3,
    );
    tavilyActivities = tavily.map((item, index) => ({
      id: normalizeId("tavily_activity", item.title || "local", index),
      name: item.title || `Local experience ${index + 1}`,
      description:
        item.content?.slice(0, 220) ||
        `Web-sourced suggestion for ${plan.destination}`,
      category: "sightseeing",
      duration: 90,
      price: 0,
      currency: "USD",
      rating: Math.max(3.8, Math.min(5, (item.score || 0.8) * 5)),
      reviewCount: 0,
      location: { name: plan.destination, address: "", lat: 0, lng: 0 },
      images: [],
      affiliateUrl: undefined,
      affiliatePartner: undefined,
      bestTimeOfDay: "any",
      vibeScore: 76 - index * 2,
      vibeMatch: plan.vibeInterpretation.vibes.slice(0, 2),
      bookingRequired: false,
    }));
    notes.push(
      tavilyActivities.length > 0
        ? "Tavily enrichment added local non-affiliate experiences."
        : "Tavily configured but no usable results returned.",
    );
  } else {
    notes.push("Tavily not configured; using deterministic local enrichment.");
  }

  return {
    activities: [...buildFallbackActivities(plan), ...tavilyActivities],
    dining: buildFallbackDining(plan),
    notes,
  };
}

export async function runSearchEnrichment(
  plan: SearchPlan,
  idNamespace: string = "direct",
): Promise<EnrichmentOutput> {
  const [enriched, placesActivities, placesDining] = await Promise.all([
    enrichNonAffiliateCandidates(plan),
    searchGooglePlacesActivities(plan.destination, [
      "museum",
      "park",
      "viewpoint",
    ]),
    searchGooglePlacesDining(plan.destination, [
      "local",
      "street food",
      "popular",
    ]),
  ]);

  const normalizedPlacesActivities: ActivityResult[] = placesActivities
    .slice(0, 3)
    .map((item, index) => {
      const point = getGooglePlacePoint(item);
      return {
        id: `places_activity_${idNamespace}_${index}`,
        name: String(item.name || "Local activity"),
        description: `Google Places recommendation for ${plan.destination}`,
        category: "sightseeing",
        duration: 90,
        price: 0,
        currency: "USD",
        rating: typeof item.rating === "number" ? item.rating : 4.3,
        reviewCount:
          typeof item.user_ratings_total === "number"
            ? item.user_ratings_total
            : 0,
        location: {
          name: plan.destination,
          address: String(item.formatted_address || item.vicinity || ""),
          lat: point.lat,
          lng: point.lng,
        },
        images: [],
        affiliateUrl: undefined,
        affiliatePartner: undefined,
        bestTimeOfDay: "any",
        vibeScore: 72 - index * 2,
        vibeMatch: plan.vibeInterpretation.vibes.slice(0, 2),
        bookingRequired: false,
      };
    });

  const normalizedPlacesDining: DiningResult[] = placesDining
    .slice(0, 3)
    .map((item, index) => {
      const point = getGooglePlacePoint(item);
      return {
        id: `places_dining_${idNamespace}_${index}`,
        name: String(item.name || "Local restaurant"),
        description: `Google Places dining recommendation for ${plan.destination}`,
        cuisineTypes: ["local"],
        priceLevel: 2,
        dietaryOptions: [],
        mealTypes: ["lunch", "dinner"],
        location: {
          name: plan.destination,
          address: String(item.formatted_address || item.vicinity || ""),
          lat: point.lat,
          lng: point.lng,
        },
        images: [],
        reservationUrl: undefined,
        affiliatePartner: undefined,
        vibeScore: 70 - index * 2,
        vibeMatch: plan.vibeInterpretation.vibes.slice(0, 2),
        rating: typeof item.rating === "number" ? item.rating : 4.2,
        reviewCount:
          typeof item.user_ratings_total === "number"
            ? item.user_ratings_total
            : 0,
      };
    });

  return {
    activities: [...enriched.activities, ...normalizedPlacesActivities],
    dining: [...enriched.dining, ...normalizedPlacesDining],
    notes: [
      ...enriched.notes,
      ...(normalizedPlacesActivities.length > 0 ||
      normalizedPlacesDining.length > 0
        ? ["Google Places enrichment applied for non-affiliate local picks."]
        : []),
    ],
  };
}

function getGooglePlacePoint(item: Record<string, unknown>): {
  lat: number;
  lng: number;
} {
  const geometry = item.geometry as
    | { location?: { lat?: unknown; lng?: unknown } }
    | undefined;
  const lat = geometry?.location?.lat;
  const lng = geometry?.location?.lng;
  return {
    lat: typeof lat === "number" ? lat : 0,
    lng: typeof lng === "number" ? lng : 0,
  };
}
