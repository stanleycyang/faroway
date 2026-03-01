/**
 * GetYourGuide Partner API Client
 *
 * GetYourGuide provides tours, activities, and attractions worldwide.
 * Commission: 8% CPA per booking
 * Strong European coverage, complements Viator.
 *
 * @see https://partner.getyourguide.com/
 */

// Environment variables
const GYG_API_KEY = process.env.GETYOURGUIDE_API_KEY;
const GYG_PARTNER_ID = process.env.GETYOURGUIDE_PARTNER_ID;
const GYG_API_BASE = "https://api.getyourguide.com/1";

// Types
export interface GYGSearchParams {
  destination: string;
  startDate?: string;
  endDate?: string;
  categories?: string[];
  priceRange?: { min: number; max: number };
  rating?: number;
  limit?: number;
  coordinates?: { lat: number; lng: number };
}

export interface GYGActivity {
  activityId: string;
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
}

export interface GYGAvailability {
  activityId: string;
  date: string;
  available: boolean;
  startTimes: string[];
  pricing: {
    amount: number;
    currencyCode: string;
  };
}

/**
 * Check if GetYourGuide API is configured
 */
export function isGYGConfigured(): boolean {
  return !!(GYG_API_KEY && GYG_PARTNER_ID);
}

/**
 * Search for activities at a destination
 */
