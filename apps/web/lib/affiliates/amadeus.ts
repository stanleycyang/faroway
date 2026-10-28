/**
 * Amadeus Self-Service API Client
 *
 * Amadeus provides flight and hotel search inventory via their Self-Service APIs.
 * Uses the `amadeus` npm SDK for authentication (OAuth2) and API calls.
 *
 * Environment variables:
 * - AMADEUS_CLIENT_ID: API key from Amadeus developer portal
 * - AMADEUS_CLIENT_SECRET: API secret from Amadeus developer portal
 * - AMADEUS_ENV: 'test' or 'production' (defaults to 'test')
 *
 * @see https://developers.amadeus.com/
 */

// @ts-expect-error -- amadeus SDK has no type declarations
import Amadeus from "amadeus";
import { withTimeout } from "@/lib/search/runtime";
import { providerAmount, currencyCode, reviewRating } from "@faroway/constants";

// Environment variables
const AMADEUS_CLIENT_ID = process.env.AMADEUS_CLIENT_ID;
const AMADEUS_CLIENT_SECRET = process.env.AMADEUS_CLIENT_SECRET;
const AMADEUS_ENV = process.env.AMADEUS_ENV || "test";

// Lazy-initialized SDK instance
let amadeusClient: Amadeus | null = null;

type AmadeusApiResponse<T> = {
  data?: T[];
};

/**
 * Get or create the Amadeus SDK client (lazy singleton).
 * The SDK handles OAuth2 token management automatically.
 */
function getClient(): Amadeus {
  if (!amadeusClient) {
    amadeusClient = new Amadeus({
      clientId: AMADEUS_CLIENT_ID!,
      clientSecret: AMADEUS_CLIENT_SECRET!,
      hostname: AMADEUS_ENV === "production" ? "production" : "test",
    });
  }
  return amadeusClient;
}

// ──────────────────────────────────────────
// Types
// ──────────────────────────────────────────

export interface AmadeusFlightSearchParams {
  origin: string; // IATA code
  destination: string; // IATA code
  departureDate: string; // YYYY-MM-DD
  returnDate?: string;
  adults: number;
  cabinClass?: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST";
  maxPrice?: number;
  maxStops?: number;
  limit?: number;
}

export interface AmadeusFlightOffer {
  offerId: string;
  airlines: string[];
  price: { amount: number; currency: string };
  departure: {
    airport: string;
    city: string;
    dateTime: string;
    terminal?: string;
  };
  arrival: {
    airport: string;
    city: string;
    dateTime: string;
    terminal?: string;
  };
  duration: number; // minutes
  stops: number;
  cabinClass: string;
  segments: Array<{
    carrier: string;
    flightNumber: string;
    departure: { airport: string; dateTime: string };
    arrival: { airport: string; dateTime: string };
    duration: number;
  }>;
}

export interface AmadeusHotelSearchParams {
  cityCode: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  stars?: number[];
  priceMax?: number;
  limit?: number;
}

export interface AmadeusHotel {
  hotelId: string;
  name: string;
  description?: string;
  starRating?: number;
  price: { perNight?: number; total?: number; currency?: string };
  location: {
    lat: number;
    lng: number;
    address?: string;
    cityCode?: string;
  };
  amenities: string[];
  images: string[];
}

// ──────────────────────────────────────────
// Configuration check
// ──────────────────────────────────────────

/**
 * Check if Amadeus API is configured
 */
export function isAmadeusConfigured(): boolean {
  return !!(AMADEUS_CLIENT_ID && AMADEUS_CLIENT_SECRET);
}

const AMADEUS_CITY_CODES: Record<string, string> = {
  amsterdam: "AMS",
  athens: "ATH",
  bali: "DPS",
  bangkok: "BKK",
  barcelona: "BCN",
  berlin: "BER",
  boston: "BOS",
  "buenos aires": "BUE",
  cairo: "CAI",
  "cape town": "CPT",
  chicago: "CHI",
  copenhagen: "CPH",
  dubai: "DXB",
  dublin: "DUB",
  florence: "FLR",
  hongkong: "HKG",
  "hong kong": "HKG",
  honolulu: "HNL",
  iceland: "REK",
  istanbul: "IST",
  kyoto: "OSA",
  lisbon: "LIS",
  london: "LON",
  "los angeles": "LAX",
  madrid: "MAD",
  miami: "MIA",
  milan: "MIL",
  montreal: "YMQ",
  "new york": "NYC",
  osaka: "OSA",
  paris: "PAR",
  prague: "PRG",
  reykjavik: "REK",
  rome: "ROM",
  "san francisco": "SFO",
  santorini: "JTR",
  seoul: "SEL",
  singapore: "SIN",
  sydney: "SYD",
  tokyo: "TYO",
  toronto: "YTO",
  venice: "VCE",
  vienna: "VIE",
  zurich: "ZRH",
};

