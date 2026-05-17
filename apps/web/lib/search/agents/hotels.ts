/**
 * Hotels Agent
 * Searches for accommodation options from affiliate partners
 * Uses real API data from Booking.com and Amadeus, with TripAdvisor enrichment,
 * falling back to AI generation for remaining slots.
 */

import {
  generateObject,
  gateway as defaultGateway,
  createGateway,
} from "@/lib/ai/sdk";
import { z } from "zod";
import { SearchPlan, HotelResult } from "../types";
import { VIBE_KEYWORDS } from "@faroway/constants";
import {
  searchBookingHotels,
  isBookingConfigured,
  generateBookingAffiliateUrl,
} from "@/lib/affiliates/booking";
import {
  searchAmadeusHotels,
  isAmadeusConfigured,
  generateAmadeusAffiliateUrl,
  resolveAmadeusCityCode,
} from "@/lib/affiliates/amadeus";
import {
  enrichWithTripAdvisor,
  isTripAdvisorConfigured,
} from "@/lib/affiliates/tripadvisor";
import {
  AI_AGENT_TIMEOUT_MS,
  fetchWithTimeout,
  isOperationTimeoutError,
  withAbortTimeout,
} from "@/lib/search/runtime";

const aiGateway = process.env.AI_GATEWAY_API_KEY
  ? createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })
  : defaultGateway;

const MODEL = "google/gemini-3-flash";

const HotelSchema = z.object({
  name: z.string(),
  description: z.string(),
  starRating: z.number().min(1).max(5),
  userRating: z.number().min(0).max(10),
  reviewCount: z.number(),
  pricePerNight: z.number(),
  totalPrice: z.number(),
  currency: z.string().default("USD"),
  amenities: z.array(z.string()),
  location: z.object({
    name: z.string(),
    address: z.string(),
    lat: z.number(),
    lng: z.number(),
    neighborhood: z.string().optional(),
  }),
  images: z.array(z.string()).default([]),
  affiliateUrl: z.string(),
  affiliatePartner: z.string(),
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
2. Accurate star ratings and typical user ratings
3. Realistic nightly pricing based on star rating and location
4. Common amenities for that hotel tier
5. Location in a popular neighborhood
6. How well it matches the traveler's preferences

Use realistic affiliate URLs in format:
- https://booking.com/hotel/[country-code]/[hotel-slug]
- https://hotels.com/ho[id]/[hotel-name]

Price ranges by star rating (per night):
- 2-star: $40-80
- 3-star: $80-150
- 4-star: $150-300
- 5-star: $300-800+

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

    if (!existing || hotel.userRating > existing.userRating) {
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
    count,
  });

  // ── Step 1: Fetch real data from Booking.com and Amadeus in parallel ──

  const apiPromises: [Promise<HotelResult[]>, Promise<HotelResult[]>] = [
    // Booking.com
    isBookingConfigured()
      ? searchBookingHotels({
          destination,
          checkIn: dates.start,
          checkOut: dates.end,
          guests: 2,
          stars: starRating,
          priceMin: priceRange.min,
          priceMax: priceRange.max,
          limit: count,
        })
          .then((bookingHotels) => {
            console.log(
              "[Hotels Agent] Booking.com returned",
              bookingHotels.length,
              "hotels",
            );
            return bookingHotels.map((hotel): HotelResult => {
              const vibeResult = calculateHotelVibeScore(
                {
                  name: hotel.name,
                  description: hotel.description,
                  amenities: hotel.amenities,
                },
                vibeInterpretation.vibes,
              );
              return {
                id: `hotel_bk_${hotel.hotelId}`,
                name: hotel.name,
                description: hotel.description,
                starRating: hotel.starRating,
                userRating: hotel.userRating,
                reviewCount: hotel.reviewCount,
                pricePerNight: hotel.price.perNight,
                totalPrice: hotel.price.total,
                currency: hotel.price.currencyCode,
                amenities: hotel.amenities,
                location: {
                  name: hotel.location.city,
                  address: hotel.location.address,
                  lat: hotel.location.latitude,
                  lng: hotel.location.longitude,
                  neighborhood: hotel.location.neighborhood,
                },
                images: hotel.images.map((i) => i.url),
                affiliateUrl:
                  hotel.bookingUrl ||
                  generateBookingAffiliateUrl(
                    hotel.hotelId,
                    `tg_${Date.now()}`,
                    {
                      checkIn: dates.start,
                      checkOut: dates.end,
                    },
                  ),
                affiliatePartner: "booking",
                vibeScore: vibeResult.score,
                vibeMatch: vibeResult.matchedVibes,
              };
            });
          })
          .catch((err) => {
            console.error("[Hotels Agent] Booking.com error:", err);
            return [] as HotelResult[];
          })
      : Promise.resolve([] as HotelResult[]),

    // Amadeus
    isAmadeusConfigured()
      ? searchAmadeusHotels({
          cityCode: resolveAmadeusCityCode(destination),
          checkIn: dates.start,
          checkOut: dates.end,
          adults: 2,
          stars: starRating,
          priceMax: priceRange.max,
          limit: count,
        })
          .then((amadeusHotels) => {
            console.log(
              "[Hotels Agent] Amadeus returned",
              amadeusHotels.length,
              "hotels",
            );
            return amadeusHotels.map((hotel): HotelResult => {
              const vibeResult = calculateHotelVibeScore(
                {
                  name: hotel.name,
                  description: hotel.description || "",
                  amenities: hotel.amenities,
                },
                vibeInterpretation.vibes,
              );
              return {
                id: `hotel_am_${hotel.hotelId}`,
                name: hotel.name,
                description: hotel.description || "",
                starRating: hotel.starRating,
                userRating: 0,
                reviewCount: 0,
                pricePerNight: hotel.price.perNight,
                totalPrice: hotel.price.total,
                currency: hotel.price.currency,
                amenities: hotel.amenities,
                location: {
                  name: hotel.location.cityCode || destination,
                  address: hotel.location.address || "",
                  lat: hotel.location.lat,
                  lng: hotel.location.lng,
                  neighborhood: undefined,
                },
                images: hotel.images,
                affiliateUrl: generateAmadeusAffiliateUrl(
                  "hotel",
                  {
                    hotelId: hotel.hotelId,
                    checkIn: dates.start,
                  },
                  `tg_${Date.now()}`,
                ),
                affiliatePartner: "amadeus",
                vibeScore: vibeResult.score,
                vibeMatch: vibeResult.matchedVibes,
              };
            });
          })
          .catch((err) => {
            console.error("[Hotels Agent] Amadeus error:", err);
            return [] as HotelResult[];
          })
      : Promise.resolve([] as HotelResult[]),
  ];

  const [bookingResults, amadeusResults] = await Promise.all(apiPromises);

  // ── Step 2: Merge and deduplicate ──

  const merged = [...bookingResults, ...amadeusResults];
  let realHotels = deduplicateHotels(merged);

  console.log(
    `[Hotels Agent] Real API results: ${bookingResults.length} Booking + ${amadeusResults.length} Amadeus = ${merged.length} total, ${realHotels.length} after dedup`,
  );

  // ── Step 3: Enrich with TripAdvisor ──

  if (isTripAdvisorConfigured() && realHotels.length > 0) {
    console.log("[Hotels Agent] Enriching with TripAdvisor data...");
    realHotels = await enrichWithTripAdvisor(realHotels, "hotels");
  }

  // ── Step 4: Fall back to AI generation if we need more results ──

  let aiHotels: HotelResult[] = [];

  if (realHotels.length < count) {
    const remaining = count - realHotels.length;
    console.log(
      `[Hotels Agent] Need ${remaining} more hotels, falling back to AI generation`,
    );
    aiHotels = await aiFallbackPromise;
  }

  // ── Step 5: Combine, sort by vibeScore descending, return up to count ──

  const allHotels = [...realHotels, ...aiHotels];

  return allHotels.sort((a, b) => b.vibeScore - a.vibeScore).slice(0, count);
}

