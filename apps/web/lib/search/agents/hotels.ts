import {
  PLANNING_MODEL,
  PLANNING_PROVIDER_OPTIONS,
} from "@/lib/ai/planning-disclosure";
/**
 * Hotels Agent
 * Generates informational accommodation suggestions.
 * Live hotel quotes use the separate consented LiteAPI flow.
 */

import { gateway as defaultGateway, createGateway } from "@/lib/ai/sdk";
import {
  generatePlanningObject,
  logPlanningFallback,
  planningModel,
} from "@/lib/ai/planning-step";
import { z } from "zod";
import { SearchPlan, HotelResult } from "../types";
import { VIBE_KEYWORDS } from "@faroway/constants";
import {
  AI_AGENT_TIMEOUT_MS,
  isOperationTimeoutError,
  withAbortTimeout,
} from "@/lib/search/runtime";

const aiGateway = process.env.AI_GATEWAY_API_KEY
  ? createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })
  : defaultGateway;

const MODEL = PLANNING_MODEL;

const HotelSchema = z.object({
  name: z.string(),
  description: z.string(),
  amenities: z.array(z.string()),
  location: z.object({
    name: z.string(),
    address: z.string(),
    lat: z.number(),
    lng: z.number(),
    neighborhood: z.string().optional(),
  }),
  images: z.array(z.string()).default([]),
  vibeScore: z.number().min(0).max(100),
  vibeMatch: z.array(z.string()),
});

const HotelListSchema = z.object({
  hotels: z.array(HotelSchema),
});

type GeneratedHotel = Omit<HotelResult, "id">;

interface HotelListResult {
  hotels: GeneratedHotel[];
}

const SYSTEM_PROMPT = `You are a hotel booking expert. Generate realistic hotel recommendations for travelers.

For each hotel, provide:
1. Real hotel names that exist at the destination (use actual hotel names)
2. A brief description of why the hotel may fit the traveler's preferences
3. Location in a popular neighborhood
4. How well it matches the traveler's preferences

Do not generate booking or affiliate URLs. Only live provider results may have
booking links; AI-generated recommendations are informational only.
Do not invent or supply prices, currencies, review scores, review counts, star
classifications, availability or cancellation terms. These require provider data.
Room capacity, accessibility and dietary suitability are unverified; do not claim
they are confirmed. Use the supplied party and requirements to identify options
to check, without inventing room configurations, child policies or guarantees.

IMPORTANT: For the "images" field, return an EMPTY array []. Do NOT generate or guess image URLs.`;

/**
 * Normalize a hotel name for fuzzy deduplication.
 * Lowercases and strips common filler words like "hotel", "resort", "the", etc.
 */
function normalizeHotelName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(hotel|resort|the|a|an|&|and)\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/**
 * Deduplicate hotels by fuzzy name matching.
 * When two hotels have the same normalized name, keep the one with the better userRating.
 */
function deduplicateHotels(hotels: HotelResult[]): HotelResult[] {
  const seen = new Map<string, HotelResult>();

  for (const hotel of hotels) {
    const key = normalizeHotelName(hotel.name);
    const existing = seen.get(key);

    if (!existing || (hotel.userRating ?? -1) > (existing.userRating ?? -1)) {
      seen.set(key, hotel);
    }
  }

  return Array.from(seen.values());
}

export async function runHotelsAgent(
  plan: SearchPlan,
  count: number = 10,
): Promise<HotelResult[]> {
  const { destination, dates, hotelCriteria, vibeInterpretation } = plan;
  const { priceRange, starRating, amenities, neighborhoods } = hotelCriteria;
  const aiFallbackPromise = generateAiHotelFallbacks({
    destination,
    dates,
    priceRange,
    starRating,
    amenities,
    neighborhoods,
    vibes: vibeInterpretation.vibes,
    travelerContext: plan,
    count,
  });

  // Live quotes are requested separately through the consented LiteAPI flow.
  const hotels = deduplicateHotels(await aiFallbackPromise);
  return hotels.sort((a, b) => b.vibeScore - a.vibeScore).slice(0, count);
}

