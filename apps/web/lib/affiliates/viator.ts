/**
 * Viator Partner API Client
 *
 * Viator (TripAdvisor Experiences) provides tours, activities, and attractions.
 * Commission: 15-20% per booking
 *
 * Uses the Partner API endpoints:
 * - POST /products/search  (v2 — requires Accept: application/json;version=2.0)
 * - GET  /v1/taxonomy/destinations (v1 — no version header, response wrapped in `data`)
 *
 * @see https://github.com/viator-docs/Viator-Partner-API-v2
 */

import { providerAmount, currencyCode, formatPrice } from "@faroway/constants";
import { fetchWithTimeout } from "@/lib/search/runtime";
import { buildViatorHandoffUrl } from "./viator-link";
import { isViatorContentEnabled } from "./viator-policy";

// Environment variables
const VIATOR_API_KEY = process.env.VIATOR_API_KEY;
const VIATOR_PARTNER_ID = process.env.VIATOR_PARTNER_ID;
// VIATOR_SANDBOX=true in .env to use sandbox endpoint (for testing keys)
const VIATOR_API_BASE =
  process.env.VIATOR_SANDBOX === "true"
    ? "https://api.sandbox.viator.com/partner"
    : "https://api.viator.com/partner";

// Headers for v2 endpoints (GET — no Content-Type needed)
function getV2ReadHeaders(): Record<string, string> {
  return {
    Accept: "application/json;version=2.0",
    "Accept-Language": "en-US",
    "exp-api-key": VIATOR_API_KEY!,
  };
}

// Headers for v2 endpoints (POST — includes Content-Type)
function getV2WriteHeaders(): Record<string, string> {
  return {
    Accept: "application/json;version=2.0",
    "Content-Type": "application/json",
    "Accept-Language": "en-US",
    "exp-api-key": VIATOR_API_KEY!,
  };
}

// ── Destination ID Map ────────────────────────────────────────────────────
// Viator destination IDs extracted from viator.com URL patterns (e.g. /Tokyo/d334).
// These IDs are stable and rarely change. This avoids the broken /v1/taxonomy/destinations
// endpoint which returns 400/404 depending on header version.
// Source: https://www.viator.com/{City}/d{ID}

const DESTINATION_IDS: Record<string, number> = {
  // Asia
  tokyo: 334,
  kyoto: 332,
  osaka: 4163,
  bangkok: 343,
  singapore: 60449,
  "hong kong": 35959,
  bali: 98,
  phuket: 349,
  seoul: 973,
  taipei: 3643,
  "ho chi minh city": 352,
  hanoi: 351,
  "kuala lumpur": 5765,
  mumbai: 953,
  "new delhi": 4540,
  "siem reap": 5480,
  "chiang mai": 6282,
  ubud: 4538,
  "da nang": 22399,
  "phnom penh": 3644,
  // Europe
  paris: 479,
  london: 737,
  rome: 511,
  barcelona: 562,
  amsterdam: 525,
  prague: 462,
  lisbon: 538,
  athens: 496,
  istanbul: 585,
  florence: 519,
  venice: 522,
  dublin: 503,
  berlin: 488,
  madrid: 566,
  vienna: 454,
  budapest: 449,
  edinburgh: 905,
  santorini: 959,
  mykonos: 4814,
  dubrovnik: 904,
  reykjavik: 4080,
  nice: 483,
  munich: 490,
  zurich: 573,
  copenhagen: 4361,
  stockholm: 4195,
  brussels: 531,
  milan: 512,
  naples: 515,
  seville: 564,
  krakow: 467,
  split: 906,
  // Americas
  "new york city": 687,
  "new york": 687,
  "los angeles": 645,
  "san francisco": 651,
  "las vegas": 684,
  miami: 672,
  chicago: 669,
  "washington dc": 657,
  boston: 678,
  cancun: 631,
  "mexico city": 628,
  "rio de janeiro": 712,
  "buenos aires": 901,
  lima: 1004,
  cartagena: 4988,
  cusco: 918,
  "san diego": 647,
  seattle: 653,
  "new orleans": 675,
  nashville: 20448,
  austin: 30196,
  denver: 673,
  portland: 654,
  savannah: 4985,
  charleston: 4989,
  "playa del carmen": 4975,
  tulum: 25498,
  "san juan": 711,
  medellín: 25487,
  medellin: 25487,
  bogota: 5385,
  // Hawaii (Oahu = 663, Maui = 671, Big Island = 670, Kauai = 668)
  honolulu: 663,
  waikiki: 663,
  oahu: 663,
  maui: 671,
  kona: 670,
  hilo: 670,
  "big island": 670,
  kauai: 668,
  // Middle East & Africa
  dubai: 828,
  marrakech: 5408,
  cairo: 782,
  "cape town": 318,
  "tel aviv": 945,
  jerusalem: 946,
  petra: 4892,
  nairobi: 5558,
  "abu dhabi": 4832,
  doha: 36743,
  amman: 4891,
  // Oceania
  sydney: 357,
  melbourne: 364,
  auckland: 381,
  queenstown: 5523,
  fiji: 4249,
  "gold coast": 362,
  cairns: 355,
  perth: 367,
};

