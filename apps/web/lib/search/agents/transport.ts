/**
 * Transport Agent
 * Searches for flights via Amadeus and Duffel APIs
 * Normalizes, deduplicates, and ranks results by price
 */

import { SearchPlan, TransportResult } from "../types";
import {
  searchAmadeusFlights,
  isAmadeusConfigured,
  generateAmadeusAffiliateUrl,
} from "@/lib/affiliates/amadeus";
import {
  searchDuffelFlights,
  isDuffelConfigured,
  generateDuffelLink,
} from "@/lib/affiliates/duffel";

/**
 * Run the transport agent to search for flights across Amadeus and Duffel.
 *
 * - Returns empty array if no origin airport is specified (transport is optional)
 * - Searches both providers in parallel
 * - Normalizes results to TransportResult[]
 * - Deduplicates by similar route + time (departure airports match, times within 30min)
 * - Sorts by price ascending
 * - Returns up to `count` results
 *
 * @param plan - The search plan from the orchestrator
 * @param travelers - Number of travelers / passengers
 * @param count - Maximum number of results to return (default 5)
 */
export async function runTransportAgent(
  plan: SearchPlan,
  travelers: number,
  count: number = 5,
): Promise<TransportResult[]> {
  // Transport is optional — skip if no origin airport
  if (!plan.transportCriteria?.originAirport) {
    console.log(
      "[Transport Agent] No origin airport specified, skipping transport search",
    );
    return [];
  }

  const { transportCriteria, dates } = plan;
  const origin = transportCriteria.originAirport!;
  const destination = transportCriteria.destinationAirport || "";

  console.log(
    `[Transport Agent] Searching flights: ${origin} → ${destination} on ${dates.start}`,
  );

  // Search Amadeus and Duffel in parallel
  const [amadeusResults, duffelResults] = await Promise.all([
    searchAmadeusProvider(origin, destination, dates, travelers),
    searchDuffelProvider(origin, destination, dates, travelers),
  ]);

  console.log(
    `[Transport Agent] Raw results — Amadeus: ${amadeusResults.length}, Duffel: ${duffelResults.length}`,
  );

  // Combine all results
  const allResults = [...amadeusResults, ...duffelResults];

  // Deduplicate by similar route + time
  const deduplicated = deduplicateTransportResults(allResults);

  console.log(
    `[Transport Agent] After deduplication: ${deduplicated.length} results`,
  );

  // Sort by price ascending (cheapest first)
  deduplicated.sort((a, b) => a.price - b.price);

  // Return up to count results
  return deduplicated.slice(0, count);
}

/**
 * Search Amadeus for flights and normalize to TransportResult[].
 */
async function searchAmadeusProvider(
  origin: string,
  destination: string,
  dates: { start: string; end: string; nights: number },
  travelers: number,
): Promise<TransportResult[]> {
  if (!isAmadeusConfigured()) {
    console.log("[Transport Agent] Amadeus not configured, skipping");
    return [];
  }

  try {
    const offers = await searchAmadeusFlights({
      origin,
      destination,
      departureDate: dates.start,
      returnDate: dates.end,
      adults: travelers,
    });

    const trackingId = `tg_${Date.now()}`;

    return offers.map((offer, index) => ({
      id: `transport_amadeus_${offer.offerId || index}`,
      type: "flight" as const,
      provider: offer.airlines.join(", ") || "Unknown Airline",
      departure: {
        airport: offer.departure.airport,
        city: offer.departure.city,
        dateTime: offer.departure.dateTime,
        terminal: offer.departure.terminal,
      },
      arrival: {
        airport: offer.arrival.airport,
        city: offer.arrival.city,
        dateTime: offer.arrival.dateTime,
        terminal: offer.arrival.terminal,
      },
      duration: offer.duration,
      stops: offer.stops,
      price: offer.price.amount,
      currency: offer.price.currency,
      cabinClass: normalizeCabinClass(offer.cabinClass),
      airlines: offer.airlines,
      segments: offer.segments.map((seg) => ({
        carrier: seg.carrier,
        flightNumber: seg.flightNumber,
        departure: {
          airport: seg.departure.airport,
          dateTime: seg.departure.dateTime,
        },
        arrival: {
          airport: seg.arrival.airport,
          dateTime: seg.arrival.dateTime,
        },
        duration: seg.duration,
      })),
      affiliateUrl: generateAmadeusAffiliateUrl(
        "flight",
        { origin, destination, date: dates.start },
        trackingId,
      ),
      affiliatePartner: "amadeus",
      source: "amadeus" as const,
      vibeScore: 0,
      vibeMatch: [],
    }));
  } catch (error) {
    console.error("[Transport Agent] Amadeus search error:", error);
    return [];
  }
}

/**
 * Search Duffel for flights and normalize to TransportResult[].
 * Generates Duffel Links for each offer (where we earn markup revenue).
 */
