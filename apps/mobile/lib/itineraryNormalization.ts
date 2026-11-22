import {
  readProposedVisitType,
  readDayTiming,
  dayTimingTips,
  readVenueSource,
  readDiningReviewOptions,
} from '@faroway/types';
import { normalizeAffiliatePartner, resolveAffiliatePartnerByUrl } from '@faroway/constants';
import { durationLabel } from './durationLabel';
import { venuePhoto } from './venuePhotos';
import type { Activity, Hotel, TripDay } from './itineraryTypes';
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

function resolveNormalizedPartner(
  explicitPartner: unknown,
  bookingUrl?: string
): string | undefined {
  const raw = displayText(explicitPartner).trim();
  if (raw) {
    return normalizeAffiliatePartner(raw) ?? raw;
  }
  if (bookingUrl) {
    return resolveAffiliatePartnerByUrl(bookingUrl);
  }
  return undefined;
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
  const bookingUrl =
    displayText(fields.affiliateUrl) || displayText(fields.bookingUrl) || undefined;
  return {
    expiresAt: displayText(fields.expiresAt) || undefined,
    type: fields.type as NonNullable<TripDay['transport']>['type'],
    provider: displayText(fields.provider, 'Transport option'),
    departure: endpoint(fields.departure),
    arrival: endpoint(fields.arrival),
    duration: displayNumber(fields.duration),
    stops: Number.isInteger(fields.stops) ? displayNumber(fields.stops) : undefined,
    price: displayNumber(fields.price),
    currency: displayText(fields.currency),
    bookingUrl,
    affiliatePartner: resolveNormalizedPartner(fields.affiliatePartner, bookingUrl),
  };
}