/**
 * Look up a Viator numeric destination ID by city name.
 * Uses a static map of common destinations. Falls back to normalized
 * name matching (strips country suffixes like "Tokyo, Japan").
 */
function getViatorDestinationId(name: string): number | null {
  const normalized = name.toLowerCase().trim();

  // Direct match
  if (DESTINATION_IDS[normalized]) {
    return DESTINATION_IDS[normalized];
  }

  // Try without country suffix: "Santorini, Greece" → "santorini"
  const city = normalized.split(",")[0].trim();
  if (city !== normalized && DESTINATION_IDS[city]) {
    return DESTINATION_IDS[city];
  }

  // Try partial match: find any key that starts with or is contained in the input
  for (const [key, id] of Object.entries(DESTINATION_IDS)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return id;
    }
  }

  console.log(`[Viator] No destination ID found for "${name}" in static map`);
  return null;
}

// ── Types ───────────────────────────────────────────────────────────────────

export interface ViatorSearchParams {
  destination: string;
  startDate?: string;
  endDate?: string;
  categories?: string[];
  priceRange?: { min: number; max: number };
  rating?: number;
  limit?: number;
}

export interface ViatorProduct {
  productCode: string;
  title: string;
  description: string;
  shortDescription: string;
  rating: number;
  reviewCount: number;
  price: {
    amount: number;
    currencyCode: string;
    formattedPrice: string;
  };
  duration: {
    fixedDurationInMinutes?: number;
    variableDurationFromMinutes?: number;
    variableDurationToMinutes?: number;
  };
  images: Array<{
    url: string;
    caption?: string;
  }>;
  categories: string[];
  location: {
    address?: string;
    city?: string;
    country?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  bookingInfo: {
    confirmationType: string;
    cancellationPolicy: string;
    mobileTicket: boolean;
    instantConfirmation: boolean;
  };
  highlights: string[];
  inclusions: string[];
  exclusions: string[];
  productUrl?: string;
}

export interface ViatorAvailability {
  productCode: string;
  date: string;
  available: boolean;
  startTimes: string[];
  pricing: {
    amount: number;
    currencyCode: string;
  };
}

/**
 * Check if Viator API is configured
 */
export function isViatorConfigured(): boolean {
  return isViatorContentEnabled() && !!(VIATOR_API_KEY && VIATOR_PARTNER_ID);
}

/**
 * Search for products/experiences at a destination via Viator Partner API v2.
 *
 * Strategy:
 * 1. Look up numeric destination ID from static map
 * 2. POST /products/search with the destination ID
 * 3. If lookup fails, return empty (activities agent falls back to AI-generated)
 */
export async function searchViatorProducts(
  params: ViatorSearchParams,
): Promise<ViatorProduct[]> {
  if (!isViatorConfigured()) {
    console.warn("[Viator] API not configured, returning empty results");
    return [];
  }

  try {
    const destId = getViatorDestinationId(params.destination);

    if (destId) {
      console.log(
        `[Viator] Found destination ID ${destId} for "${params.destination}" (${VIATOR_API_BASE})`,
      );
      const products = await searchByDestinationId(destId, params);
      if (products.length > 0) return products;
      console.log(
        `[Viator] No products found for destId=${destId}, search returned empty`,
      );
    } else {
      console.log(
        `[Viator] No destination ID for "${params.destination}", skipping Viator search`,
      );
    }

    return [];
  } catch (error) {
    console.error("[Viator] Search error:", error);
    return [];
  }
}

/**
 * Primary search: POST /products/search with numeric destination ID
 */
async function searchByDestinationId(
  destId: number,
  params: ViatorSearchParams,
): Promise<ViatorProduct[]> {
  const body: Record<string, unknown> = {
    filtering: {
      destination: String(destId),
      ...(params.startDate && { startDate: params.startDate }),
      ...(params.endDate && { endDate: params.endDate }),
      ...(params.rating && { rating: { from: params.rating } }),
      ...(params.priceRange && {
        price: { from: params.priceRange.min, to: params.priceRange.max },
      }),
    },
    pagination: {
      start: 1,
      count: params.limit || 15,
    },
    sorting: {
      sort: "DEFAULT",
      order: "DESCENDING",
    },
    currency: "USD",
  };

  const response = await fetchWithTimeout(
    `${VIATOR_API_BASE}/products/search`,
    {
      method: "POST",
      headers: getV2WriteHeaders(),
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("[Viator] products/search error:", response.status, error);
    return [];
  }

  const data = await response.json();
  console.log(
    `[Viator] products/search returned ${data.products?.length || 0} results for destId=${destId}`,
  );
  return (data.products || []).map(normalizeViatorProduct);
}

/**
 * Get detailed product information
 */
export async function getViatorProduct(
  productCode: string,
  campaign?: string,
): Promise<ViatorProduct | null> {
  if (!isViatorConfigured()) {
    return null;
  }

  try {
    const response = await fetchWithTimeout(
      `${VIATOR_API_BASE}/products/${encodeURIComponent(productCode)}${campaign ? `?campaign-value=${encodeURIComponent(campaign)}` : ""}`,
      {
        headers: getV2ReadHeaders(),
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return normalizeViatorProduct(data);
  } catch (error) {
    console.error("[Viator] Get product error:", error);
    return null;
  }
}

/**
 * Check availability for a product on specific dates
 */
export async function checkViatorAvailability(
  productCode: string,
  startDate: string,
  endDate: string,
  travelers: number = 2,
): Promise<ViatorAvailability[]> {
  if (!isViatorConfigured()) {
    return [];
  }

  try {
    const response = await fetchWithTimeout(
      `${VIATOR_API_BASE}/availability/check`,
      {
        method: "POST",
        headers: getV2WriteHeaders(),
        body: JSON.stringify({
          productCode,
          travelDate: startDate,
          endDate,
          paxMix: [{ ageBand: "ADULT", count: travelers }],
          currency: "USD",
        }),
      },
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.availability || [];
  } catch (error) {
    console.error("[Viator] Availability check error:", error);
    return [];
  }
}

/**
 * Generate affiliate booking URL with tracking.
 * Prefers the productUrl from the API response when available.
 */
export function generateViatorAffiliateUrl(
  productCode: string,
  trackingId: string,
  options?: {
    date?: string;
    travelers?: number;
    productUrl?: string;
  },
): string {
  // Product paths and MCIDs are provider-owned. Never invent either. Dates and
  // traveler details are confirmed on Viator; unsupported URL prefill is avoided.
  void productCode;
  const campaign = trackingId.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 100);
  return options?.productUrl && VIATOR_PARTNER_ID
    ? buildViatorHandoffUrl(options.productUrl, campaign, VIATOR_PARTNER_ID) ||
        ""
    : "";
}

/**
 * Normalize Viator API v2 response to our internal format.
 * Handles both v1 and v2 response shapes gracefully.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeViatorProduct(raw: any): ViatorProduct {
  const candidates = [
    {
      amount: raw.pricing?.summary?.fromPrice,
      currency: raw.pricing?.currency,
    },
    { amount: raw.price?.amount, currency: raw.price?.currencyCode },
  ];
  const source = candidates.find(
    (value) =>
      providerAmount(value.amount) !== undefined &&
      currencyCode(value.currency),
  );
  const amount = providerAmount(source?.amount);
  const currency = currencyCode(source?.currency);
  const knownPrice = amount !== undefined && currency !== undefined;
  // v2 images: images[].variants[].url — pick highest res variant
  const images = (raw.images || [])
    .map(
      (img: {
        url?: string;
        variants?: Array<{ url?: string; width?: number }>;
        caption?: string;
      }) => {
        const url =
          img.url ||
          img.variants?.sort(
            (a: { width?: number }, b: { width?: number }) =>
              (b.width || 0) - (a.width || 0),
          )?.[0]?.url ||
          "";
        return { url, caption: img.caption };
      },
    )
    .filter((img: { url: string }) => img.url);

  return {
    productCode: raw.productCode || raw.code,
    title: raw.title || raw.name,
    description: raw.description || "",
    shortDescription: raw.shortDescription || "",
    // v2: reviews.combinedAverageRating / reviews.totalReviews
    rating: raw.reviews?.combinedAverageRating || raw.rating || 0,
    reviewCount: raw.reviews?.totalReviews || raw.reviewCount || 0,
    price: {
      amount: knownPrice ? amount : 0,
      currencyCode: knownPrice ? currency : "",
      formattedPrice: knownPrice ? (formatPrice(amount, currency) ?? "") : "",
    },
    duration: {
      fixedDurationInMinutes: raw.duration?.fixedDurationInMinutes,
      variableDurationFromMinutes: raw.duration?.variableDurationFromMinutes,
      variableDurationToMinutes: raw.duration?.variableDurationToMinutes,
    },
    images,
    categories:
      raw.tags?.map((t: string | { tagName?: string }) =>
        typeof t === "string" ? t : t.tagName || "",
      ) ||
      raw.categories ||
      [],
    location: {
      address: raw.location?.address,
      city: raw.location?.city || raw.destinationName,
      country: raw.location?.country,
      coordinates: raw.location?.coordinates
        ? {
            latitude: raw.location.coordinates.latitude,
            longitude: raw.location.coordinates.longitude,
          }
        : raw.geoLocation
          ? {
              latitude: raw.geoLocation.latitude,
              longitude: raw.geoLocation.longitude,
            }
          : undefined,
    },
    bookingInfo: {
      confirmationType:
        raw.bookingInfo?.confirmationType || raw.confirmationType || "INSTANT",
      cancellationPolicy:
        raw.cancellationPolicy?.description ||
        raw.cancellationPolicy?.type ||
        "Free cancellation",
      mobileTicket:
        raw.bookingInfo?.mobileTicket ??
        raw.ticketInfo?.mobileTicketAvailable ??
        true,
      instantConfirmation:
        raw.bookingInfo?.instantConfirmation ??
        raw.flags?.includes("INSTANT_CONFIRMATION") ??
        true,
    },
    highlights: raw.highlights || raw.productHighlights || [],
    inclusions: raw.inclusions || raw.itinerary?.inclusions || [],
    exclusions: raw.exclusions || raw.itinerary?.exclusions || [],
    productUrl: raw.productUrl || raw.webURL || undefined,
  };
}

/**
 * Map Viator categories to our vibe system
 */
export function mapViatorCategoryToVibe(category: string): string[] {
  const mappings: Record<string, string[]> = {
    "Tours & Sightseeing": ["Cultural", "Explorer"],
    "Food & Drink": ["Foodie", "Cultural"],
    "Outdoor Activities": ["Adventure", "Nature"],
    "Water Sports": ["Adventure", "Beach"],
    "Walking & Biking Tours": ["Adventure", "Cultural"],
    "Day Trips": ["Explorer", "Nature"],
    Nightlife: ["Nightlife", "Social"],
    "Shows & Entertainment": ["Nightlife", "Cultural"],
    "Spa & Wellness": ["Wellness", "Relaxation"],
    "Classes & Workshops": ["Cultural", "Creative"],
    "Museums & Art": ["Cultural", "Art"],
    "Historical Tours": ["Cultural", "History"],
    "Private Tours": ["Luxury", "Romantic"],
    "Family-Friendly": ["Family"],
    Romantic: ["Romantic"],
  };

  return mappings[category] || ["Explorer"];
}
