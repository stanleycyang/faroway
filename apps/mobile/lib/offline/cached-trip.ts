import { z } from 'zod';
import type { Trip } from '../../stores/tripStore';

const text = z.string();
const optionalText = text.optional();
const amount = z.number().finite();
const endpoint = z.object({ airport: text, city: text, dateTime: text }).passthrough();
const activity = z
  .object({
    id: text.min(1),
    time: text,
    title: text,
    description: text,
    location: text,
    duration: text,
    type: z.enum([
      'activity',
      'restaurant',
      'transport',
      'accommodation',
      'attraction',
      'experience',
    ]),
    price: optionalText,
    estimatedCost: z
      .object({ amount, currency: text, perPerson: z.boolean().optional() })
      .optional(),
    bookingUrl: optionalText,
    affiliatePartner: optionalText,
    image: optionalText,
    rating: amount.optional(),
    reviewCount: amount.optional(),
    topReview: optionalText,
    freeCancellation: z.boolean().optional(),
    isSaved: z.boolean().optional(),
  })
  .passthrough();
const day = z
  .object({
    date: text,
    dayNumber: amount,
    theme: text,
    tips: z.array(text).optional(),
    activities: z.array(activity),
    transport: z
      .object({
        expiresAt: optionalText,
        type: z.enum(['flight', 'train', 'bus', 'ferry']),
        provider: text,
        departure: endpoint,
        arrival: endpoint,
        duration: amount.optional(),
        stops: amount.optional(),
        price: amount.optional(),
        currency: text,
        bookingUrl: optionalText,
        affiliatePartner: optionalText,
      })
      .passthrough()
      .optional(),
  })
  .passthrough();
const hotel = z
  .object({
    id: text,
    name: text,
    description: text,
    // The normalizer uses NaN for an unavailable quote; JSON persists it as null.
    pricePerNight: z.union([amount, z.nan(), z.null()]).transform((value) => value ?? NaN),
    currency: optionalText,
    totalPrice: amount,
    rating: amount,
    reviewCount: amount,
    amenities: z.array(text),
    images: z.array(text),
    bookingUrl: text,
    location: z
      .object({ name: text, address: text, lat: amount, lng: amount, neighborhood: optionalText })
      .passthrough(),
  })
  .passthrough();
const cachedTrip: z.ZodType<Trip> = z
  .object({
    id: text.min(1),
    destination: text,
    country: text,
    placeId: optionalText,
    startDate: text,
    endDate: text,
    travelers: amount,
    travelerType: text,
    originCity: optionalText,
    originAirport: optionalText,
    vibes: z.array(text),
    // Older sync summaries stored an absent server budget as null. Preserve the
    // trip and normalize that one legacy representation instead of rejecting it.
    budget: text.nullish().transform((value) => value ?? undefined),
    days: z.array(day),
    hotel: hotel.optional(),
    coverImage: text,
    createdAt: text,
    updatedAt: optionalText,
    status: z.enum(['draft', 'planned', 'active', 'completed']),
    planNeedsRefresh: z.boolean().optional(),
  })
  .passthrough();

/** Validate an owned cache before any list/detail consumer sees it. Never erase it. */
export function readCachedTrips(value: unknown): Trip[] {
  const result = z.array(cachedTrip).safeParse(value);
  if (!result.success) {
    throw new Error(
      'Couldn’t read your saved trips on this device. Your stored data is kept. Connect and refresh your trips to try again.'
    );
  }
  return result.data;
}