async function generateAiHotelFallbacks(params: {
  destination: string;
  dates: SearchPlan["dates"];
  priceRange: SearchPlan["hotelCriteria"]["priceRange"];
  starRating: number[];
  amenities: string[];
  neighborhoods: string[];
  vibes: string[];
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
    count,
  } = params;
  const prompt = `Generate ${count} real hotel recommendations for ${destination}.

**Stay Details:**
- ${dates.nights} nights (${dates.start} to ${dates.end})
- Price range: $${priceRange.min} - $${priceRange.max} per night
- Preferred star ratings: ${starRating.join(", ")}-star
- Desired amenities: ${amenities.join(", ") || "wifi, breakfast"}
- Preferred neighborhoods: ${neighborhoods.join(", ") || "central/popular areas"}

**Vibes to match:** ${vibes.join(", ")}

Generate hotels matching these criteria:
- Include actual hotel names that exist in ${destination}
- Calculate total price (nights × nightly rate)
- Score each hotel 0-100 on how well it matches the traveler's vibes
- Include a mix of star ratings within the price range

For vibes like:
- "Romantic" → boutique hotels, luxury properties
- "Adventure" → hotels near outdoor activities
- "Cultural" → historic hotels, local character
- "Relaxation" → spa hotels, beach resorts`;

  try {
    console.log("[Hotels Agent] Using AI Gateway with model:", MODEL);
    console.log(
      "[Hotels Agent] API Key present:",
      !!process.env.AI_GATEWAY_API_KEY ||
        !!process.env.VERCEL_AI_GATEWAY_API_KEY,
    );

    const { object: result } = await withAbortTimeout(
      (abortSignal) =>
        generateObject<HotelListResult>({
          model: aiGateway(MODEL),
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

    return result.hotels.map((hotel, index) => ({
      ...hotel,
      id: `hotel_${Date.now()}_${index}`,
    }));
  } catch (error) {
    if (isOperationTimeoutError(error)) {
      console.warn(
        "[Hotels Agent] AI timed out, returning available hotel results:",
        error instanceof Error ? error.message : String(error),
      );
    } else {
      console.error("[Hotels Agent] AI generation error:", error);
    }
    return [];
  }
}

/**
 * Search hotels via RapidAPI (optional integration)
 */
export async function searchRapidAPIHotels(
  destination: string,
  checkIn: string,
  checkOut: string,
  guests: number,
): Promise<Record<string, unknown>[]> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    console.log("[Hotels Agent] No RapidAPI key, using AI-generated data");
    return [];
  }

  try {
    // Booking.com API via RapidAPI
    const response = await fetchWithTimeout(
      `https://booking-com.p.rapidapi.com/v1/hotels/search?` +
        `dest_type=city&dest_name=${encodeURIComponent(destination)}&` +
        `checkin_date=${checkIn}&checkout_date=${checkOut}&` +
        `adults_number=${guests}&room_number=1&` +
        `order_by=popularity&filter_by_currency=USD&locale=en-us&units=metric`,
      {
        headers: {
          "X-RapidAPI-Key": apiKey,
          "X-RapidAPI-Host": "booking-com.p.rapidapi.com",
        },
      },
    );

    const data = await response.json();
    return data.result || [];
  } catch (error) {
    console.error("[Hotels Agent] RapidAPI error:", error);
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
