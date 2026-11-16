import type { ActivityResult, DiningResult, SearchPlan } from "@faroway/types";
import { fetchWithTimeout } from "@/lib/search/runtime";

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

const MEAL_ORDER = ["breakfast", "lunch", "dinner"] as const;

function placePhrase(plan: SearchPlan): string {
  const area = plan.hotelCriteria.neighborhoods?.find((item) => item.trim());
  return area
    ? `near ${area.trim()} in ${plan.destination}`
    : `in ${plan.destination}`;
}

function planningScore(index: number): number {
  // Stay below a real interest match so these prompts cannot crowd supplier inventory.
  return Math.max(12, 32 - index * 4);
}

function buildFallbackActivities(plan: SearchPlan): ActivityResult[] {
  const interests = [
    ...plan.activityCriteria.interests,
    ...plan.vibeInterpretation.vibes,
  ].filter((item, index, all) => item.trim() && all.indexOf(item) === index);
  const topics = (interests.length ? interests : ["local"]).slice(0, 3);
  const place = placePhrase(plan);
  const pace = plan.activityCriteria.pacePreference;
  return topics.map((topic, index) => ({
    id: normalizeId("enriched_activity", topic, index),
    planningIdea: true,
    name: `Look for a ${topic.trim()} stop ${place}`,
    description: `Planning prompt, not a reserved stop. Look for one ${topic.trim()} visit ${place} that fits a ${pace} pace. Confirm the place, opening times, access, and any admission before you go.`,
    category: "sightseeing",
    duration: pace === "packed" ? 75 : 90,
    price: 0,
    priceStatus: "unknown",
    currency: "",
    rating: 0,
    reviewCount: 0,
    location: {
      name: plan.hotelCriteria.neighborhoods?.[0]?.trim() || plan.destination,
      address: "",
      lat: 0,
      lng: 0,
    },
    images: [],
    affiliateUrl: undefined,
    affiliatePartner: undefined,
    bestTimeOfDay: index === 0 ? "morning" : index === 1 ? "afternoon" : "any",
    vibeScore: planningScore(index),
    vibeMatch: plan.vibeInterpretation.vibes.slice(0, 2),
    bookingRequired: false,
  }));
}

function buildFallbackDining(plan: SearchPlan): DiningResult[] {
  const cuisines = plan.diningCriteria.cuisineTypes.length
    ? plan.diningCriteria.cuisineTypes
    : ["local"];
  const meals = plan.diningCriteria.mealPriorities.length
    ? plan.diningCriteria.mealPriorities
    : [...MEAL_ORDER];
  const place = placePhrase(plan);
  const dietary = [
    ...(plan.diningCriteria.dietaryNeeds ?? []),
    ...(plan.dietaryRestrictions ?? []),
  ].some((item) => item.trim());
  return cuisines.slice(0, 3).map((cuisine, index) => {
    const meal = meals[index % meals.length];
    return {
      id: normalizeId("enriched_dining", `${cuisine}-${meal}`, index),
      planningIdea: true,
      name: `Find ${cuisine.trim()} for ${meal} ${place}`,
      description: `Not a reserved table. Look for ${cuisine.trim()} that serves ${meal} ${place}. ${
        dietary
          ? "Ask the venue about the dietary needs saved on this trip. This prompt is not a suitability claim."
          : "Confirm the menu before you go."
      } Prices are unknown until the venue confirms them.`,
      cuisineTypes: [cuisine],
      priceLevel: 2,
      priceStatus: "unknown",
      dietaryOptions: [],
      mealTypes: [meal],
      location: {
        name: plan.hotelCriteria.neighborhoods?.[0]?.trim() || plan.destination,
        address: "",
        lat: 0,
        lng: 0,
      },
      images: [],
      reservationUrl: undefined,
      affiliatePartner: undefined,
      vibeScore: planningScore(index),
      vibeMatch: plan.vibeInterpretation.vibes.slice(0, 2),
      rating: 0,
      reviewCount: 0,
    };
  });
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
      // Search-page snippets have not been resolved to a specific venue/visit.
      planningIdea: true,
      name: item.title || `Local experience ${index + 1}`,
      description:
        item.content?.slice(0, 220) ||
        `Web-sourced suggestion for ${plan.destination}`,
      category: "sightseeing",
      duration: 90,
      price: 0,
      priceStatus: "unknown",
      currency: "",
      rating: 0,
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
  _idNamespace: string = "direct",
): Promise<EnrichmentOutput> {
  void _idNamespace;
  // Google Places responses were previously sent to the aggregator and stored
  // in search/trip records. Keep that path closed until storage and external
  // processing rights and a transient attributed display are resolved.
  return enrichNonAffiliateCandidates(plan);
}