function normalizeDestinationName(destination: string): string {
  return destination
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .split(",")[0]
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Resolve the city code Amadeus expects for hotel search.
 *
 * Amadeus hotel APIs use metropolitan/IATA city codes, which are not always
 * the first three letters of the city name (Tokyo is TYO, New York is NYC).
 */
export function resolveAmadeusCityCode(destination: string): string {
  const normalized = normalizeDestinationName(destination);
  const mapped = AMADEUS_CITY_CODES[normalized];
  if (mapped) return mapped;

  return normalized
    .replace(/[^a-z]/g, "")
    .slice(0, 3)
    .toUpperCase();
}

// ──────────────────────────────────────────
// Flight search
// ──────────────────────────────────────────

/**
 * Parse an ISO 8601 duration string (e.g. "PT2H30M") into total minutes.
 */
function parseDurationToMinutes(duration: string): number {
  const hoursMatch = duration.match(/(\d+)H/);
  const minutesMatch = duration.match(/(\d+)M/);
  const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
  const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;
  return hours * 60 + minutes;
}

/**
 * Search for flight offers using the Amadeus Flight Offers Search API.
 */
export async function searchAmadeusFlights(
  params: AmadeusFlightSearchParams,
): Promise<AmadeusFlightOffer[]> {
  if (!isAmadeusConfigured()) {
    console.warn("[Amadeus] API not configured, returning empty results");
    return [];
  }

  try {
    const client = getClient();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const searchParams: Record<string, any> = {
      originLocationCode: params.origin,
      destinationLocationCode: params.destination,
      departureDate: params.departureDate,
      adults: params.adults,
      max: params.limit || 20,
    };

    if (params.returnDate) {
      searchParams.returnDate = params.returnDate;
    }
    if (params.cabinClass) {
      searchParams.travelClass = params.cabinClass;
    }
    if (params.maxPrice) {
      searchParams.maxPrice = params.maxPrice;
    }
    if (params.maxStops === 0) {
      searchParams.nonStop = true;
    }

    const response = await withTimeout<AmadeusApiResponse<unknown>>(
      client.shopping.flightOffersSearch.get(searchParams) as Promise<
        AmadeusApiResponse<unknown>
      >,
      undefined,
      "Amadeus flight search",
    );
    const offers = response.data || [];

    return offers
      .filter((value: unknown) => {
        if (!value || typeof value !== "object") return false;
        const offer = value as {
          price?: { total?: unknown; currency?: unknown };
        };
        return (
          providerAmount(offer.price?.total) !== undefined &&
          !!currencyCode(offer.price?.currency)
        );
      })
      .map(normalizeFlightOffer);
  } catch (error) {
    console.error("[Amadeus] Flight search error:", error);
    return [];
  }
}

/**
 * Normalize an Amadeus flight offer response to our internal format.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeFlightOffer(offer: any): AmadeusFlightOffer {
  const itineraries = offer.itineraries || [];
  const firstItinerary = itineraries[0] || {};
  const segments = firstItinerary.segments || [];
  const firstSegment = segments[0] || {};
  const lastSegment = segments[segments.length - 1] || {};

  // Collect unique airline codes across all segments
  const airlines = [
    ...new Set<string>(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      segments.map((seg: any) => seg.carrierCode as string),
    ),
  ];

  // Determine cabin class from the first traveler pricing
  const travelerPricings = offer.travelerPricings || [];
  const firstPricing = travelerPricings[0] || {};
  const fareDetails = firstPricing.fareDetailsBySegment || [];
  const cabinClass = fareDetails[0]?.cabin || "ECONOMY";

  return {
    offerId: offer.id || "",
    airlines,
    price: {
      amount: providerAmount(offer.price?.total)!,
      currency: currencyCode(offer.price?.currency)!,
    },
    departure: {
      airport: firstSegment.departure?.iataCode || "",
      city: firstSegment.departure?.iataCode || "",
      dateTime: firstSegment.departure?.at || "",
      terminal: firstSegment.departure?.terminal,
    },
    arrival: {
      airport: lastSegment.arrival?.iataCode || "",
      city: lastSegment.arrival?.iataCode || "",
      dateTime: lastSegment.arrival?.at || "",
      terminal: lastSegment.arrival?.terminal,
    },
    duration: parseDurationToMinutes(firstItinerary.duration || "PT0H0M"),
    stops: Math.max(0, segments.length - 1),
    cabinClass,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    segments: segments.map((seg: any) => ({
      carrier: seg.carrierCode || "",
      flightNumber: `${seg.carrierCode || ""}${seg.number || ""}`,
      departure: {
        airport: seg.departure?.iataCode || "",
        dateTime: seg.departure?.at || "",
      },
      arrival: {
        airport: seg.arrival?.iataCode || "",
        dateTime: seg.arrival?.at || "",
      },
      duration: parseDurationToMinutes(seg.duration || "PT0H0M"),
    })),
  };
}

// ──────────────────────────────────────────
// Hotel search
// ──────────────────────────────────────────

/**
 * Search for hotels in a city using the Amadeus Hotel Search API.
 *
 * Two-step process:
 * 1. Look up hotel IDs by city code
 * 2. Fetch offers for those hotels
 */
export async function searchAmadeusHotels(
  params: AmadeusHotelSearchParams,
): Promise<AmadeusHotel[]> {
  if (!isAmadeusConfigured()) {
    console.warn("[Amadeus] API not configured, returning empty results");
    return [];
  }

  try {
    const client = getClient();
    const limit = params.limit || 20;

    // Step 1: Get hotel IDs by city code
    const hotelListResponse = await withTimeout<AmadeusApiResponse<unknown>>(
      client.referenceData.locations.hotels.byCity.get({
        cityCode: params.cityCode,
      }) as Promise<AmadeusApiResponse<unknown>>,
      undefined,
      "Amadeus hotel list search",
    );

    const hotelEntries = hotelListResponse.data || [];
    if (hotelEntries.length === 0) {
      console.warn("[Amadeus] No hotels found for city:", params.cityCode);
      return [];
    }

    // Take first N hotel IDs up to the limit
    const hotelIds = hotelEntries
      .slice(0, limit)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((entry: any) => entry.hotelId);

    // Step 2: Fetch offers for those hotels
    const offersResponse = await withTimeout<AmadeusApiResponse<unknown>>(
      client.shopping.hotelOffersSearch.get({
        hotelIds: hotelIds.join(","),
        adults: params.adults,
        checkInDate: params.checkIn,
        checkOutDate: params.checkOut,
      }) as Promise<AmadeusApiResponse<unknown>>,
      undefined,
      "Amadeus hotel offer search",
    );

    const hotelOffers = offersResponse.data || [];

    return hotelOffers.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (hotelOffer: any) => normalizeHotelOffer(hotelOffer, params),
    );
  } catch (error) {
    console.error("[Amadeus] Hotel search error:", error);
    return [];
  }
}

