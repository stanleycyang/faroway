/**
 * Viator Partner API Client
 * 
 * Viator (TripAdvisor Experiences) provides tours, activities, and attractions.
 * Commission: 15-20% per booking
 * 
 * @see https://developer.viator.com/
 */

import { z } from 'zod';

// Environment variables
const VIATOR_API_KEY = process.env.VIATOR_API_KEY;
const VIATOR_PARTNER_ID = process.env.VIATOR_PARTNER_ID;
const VIATOR_API_BASE = 'https://api.viator.com/partner';

// Types
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

// Zod schema for validation
const ViatorProductSchema = z.object({
  productCode: z.string(),
  title: z.string(),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  rating: z.number().min(0).max(5),
  reviewCount: z.number(),
  price: z.object({
    amount: z.number(),
    currencyCode: z.string(),
    formattedPrice: z.string().optional(),
  }),
  duration: z.object({
    fixedDurationInMinutes: z.number().optional(),
    variableDurationFromMinutes: z.number().optional(),
    variableDurationToMinutes: z.number().optional(),
  }).optional(),
  images: z.array(z.object({
    url: z.string(),
    caption: z.string().optional(),
  })).optional(),
  categories: z.array(z.string()).optional(),
  location: z.object({
    address: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    coordinates: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }).optional(),
  }).optional(),
});

/**
 * Check if Viator API is configured
 */
export function isViatorConfigured(): boolean {
  return !!(VIATOR_API_KEY && VIATOR_PARTNER_ID);
}

/**
 * Search for products/experiences at a destination
 */
export async function searchViatorProducts(
  params: ViatorSearchParams
): Promise<ViatorProduct[]> {
  if (!isViatorConfigured()) {
    console.warn('[Viator] API not configured, returning empty results');
    return [];
  }

  try {
    const queryParams = new URLSearchParams({
      destName: params.destination,
      ...(params.startDate && { startDate: params.startDate }),
      ...(params.endDate && { endDate: params.endDate }),
      ...(params.rating && { rating: params.rating.toString() }),
      ...(params.limit && { count: params.limit.toString() }),
      currency: 'USD',
      sortBy: 'TOP_SELLERS',
    });

    const response = await fetch(
      `${VIATOR_API_BASE}/products/search?${queryParams}`,
      {
        headers: {
          'Accept': 'application/json',
          'Accept-Language': 'en-US',
          'exp-api-key': VIATOR_API_KEY!,
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[Viator] API error:', response.status, error);
      return [];
    }

    const data = await response.json();
    return (data.products || []).map(normalizeViatorProduct);
  } catch (error) {
    console.error('[Viator] Search error:', error);
    return [];
  }
}

/**
 * Get detailed product information
 */
export async function getViatorProduct(
  productCode: string
): Promise<ViatorProduct | null> {
  if (!isViatorConfigured()) {
    return null;
  }

  try {
    const response = await fetch(
      `${VIATOR_API_BASE}/products/${productCode}`,
      {
        headers: {
          'Accept': 'application/json',
          'Accept-Language': 'en-US',
          'exp-api-key': VIATOR_API_KEY!,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return normalizeViatorProduct(data);
  } catch (error) {
    console.error('[Viator] Get product error:', error);
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
  travelers: number = 2
): Promise<ViatorAvailability[]> {
  if (!isViatorConfigured()) {
    return [];
  }

  try {
    const response = await fetch(
      `${VIATOR_API_BASE}/availability/check`,
      {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'exp-api-key': VIATOR_API_KEY!,
        },
        body: JSON.stringify({
          productCode,
          travelDate: startDate,
          endDate,
          paxMix: [{ ageBand: 'ADULT', count: travelers }],
          currency: 'USD',
        }),
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.availability || [];
  } catch (error) {
    console.error('[Viator] Availability check error:', error);
    return [];
  }
}

/**
 * Generate affiliate booking URL with tracking
 */
export function generateViatorAffiliateUrl(
  productCode: string,
  trackingId: string,
  options?: {
    date?: string;
    travelers?: number;
  }
): string {
  const baseUrl = `https://www.viator.com/tours/${productCode}`;
  const params = new URLSearchParams({
    pid: VIATOR_PARTNER_ID || 'tripgenie',
    mcid: trackingId,
    medium: 'api',
    ...(options?.date && { date: options.date }),
    ...(options?.travelers && { travelers: options.travelers.toString() }),
  });

  return `${baseUrl}?${params}`;
}

/**
 * Normalize Viator API response to our internal format
 */
function normalizeViatorProduct(raw: any): ViatorProduct {
  return {
    productCode: raw.productCode || raw.code,
    title: raw.title || raw.name,
    description: raw.description || '',
    shortDescription: raw.shortDescription || raw.description?.substring(0, 200) || '',
    rating: raw.rating || raw.reviews?.combinedAverageRating || 0,
    reviewCount: raw.reviewCount || raw.reviews?.totalReviews || 0,
    price: {
      amount: raw.pricing?.summary?.fromPrice || raw.price?.amount || 0,
      currencyCode: raw.pricing?.currency || raw.price?.currencyCode || 'USD',
      formattedPrice: raw.pricing?.summary?.fromPriceFormatted || `$${raw.price?.amount || 0}`,
    },
    duration: {
      fixedDurationInMinutes: raw.duration?.fixedDurationInMinutes,
      variableDurationFromMinutes: raw.duration?.variableDurationFromMinutes,
      variableDurationToMinutes: raw.duration?.variableDurationToMinutes,
    },
    images: (raw.images || []).map((img: any) => ({
      url: img.url || img.variants?.[0]?.url,
      caption: img.caption,
    })),
    categories: raw.categories || raw.tags || [],
    location: {
      address: raw.location?.address,
      city: raw.location?.city || raw.destinationName,
      country: raw.location?.country,
      coordinates: raw.location?.coordinates ? {
        latitude: raw.location.coordinates.latitude,
        longitude: raw.location.coordinates.longitude,
      } : undefined,
    },
    bookingInfo: {
      confirmationType: raw.bookingInfo?.confirmationType || 'INSTANT',
      cancellationPolicy: raw.cancellationPolicy?.description || 'Free cancellation',
      mobileTicket: raw.bookingInfo?.mobileTicket ?? true,
      instantConfirmation: raw.bookingInfo?.instantConfirmation ?? true,
    },
    highlights: raw.highlights || [],
    inclusions: raw.inclusions || [],
    exclusions: raw.exclusions || [],
  };
}

/**
 * Map Viator categories to our vibe system
 */
export function mapViatorCategoryToVibe(category: string): string[] {
  const mappings: Record<string, string[]> = {
    'Tours & Sightseeing': ['Cultural', 'Explorer'],
    'Food & Drink': ['Foodie', 'Cultural'],
    'Outdoor Activities': ['Adventure', 'Nature'],
    'Water Sports': ['Adventure', 'Beach'],
    'Walking & Biking Tours': ['Adventure', 'Cultural'],
    'Day Trips': ['Explorer', 'Nature'],
    'Nightlife': ['Nightlife', 'Social'],
    'Shows & Entertainment': ['Nightlife', 'Cultural'],
    'Spa & Wellness': ['Wellness', 'Relaxation'],
    'Classes & Workshops': ['Cultural', 'Creative'],
    'Museums & Art': ['Cultural', 'Art'],
    'Historical Tours': ['Cultural', 'History'],
    'Private Tours': ['Luxury', 'Romantic'],
    'Family-Friendly': ['Family'],
    'Romantic': ['Romantic'],
  };

  return mappings[category] || ['Explorer'];
}
