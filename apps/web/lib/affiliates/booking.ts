/**
 * Booking.com Affiliate Partner API Client
 * 
 * Booking.com provides hotel and accommodation inventory.
 * Commission: 25-40% per booking
 * 
 * @see https://developers.booking.com/
 */

import { z } from 'zod';

// Environment variables
const BOOKING_USERNAME = process.env.BOOKING_COM_USERNAME;
const BOOKING_PASSWORD = process.env.BOOKING_COM_PASSWORD;
const BOOKING_AFFILIATE_ID = process.env.BOOKING_COM_AFFILIATE_ID;
const BOOKING_API_BASE = 'https://distribution-xml.booking.com/2.9/json';

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
  return !!(BOOKING_USERNAME && BOOKING_PASSWORD && BOOKING_AFFILIATE_ID);
}

/**
 * Get Basic Auth header for Booking.com API
 */
function getAuthHeader(): string {
  const credentials = Buffer.from(`${BOOKING_USERNAME}:${BOOKING_PASSWORD}`).toString('base64');
  return `Basic ${credentials}`;
}

/**
 * Get destination ID from destination name
 */
export async function getBookingDestinationId(
  destination: string
): Promise<string | null> {
  if (!isBookingConfigured()) {
    return null;
  }

  try {
    const response = await fetch(
      `${BOOKING_API_BASE}/autocomplete?text=${encodeURIComponent(destination)}&language=en`,
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const cityResult = data.results?.find((r: any) => r.dest_type === 'city');
    return cityResult?.dest_id || null;
  } catch (error) {
    console.error('[Booking] Destination lookup error:', error);
    return null;
  }
}

/**
 * Search for hotels at a destination
 */
export async function searchBookingHotels(
  params: BookingSearchParams
): Promise<BookingHotel[]> {
  if (!isBookingConfigured()) {
    console.warn('[Booking] API not configured, returning empty results');
    return [];
  }

  try {
    // First get destination ID
    const destId = await getBookingDestinationId(params.destination);
    if (!destId) {
      console.warn('[Booking] Could not find destination:', params.destination);
      return [];
    }

    const queryParams = new URLSearchParams({
      dest_id: destId,
      dest_type: 'city',
      checkin: params.checkIn,
      checkout: params.checkOut,
      guest_qty: params.guests.toString(),
      room_qty: (params.rooms || 1).toString(),
      currency: 'USD',
      language: 'en',
      order_by: 'popularity',
      rows: (params.limit || 20).toString(),
      ...(params.priceMin && { price_filter_min: params.priceMin.toString() }),
      ...(params.priceMax && { price_filter_max: params.priceMax.toString() }),
      ...(params.stars?.length && { class_filter: params.stars.join(',') }),
    });

    const response = await fetch(
      `${BOOKING_API_BASE}/hotels?${queryParams}`,
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('[Booking] API error:', response.status, error);
      return [];
    }

    const data = await response.json();
    return (data.result || []).map((hotel: any) => normalizeBookingHotel(hotel, params));
  } catch (error) {
    console.error('[Booking] Search error:', error);
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
  guests: number
): Promise<BookingHotel | null> {
  if (!isBookingConfigured()) {
    return null;
  }

  try {
    const queryParams = new URLSearchParams({
      hotel_ids: hotelId,
      checkin: checkIn,
      checkout: checkOut,
      guest_qty: guests.toString(),
      room_qty: '1',
      currency: 'USD',
      language: 'en',
      extras: 'hotel_info,hotel_photos,hotel_description,hotel_facilities,room_info',
    });

    const response = await fetch(
      `${BOOKING_API_BASE}/hotels?${queryParams}`,
      {
        headers: {
          'Authorization': getAuthHeader(),
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const hotel = data.result?.[0];
    return hotel ? normalizeBookingHotel(hotel, { checkIn, checkOut, guests, destination: '' }) : null;
  } catch (error) {
    console.error('[Booking] Get hotel error:', error);
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
  }
): string {
  const params = new URLSearchParams({
    aid: BOOKING_AFFILIATE_ID || 'tripgenie',
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
  }
): string {
  const params = new URLSearchParams({
    aid: BOOKING_AFFILIATE_ID || 'tripgenie',
    label: trackingId,
    ss: destination,
    ...(options?.checkIn && { checkin: options.checkIn }),
    ...(options?.checkOut && { checkout: options.checkOut }),
    ...(options?.guests && { group_adults: options.guests.toString() }),
  });

  return `https://www.booking.com/searchresults.html?${params}`;
}

/**
 * Normalize Booking.com API response to our internal format
 */
function normalizeBookingHotel(raw: any, params: Partial<BookingSearchParams>): BookingHotel {
  const nights = params.checkIn && params.checkOut
    ? Math.ceil((new Date(params.checkOut).getTime() - new Date(params.checkIn).getTime()) / (1000 * 60 * 60 * 24))
    : 1;

  const pricePerNight = raw.min_total_price ? raw.min_total_price / nights : 0;

  return {
    hotelId: raw.hotel_id?.toString() || raw.id,
    name: raw.hotel_name || raw.name,
    description: raw.hotel_description || raw.description || '',
    starRating: raw.class || raw.star_rating || 0,
    userRating: raw.review_score || 0,
    reviewScore: raw.review_score || 0,
    reviewCount: raw.review_nr || raw.review_count || 0,
    price: {
      perNight: Math.round(pricePerNight),
      total: Math.round(raw.min_total_price || 0),
      currencyCode: raw.currency_code || 'USD',
      formatted: `$${Math.round(pricePerNight)}/night`,
    },
    location: {
      address: raw.address || '',
      city: raw.city || raw.city_name || '',
      country: raw.country || '',
      countryCode: raw.country_code || raw.cc1 || '',
      latitude: raw.latitude || raw.location?.latitude || 0,
      longitude: raw.longitude || raw.location?.longitude || 0,
      neighborhood: raw.district || raw.neighborhood,
      distanceFromCenter: raw.distance_to_cc,
    },
    images: (raw.hotel_photos || raw.photos || []).map((photo: any) => ({
      url: photo.url_original || photo.url_max || photo.url,
      caption: photo.caption,
    })),
    amenities: raw.hotel_facilities || raw.facilities || [],
    roomTypes: (raw.rooms || []).map((room: any) => ({
      name: room.room_name || room.name,
      maxOccupancy: room.max_occupancy || 2,
      bedType: room.bed_type || 'Queen',
      price: room.price || pricePerNight,
    })),
    policies: {
      checkIn: raw.checkin?.from || '15:00',
      checkOut: raw.checkout?.until || '11:00',
      cancellation: raw.is_free_cancellable ? 'Free cancellation available' : 'Non-refundable',
      freeCancellationUntil: raw.free_cancellation_until,
    },
    badges: [
      ...(raw.is_genius_deal ? ['Genius Deal'] : []),
      ...(raw.is_mobile_deal ? ['Mobile Deal'] : []),
      ...(raw.preferred ? ['Preferred Partner'] : []),
      ...(raw.review_score >= 9 ? ['Exceptional'] : raw.review_score >= 8 ? ['Excellent'] : []),
    ],
  };
}

/**
 * Map Booking.com amenities to our vibe system
 */
export function mapBookingAmenitiesToVibe(amenities: string[]): string[] {
  const vibes: string[] = [];
  const amenityText = amenities.join(' ').toLowerCase();

  if (amenityText.includes('spa') || amenityText.includes('wellness')) {
    vibes.push('Wellness', 'Relaxation');
  }
  if (amenityText.includes('pool') || amenityText.includes('beach')) {
    vibes.push('Beach', 'Relaxation');
  }
  if (amenityText.includes('gym') || amenityText.includes('fitness')) {
    vibes.push('Wellness');
  }
  if (amenityText.includes('romantic') || amenityText.includes('honeymoon')) {
    vibes.push('Romantic');
  }
  if (amenityText.includes('family') || amenityText.includes('kids')) {
    vibes.push('Family');
  }
  if (amenityText.includes('business') || amenityText.includes('conference')) {
    vibes.push('Business');
  }
  if (amenityText.includes('bar') || amenityText.includes('nightclub')) {
    vibes.push('Nightlife');
  }

  return [...new Set(vibes)];
}

/**
 * Calculate vibe score for a hotel
 */
export function calculateHotelVibeScore(
  hotel: BookingHotel,
  targetVibes: string[]
): { score: number; matchedVibes: string[] } {
  const hotelVibes = mapBookingAmenitiesToVibe(hotel.amenities);
  const matchedVibes = hotelVibes.filter(v => targetVibes.includes(v));
  
  let score = 50; // Base score
  score += matchedVibes.length * 15;
  score += Math.min(hotel.reviewScore * 3, 30); // Up to 30 points for rating
  
  // Bonus for specific matches
  if (targetVibes.includes('Luxury') && hotel.starRating >= 4) score += 15;
  if (targetVibes.includes('Budget') && hotel.starRating <= 3) score += 10;

  return {
    score: Math.min(100, score),
    matchedVibes,
  };
}
