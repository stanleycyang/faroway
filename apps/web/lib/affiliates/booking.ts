/**
 * Booking.com Demand API Client
 *
 * Booking.com provides hotel and accommodation inventory.
 * Commission: 25-40% per booking
 *
 * @see https://developers.booking.com/demand/docs/open-api/demand-api/accommodations
 */

import { fetchWithTimeout } from "@/lib/search/runtime";

// Environment variables
const BOOKING_TOKEN =
  process.env.BOOKING_COM_TOKEN || process.env.BOOKING_COM_DEMAND_TOKEN;
const BOOKING_AFFILIATE_ID = process.env.BOOKING_COM_AFFILIATE_ID;
const BOOKING_ENV = process.env.BOOKING_COM_ENV || "production";
const BOOKING_DEMAND_API_BASE =
  BOOKING_ENV === "sandbox"
    ? "https://demandapi-sandbox.booking.com/3.1"
    : "https://demandapi.booking.com/3.1";

// Legacy Distribution XML credentials are kept as a fallback for existing envs.
const BOOKING_USERNAME = process.env.BOOKING_COM_USERNAME;
const BOOKING_PASSWORD = process.env.BOOKING_COM_PASSWORD;
const BOOKING_LEGACY_API_BASE = "https://distribution-xml.booking.com/2.9/json";
const BOOKING_BOOKER_COUNTRY = (
  process.env.BOOKING_COM_BOOKER_COUNTRY || "us"
).toLowerCase();

// Types
export interface BookingSearchParams {
  destination: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms?: number;
  stars?: number[];
  priceMin?: number;
  priceMax?: number;
  amenities?: string[];
  limit?: number;
  coordinates?: { latitude: number; longitude: number; radius?: number };
}

export interface BookingHotel {
  hotelId: string;
  name: string;
  description: string;
  starRating: number;
  userRating: number;
  reviewScore: number;
  reviewCount: number;
  price: {
    perNight: number;
    total: number;
    currencyCode: string;
    formatted: string;
  };
  location: {
    address: string;
    city: string;
    country: string;
    countryCode: string;
    latitude: number;
    longitude: number;
    neighborhood?: string;
    distanceFromCenter?: number;
  };
  images: Array<{
    url: string;
    caption?: string;
  }>;
  bookingUrl?: string;
  amenities: string[];
  roomTypes: Array<{
    name: string;
    maxOccupancy: number;
    bedType: string;
    price: number;
  }>;
  policies: {
    checkIn: string;
    checkOut: string;
    cancellation: string;
    freeCancellationUntil?: string;
  };
  badges: string[];
}

export interface BookingAvailability {
  hotelId: string;
  available: boolean;
  rooms: Array<{
    roomId: string;
    roomName: string;
    maxOccupancy: number;
    pricePerNight: number;
    totalPrice: number;
    freeCancellation: boolean;
    breakfast: boolean;
  }>;
}

/**
 * Check if Booking.com API is configured
 */
export function isBookingConfigured(): boolean {
  return isBookingDemandConfigured() || isBookingLegacyConfigured();
}

export function isBookingDemandConfigured(): boolean {
  return !!(BOOKING_TOKEN && BOOKING_AFFILIATE_ID);
}

function isBookingLegacyConfigured(): boolean {
  return !!(BOOKING_USERNAME && BOOKING_PASSWORD && BOOKING_AFFILIATE_ID);
}

/**
 * Get Basic Auth header for Booking.com legacy API
 */
function getAuthHeader(): string {
  const credentials = Buffer.from(
    `${BOOKING_USERNAME}:${BOOKING_PASSWORD}`,
  ).toString("base64");
  return `Basic ${credentials}`;
}

function getDemandHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${BOOKING_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Affiliate-Id": BOOKING_AFFILIATE_ID!,
  };
}

function getRowsForDemandApi(limit: number | undefined): number {
  const requested = limit || 20;
  return Math.min(100, Math.max(10, Math.ceil(requested / 10) * 10));
}

const BOOKING_DESTINATION_COORDINATES: Record<
  string,
  {
    latitude: number;
    longitude: number;
    radius: number;
    city: string;
    country: string;
    countryCode: string;
  }
