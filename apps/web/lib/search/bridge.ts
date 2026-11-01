import { suppliedCoordinates } from "../location-coordinates";
import { readPrice } from "@faroway/constants";
import { viatorContentMetadata } from "@/lib/affiliates/viator-policy";
/**
 * Type Bridge: Multi-Agent Search Results → Frontend Itinerary Types
 *
 * Maps the structured output from the multi-agent system (ActivityResult,
 * DiningResult, HotelResult, SuggestedDay) to the frontend's TripDay /
 * ItineraryActivity / Restaurant format used by ItineraryDay.tsx and the
 * itineraries table.
 */

import type {
  ActivityResult,
  DiningResult,
  HotelResult,
  TransportResult,
  SuggestedDay,
  SearchResults,
  ItineraryActivity,
  Restaurant,
  TripDay,
  TripDayTransport,
} from "@faroway/types";

// ── Activity Mapper ─────────────────────────────────────────────────────────

function mapActivity(
  a: ActivityResult,
  timeOfDay: "morning" | "afternoon" | "evening",
): ItineraryActivity {
  const categoryMap: Record<string, ItineraryActivity["category"]> = {
    sightseeing: "sightseeing",
    adventure: "adventure",
    cultural: "cultural",
    relaxation: "relaxation",
    entertainment: "entertainment",
    shopping: "shopping",
    food: "cultural",
    nature: "adventure",
    nightlife: "entertainment",
  };

  const price =
    a.priceStatus === "unknown" ? undefined : readPrice(a.price, a.currency);
  return {
    ...viatorContentMetadata(a),
    id: a.id,
    name: a.name,
    description: a.description,
    duration: a.duration, // already in minutes from activities agent
    estimatedCost: {
      amount: price?.amount ?? 0,
      status: price ? a.priceStatus : "unknown",
      currency: price?.currency ?? "",
    },
    timeOfDay:
      a.bestTimeOfDay === "any"
        ? timeOfDay
        : (a.bestTimeOfDay as "morning" | "afternoon" | "evening"),
    category: categoryMap[a.category?.toLowerCase()] || "sightseeing",
    location: {
      name: a.location?.name || a.location?.neighborhood || "",
      address: a.location?.address,
      coordinates: suppliedCoordinates(a.location) ?? undefined,
    },
    vibeMatch: {
      matchedVibes: a.vibeMatch || [],
      reasoning: `Matches your ${a.vibeMatch?.join(", ") || "travel"} style`,
    },
    bookingInfo: {
      requiresReservation: a.bookingRequired,
      bookingUrl: a.affiliateUrl || undefined,
      affiliateId: a.affiliatePartner || undefined,
    },
    rating: a.rating,
    reviewCount: a.reviewCount,
    images: a.images,
    tripadvisorRating: a.tripadvisorRating,
    tripadvisorReviewCount: a.tripadvisorReviewCount,
    tripadvisorUrl: a.tripadvisorUrl,
  };
}

// ── Dining Mapper ───────────────────────────────────────────────────────────

function mapDining(
  d: DiningResult,
  mealType: "breakfast" | "lunch" | "dinner",
): Restaurant {
  return {
    id: d.id,
    name: d.name,
    cuisineType: d.cuisineTypes || [],
    priceLevel: d.priceLevel as 1 | 2 | 3 | 4,
    description: d.description,
    estimatedCost: {
      amount: 0,
      status: "unknown",
      currency: "",
      perPerson: true,
    },
    mealType,
    location: {
      name: d.location?.name || d.location?.neighborhood || "",
      address: d.location?.address,
      coordinates: suppliedCoordinates(d.location) ?? undefined,
    },
    dietaryOptions: d.dietaryOptions || [],
    vibeMatch: {
      matchedVibes: d.vibeMatch || [],
      reasoning: `Matches your ${d.vibeMatch?.join(", ") || "dining"} preferences`,
    },
    reservationInfo: d.reservationUrl
      ? { recommended: true, url: d.reservationUrl }
      : { recommended: false },
    rating: d.rating,
    reviewCount: d.reviewCount,
    tripadvisorRating: d.tripadvisorRating,
    tripadvisorReviewCount: d.tripadvisorReviewCount,
    tripadvisorUrl: d.tripadvisorUrl,
  };
}

// ── Slot Mapper ─────────────────────────────────────────────────────────────

function mapSlot(
  slot: { activities: ActivityResult[]; meal?: DiningResult },
  timeOfDay: "morning" | "afternoon" | "evening",
  mealType: "breakfast" | "lunch" | "dinner",
): { activities: ItineraryActivity[]; meals: Restaurant[] } {
  const activities = (slot.activities || []).map((a) =>
    mapActivity(a, timeOfDay),
  );
  const meals = slot.meal ? [mapDining(slot.meal, mealType)] : [];
  return { activities, meals };
}

// ── Transport Mapper ────────────────────────────────────────────────────────

function mapTransport(t: TransportResult): TripDayTransport & { id: string } {
  return {
    id: t.id,
    expiresAt: t.expiresAt,
    type: t.type,
    provider: t.provider,
    departure: {
      airport: t.departure.airport,
      city: t.departure.city,
      dateTime: t.departure.dateTime,
    },
    arrival: {
      airport: t.arrival.airport,
      city: t.arrival.city,
      dateTime: t.arrival.dateTime,
    },
    duration: t.duration,
    stops: t.stops,
    price: t.price,
    currency: t.currency,
    affiliateUrl: t.affiliateUrl || undefined,
    affiliatePartner: t.affiliatePartner || undefined,
  };
}

// ── Day Mapper ──────────────────────────────────────────────────────────────

function mapDay(day: SuggestedDay): MappedItinerary["days"][number] {
  return {
    dayNumber: day.dayNumber,
    date: day.date,
    title: day.title,
    summary: day.summary,
    morning: mapSlot(day.morning, "morning", "breakfast"),
    afternoon: mapSlot(day.afternoon, "afternoon", "lunch"),
    evening: mapSlot(day.evening, "evening", "dinner"),
    transport: day.transport ? mapTransport(day.transport) : undefined,
    hotel: day.hotel,
    totalEstimatedCost:
      typeof day.estimatedCost === "number" &&
      Number.isFinite(day.estimatedCost) &&
      day.estimatedCost >= 0 &&
      readPrice(day.estimatedCost, day.currency)
        ? readPrice(day.estimatedCost, day.currency)
        : undefined,
    tips: day.tips || [],
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export interface MappedItinerary {
  days: (TripDay & { transport?: TripDayTransport & { id?: string } })[];
  topHotel: HotelResult | null;
  hotels: HotelResult[];
  activities: ActivityResult[];
  dining: DiningResult[];
  transport: TransportResult[];
  totalEstimatedCost?: number;
  currency?: string;
}

/**
 * Map the multi-agent SearchResults into the frontend itinerary format.
 */
export function mapSearchResultsToItinerary(
  results: SearchResults,
  topHotel: HotelResult | null,
): MappedItinerary {
  const days = (results.itinerary || []).map(mapDay);

  // The aggregator's daily estimate can include transport, and provider prices
  // can use different currencies/quantities. Do not invent a complete total by
  // adding these fields (or treating unknown hotel prices as zero).

  return {
    days,
    topHotel,
    hotels: results.hotels || [],
    activities: results.activities || [],
    dining: results.dining || [],
    transport: results.transport || [],
    totalEstimatedCost: undefined,
    currency: undefined,
  };
}
