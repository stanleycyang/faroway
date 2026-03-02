/**
 * Duffel API Client — Flight Search & Duffel Links
 *
 * Duffel is a flight booking API where Duffel acts as Merchant of Record (MoR).
 * Revenue model: we add a markup to each offer via Duffel Links, and Duffel
 * handles payment, ticketing, and post-booking support.
 *
 * Endpoints used:
 * - POST /air/offer_requests   — search for flight offers
 * - POST /links/duffel_links   — generate a hosted booking page with markup
 *
 * @see https://duffel.com/docs/api
 */

// Environment variables
const DUFFEL_API_TOKEN = process.env.DUFFEL_API_TOKEN;
const DUFFEL_API_BASE = "https://api.duffel.com";

// ── Types ───────────────────────────────────────────────────────────────────

export interface DuffelFlightSearchParams {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  passengers: {
    type: "adult" | "child" | "infant_without_seat";
    count: number;
  }[];
  cabinClass?: "economy" | "premium_economy" | "business" | "first";
  maxConnections?: number;
  limit?: number;
}

export interface DuffelOffer {
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
    carrierName: string;
    flightNumber: string;
    departure: { airport: string; dateTime: string; terminal?: string };
    arrival: { airport: string; dateTime: string; terminal?: string };
    duration: number;
  }>;
  expiresAt: string;
  duffelLinkUrl?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build standard headers for all Duffel API requests.
 * Includes Bearer auth, API version, and JSON content type.
 */
function getHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${DUFFEL_API_TOKEN}`,
    "Duffel-Version": "v2",
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

/**
 * Parse an ISO 8601 duration string (e.g. "PT2H30M", "PT45M", "PT1H") to
 * total minutes. Returns 0 if the string cannot be parsed.
 */
function parseDuration(isoDuration: string): number {
  if (!isoDuration) return 0;

  const match = isoDuration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;

  const hours = parseInt(match[1] || "0", 10);
  const minutes = parseInt(match[2] || "0", 10);
  const seconds = parseInt(match[3] || "0", 10);

  return hours * 60 + minutes + Math.ceil(seconds / 60);
}

/**
 * Normalize a raw Duffel offer from the API response into our DuffelOffer shape.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeOffer(raw: any): DuffelOffer {
  // Duffel offers contain slices → segments. The first slice is the outbound.
  const firstSlice = raw.slices?.[0];
  const segments = firstSlice?.segments || [];

  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1] || firstSegment;

  // Collect unique marketing carrier names
  const airlineSet = new Set<string>();
  for (const seg of segments) {
    const name =
      seg.marketing_carrier?.name ||
      seg.operating_carrier?.name ||
      seg.marketing_carrier?.iata_code ||
      "Unknown";
    airlineSet.add(name);
  }

  // Calculate total duration across all segments in the first slice
  const totalDuration = parseDuration(firstSlice?.duration || "");

  return {
    offerId: raw.id,
    airlines: Array.from(airlineSet),
    price: {
      amount: parseFloat(raw.total_amount || "0"),
      currency: raw.total_currency || "USD",
    },
    departure: {
      airport: firstSegment?.origin?.iata_code || "",
      city:
        firstSegment?.origin?.city_name ||
        firstSegment?.origin?.city?.name ||
        "",
      dateTime: firstSegment?.departing_at || "",
      terminal: firstSegment?.origin_terminal || undefined,
    },
    arrival: {
      airport: lastSegment?.destination?.iata_code || "",
      city:
        lastSegment?.destination?.city_name ||
        lastSegment?.destination?.city?.name ||
        "",
      dateTime: lastSegment?.arriving_at || "",
      terminal: lastSegment?.destination_terminal || undefined,
    },
    duration: totalDuration,
    stops: Math.max(0, segments.length - 1),
    cabinClass:
      firstSegment?.passengers?.[0]?.cabin_class_marketing_name ||
      firstSegment?.passengers?.[0]?.cabin_class ||
      "economy",
    segments: segments.map((seg: any) => ({
      carrier:
        seg.marketing_carrier?.iata_code ||
        seg.operating_carrier?.iata_code ||
        "",
      carrierName:
        seg.marketing_carrier?.name || seg.operating_carrier?.name || "",
      flightNumber: `${seg.marketing_carrier?.iata_code || ""}${seg.marketing_carrier_flight_number || ""}`,
      departure: {
        airport: seg.origin?.iata_code || "",
        dateTime: seg.departing_at || "",
        terminal: seg.origin_terminal || undefined,
      },
      arrival: {
        airport: seg.destination?.iata_code || "",
        dateTime: seg.arriving_at || "",
        terminal: seg.destination_terminal || undefined,
      },
      duration: parseDuration(seg.duration || ""),
    })),
    expiresAt: raw.expires_at || "",
    duffelLinkUrl: undefined,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Check if the Duffel API is configured with a valid token.
 */
export function isDuffelConfigured(): boolean {
  return !!DUFFEL_API_TOKEN;
}

/**
 * Search for flight offers via the Duffel Offer Requests API.
 *
 * Creates an offer request with the given parameters and returns normalized
 * offers sorted by price (ascending), limited to `params.limit` results.
 *
 * @param params - Flight search parameters (origin, destination, dates, passengers, etc.)
 * @returns Array of normalized flight offers, sorted by price ascending
 */
export async function searchDuffelFlights(
  params: DuffelFlightSearchParams,
): Promise<DuffelOffer[]> {
  if (!isDuffelConfigured()) {
    console.warn("[Duffel] API not configured, returning empty results");
    return [];
  }

  try {
    // Build slices — outbound is required, return is optional
    const slices: Array<{
      origin: string;
      destination: string;
      departure_date: string;
    }> = [
      {
        origin: params.origin,
        destination: params.destination,
        departure_date: params.departureDate,
      },
    ];

    if (params.returnDate) {
      slices.push({
        origin: params.destination,
        destination: params.origin,
        departure_date: params.returnDate,
      });
    }

    // Expand passenger counts into individual passenger objects
    const passengers: Array<{ type: string }> = [];
    for (const pax of params.passengers) {
      for (let i = 0; i < pax.count; i++) {
        passengers.push({ type: pax.type });
      }
    }

    const body = {
      data: {
        slices,
        passengers,
        cabin_class: params.cabinClass || "economy",
        max_connections: params.maxConnections ?? 1,
      },
    };

    console.log(
      `[Duffel] Searching flights: ${params.origin} → ${params.destination} on ${params.departureDate}`,
    );

    const response = await fetch(`${DUFFEL_API_BASE}/air/offer_requests`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(
        "[Duffel] offer_requests error:",
        response.status,
        error,
      );
      return [];
    }

    const data = await response.json();
    const rawOffers = data.data?.offers || [];

    console.log(
      `[Duffel] offer_requests returned ${rawOffers.length} offers`,
    );

    // Normalize, sort by price ascending, and limit
    const offers = rawOffers
      .map(normalizeOffer)
      .sort((a: DuffelOffer, b: DuffelOffer) => a.price.amount - b.price.amount);

    const limit = params.limit || 20;
    return offers.slice(0, limit);
  } catch (error) {
    console.error("[Duffel] Search error:", error);
    return [];
  }
}

/**
 * Generate a Duffel Link — a hosted booking page for a specific offer.
 *
 * Duffel Links allow us to earn revenue through markup. Duffel handles the
 * entire booking flow (payment, ticketing, customer support) as Merchant of
 * Record. We add a markup amount that becomes our commission.
 *
 * @param offerId - The Duffel offer ID to create a booking link for
 * @param markupAmount - Markup amount to add (default: "5.00")
 * @param markupCurrency - Currency for the markup (default: "USD")
 * @returns The Duffel Link URL for the hosted booking page, or null on failure
 */
export async function generateDuffelLink(
  offerId: string,
  markupAmount?: number,
  markupCurrency?: string,
): Promise<string | null> {
  if (!isDuffelConfigured()) {
    console.warn("[Duffel] API not configured, cannot generate link");
    return null;
  }

  try {
    const body = {
      data: {
        offer_id: offerId,
        markup_amount: (markupAmount ?? 5.0).toFixed(2),
        markup_currency: markupCurrency || "USD",
      },
    };

    console.log(`[Duffel] Generating link for offer ${offerId}`);

    const response = await fetch(`${DUFFEL_API_BASE}/links/duffel_links`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(
        "[Duffel] duffel_links error:",
        response.status,
        error,
      );
      return null;
    }

    const data = await response.json();
    const url = data.data?.url || null;

    if (url) {
      console.log(`[Duffel] Generated link for offer ${offerId}`);
    } else {
      console.warn(
        `[Duffel] No URL returned in duffel_links response for offer ${offerId}`,
      );
    }

    return url;
  } catch (error) {
    console.error("[Duffel] Generate link error:", error);
    return null;
  }
}