export async function searchGYGActivities(
  params: GYGSearchParams,
): Promise<GYGActivity[]> {
  if (!isGYGConfigured()) {
    console.warn("[GYG] API not configured, returning empty results");
    return [];
  }

  try {
    const queryParams = new URLSearchParams({
      q: params.destination,
      ...(params.startDate && { date: params.startDate }),
      ...(params.endDate && { date_end: params.endDate }),
      ...(params.rating && { rating: params.rating.toString() }),
      ...(params.limit && { cnt: params.limit.toString() }),
      ...(params.coordinates && {
        lat: params.coordinates.lat.toString(),
        lng: params.coordinates.lng.toString(),
      }),
      currency: "USD",
    });

    if (params.categories?.length) {
      queryParams.set("category", params.categories.join(","));
    }

    if (params.priceRange) {
      queryParams.set("price_from", params.priceRange.min.toString());
      queryParams.set("price_to", params.priceRange.max.toString());
    }

    const response = await fetch(`${GYG_API_BASE}/activities?${queryParams}`, {
      headers: {
        Accept: "application/json",
        "X-Access-Token": GYG_API_KEY!,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("[GYG] API error:", response.status, error);
      return [];
    }

    const data = await response.json();
    return (data.data?.activities || data.activities || []).map(
      normalizeGYGActivity,
    );
  } catch (error) {
    console.error("[GYG] Search error:", error);
    return [];
  }
}

/**
 * Get detailed activity information
 */
export async function getGYGActivity(
  activityId: string,
): Promise<GYGActivity | null> {
  if (!isGYGConfigured()) {
    return null;
  }

  try {
    const response = await fetch(`${GYG_API_BASE}/activities/${activityId}`, {
      headers: {
        Accept: "application/json",
        "X-Access-Token": GYG_API_KEY!,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return normalizeGYGActivity(data.data?.activity || data.activity || data);
  } catch (error) {
    console.error("[GYG] Get activity error:", error);
    return null;
  }
}

/**
 * Check availability for an activity on a specific date
 */
export async function checkGYGAvailability(
  activityId: string,
  date: string,
): Promise<GYGAvailability[]> {
  if (!isGYGConfigured()) {
    return [];
  }

  try {
    const response = await fetch(
      `${GYG_API_BASE}/activities/${activityId}/availabilities?date=${date}`,
      {
        headers: {
          Accept: "application/json",
          "X-Access-Token": GYG_API_KEY!,
        },
      },
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const availabilities =
      data.data?.availabilities || data.availabilities || [];

    return availabilities.map(
      (avail: {
        date?: string;
        available?: boolean;
        start_times?: string[];
        startTimes?: string[];
        price?: { amount?: number; currency?: string };
        retail_price?: { amount?: number; currency?: string };
      }) => ({
        activityId,
        date: avail.date || date,
        available: avail.available ?? true,
        startTimes: avail.start_times || avail.startTimes || [],
        pricing: {
          amount: avail.price?.amount || avail.retail_price?.amount || 0,
          currencyCode:
            avail.price?.currency || avail.retail_price?.currency || "USD",
        },
      }),
    );
  } catch (error) {
    console.error("[GYG] Availability check error:", error);
    return [];
  }
}

/**
 * Generate affiliate booking URL with tracking
 */
export function generateGYGAffiliateUrl(
  activityId: string,
  trackingId: string,
  options?: {
    date?: string;
  },
): string {
  const baseUrl = `https://www.getyourguide.com/activity-t${activityId}`;
  const params = new URLSearchParams({
    partner_id: GYG_PARTNER_ID || "faroway",
    cmp: trackingId,
    ...(options?.date && { date: options.date }),
  });

  return `${baseUrl}/?${params}`;
}

/**
 * Normalize GetYourGuide API response to our internal format
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeGYGActivity(raw: any): GYGActivity {
  return {
    activityId: String(raw.activity_id || raw.activityId || raw.id),
    title: raw.title || raw.name,
    description: raw.description || raw.abstract || "",
    shortDescription:
      raw.abstract ||
      raw.shortDescription ||
      raw.description?.substring(0, 200) ||
      "",
    rating: raw.overall_rating || raw.rating || raw.reviews?.rating || 0,
    reviewCount:
      raw.number_of_ratings || raw.reviewCount || raw.reviews?.count || 0,
    price: {
      amount:
        raw.price?.values?.amount ||
        raw.retail_price?.amount ||
        raw.price?.amount ||
        0,
      currencyCode:
        raw.price?.values?.currency ||
        raw.retail_price?.currency ||
        raw.price?.currencyCode ||
        "USD",
      formattedPrice:
        raw.retail_price?.formatted ||
        raw.price?.formattedPrice ||
        `$${raw.price?.values?.amount || raw.retail_price?.amount || raw.price?.amount || 0}`,
    },
    duration: {
      fixedDurationInMinutes: raw.duration?.value
        ? raw.duration.value * (raw.duration.unit === "hour" ? 60 : 1)
        : raw.duration_in_minutes || raw.duration?.fixedDurationInMinutes,
      variableDurationFromMinutes:
        raw.duration_from_minutes || raw.duration?.variableDurationFromMinutes,
      variableDurationToMinutes:
        raw.duration_to_minutes || raw.duration?.variableDurationToMinutes,
    },
    images: (raw.pictures || raw.images || []).map(
      (img: {
        url?: string;
        ssl_url?: string;
        variants?: Array<{ url?: string }>;
        caption?: string;
        alt?: string;
      }) => ({
        url: img.url || img.ssl_url || img.variants?.[0]?.url,
        caption: img.caption || img.alt,
      }),
    ),
    categories: (raw.categories || []).map(
      (cat: string | { name?: string; title?: string }) =>
        typeof cat === "string" ? cat : cat.name || cat.title,
    ),
    location: {
      address: raw.location?.address || raw.meeting_point,
      city: raw.location?.city || raw.locations?.[0]?.city,
      country: raw.location?.country || raw.locations?.[0]?.country,
      coordinates:
        raw.location?.coordinates || raw.coordinates || raw.geo
          ? {
              latitude:
                raw.location?.coordinates?.latitude ||
                raw.coordinates?.lat ||
                raw.geo?.lat ||
                0,
              longitude:
                raw.location?.coordinates?.longitude ||
                raw.coordinates?.lng ||
                raw.geo?.lng ||
                0,
            }
          : undefined,
    },
    bookingInfo: {
      confirmationType:
        raw.confirmation_type || raw.bookingInfo?.confirmationType || "INSTANT",
      cancellationPolicy:
        raw.cancellation_policy?.description ||
        raw.cancellation_text ||
        "Free cancellation",
      mobileTicket:
        raw.has_mobile_ticket ?? raw.bookingInfo?.mobileTicket ?? true,
      instantConfirmation:
        raw.instant_confirmation ??
        raw.bookingInfo?.instantConfirmation ??
        true,
    },
    highlights:
      raw.highlights ||
      raw.inclusions?.map((i: string | { text?: string }) =>
        typeof i === "string" ? i : i.text,
      ) ||
      [],
  };
}

/**
 * Map GetYourGuide categories to our vibe system
 */
export function mapGYGCategoryToVibe(category: string): string[] {
  const mappings: Record<string, string[]> = {
    "City Tours": ["Cultural", "Explorer"],
    "Food & Gourmet Tours": ["Foodie", "Cultural"],
    "Outdoor Activities": ["Adventure", "Nature"],
    "Water Activities": ["Adventure", "Beach"],
    "Day Trips": ["Explorer", "Nature"],
    "Nightlife & Shows": ["Nightlife", "Social"],
    "Museums & Exhibitions": ["Cultural", "Art"],
    "Walking Tours": ["Cultural", "Adventure"],
    "Classes & Workshops": ["Cultural", "Creative"],
    "Wellness & Spas": ["Wellness", "Relaxation"],
    "Hop-on Hop-off": ["Explorer", "Family"],
    "Tickets & Passes": ["Explorer", "Cultural"],
    "Private Tours": ["Luxury", "Romantic"],
    "Boat Tours": ["Adventure", "Nature"],
    "Photography Tours": ["Creative", "Cultural"],
  };

  return mappings[category] || ["Explorer"];
}
