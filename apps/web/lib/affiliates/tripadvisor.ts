/**
 * TripAdvisor Content API Client
 *
 * TripAdvisor provides location data, reviews, and ratings for hotels,
 * restaurants, and attractions worldwide.
 *
 * Uses the Content API endpoints:
 * - GET /location/search        (search locations by query)
 * - GET /location/{id}/details  (get location details)
 * - GET /location/{id}/reviews  (get location reviews)
 *
 * All requests pass the API key as a `key` query parameter.
 *
 * @see https://tripadvisor-content-api.readme.io/reference
 */

// Environment variables
const TRIPADVISOR_API_KEY = process.env.TRIPADVISOR_API_KEY;
const TRIPADVISOR_API_BASE = "https://api.content.tripadvisor.com/api/v1";

// ── Types ───────────────────────────────────────────────────────────────────

export interface TripAdvisorLocation {
  locationId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number;
  numReviews: number;
  rankingString?: string;
  webUrl: string;
  category: string;
}

export interface TripAdvisorDetails {
  locationId: string;
  name: string;
  description?: string;
  rating: number;
  numReviews: number;
  rankingString?: string;
  priceLevel?: string;
  cuisine?: string[];
  photos?: { url: string; caption?: string }[];
  webUrl: string;
  amenities?: string[];
}

export interface TripAdvisorReview {
  id: string;
  title: string;
  text: string;
  rating: number;
  publishedDate: string;
  author: string;
}

// ── Configuration ───────────────────────────────────────────────────────────

/**
 * Check if TripAdvisor API is configured
 */
export function isTripAdvisorConfigured(): boolean {
  return !!TRIPADVISOR_API_KEY;
}

// ── Search ──────────────────────────────────────────────────────────────────

/**
 * Search for locations on TripAdvisor by query and category.
 *
 * Endpoint: GET /location/search
 *
 * @param query - Search query (e.g. "Eiffel Tower", "sushi Tokyo")
 * @param category - One of 'hotels', 'restaurants', or 'attractions'
 * @param latLong - Optional lat,long string for geo-biased results (e.g. "35.6762,139.6503")
 * @returns Array of matching TripAdvisor locations
 */
