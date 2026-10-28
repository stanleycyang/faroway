import type { Activity, Hotel, TripDay } from '../stores/tripStore';
import { readTripCost, formatTripCost } from './tripCost';

function formatCostValue(cost: unknown): string | undefined {
  if (typeof cost === 'string') return cost;
  const structured = readTripCost(cost);
  if (structured) return formatTripCost(structured);
  if (typeof cost === 'number' && Number.isFinite(cost) && cost >= 0)
    return `${cost} · currency unavailable`;
  return undefined;
}

function displayText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}
function displayNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}
function hasActivityTitle(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return !!(displayText(item.name) || displayText(item.title));
}

function displayStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function transformTransport(value: unknown): TripDay['transport'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const fields = value as Record<string, unknown>;
  if (!['flight', 'train', 'bus', 'ferry'].includes(String(fields.type))) return undefined;
  const endpoint = (value: unknown) => {
    const fields = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
    return {
      airport: displayText(fields.airport),
      city: displayText(fields.city),
      dateTime: displayText(fields.dateTime),
    };
  };
  return {
    type: fields.type as NonNullable<TripDay['transport']>['type'],
    provider: displayText(fields.provider, 'Transport option'),
    departure: endpoint(fields.departure),
    arrival: endpoint(fields.arrival),
    duration: displayNumber(fields.duration),
    stops: Number.isInteger(fields.stops) ? displayNumber(fields.stops) : undefined,
    price: displayNumber(fields.price),
    currency: displayText(fields.currency),
    bookingUrl: displayText(fields.affiliateUrl) || displayText(fields.bookingUrl) || undefined,
    affiliatePartner: displayText(fields.affiliatePartner) || undefined,
  };
}