async function generateAiHotelFallbacks(params: {
  destination: string;
  dates: SearchPlan["dates"];
  priceRange: SearchPlan["hotelCriteria"]["priceRange"];
  starRating: number[];
  amenities: string[];
  neighborhoods: string[];
  vibes: string[];
  travelerContext: Pick<
    SearchPlan,
    | "travelers"
    | "adults"
    | "children"
    | "childAges"
    | "roomCount"
    | "mobilityNeeds"
    | "requirements"
  >;
  count: number;
}): Promise<HotelResult[]> {
  const {
    destination,
    dates,
    priceRange,
    starRating,
    amenities,
    neighborhoods,
    vibes,
    travelerContext,
    count,
  } = params;
  const prompt = `Generate ${count} real hotel recommendations for ${destination}.

**Stay Details:**
- ${dates.nights} nights (${dates.start} to ${dates.end})
- Price range: $${priceRange.min} - $${priceRange.max} per night
- Preferred star ratings: ${starRating.join(", ")}-star
- Desired amenities: ${amenities.join(", ") || "wifi, breakfast"}
- Preferred neighborhoods: ${neighborhoods.join(", ") || "central/popular areas"}

**Saved traveler details (take precedence over inferred amenities):**
- Travelers: ${travelerContext.travelers ?? "Not specified"}
- Adults: ${travelerContext.adults ?? "Not specified"}
- Children: ${travelerContext.children ?? "Not specified"}
- Child ages: ${travelerContext.childAges?.join(", ") || "Not specified"}
- Requested rooms: ${travelerContext.roomCount ?? "Not specified"}
- Mobility needs: ${travelerContext.mobilityNeeds || "Not specified"}
- Structured requirements: ${JSON.stringify(travelerContext.requirements ?? {})}

**Vibes to match:** ${vibes.join(", ")}

Generate hotels matching these criteria:
- Include actual hotel names that exist in ${destination}
- Do not supply prices, review scores/counts or star classifications
- Score each hotel 0-100 on how well it matches the traveler's vibes
- Include a mix of star ratings within the price range

For vibes like:
- "Romantic" → boutique hotels, luxury properties
- "Adventure" → hotels near outdoor activities
- "Cultural" → historic hotels, local character
- "Relaxation" → spa hotels, beach resorts`;

  try {
    const modelName = planningModel("hotels", MODEL);
    console.log("[Hotels Agent] Using AI Gateway with model:", modelName);
    console.log(
      "[Hotels Agent] API Key present:",
      !!process.env.AI_GATEWAY_API_KEY ||
        !!process.env.VERCEL_AI_GATEWAY_API_KEY,
    );

    const { object: result } = await withAbortTimeout(
      (abortSignal) =>
        generatePlanningObject<HotelListResult>("hotels", {
          model: aiGateway(modelName),
          providerOptions: PLANNING_PROVIDER_OPTIONS,
          system: SYSTEM_PROMPT,
          prompt,
          schema: HotelListSchema,
          timeout: AI_AGENT_TIMEOUT_MS,
          abortSignal,
          maxRetries: 0,
        }),
      AI_AGENT_TIMEOUT_MS,
      "hotels AI",
    );

    console.log("[Hotels Agent] AI generated", result.hotels.length, "hotels");

    return result.hotels.map((hotel, index) => {
      // Parse again at this boundary: even a model/SDK returning extra fields
      // cannot smuggle invented ratings, prices, policies or booking URLs through.
      const safeHotel = HotelSchema.parse(hotel);
      return {
        ...safeHotel,
        dataSource: "ai",
        id: `hotel_${Date.now()}_${index}`,
      };
    });
  } catch (error) {
    const timedOut = isOperationTimeoutError(error);
    const detail = error instanceof Error ? error.message : String(error);
    if (timedOut) {
      console.warn(
        "[Hotels Agent] AI timed out, returning available hotel results:",
        detail,
      );
    } else {
      console.error("[Hotels Agent] AI generation error:", error);
    }
    logPlanningFallback(
      "hotels",
      timedOut ? "timeout" : "error",
      "empty",
      detail,
    );
    return [];
  }
}

/**
 * Calculate vibe score for a hotel
 */
export function calculateHotelVibeScore(
  hotel: { name: string; description: string; amenities: string[] },
  vibes: string[],
): { score: number; matchedVibes: string[] } {
  const text =
    `${hotel.name} ${hotel.description} ${hotel.amenities.join(" ")}`.toLowerCase();
  const matchedVibes: string[] = [];
  let score = 50; // Base score

  for (const vibe of vibes) {
    const keywords = VIBE_KEYWORDS[vibe.toLowerCase()] || [];
    const matches = keywords.filter((keyword) =>
      text.includes(keyword.toLowerCase()),
    );

    if (matches.length > 0) {
      matchedVibes.push(vibe);
      score += matches.length * 10;
    }
  }

  // Bonus for specific vibe-hotel matches
  if (vibes.includes("Romantic") && text.includes("boutique")) score += 20;
  if (vibes.includes("Relaxation") && text.includes("spa")) score += 25;
  if (
    vibes.includes("Wellness") &&
    (text.includes("spa") || text.includes("fitness"))
  )
    score += 20;

  return {
    score: Math.min(100, score),
    matchedVibes,
  };
}