export async function searchTripAdvisorLocations(
  query: string,
  category: "hotels" | "restaurants" | "attractions",
  latLong?: string,
): Promise<TripAdvisorLocation[]> {
  if (!isTripAdvisorConfigured()) {
    console.warn("[TripAdvisor] API not configured, returning empty results");
    return [];
  }

  try {
    const params = new URLSearchParams({
      searchQuery: query,
      category,
      language: "en",
      key: TRIPADVISOR_API_KEY!,
    });

    if (latLong) {
      params.set("latLong", latLong);
    }

    const response = await fetch(
      `${TRIPADVISOR_API_BASE}/location/search?${params}`,
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(
        "[TripAdvisor] location/search error:",
        response.status,
        error,
      );
      return [];
    }

    const data = await response.json();
    const results = data.data || [];

    console.log(
      `[TripAdvisor] location/search returned ${results.length} results for "${query}" (${category})`,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return results.map((raw: any) => normalizeTripAdvisorLocation(raw));
  } catch (error) {
    console.error("[TripAdvisor] Search error:", error);
    return [];
  }
}

// ── Details ─────────────────────────────────────────────────────────────────

/**
 * Get detailed information for a TripAdvisor location.
 *
 * Endpoint: GET /location/{locationId}/details
 *
 * @param locationId - TripAdvisor location ID
 * @returns Location details or null if not found
 */
export async function getTripAdvisorDetails(
  locationId: string,
): Promise<TripAdvisorDetails | null> {
  if (!isTripAdvisorConfigured()) {
    console.warn("[TripAdvisor] API not configured, returning null");
    return null;
  }

  try {
    const params = new URLSearchParams({
      language: "en",
      key: TRIPADVISOR_API_KEY!,
    });

    const response = await fetch(
      `${TRIPADVISOR_API_BASE}/location/${locationId}/details?${params}`,
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(
        "[TripAdvisor] location/details error:",
        response.status,
        error,
      );
      return null;
    }

    const raw = await response.json();
    return normalizeTripAdvisorDetails(raw);
  } catch (error) {
    console.error("[TripAdvisor] Details error:", error);
    return null;
  }
}

// ── Reviews ─────────────────────────────────────────────────────────────────

/**
 * Get reviews for a TripAdvisor location.
 *
 * Endpoint: GET /location/{locationId}/reviews
 *
 * @param locationId - TripAdvisor location ID
 * @param limit - Optional maximum number of reviews to return
 * @returns Array of reviews
 */
export async function getTripAdvisorReviews(
  locationId: string,
  limit?: number,
): Promise<TripAdvisorReview[]> {
  if (!isTripAdvisorConfigured()) {
    console.warn("[TripAdvisor] API not configured, returning empty results");
    return [];
  }

  try {
    const params = new URLSearchParams({
      language: "en",
      key: TRIPADVISOR_API_KEY!,
    });

    const response = await fetch(
      `${TRIPADVISOR_API_BASE}/location/${locationId}/reviews?${params}`,
    );

    if (!response.ok) {
      const error = await response.text();
      console.error(
        "[TripAdvisor] location/reviews error:",
        response.status,
        error,
      );
      return [];
    }

    const data = await response.json();
    const results = data.data || [];

    console.log(
      `[TripAdvisor] location/reviews returned ${results.length} reviews for locationId=${locationId}`,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reviews = results.map((raw: any) => normalizeTripAdvisorReview(raw));

    if (limit && limit > 0) {
      return reviews.slice(0, limit);
    }

    return reviews;
  } catch (error) {
    console.error("[TripAdvisor] Reviews error:", error);
    return [];
  }
}

// ── Affiliate URL ───────────────────────────────────────────────────────────

/**
 * Generate a TripAdvisor affiliate URL with tracking.
 *
 * @param locationId - TripAdvisor location ID
 * @param trackingId - Tracking ID for commission attribution
 * @returns Affiliate URL string
 */
export function generateTripAdvisorAffiliateUrl(
  locationId: string,
  trackingId: string,
): string {
  return `https://www.tripadvisor.com/${locationId}?m=faroway&ref=${trackingId}`;
}

// ── Enrichment ──────────────────────────────────────────────────────────────

/**
 * Enrich an array of items with TripAdvisor rating data.
 *
 * For each item, searches TripAdvisor by name + location, and if a match is
 * found (first result), attaches tripadvisorRating, tripadvisorReviewCount,
 * and tripadvisorUrl to the item.
 *
 * Rate limited to process max 3 items concurrently using a simple batching
 * approach. Graceful: never throws, just skips items that fail.
 *
 * @param items - Array of items with name and location.name properties
 * @param category - TripAdvisor category to search within
 * @returns The enriched array (same reference, mutated in place)
 */
export async function enrichWithTripAdvisor<
  T extends { name: string; location: { name: string } },
>(
  items: T[],
  category: "hotels" | "restaurants" | "attractions",
): Promise<T[]> {
  if (!isTripAdvisorConfigured()) {
    console.warn("[TripAdvisor] API not configured, skipping enrichment");
    return items;
  }

  const BATCH_SIZE = 3;

  // Create a new array to avoid mutating the input
  const enrichedItems = [...items];

  for (let i = 0; i < enrichedItems.length; i += BATCH_SIZE) {
    const batchIndices = Array.from(
      { length: Math.min(BATCH_SIZE, enrichedItems.length - i) },
      (_, j) => i + j,
    );

    await Promise.all(
      batchIndices.map(async (idx) => {
        const item = enrichedItems[idx];
        try {
          const query = `${item.name} ${item.location.name}`;
          const results = await searchTripAdvisorLocations(query, category);

          if (results.length > 0) {
            const match = results[0];
            enrichedItems[idx] = {
              ...item,
              tripadvisorRating: match.rating,
              tripadvisorReviewCount: match.numReviews,
              tripadvisorUrl: match.webUrl,
            };
          }
        } catch (error) {
          console.error(
            `[TripAdvisor] Enrichment failed for "${item.name}":`,
            error,
          );
          // Gracefully skip this item
        }
      }),
    );
  }

  return enrichedItems;
}

// ── Normalizers ─────────────────────────────────────────────────────────────

/**
 * Normalize TripAdvisor location search response to our internal format.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeTripAdvisorLocation(raw: any): TripAdvisorLocation {
  return {
    locationId: raw.location_id || "",
    name: raw.name || "",
    address: raw.address_obj
      ? [
          raw.address_obj.street1,
          raw.address_obj.city,
          raw.address_obj.state,
          raw.address_obj.country,
        ]
          .filter(Boolean)
          .join(", ")
      : "",
    latitude: parseFloat(raw.latitude) || 0,
    longitude: parseFloat(raw.longitude) || 0,
    rating: parseFloat(raw.rating) || 0,
    numReviews: parseInt(raw.num_reviews, 10) || 0,
    rankingString: raw.ranking_data?.ranking_string || undefined,
    webUrl: raw.web_url || "",
    category: raw.category?.localized_name || raw.category?.name || "",
  };
}

/**
 * Normalize TripAdvisor details response to our internal format.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeTripAdvisorDetails(raw: any): TripAdvisorDetails {
  return {
    locationId: raw.location_id || "",
    name: raw.name || "",
    description: raw.description || undefined,
    rating: parseFloat(raw.rating) || 0,
    numReviews: parseInt(raw.num_reviews, 10) || 0,
    rankingString: raw.ranking_data?.ranking_string || undefined,
    priceLevel: raw.price_level || undefined,
    cuisine: raw.cuisine
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        raw.cuisine.map((c: any) => c.localized_name || c.name)
      : undefined,
    photos: raw.photos
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        raw.photos.map((p: any) => ({
          url:
            p.images?.large?.url ||
            p.images?.medium?.url ||
            p.images?.original?.url ||
            "",
          caption: p.caption || undefined,
        }))
      : undefined,
    webUrl: raw.web_url || "",
    amenities: raw.amenities
      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
        raw.amenities.map((a: any) => (typeof a === "string" ? a : a.name))
      : undefined,
  };
}

/**
 * Normalize TripAdvisor review response to our internal format.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeTripAdvisorReview(raw: any): TripAdvisorReview {
  return {
    id: raw.id?.toString() || "",
    title: raw.title || "",
    text: raw.text || "",
    rating: parseInt(raw.rating, 10) || 0,
    publishedDate: raw.published_date || "",
    author: raw.user?.username || raw.user?.name || "Anonymous",
  };
}