/**
 * Transform an API activity (from morning/afternoon/evening blocks) into
 * the flat Activity type used by mobile UI.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformApiActivity(a: any, timeOfDay: string): Activity {
  return {
    id: displayText(a.id) || `activity_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    time: displayText(a.timeOfDay) || displayText(a.time) || timeOfDay,
    title: displayText(a.name) || displayText(a.title),
    description: displayText(a.description),
    location: displayText(a.location?.name) || displayText(a.location),
    duration:
      displayNumber(a.duration) !== undefined ? `${a.duration} min` : displayText(a.duration),
    type:
      a.category === 'sightseeing' || a.category === 'adventure' || a.category === 'cultural'
        ? 'attraction'
        : a.category === 'entertainment' || a.category === 'shopping'
          ? 'experience'
          : [
                'activity',
                'restaurant',
                'transport',
                'accommodation',
                'attraction',
                'experience',
              ].includes(a.type)
            ? a.type
            : 'activity',
    estimatedCost:
      a.estimatedCost?.status === 'unknown' || a.priceStatus === 'unknown'
        ? undefined
        : readTripCost(a.estimatedCost) || readTripCost(a.price),
    price:
      a.estimatedCost?.status === 'unknown' || a.priceStatus === 'unknown'
        ? undefined
        : formatCostValue(a.estimatedCost) || formatCostValue(a.price),
    bookingUrl:
      displayText(a.bookingInfo?.bookingUrl) ||
      displayText(a.bookingUrl) ||
      displayText(a.affiliateUrl) ||
      undefined,
    affiliatePartner:
      displayText(a.bookingInfo?.affiliateId) || displayText(a.affiliatePartner) || undefined,
    image: displayText(a.images?.[0]) || displayText(a.image) || undefined,
    rating: displayNumber(a.rating) !== undefined && a.rating <= 5 ? a.rating : undefined,
    reviewCount: displayNumber(a.reviewCount),
    topReview: displayText(a.topReview) || undefined,
    freeCancellation: typeof a.freeCancellation === 'boolean' ? a.freeCancellation : undefined,
    isSaved: typeof a.isSaved === 'boolean' ? a.isSaved : undefined,
  };
}

/**
 * Transform an API restaurant/meal into the flat Activity type with type 'restaurant'.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformApiRestaurant(r: any): Activity {
  return {
    id: displayText(r.id) || `restaurant_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    time: displayText(r.mealType) || 'dining',
    title: displayText(r.name) || displayText(r.title),
    description: displayText(r.description),
    location: displayText(r.location?.name) || displayText(r.location),
    duration: '1-2 hours',
    type: 'restaurant',
    estimatedCost:
      r.estimatedCost?.status === 'unknown' || r.priceStatus === 'unknown'
        ? undefined
        : readTripCost(r.estimatedCost) || readTripCost(r.price),
    price:
      r.estimatedCost?.status === 'unknown' || r.priceStatus === 'unknown'
        ? undefined
        : formatCostValue(r.estimatedCost) || formatCostValue(r.price),
    bookingUrl:
      displayText(r.reservationInfo?.url) ||
      displayText(r.bookingUrl) ||
      displayText(r.reservationUrl) ||
      displayText(r.affiliateUrl) ||
      undefined,
    image: displayText(r.images?.[0]) || displayText(r.image) || undefined,
    topReview: displayText(r.topReview) || undefined,
    isSaved: typeof r.isSaved === 'boolean' ? r.isSaved : undefined,
    affiliatePartner: 'opentable',
    rating: displayNumber(r.rating) !== undefined && r.rating <= 5 ? r.rating : undefined,
    reviewCount: displayNumber(r.reviewCount),
  };
}

/**
 * Transform API itinerary days (morning/afternoon/evening blocks) into
 * a flat activities array per day that the mobile UI expects.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformItineraryDays(apiDays: any[]): TripDay[] {
  if (!Array.isArray(apiDays)) return [];

  return apiDays
    .filter((day) => day && typeof day === 'object' && !Array.isArray(day))
    .map((day) => {
      const activities: Activity[] = [];

      // Cached flat activities use the same display normalization as API activities.
      if (Array.isArray(day.activities) && !day.morning && !day.afternoon && !day.evening) {
        activities.push(
          ...day.activities
            .filter(hasActivityTitle)
            .map((activity: unknown) => transformApiActivity(activity, 'activity'))
        );
      }

      // Flatten morning/afternoon/evening time blocks into a single activities array
      for (const [timeOfDay] of [['morning'], ['afternoon'], ['evening']] as const) {
        const block = day[timeOfDay];
        if (!block) continue;

        // Map activities from this time block
        if (Array.isArray(block.activities)) {
          for (const a of block.activities) {
            if (hasActivityTitle(a)) {
              activities.push(transformApiActivity(a, timeOfDay));
            }
          }
        }

        // Map meals/restaurants into activities with type 'restaurant'
        const meals = Array.isArray(block.meals)
          ? block.meals
          : block.meal && typeof block.meal === 'object'
            ? [block.meal]
            : [];
        for (const m of meals) {
          if (hasActivityTitle(m)) {
            activities.push(transformApiRestaurant(m));
          }
        }
      }

      const transport = transformTransport(day.transport);

      return {
        date: displayText(day.date),
        dayNumber: Number.isInteger(day.dayNumber) && day.dayNumber > 0 ? day.dayNumber : 1,
        theme: displayText(day.title) || displayText(day.theme) || 'Your day',
        tips: Array.isArray(day.tips)
          ? day.tips.filter(
              (tip: unknown): tip is string => typeof tip === 'string' && !!tip.trim()
            )
          : [],
        activities,
        transport,
      };
    });
}

/**
 * Transform hotel data from the API response.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformApiHotel(h: any): Hotel | undefined {
  if (!h || typeof h !== 'object' || Array.isArray(h) || !displayText(h.name)) return undefined;

  return {
    id: displayText(h.id) || `hotel_${Date.now()}`,
    name: displayText(h.name),
    description: displayText(h.description),
    pricePerNight: displayNumber(h.pricePerNight) ?? displayNumber(h.price) ?? NaN,
    totalPrice: displayNumber(h.totalPrice) ?? 0,
    currency: typeof h.currency === 'string' ? h.currency : undefined,
    rating:
      [h.userRating, h.rating, h.starRating]
        .map(displayNumber)
        .find((rating) => rating !== undefined && rating <= 5) ?? 0,
    reviewCount: displayNumber(h.reviewCount) ?? 0,
    amenities: displayStrings(h.amenities),
    images: displayStrings(h.images).length
      ? displayStrings(h.images)
      : displayText(h.image)
        ? [h.image]
        : [],
    bookingUrl: displayText(h.affiliateUrl) || displayText(h.bookingUrl),
    location: {
      name: displayText(h.location?.name) || displayText(h.neighborhood),
      address: displayText(h.location?.address) || displayText(h.address),
      lat: h.location?.lat || h.location?.coordinates?.lat || 0,
      lng: h.location?.lng || h.location?.coordinates?.lng || 0,
      neighborhood:
        displayText(h.location?.neighborhood) || displayText(h.neighborhood) || undefined,
    },
  };
}