async function searchDuffelProvider(
  origin: string,
  destination: string,
  dates: { start: string; end: string; nights: number },
  travelers: number,
): Promise<TransportResult[]> {
  if (!isDuffelConfigured()) {
    console.log("[Transport Agent] Duffel not configured, skipping");
    return [];
  }

  try {
    const offers = await searchDuffelFlights({
      origin,
      destination,
      departureDate: dates.start,
      returnDate: dates.end,
      passengers: [{ type: "adult", count: travelers }],
    });

    // Generate Duffel Links in parallel for all offers (not sequentially)
    const linkPromises = offers.map(async (offer) => {
      try {
        return (await generateDuffelLink(offer.offerId, 5)) || "";
      } catch (error) {
        console.error(
          `[Transport Agent] Duffel link generation failed for offer ${offer.offerId}:`,
          error,
        );
        return "";
      }
    });
    const affiliateUrls = await Promise.all(linkPromises);

    const results: TransportResult[] = [];

    for (let i = 0; i < offers.length; i++) {
      const offer = offers[i];
      const affiliateUrl = affiliateUrls[i];

      results.push({
        id: `transport_duffel_${offer.offerId}`,
        type: "flight" as const,
        provider: offer.airlines.join(", ") || "Unknown Airline",
        departure: {
          airport: offer.departure.airport,
          city: offer.departure.city,
          dateTime: offer.departure.dateTime,
          terminal: offer.departure.terminal,
        },
        arrival: {
          airport: offer.arrival.airport,
          city: offer.arrival.city,
          dateTime: offer.arrival.dateTime,
          terminal: offer.arrival.terminal,
        },
        duration: offer.duration,
        stops: offer.stops,
        price: offer.price.amount,
        currency: offer.price.currency,
        cabinClass: normalizeCabinClass(offer.cabinClass),
        airlines: offer.airlines,
        segments: offer.segments.map((seg) => ({
          carrier: seg.carrier,
          flightNumber: seg.flightNumber,
          departure: {
            airport: seg.departure.airport,
            dateTime: seg.departure.dateTime,
          },
          arrival: {
            airport: seg.arrival.airport,
            dateTime: seg.arrival.dateTime,
          },
          duration: seg.duration,
        })),
        affiliateUrl,
        affiliatePartner: "duffel",
        source: "duffel" as const,
        vibeScore: 0,
        vibeMatch: [],
      });
    }

    return results;
  } catch (error) {
    console.error("[Transport Agent] Duffel search error:", error);
    return [];
  }
}

/**
 * Normalize cabin class strings from various providers to the TransportResult union type.
 */
function normalizeCabinClass(
  cabinClass: string,
): "economy" | "premium_economy" | "business" | "first" | undefined {
  const normalized = cabinClass?.toLowerCase().replace(/[\s_-]/g, "");

  if (!normalized) return undefined;

  if (normalized.includes("first")) return "first";
  if (normalized.includes("business")) return "business";
  if (normalized.includes("premiumeconomy") || normalized.includes("premium"))
    return "premium_economy";
  if (normalized.includes("economy")) return "economy";

  return undefined;
}

/**
 * Deduplicate transport results by similar route and time.
 *
 * Two results are considered duplicates if:
 * 1. They have the same departure airport
 * 2. They have the same arrival airport
 * 3. Their departure times are within 30 minutes of each other
 *
 * When duplicates are found, the cheaper option is kept.
 */
function deduplicateTransportResults(
  results: TransportResult[],
): TransportResult[] {
  const kept: TransportResult[] = [];

  for (const result of results) {
    const duplicateIndex = kept.findIndex((existing) =>
      isSimilarFlight(existing, result),
    );

    if (duplicateIndex === -1) {
      // No duplicate found — keep this result
      kept.push(result);
    } else {
      // Duplicate found — keep the cheaper one
      if (result.price < kept[duplicateIndex].price) {
        kept[duplicateIndex] = result;
      }
    }
  }

  return kept;
}

/**
 * Check if two transport results represent similar flights.
 * Matches on same departure/arrival airports and departure times within 30 minutes.
 */
function isSimilarFlight(a: TransportResult, b: TransportResult): boolean {
  // Must have same departure and arrival airports
  if (a.departure.airport !== b.departure.airport) return false;
  if (a.arrival.airport !== b.arrival.airport) return false;

  // Departure times must be within 30 minutes
  try {
    const timeA = new Date(a.departure.dateTime).getTime();
    const timeB = new Date(b.departure.dateTime).getTime();
    const diffMinutes = Math.abs(timeA - timeB) / (1000 * 60);
    return diffMinutes <= 30;
  } catch {
    return false;
  }
}

/**
 * Calculate a vibe score for a transport result.
 *
 * Scoring breakdown:
 * - Base score: 50
 * - Luxury vibe + business/first class: +25
 * - Budget vibe + low price: +15
 * - Direct flight (0 stops): +10
 *
 * Score is capped at 100.
 *
 * @param transport - Transport details (price, stops, cabinClass)
 * @param vibes - Array of vibe strings from the search plan
 * @returns Object with score (0-100) and array of matched vibes
 */
export function calculateTransportVibeScore(
  transport: { price: number; stops: number; cabinClass?: string },
  vibes: string[],
): { score: number; matchedVibes: string[] } {
  let score = 50;
  const matchedVibes: string[] = [];

  // Luxury vibe + business/first class cabin
  const cabinLower = transport.cabinClass?.toLowerCase() || "";
  if (
    vibes.some((v) => v.toLowerCase() === "luxury") &&
    (cabinLower.includes("business") || cabinLower.includes("first"))
  ) {
    score += 25;
    matchedVibes.push("Luxury");
  }

  // Budget vibe + low price (under $300 considered low for flights)
  if (
    vibes.some((v) => v.toLowerCase() === "budget") &&
    transport.price < 300
  ) {
    score += 15;
    matchedVibes.push("Budget");
  }

  // Direct flight bonus
  if (transport.stops === 0) {
    score += 10;
  }

  return {
    score: Math.min(100, score),
    matchedVibes,
  };
}