/**
 * Normalize an Amadeus hotel offer response to our internal format.
 */
export function normalizeHotelOffer(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  hotelOffer: any,
  params: AmadeusHotelSearchParams,
): AmadeusHotel {
  const hotel = hotelOffer.hotel || {};
  const offers = hotelOffer.offers || [];
  const firstOffer = offers[0] || {};
  const priceInfo = firstOffer.price || {};

  // Calculate number of nights for per-night pricing
  const nights =
    params.checkIn && params.checkOut
      ? Math.ceil(
          (new Date(params.checkOut).getTime() -
            new Date(params.checkIn).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 0;

  const totalPrice = providerAmount(priceInfo.total);
  const perNight =
    totalPrice !== undefined && nights > 0 ? totalPrice / nights : undefined;

  return {
    hotelId: hotel.hotelId || "",
    name: hotel.name || "",
    description: firstOffer.room?.description?.text,
    starRating: reviewRating(providerAmount(hotel.rating)),
    price: {
      perNight,
      total: totalPrice,
      currency: currencyCode(priceInfo.currency),
    },
    location: {
      lat: hotel.latitude || 0,
      lng: hotel.longitude || 0,
      address: hotel.address?.lines?.join(", "),
      cityCode: hotel.cityCode,
    },
    amenities: hotel.amenities || [],
    images: (hotel.media || [])
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => m.uri as string)
      .filter(Boolean),
  };
}

// ──────────────────────────────────────────
// Affiliate URL generation
// ──────────────────────────────────────────

/**
 * Generate an Amadeus affiliate/deep-link URL for flight or hotel booking.
 */
export function generateAmadeusAffiliateUrl(
  type: "flight" | "hotel",
  params: Record<string, string>,
  _trackingId: string,
): string {
  void _trackingId;

  if (type === "flight") {
    // Link to Google Flights since Amadeus is B2B — no consumer booking page
    const origin = params.origin || "";
    const destination = params.destination || "";
    const date = params.date || "";
    return `https://www.google.com/travel/flights?q=flights+from+${encodeURIComponent(origin)}+to+${encodeURIComponent(destination)}+on+${encodeURIComponent(date)}`;
  }

  // Hotel — link to Google Hotels search
  const hotelId = params.hotelId || "";
  const checkIn = params.checkIn || "";
  return `https://www.google.com/travel/hotels?q=${encodeURIComponent(hotelId)}&dates=${encodeURIComponent(checkIn)}`;
}