/**
 * Transform an API activity (from morning/afternoon/evening blocks) into
 * the flat Activity type used by mobile UI.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformApiActivity(a: any, timeOfDay: string): Activity {
  const name = displayText(a.name) || displayText(a.title);
  const venueAddress = displayText(a.location?.address) || displayText(a.venueAddress);
  const photo = venuePhoto(name, venueAddress);
  const suppliedImage = displayText(a.images?.[0]) || displayText(a.image);
  const image = suppliedImage || photo?.imageUrl;
  const bookingUrl =
    displayText(a.bookingInfo?.bookingUrl) ||
    displayText(a.bookingUrl) ||
    displayText(a.affiliateUrl) ||
    undefined;
  return {
    venueAddress: venueAddress || undefined,
    imageCredit:
      photo && image === photo.imageUrl
        ? {
            artist: photo.artist,
            sourceUrl: photo.sourceUrl,
            license: photo.license,
            licenseUrl: photo.licenseUrl,
          }
        : undefined,
    proposedVisitType: readProposedVisitType(a.proposedVisitType),
    source: readVenueSource(a.source),
    planningIdea: a.planningIdea === true ? true : undefined,
    id: displayText(a.id) || `activity_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    scheduleSlot: ['morning', 'afternoon', 'evening'].includes(a.scheduleSlot)
      ? a.scheduleSlot
      : undefined,
    durationMinutes:
      displayNumber(a.duration) ??
      (displayNumber(a.durationMinutes) !== undefined &&
      (typeof a.duration !== 'string' ||
        durationLabel(a.duration) === durationLabel(`${a.durationMinutes} min`))
        ? a.durationMinutes
        : undefined),
    time: displayText(a.timeOfDay) || displayText(a.time) || timeOfDay,
    title: displayText(a.name) || displayText(a.title),
    description: displayText(a.description),
    location: displayText(a.location?.name) || displayText(a.location),
    duration:
      displayNumber(a.duration) !== undefined
        ? durationLabel(`${a.duration} min`)
        : durationLabel(displayText(a.duration)),
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
    bookingUrl,
    affiliatePartner: resolveNormalizedPartner(
      a.bookingInfo?.affiliateId ?? a.affiliatePartner,
      bookingUrl
    ),
    image,
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
  const bookingUrl =
    displayText(r.reservationInfo?.url) ||
    displayText(r.bookingUrl) ||
    displayText(r.reservationUrl) ||
    displayText(r.affiliateUrl) ||
    undefined;
  return {
    source: readVenueSource(r.source),
    planningIdea: r.planningIdea === true ? true : undefined,
    id: displayText(r.id) || `restaurant_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    time: displayText(r.mealType) || 'dining',
    title: displayText(r.name) || displayText(r.title),
    description: displayText(r.description),
    location: displayText(r.location?.name) || displayText(r.location),
    duration: '',
    type: 'restaurant',
    estimatedCost:
      r.estimatedCost?.status === 'unknown' || r.priceStatus === 'unknown'
        ? undefined
        : readTripCost(r.estimatedCost) || readTripCost(r.price),
    price:
      r.estimatedCost?.status === 'unknown' || r.priceStatus === 'unknown'
        ? undefined
        : formatCostValue(r.estimatedCost) || formatCostValue(r.price),
    bookingUrl,
    image: displayText(r.images?.[0]) || displayText(r.image) || undefined,
    topReview: displayText(r.topReview) || undefined,
    isSaved: typeof r.isSaved === 'boolean' ? r.isSaved : undefined,
    affiliatePartner: resolveNormalizedPartner(
      r.reservationInfo?.affiliateId ??
        r.reservationInfo?.provider ??
        r.bookingInfo?.affiliateId ??
        r.affiliatePartner,
      bookingUrl
    ),
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

        const blockActivities: Activity[] = [];
        // Keep visits in their supplied order within the day part.
        if (Array.isArray(block.activities)) {
          for (const a of block.activities) {
            if (hasActivityTitle(a)) {
              blockActivities.push({
                ...transformApiActivity(a, timeOfDay),
                scheduleSlot: timeOfDay,
              });
            }
          }
        }

        // Map meals/restaurants into activities with type 'restaurant'
        const meals = Array.isArray(block.meals)
          ? block.meals
          : block.meal && typeof block.meal === 'object'
            ? [block.meal]
            : [];
        const blockMeals: Activity[] = [];
        for (const m of meals) {
          if (hasActivityTitle(m)) {
            blockMeals.push({ ...transformApiRestaurant(m), scheduleSlot: timeOfDay });
          }
        }
        // Match the planner's day-part sequence without inventing clock times:
        // breakfast, morning visits, lunch, afternoon visits, evening visits, dinner.
        activities.push(
          ...(timeOfDay === 'evening'
            ? [...blockActivities, ...blockMeals]
            : [...blockMeals, ...blockActivities])
        );
      }

      const transport = transformTransport(day.transport);
      // Cached mobile days are flat. Reconstruct only the identity/duration basis,
      // using preserved slot metadata; older caches without it cannot certify times.
      const timingDay =
        Array.isArray(day.activities) && !day.morning && !day.afternoon && !day.evening
          ? {
              ...day,
              ...Object.fromEntries(
                ['morning', 'afternoon', 'evening'].map((slot) => [
                  slot,
                  {
                    activities: activities
                      .filter((a) => a.scheduleSlot === slot && a.type !== 'restaurant')
                      .map((a) => ({ id: a.id, name: a.title, duration: a.durationMinutes })),
                    meals: activities
                      .filter((a) => a.scheduleSlot === slot && a.type === 'restaurant')
                      .map((a) => ({ id: a.id, name: a.title })),
                  },
                ])
              ),
            }
          : day;

      const timingProposal = readDayTiming(timingDay);
      // Meal durations are planning assumptions, not restaurant facts. Rebuild
      // labels on every normalization so an invalidated cache cannot retain them.
      const mealDurations = new Map(
        timingProposal?.events
          .filter((event) => event.kind === 'meal')
          .map((event) => [event.id, event.durationMinutes]) ?? []
      );
      for (const activity of activities) {
        if (activity.type !== 'restaurant') continue;
        const minutes = mealDurations.get(`meal:${activity.scheduleSlot}:${activity.id}`);
        activity.duration =
          minutes === undefined ? '' : `${durationLabel(`${minutes} min`)} planned`;
        delete activity.durationMinutes;
      }

      return {
        date: displayText(day.date),
        dayNumber: Number.isInteger(day.dayNumber) && day.dayNumber > 0 ? day.dayNumber : 1,
        theme: displayText(day.title) || displayText(day.theme) || 'Your day',
        timingProposal,
        tips: dayTimingTips(timingDay),
        diningOptions: readDiningReviewOptions(day.diningOptions),
        activities,
        transport,
      };
    });
}

function finiteCoord(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * Transform hotel data from the API response.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformApiHotel(h: any): Hotel | undefined {
  if (!h || typeof h !== 'object' || Array.isArray(h) || !displayText(h.name)) return undefined;

  const bookingUrl =
    displayText(h.affiliateUrl) ||
    displayText(h.bookingUrl) ||
    displayText(h.bookingInfo?.bookingUrl) ||
    undefined;
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
    bookingUrl,
    affiliatePartner: resolveNormalizedPartner(
      h.bookingInfo?.affiliateId ?? h.affiliatePartner,
      bookingUrl
    ),
    location: {
      name: displayText(h.location?.name) || displayText(h.neighborhood),
      address: displayText(h.location?.address) || displayText(h.address),
      lat: finiteCoord(h.location?.lat) ?? finiteCoord(h.location?.coordinates?.lat) ?? 0,
      lng: finiteCoord(h.location?.lng) ?? finiteCoord(h.location?.coordinates?.lng) ?? 0,
      neighborhood:
        displayText(h.location?.neighborhood) || displayText(h.neighborhood) || undefined,
    },
  };
}
