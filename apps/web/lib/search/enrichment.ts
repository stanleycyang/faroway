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
      "Planning idea; confirm opening times, availability and any admission price.",
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
      "Dining idea; choose a venue and confirm menu prices before booking.",
    cuisineTypes: [cuisine],
    priceLevel: 2,
    priceStatus: "unknown",
    dietaryOptions: [],
    mealTypes: ["lunch", "dinner"],
    location: { name: plan.destination, address: "", lat: 0, lng: 0 },
    images: [],
    reservationUrl: undefined,
    affiliatePartner: undefined,
    vibeScore: 74 - index * 3,
    vibeMatch: plan.vibeInterpretation.vibes.slice(0, 2),
    rating: 0,
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
