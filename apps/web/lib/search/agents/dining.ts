import {
  PLANNING_MODEL,
  PLANNING_PROVIDER_OPTIONS,
} from "@/lib/ai/planning-disclosure";
/**
 * Dining Agent
 * Searches for restaurant recommendations
 * Uses AI generation + optional Google Places integration
 */

import { gateway as defaultGateway, createGateway } from "@/lib/ai/sdk";
import {
  generatePlanningObject,
  logPlanningFallback,
  planningModel,
} from "@/lib/ai/planning-step";
import { reservationUrlFromEvidence } from "@/lib/search/reservation-url";
import { z } from "zod";
import { SearchPlan, DiningResult } from "../types";
import { VIBE_KEYWORDS } from "@faroway/constants";
import {
  enrichWithTripAdvisor,
  isTripAdvisorConfigured,
} from "@/lib/affiliates/tripadvisor";
import {
  AI_AGENT_TIMEOUT_MS,
  isOperationTimeoutError,
  withAbortTimeout,
} from "@/lib/search/runtime";

const aiGateway = process.env.AI_GATEWAY_API_KEY
  ? createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })
  : defaultGateway;

const MODEL = PLANNING_MODEL;

const DiningSchema = z.object({
  name: z.string(),
  description: z.string(),
  cuisineTypes: z.array(z.string()),
  priceLevel: z.number().min(1).max(4),
  rating: z.number().min(0).max(5),
  reviewCount: z.number(),
  location: z.object({
    name: z.string(),
    address: z.string(),
    lat: z.number(),
    lng: z.number(),
    neighborhood: z.string().optional(),
  }),
  images: z.array(z.string()).default([]),
  reservationUrl: z.string().optional(),
  affiliatePartner: z.string().optional(),
  mealTypes: z.array(z.enum(["breakfast", "lunch", "dinner"])),
  vibeScore: z.number().min(0).max(100),
  vibeMatch: z.array(z.string()),
  dietaryOptions: z.array(z.string()),
});

const DiningListSchema = z.object({
  restaurants: z.array(DiningSchema),
});

type GeneratedDining = Omit<DiningResult, "id" | "priceLevel"> & {
  priceLevel: number;
};

interface DiningListResult {
  restaurants: GeneratedDining[];
}

const SYSTEM_PROMPT = `You are a food and restaurant expert. Generate realistic restaurant recommendations for travelers.

For each restaurant, provide:
1. Only real restaurant names you have reason to believe exist at the destination. Never invent a name to meet the requested count; return fewer candidates when uncertain. Names, hours, prices and suitability still require current verification.
2. Accurate cuisine types and pricing
3. Set rating and reviewCount to 0; unverified reviews must not be invented
4. Which meals they're best for (breakfast, lunch, dinner)
5. How well the atmosphere matches the traveler's vibes

Price levels:
- 1 ($): Budget, ~$10-20/person
- 2 ($$): Moderate, ~$20-40/person  
- 3 ($$$): Upscale, ~$40-80/person
- 4 ($$$$): Fine dining, ~$80+/person

Include common dietary options if applicable (vegetarian, vegan, gluten-free, halal, kosher).

Do not invent reservation URLs or OpenTable links. Leave reservationUrl empty. A reservation link is added only from verified provider data.

IMPORTANT: For the "images" field, return an EMPTY array []. Do NOT generate or guess image URLs.`;