> = {
  amsterdam: {
    latitude: 52.3676,
    longitude: 4.9041,
    radius: 20,
    city: "Amsterdam",
    country: "Netherlands",
    countryCode: "nl",
  },
  bali: {
    latitude: -8.4095,
    longitude: 115.1889,
    radius: 50,
    city: "Bali",
    country: "Indonesia",
    countryCode: "id",
  },
  bangkok: {
    latitude: 13.7563,
    longitude: 100.5018,
    radius: 25,
    city: "Bangkok",
    country: "Thailand",
    countryCode: "th",
  },
  barcelona: {
    latitude: 41.3874,
    longitude: 2.1686,
    radius: 20,
    city: "Barcelona",
    country: "Spain",
    countryCode: "es",
  },
  dubai: {
    latitude: 25.2048,
    longitude: 55.2708,
    radius: 30,
    city: "Dubai",
    country: "United Arab Emirates",
    countryCode: "ae",
  },
  kyoto: {
    latitude: 35.0116,
    longitude: 135.7681,
    radius: 25,
    city: "Kyoto",
    country: "Japan",
    countryCode: "jp",
  },
  london: {
    latitude: 51.5072,
    longitude: -0.1276,
    radius: 25,
    city: "London",
    country: "United Kingdom",
    countryCode: "gb",
  },
  "new york": {
    latitude: 40.7128,
    longitude: -74.006,
    radius: 25,
    city: "New York",
    country: "United States",
    countryCode: "us",
  },
  paris: {
    latitude: 48.8566,
    longitude: 2.3522,
    radius: 20,
    city: "Paris",
    country: "France",
    countryCode: "fr",
  },
  rome: {
    latitude: 41.9028,
    longitude: 12.4964,
    radius: 20,
    city: "Rome",
    country: "Italy",
    countryCode: "it",
  },
  santorini: {
    latitude: 36.3932,
    longitude: 25.4615,
    radius: 25,
    city: "Santorini",
    country: "Greece",
    countryCode: "gr",
  },
  singapore: {
    latitude: 1.3521,
    longitude: 103.8198,
    radius: 25,
    city: "Singapore",
    country: "Singapore",
    countryCode: "sg",
  },
  tokyo: {
    latitude: 35.6762,
    longitude: 139.6503,
    radius: 25,
    city: "Tokyo",
    country: "Japan",
    countryCode: "jp",
  },
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

export function resolveBookingCoordinates(
  destination: string,
): (typeof BOOKING_DESTINATION_COORDINATES)[string] | null {
  return (
    BOOKING_DESTINATION_COORDINATES[normalizeDestinationName(destination)] ||
    null
  );
}

/**
 * Get destination ID from destination name
 */
export async function getBookingDestinationId(
  destination: string,
): Promise<string | null> {
  if (!isBookingLegacyConfigured()) {
    return null;
  }

  try {
    const response = await fetchWithTimeout(
      `${BOOKING_LEGACY_API_BASE}/autocomplete?text=${encodeURIComponent(destination)}&language=en`,
      {
        headers: {
          Authorization: getAuthHeader(),
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const cityResult = data.results?.find(
      (r: { dest_type: string; dest_id?: string }) => r.dest_type === "city",
    );
    return cityResult?.dest_id || null;
  } catch (error) {
    console.error("[Booking] Destination lookup error:", error);
    return null;
  }
}

/**
 * Search for hotels at a destination
 */
export async function searchBookingHotels(
  params: BookingSearchParams,
): Promise<BookingHotel[]> {
  if (!isBookingConfigured()) {
    console.warn("[Booking] API not configured, returning empty results");
    return [];
  }

  if (isBookingDemandConfigured()) {
    const demandResults = await searchBookingDemandHotels(params);
    if (demandResults.length > 0 || !isBookingLegacyConfigured()) {
      return demandResults;
    }
  }

  return searchBookingLegacyHotels(params);
}

async function searchBookingDemandHotels(
  params: BookingSearchParams,
): Promise<BookingHotel[]> {
  try {
    const resolvedLocation = params.coordinates
      ? {
          latitude: params.coordinates.latitude,
          longitude: params.coordinates.longitude,
          radius: params.coordinates.radius || 25,
          city: params.destination,
          country: "",
          countryCode: "",
        }
      : resolveBookingCoordinates(params.destination);

    if (!resolvedLocation) {
      console.warn(
        "[Booking] No Demand API coordinates for destination:",
        params.destination,
      );
      return [];
    }

    const body: Record<string, unknown> = {
      booker: {
        country: BOOKING_BOOKER_COUNTRY,
        platform: "desktop",
      },
      checkin: params.checkIn,
      checkout: params.checkOut,
      currency: "USD",
      coordinates: {
        latitude: resolvedLocation.latitude,
        longitude: resolvedLocation.longitude,
        radius: resolvedLocation.radius,
      },
      extras: ["extra_charges", "products"],
      guests: {
        number_of_adults: Math.max(1, params.guests),
        number_of_rooms: Math.max(1, params.rooms || 1),
      },
      rows: getRowsForDemandApi(params.limit),
    };

    if (params.priceMin || params.priceMax) {
      body.price = {
        ...(params.priceMin && { minimum: Math.round(params.priceMin) }),
        ...(params.priceMax && { maximum: Math.round(params.priceMax) }),
      };
    }

    if (params.stars?.length) {
      body.rating = { stars: params.stars };
    }

    const searchResponse = await fetchWithTimeout(
      `${BOOKING_DEMAND_API_BASE}/accommodations/search`,
      {
        method: "POST",
        headers: getDemandHeaders(),
        body: JSON.stringify(body),
      },
    );

    if (!searchResponse.ok) {
      const error = await searchResponse.text();
      console.error(
        "[Booking] Demand API search error:",
        searchResponse.status,
        error,
      );
      return [];
    }

    const searchData = await searchResponse.json();
    const searchResults: Array<Record<string, unknown>> = Array.isArray(
      searchData.data,
    )
      ? searchData.data
      : [];
    const limit = params.limit || 20;
    const topResults = searchResults.slice(0, limit);
    const accommodationIds = topResults
      .map((result: { id?: number | string }) => Number(result.id))
      .filter((id: number) => Number.isFinite(id) && id > 0);
    const detailsById = await getBookingDemandDetails(accommodationIds);

    return topResults
      .map((result: Record<string, unknown>) =>
        normalizeBookingDemandHotel(
          result,
          detailsById.get(Number(result.id)),
          params,
          resolvedLocation,
        ),
      )
      .filter((hotel: BookingHotel) => Boolean(hotel.name));
  } catch (error) {
    console.error("[Booking] Demand API search error:", error);
    return [];
  }
}

async function getBookingDemandDetails(
  accommodationIds: number[],
): Promise<Map<number, Record<string, unknown>>> {
  if (accommodationIds.length === 0) {
    return new Map();
  }

  try {
    const response = await fetchWithTimeout(
      `${BOOKING_DEMAND_API_BASE}/accommodations/details`,
      {
        method: "POST",
        headers: getDemandHeaders(),
        body: JSON.stringify({
          accommodations: accommodationIds,
          extras: ["description", "facilities", "photos", "policies", "rooms"],
          languages: ["en-us"],
          rows: getRowsForDemandApi(accommodationIds.length),
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(
        "[Booking] Demand API details error:",
        response.status,
        error,
      );
      return new Map();
    }

    const data = await response.json();
    const details: Array<Record<string, unknown>> = Array.isArray(data.data)
      ? data.data
      : [];
    const detailEntries = details
      .map((detail) => [Number(detail.id), detail] as const)
      .filter(([id]: readonly [number, Record<string, unknown>]) =>
        Number.isFinite(id),
      );

    return new Map(detailEntries);
  } catch (error) {
    console.error("[Booking] Demand API details error:", error);
    return new Map();
  }
}

async function searchBookingLegacyHotels(
  params: BookingSearchParams,
): Promise<BookingHotel[]> {
  try {
    // First get destination ID
    const destId = await getBookingDestinationId(params.destination);
    if (!destId) {
      console.warn("[Booking] Could not find destination:", params.destination);
      return [];
    }

    const queryParams = new URLSearchParams({
      dest_id: destId,
      dest_type: "city",
      checkin: params.checkIn,
      checkout: params.checkOut,
      guest_qty: params.guests.toString(),
      room_qty: (params.rooms || 1).toString(),
      currency: "USD",
      language: "en",
      order_by: "popularity",
      rows: (params.limit || 20).toString(),
      ...(params.priceMin && { price_filter_min: params.priceMin.toString() }),
      ...(params.priceMax && { price_filter_max: params.priceMax.toString() }),
      ...(params.stars?.length && { class_filter: params.stars.join(",") }),
    });

    const response = await fetchWithTimeout(
      `${BOOKING_LEGACY_API_BASE}/hotels?${queryParams}`,
      {
        headers: {
          Authorization: getAuthHeader(),
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[Booking] API error:", response.status, error);
      return [];
    }

    const data = await response.json();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.result || []).map((hotel: any) =>
      normalizeBookingHotel(hotel, params),
    );
  } catch (error) {
    console.error("[Booking] Search error:", error);
    return [];
  }
}

/**
 * Get detailed hotel information
 */
export async function getBookingHotel(
  hotelId: string,
  checkIn: string,
  checkOut: string,
  guests: number,
): Promise<BookingHotel | null> {
  if (!isBookingConfigured()) {
    return null;
  }

  if (isBookingDemandConfigured()) {
    const detailsById = await getBookingDemandDetails([Number(hotelId)]);
    const detail = detailsById.get(Number(hotelId));
    if (detail) {
      return normalizeBookingDemandHotel(
        { id: Number(hotelId), url: detail.url },
        detail,
        { checkIn, checkOut, guests, destination: "" },
        {
          latitude: 0,
          longitude: 0,
          city: "",
          country: "",
          countryCode: "",
        },
      );
    }

    if (!isBookingLegacyConfigured()) {
      return null;
    }
  }

  try {
    const queryParams = new URLSearchParams({
      hotel_ids: hotelId,
      checkin: checkIn,
      checkout: checkOut,
      guest_qty: guests.toString(),
      room_qty: "1",
      currency: "USD",
      language: "en",
      extras:
        "hotel_info,hotel_photos,hotel_description,hotel_facilities,room_info",
    });

    const response = await fetchWithTimeout(
      `${BOOKING_LEGACY_API_BASE}/hotels?${queryParams}`,
      {
        headers: {
          Authorization: getAuthHeader(),
          Accept: "application/json",
        },
      },
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const hotel = data.result?.[0];
    return hotel
      ? normalizeBookingHotel(hotel, {
          checkIn,
          checkOut,
          guests,
          destination: "",
        })
      : null;
  } catch (error) {
    console.error("[Booking] Get hotel error:", error);
    return null;
  }
}

/**
 * Generate affiliate booking URL with tracking
 */
export function generateBookingAffiliateUrl(
  hotelId: string,
  trackingId: string,
  options?: {
    checkIn?: string;
    checkOut?: string;
    guests?: number;
  },
): string {
  const params = new URLSearchParams({
    aid: BOOKING_AFFILIATE_ID || "faroway",
    label: trackingId,
    ...(options?.checkIn && { checkin: options.checkIn }),
    ...(options?.checkOut && { checkout: options.checkOut }),
    ...(options?.guests && { group_adults: options.guests.toString() }),
  });

  // Booking.com hotel URL format
  return `https://www.booking.com/hotel/${hotelId}.html?${params}`;
}

/**
 * Generate a search results page affiliate URL
 */
export function generateBookingSearchUrl(
  destination: string,
  trackingId: string,
  options?: {
    checkIn?: string;
    checkOut?: string;
    guests?: number;
  },
): string {
  const params = new URLSearchParams({
    aid: BOOKING_AFFILIATE_ID || "faroway",
    label: trackingId,
    ss: destination,
    ...(options?.checkIn && { checkin: options.checkIn }),
    ...(options?.checkOut && { checkout: options.checkOut }),
    ...(options?.guests && { group_adults: options.guests.toString() }),
  });

  return `https://www.booking.com/searchresults.html?${params}`;
}

function localizedText(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      (record["en-us"] as string | undefined) ||
      (record["en-gb"] as string | undefined) ||
      (Object.values(record).find((item) => typeof item === "string") as
        string | undefined) ||
      ""
    );
  }
  return "";
}

function normalizeBookingDemandHotel(
  searchResult: Record<string, unknown>,
  detail: Record<string, unknown> | undefined,
  params: Partial<BookingSearchParams>,
  fallbackLocation: {
    latitude: number;
    longitude: number;
    city: string;
    country: string;
    countryCode: string;
  },
): BookingHotel {
  const id = String(detail?.id || searchResult.id || "");
  const nights =
    params.checkIn && params.checkOut
      ? Math.max(
          1,
          Math.ceil(
            (new Date(params.checkOut).getTime() -
              new Date(params.checkIn).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : 1;
  const searchPrice = searchResult.price as
    { total?: number; base?: number; currency?: string } | undefined;
  const totalPrice = Number(searchPrice?.total || searchPrice?.base || 0);
  const rating = detail?.rating as
    | {
        stars?: number;
        review_score?: number;
        number_of_reviews?: number;
        preferred?: boolean;
      }
    | undefined;
  const location = detail?.location as
    | {
        address?: unknown;
        coordinates?: { latitude?: number; longitude?: number };
        country?: string;
      }
    | undefined;
  const photos = Array.isArray(detail?.photos)
    ? (detail.photos as Array<{
        url?: {
          large?: string;
          standard?: string;
          thumbnail_large?: string;
          thumbnail?: string;
        };
        tags?: string[];
      }>)
    : [];
  const description = detail?.description as { text?: unknown } | undefined;
  const facilities = Array.isArray(detail?.facilities)
    ? (detail.facilities as Array<{ id?: number }>)
    : [];

  return {
    hotelId: id,
    name: String(detail?.name || `Booking.com property ${id}`),
    description: localizedText(description?.text),
    starRating: rating?.stars || 0,
    userRating: rating?.review_score || 0,
    reviewScore: rating?.review_score || 0,
    reviewCount: rating?.number_of_reviews || 0,
    price: {
      perNight: nights > 0 ? Math.round(totalPrice / nights) : totalPrice,
      total: Math.round(totalPrice),
      currencyCode: String(
        searchResult.currency || searchPrice?.currency || "USD",
      ),
      formatted: totalPrice
        ? `$${Math.round(totalPrice / nights)}/night`
        : "Price unavailable",
    },
    location: {
      address: localizedText(location?.address),
      city: fallbackLocation.city,
      country: fallbackLocation.country,
      countryCode:
        location?.country?.toUpperCase() ||
        fallbackLocation.countryCode.toUpperCase(),
      latitude: location?.coordinates?.latitude || fallbackLocation.latitude,
      longitude: location?.coordinates?.longitude || fallbackLocation.longitude,
    },
    images: photos
      .map((photo) => ({
        url:
          photo.url?.large ||
          photo.url?.standard ||
          photo.url?.thumbnail_large ||
          photo.url?.thumbnail ||
          "",
        caption: photo.tags?.join(", "),
      }))
      .filter((photo) => photo.url),
    bookingUrl: String(searchResult.url || detail?.url || ""),
    amenities: facilities.map((facility) => `facility:${facility.id}`),
    roomTypes: [],
    policies: {
      checkIn: "15:00",
      checkOut: "11:00",
      cancellation: "See Booking.com for cancellation policy",
    },
    badges: [
      ...(rating?.preferred ? ["Preferred Partner"] : []),
      ...(rating?.review_score && rating.review_score >= 9
        ? ["Exceptional"]
        : rating?.review_score && rating.review_score >= 8
          ? ["Excellent"]
          : []),
    ],
  };
}

/**
 * Normalize Booking.com API response to our internal format
 */
function normalizeBookingHotel(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  raw: any,
  params: Partial<BookingSearchParams>,
): BookingHotel {
  const nights =
    params.checkIn && params.checkOut
      ? Math.ceil(
          (new Date(params.checkOut).getTime() -
            new Date(params.checkIn).getTime()) /
            (1000 * 60 * 60 * 24),
        )
      : 1;

  const pricePerNight = raw.min_total_price ? raw.min_total_price / nights : 0;

  return {
    hotelId: raw.hotel_id?.toString() || raw.id,
    name: raw.hotel_name || raw.name,
    description: raw.hotel_description || raw.description || "",
    starRating: raw.class || raw.star_rating || 0,
    userRating: raw.review_score || 0,
    reviewScore: raw.review_score || 0,
    reviewCount: raw.review_nr || raw.review_count || 0,
    price: {
      perNight: Math.round(pricePerNight),
      total: Math.round(raw.min_total_price || 0),
      currencyCode: raw.currency_code || "USD",
      formatted: `$${Math.round(pricePerNight)}/night`,
    },
    location: {
      address: raw.address || "",
      city: raw.city || raw.city_name || "",
      country: raw.country || "",
      countryCode: raw.country_code || raw.cc1 || "",
      latitude: raw.latitude || raw.location?.latitude || 0,
      longitude: raw.longitude || raw.location?.longitude || 0,
      neighborhood: raw.district || raw.neighborhood,
      distanceFromCenter: raw.distance_to_cc,
    },
    images: (raw.hotel_photos || raw.photos || []).map(
      (photo: {
        url_original?: string;
        url_max?: string;
        url?: string;
        caption?: string;
      }) => ({
        url: photo.url_original || photo.url_max || photo.url,
        caption: photo.caption,
      }),
    ),
    amenities: raw.hotel_facilities || raw.facilities || [],
    roomTypes: (raw.rooms || []).map(
      (room: {
        room_name?: string;
        name?: string;
        max_occupancy?: number;
        bed_type?: string;
        price?: number;
      }) => ({
        name: room.room_name || room.name,
        maxOccupancy: room.max_occupancy || 2,
        bedType: room.bed_type || "Queen",
        price: room.price || pricePerNight,
      }),
    ),
    policies: {
      checkIn: raw.checkin?.from || "15:00",
      checkOut: raw.checkout?.until || "11:00",
      cancellation: raw.is_free_cancellable
        ? "Free cancellation available"
        : "Non-refundable",
      freeCancellationUntil: raw.free_cancellation_until,
    },
    badges: [
      ...(raw.is_genius_deal ? ["Genius Deal"] : []),
      ...(raw.is_mobile_deal ? ["Mobile Deal"] : []),
      ...(raw.preferred ? ["Preferred Partner"] : []),
      ...(raw.review_score >= 9
        ? ["Exceptional"]
        : raw.review_score >= 8
          ? ["Excellent"]
          : []),
    ],
  };
}

/**
 * Map Booking.com amenities to our vibe system
 */
export function mapBookingAmenitiesToVibe(amenities: string[]): string[] {
  const vibes: string[] = [];
  const amenityText = amenities.join(" ").toLowerCase();

  if (amenityText.includes("spa") || amenityText.includes("wellness")) {
    vibes.push("Wellness", "Relaxation");
  }
  if (amenityText.includes("pool") || amenityText.includes("beach")) {
    vibes.push("Beach", "Relaxation");
  }
  if (amenityText.includes("gym") || amenityText.includes("fitness")) {
    vibes.push("Wellness");
  }
  if (amenityText.includes("romantic") || amenityText.includes("honeymoon")) {
    vibes.push("Romantic");
  }
  if (amenityText.includes("family") || amenityText.includes("kids")) {
    vibes.push("Family");
  }
  if (amenityText.includes("business") || amenityText.includes("conference")) {
    vibes.push("Business");
  }
  if (amenityText.includes("bar") || amenityText.includes("nightclub")) {
    vibes.push("Nightlife");
  }

  return [...new Set(vibes)];
}

/**
 * Calculate vibe score for a hotel
 */
export function calculateHotelVibeScore(
  hotel: BookingHotel,
  targetVibes: string[],
): { score: number; matchedVibes: string[] } {
  const hotelVibes = mapBookingAmenitiesToVibe(hotel.amenities);
  const matchedVibes = hotelVibes.filter((v) => targetVibes.includes(v));

  let score = 50; // Base score
  score += matchedVibes.length * 15;
  score += Math.min(hotel.reviewScore * 3, 30); // Up to 30 points for rating

  // Bonus for specific matches
  if (targetVibes.includes("Luxury") && hotel.starRating >= 4) score += 15;
  if (targetVibes.includes("Budget") && hotel.starRating <= 3) score += 10;

  return {
    score: Math.min(100, score),
    matchedVibes,
  };
}
