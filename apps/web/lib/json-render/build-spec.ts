import { formatPrice, readPrice } from "@faroway/constants";
import {
  containsViatorContent,
  filterViatorDisplay,
  isViatorContent,
} from "@/lib/affiliates/viator-policy";
/**
 * json-render Spec Builder
 *
 * Converts structured search results (hotels, activities, dining, itinerary days)
 * into a flat json-render component array that the mobile app renders directly
 * via its component registry.
 *
 * Component types match: apps/mobile/lib/json-render/catalog.ts
 *
 * For progressive streaming, use the individual builders:
 *   - buildSummaryBlocks()    — called immediately when stream starts
 *   - buildHotelBlocks()      — called when hotels agent finishes
 *   - buildItineraryBlocks()  — called when aggregator finishes
 *   - buildBudgetBlocks()     — called alongside itinerary
 */

export interface HotelInput {
  id?: string;
  name: string;
  rating?: number;
  reviewCount?: number;
  pricePerNight?: number;
  currency?: string;
  amenities?: string[];
  description?: string;
  affiliateUrl?: string;
  images?: string[];
  starRating?: number;
}

export interface ActivityInput {
  priceStatus?: "unknown" | "estimate";
  id?: string;
  name: string;
  description?: string;
  duration?: number; // hours
  price?: number;
  currency?: string;
  rating?: number;
  reviewCount?: number;
  category?: string;
  affiliateUrl?: string;
  images?: string[];
  location?: { neighborhood?: string; city?: string; name?: string };
}

export interface RestaurantInput {
  priceStatus?: "unknown" | "estimate";
  id?: string;
  name: string;
  cuisine?: string;
  priceLevel?: string | number;
  rating?: number;
  reviewCount?: number;
  description?: string;
  reservationUrl?: string;
  images?: string[];
}

export interface ItineraryDayInput {
  dayNumber: number;
  date: string;
  title: string;
  morning?: {
    activities?: ActivityInput[];
    meal?: RestaurantInput;
  };
  afternoon?: {
    activities?: ActivityInput[];
    meal?: RestaurantInput;
  };
  evening?: {
    activities?: ActivityInput[];
    meal?: RestaurantInput;
  };
  estimatedCost?: number;
  currency?: string;
}

export interface BuildSpecInput {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  budget?: string;
  hotels: HotelInput[];
  activities: ActivityInput[];
  restaurants: RestaurantInput[];
  days: ItineraryDayInput[];
  topHotel?: HotelInput;
  totalEstimatedCost?: number;
  currency?: string;
  summary?: string;
}