export async function runDiningAgent(
  plan: SearchPlan,
  count: number = 12,
): Promise<DiningResult[]> {
  const { destination, dates, diningCriteria, vibeInterpretation } = plan;
  const { cuisineTypes, priceRange, dietaryNeeds, mealPriorities } =
    diningCriteria;

  // Map price range to price levels
  const priceLevelMap: Record<string, number[]> = {
    budget: [1, 2],
    moderate: [2, 3],
    upscale: [3, 4],
  };
  const priceLevels = priceLevelMap[priceRange] || [2, 3];

  const prompt = `Generate ${count} restaurant recommendations for ${destination}.

**Dining Preferences:**
- ${dates.nights + 1} days of dining
- Price range: ${priceRange} (levels ${priceLevels.join("-")})
- Cuisine interests: ${cuisineTypes.join(", ") || "local cuisine"}
- Dietary needs: ${dietaryNeeds.join(", ") || "none specified"}
- Mobility needs: ${plan.mobilityNeeds || "none specified"}
- Structured requirements: ${JSON.stringify(plan.requirements ?? {})}
- Dietary and accessibility suitability require direct verification; do not claim they are confirmed without evidence.
- Meal priorities: ${mealPriorities.join(", ")}

**Vibes to match:** ${vibeInterpretation.vibes.join(", ")}

Generate a diverse mix of:
- 3-4 breakfast/brunch spots
- 4-5 lunch options
- 4-5 dinner restaurants
- Include both local favorites and hidden gems
- Mix of price levels within the range
- Cover the major sightseeing neighborhoods and the requested hotel areas: ${plan.hotelCriteria?.neighborhoods?.join(", ") || "central visitor areas"}. Include breakfast and lunch options outside the central nightlife district. Do not invent a venue to fill geographic gaps.

For vibes like:
- "Foodie" → renowned restaurants, food markets, unique experiences
- "Romantic" → intimate settings, fine dining, scenic views
- "Cultural" → traditional local cuisine, historic restaurants
- "Nightlife" → late-night spots, rooftop bars with food
- "Wellness" → healthy options, organic, farm-to-table

Score each restaurant 0-100 on how well it matches the traveler's vibes.`;

  try {
    const { object: result } = await withAbortTimeout(
      (abortSignal) =>
        generatePlanningObject<DiningListResult>("dining", {
          model: aiGateway(planningModel("dining", MODEL)),
          providerOptions: PLANNING_PROVIDER_OPTIONS,
          system: SYSTEM_PROMPT,
          prompt,
          schema: DiningListSchema,
          timeout: AI_AGENT_TIMEOUT_MS,
          abortSignal,
          maxRetries: 0,
        }),
      AI_AGENT_TIMEOUT_MS,
      "dining AI",
    );

    let omittedReservationUrls = 0;
    // Add unique IDs and sort by vibe score. Model-authored reservation
    // links are dropped unless constructed from verified provider data.
    let restaurants = result.restaurants
      .map((restaurant, index) => {
        const keptUrl = reservationUrlFromEvidence(restaurant.reservationUrl, {
          kind: "none",
        });
        if (restaurant.reservationUrl && !keptUrl) omittedReservationUrls += 1;
        const safe = { ...restaurant };
        delete safe.reservationUrl;
        delete safe.affiliatePartner;
        return {
          ...safe,
          ...(keptUrl ? { reservationUrl: keptUrl } : {}),
          dietaryOptions: [],
          rating: 0,
          reviewCount: 0,
          id: `dining_${Date.now()}_${index}`,
          priceLevel: restaurant.priceLevel as 1 | 2 | 3 | 4,
        };
      })
      .sort((a, b) => b.vibeScore - a.vibeScore);
    if (omittedReservationUrls > 0) {
      console.info(
        JSON.stringify({
          event: "planning.step.reservation_url_omitted",
          step: "dining",
          omitted: omittedReservationUrls,
          at: new Date().toISOString(),
        }),
      );
    }

    // Enrich with TripAdvisor ratings and reviews
    if (isTripAdvisorConfigured()) {
      try {
        restaurants = await enrichWithTripAdvisor(restaurants, "restaurants");
      } catch (e) {
        console.error("[Dining Agent] TripAdvisor enrichment error:", e);
      }
    }

    return restaurants;
  } catch (error) {
    const timedOut = isOperationTimeoutError(error);
    const detail = error instanceof Error ? error.message : String(error);
    if (timedOut) {
      console.warn(
        "[Dining Agent] AI timed out, returning available dining results:",
        detail,
      );
    } else {
      console.error("[Dining Agent] Error:", error);
    }
    logPlanningFallback(
      "dining",
      timedOut ? "timeout" : "error",
      "empty",
      detail,
    );
    return [];
  }
}

/**
 * Deprecated compatibility helper: Google venue ingestion is disabled.
 */
export async function searchGooglePlacesDining(
  _destination: string,
  _types: string[],
): Promise<Record<string, unknown>[]> {
  void _destination;
  void _types;
  // Places content must not enter the persisted, AI-processed recommendation
  // pipeline. A future transient, attributed display needs a separate design.
  return [];
}

/**
 * Calculate vibe score for a restaurant
 */
export function calculateDiningVibeScore(
  restaurant: { name: string; description: string; cuisineTypes: string[] },
  vibes: string[],
): { score: number; matchedVibes: string[] } {
  const text =
    `${restaurant.name} ${restaurant.description} ${restaurant.cuisineTypes.join(" ")}`.toLowerCase();
  const matchedVibes: string[] = [];
  let score = 50;

  for (const vibe of vibes) {
    const keywords = VIBE_KEYWORDS[vibe.toLowerCase()] || [];
    const matches = keywords.filter((keyword) =>
      text.includes(keyword.toLowerCase()),
    );

    if (matches.length > 0) {
      matchedVibes.push(vibe);
      score += matches.length * 12;
    }
  }

  // Vibe-specific bonuses
  if (vibes.includes("Foodie")) score += 15; // Foodies appreciate all good food
  if (vibes.includes("Romantic") && text.includes("intimate")) score += 20;
  if (vibes.includes("Cultural") && text.includes("traditional")) score += 20;

  return {
    score: Math.min(100, score),
    matchedVibes,
  };
}