export interface JsonRenderComponent {
  type: string;
  props: Record<string, unknown>;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ─── 1. Summary Blocks ────────────────────────────────────────────────────────

export interface BuildSummaryInput {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  budget?: string;
}

/**
 * Build the TripSummary block — called immediately when stream starts.
 */
export function buildSummaryBlocks(
  input: BuildSummaryInput,
): JsonRenderComponent[] {
  const dateRange = `${formatDate(input.startDate)} - ${formatDate(input.endDate)}`;

  return [
    {
      type: "TripSummary",
      props: {
        destination: input.destination,
        dates: dateRange,
        travelers: input.travelers,
        budget: input.budget,
      },
    },
  ];
}

// ─── 2. Hotel Blocks ──────────────────────────────────────────────────────────

export interface BuildHotelInput {
  topHotel?: HotelInput;
  otherHotels?: HotelInput[];
}

/**
 * Build hotel section blocks — called when hotels agent finishes.
 */
export function buildHotelBlocks(
  input: BuildHotelInput,
): JsonRenderComponent[] {
  const components: JsonRenderComponent[] = [];
  const { topHotel, otherHotels = [] } = input;

  if (topHotel) {
    components.push({
      type: "Section",
      props: { title: "Your Stay" },
    });

    components.push({
      type: "HotelCard",
      props: {
        name: topHotel.name,
        rating: topHotel.rating,
        starRating: topHotel.starRating,
        pricePerNight: topHotel.pricePerNight,
        currency: topHotel.currency,
        image: topHotel.images?.[0],
        bookingUrl: topHotel.affiliateUrl,
        amenities: topHotel.amenities || [],
        description: topHotel.description,
        reviewCount: topHotel.reviewCount,
        featured: true,
      },
    });

    if (topHotel.affiliateUrl) {
      components.push({
        type: "BookingButton",
        props: {
          label: `Book ${topHotel.name}`,
          url: topHotel.affiliateUrl,
          provider: "Booking.com",
          price: topHotel.pricePerNight,
          currency: topHotel.currency,
        },
      });
    }
  }

  const filteredOtherHotels = otherHotels.filter((h) => h.id !== topHotel?.id);
  if (filteredOtherHotels.length > 0) {
    components.push({
      type: "Section",
      props: { title: "Other Hotel Options" },
    });

    const topThree = filteredOtherHotels.slice(0, 3);
    for (const hotel of topThree) {
      components.push({
        type: "HotelCard",
        props: {
          name: hotel.name,
          rating: hotel.rating,
          pricePerNight: hotel.pricePerNight,
          currency: hotel.currency,
          image: hotel.images?.[0],
          bookingUrl: hotel.affiliateUrl,
          amenities: hotel.amenities || [],
          description: hotel.description,
          reviewCount: hotel.reviewCount,
        },
      });

      if (hotel.affiliateUrl) {
        components.push({
          type: "BookingButton",
          props: {
            label: `Book ${hotel.name}`,
            url: hotel.affiliateUrl,
            provider: "Booking.com",
            price: hotel.pricePerNight,
            currency: hotel.currency,
          },
        });
      }
    }
  }

  return components;
}

// ─── 3. Itinerary Blocks ──────────────────────────────────────────────────────

/**
 * Build itinerary day blocks — called when aggregator finishes.
 */
export function buildItineraryBlocks(
  days: ItineraryDayInput[],
): JsonRenderComponent[] {
  days = filterViatorDisplay(days);
  const components: JsonRenderComponent[] = [];

  if (days.length === 0) return components;

  components.push({
    type: "Section",
    props: { title: "Your Itinerary" },
  });

  for (const day of days) {
    components.push({
      type: "ItineraryDay",
      props: {
        dayNumber: day.dayNumber,
        date: day.date,
        title: day.title,
      },
    });

    const timelineItems: Array<{ time: string; title: string; type: string }> =
      [];

    if (day.morning?.meal) {
      timelineItems.push({
        time: "08:00",
        title: day.morning.meal.name,
        type: "restaurant",
      });
    }
    day.morning?.activities?.forEach((a, i) => {
      timelineItems.push({
        time: `${9 + i}:00`,
        title: a.name,
        type: "activity",
      });
    });

    if (day.afternoon?.meal) {
      timelineItems.push({
        time: "12:30",
        title: day.afternoon.meal.name,
        type: "restaurant",
      });
    }
    day.afternoon?.activities?.forEach((a, i) => {
      timelineItems.push({
        time: `${14 + i}:00`,
        title: a.name,
        type: "activity",
      });
    });

    day.evening?.activities?.forEach((a, i) => {
      timelineItems.push({
        time: `${18 + i}:00`,
        title: a.name,
        type: "activity",
      });
    });
    if (day.evening?.meal) {
      timelineItems.push({
        time: "19:30",
        title: day.evening.meal.name,
        type: "restaurant",
      });
    }

    if (timelineItems.length > 0) {
      components.push({
        type: "DayTimeline",
        props: { items: timelineItems },
      });
    }

    const addActivityCard = (activity: ActivityInput, time: string) => {
      components.push({
        type: "ActivityCard",
        props: {
          name: activity.name,
          description:
            activity.description ||
            (isViatorContent(activity) ? "" : `Enjoy ${activity.name}`),
          duration: activity.duration
            ? `${activity.duration} hours`
            : "2 hours",
          price: activity.price,
          currency: activity.currency,
          priceStatus: activity.priceStatus,
          rating: activity.rating,
          reviewCount: activity.reviewCount,
          image: activity.images?.[0],
          bookingUrl: activity.affiliateUrl,
          time,
          location:
            activity.location?.name ||
            activity.location?.neighborhood ||
            activity.location?.city,
          category: activity.category,
        },
      });
    };

    const addRestaurantCard = (restaurant: RestaurantInput, time: string) => {
      const priceLevelNum =
        typeof restaurant.priceLevel === "number"
          ? restaurant.priceLevel
          : restaurant.priceLevel?.length || 2;

      components.push({
        type: "RestaurantCard",
        props: {
          name: restaurant.name,
          cuisine: restaurant.cuisine || "Local",
          priceLevel:
            restaurant.priceStatus === "unknown" || !restaurant.priceLevel
              ? undefined
              : Math.min(4, Math.max(1, priceLevelNum)),
          priceStatus: restaurant.priceStatus,
          rating: restaurant.rating,
          reviewCount: restaurant.reviewCount,
          image: restaurant.images?.[0],
          reservationUrl: restaurant.reservationUrl,
          description: restaurant.description,
          time,
        },
      });
    };

    if (day.morning?.meal) addRestaurantCard(day.morning.meal, "08:00");
    day.morning?.activities?.forEach((a, i) =>
      addActivityCard(a, `${9 + i}:00`),
    );

    if (day.afternoon?.meal) addRestaurantCard(day.afternoon.meal, "12:30");
    day.afternoon?.activities?.forEach((a, i) =>
      addActivityCard(a, `${14 + i}:00`),
    );

    day.evening?.activities?.forEach((a, i) =>
      addActivityCard(a, `${18 + i}:00`),
    );
    if (day.evening?.meal) addRestaurantCard(day.evening.meal, "19:30");
  }

  return components;
}

// ─── 4. Budget Blocks ─────────────────────────────────────────────────────────

export interface BuildBudgetInput {
  topHotel?: HotelInput;
  activities?: ActivityInput[];
  totalEstimatedCost: number;
  nights: number;
  currency?: string;
}

/**
 * Build budget summary blocks — called alongside itinerary.
 */
export function buildBudgetBlocks(
  input: BuildBudgetInput,
): JsonRenderComponent[] {
  const components: JsonRenderComponent[] = [];
  const {
    topHotel,
    activities = [],
    totalEstimatedCost,
    nights,
    currency,
  } = input;
  const total = readPrice(totalEstimatedCost, currency);
  if (!total || total.amount <= 0) return components;

  components.push({ type: "Section", props: { title: "Budget Summary" } });
  // Show each known cost in its own currency. Never infer dining from a remainder
  // or combine currencies without an explicit conversion source.
  const hotel = readPrice(topHotel?.pricePerNight, topHotel?.currency);
  if (hotel && Number.isInteger(nights) && nights > 0) {
    const accommodation = hotel.amount * nights;
    if (Number.isFinite(accommodation))
      components.push({
        type: "PriceTag",
        props: {
          amount: accommodation,
          currency: hotel.currency,
          period: `accommodation (${nights} night${nights !== 1 ? "s" : ""})`,
        },
      });
  }
  const costs = activities.map((a) =>
    a.priceStatus === "unknown" ? undefined : readPrice(a.price, a.currency),
  );
  if (
    costs.length > 0 &&
    costs.every((p) => p && p.currency === costs[0]?.currency)
  ) {
    const amount = costs.reduce((sum, p) => sum + p!.amount, 0);
    if (Number.isFinite(amount))
      components.push({
        type: "PriceTag",
        props: {
          amount,
          currency: costs[0]!.currency,
          period: "activities & tours",
        },
      });
  }
  const currenciesMatch =
    (!topHotel || hotel?.currency === total.currency) &&
    costs.every((p) => p?.currency === total.currency);
  components.push({
    type: "Text",
    props: {
      content: currenciesMatch
        ? `Estimated total: ${formatPrice(total.amount, total.currency)} for ${nights} night${nights !== 1 ? "s" : ""}. Planning estimate only; some prices may be unknown. Confirm prices before purchase.`
        : "Total unavailable: some prices or currencies are unknown or differ. Confirm prices before purchase.",
      variant: "caption",
    },
  });

  return components;
}

// ─── Full Spec Builder (convenience wrapper) ──────────────────────────────────

/**
 * Build a complete json-render spec (flat array of components) from search results.
 * This is a convenience wrapper that calls all section builders.
 */
export function buildJsonRenderSpec(
  input: BuildSpecInput,
): JsonRenderComponent[] {
  input = filterViatorDisplay(input);
  const nights = Math.ceil(
    (new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  const summaryBlocks = buildSummaryBlocks({
    destination: input.destination,
    startDate: input.startDate,
    endDate: input.endDate,
    travelers: input.travelers,
    budget: input.budget,
  });

  const hotelBlocks = buildHotelBlocks({
    topHotel: input.topHotel,
    otherHotels: input.hotels,
  });

  const itineraryBlocks = buildItineraryBlocks(input.days);

  const budgetBlocks = buildBudgetBlocks({
    topHotel: input.topHotel,
    activities: input.activities,
    totalEstimatedCost: input.totalEstimatedCost || 0,
    nights,
    currency: input.currency,
  });

  return [
    ...summaryBlocks,
    ...hotelBlocks,
    ...itineraryBlocks,
    ...budgetBlocks,
  ].map((component) => ({
    ...component,
    contentPolicyVersion: 1,
    containsViatorContent: containsViatorContent(input),
  }));
}
