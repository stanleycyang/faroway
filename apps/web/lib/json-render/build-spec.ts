import { formatPrice, readPrice } from "@faroway/constants";
import { readProposedVisitType, type ActivityResult } from "@faroway/types";
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
  affiliatePartner?: string;
  images?: string[];
  starRating?: number;
}

export interface ActivityInput {
  proposedVisitType?: ActivityResult["proposedVisitType"];
  priceStatus?: "unknown" | "estimate";
  id?: string;
  name: string;
  description?: string;
  duration?: number; // hours; saved minutes must pass through mappedDaysToSpec
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
  tips?: string[];
  dayNumber: number;
  date: string;
  title: string;
  morning?: {
    activities?: ActivityInput[];
    meal?: RestaurantInput;
    meals?: RestaurantInput[];
  };
  afternoon?: {
    activities?: ActivityInput[];
    meal?: RestaurantInput;
    meals?: RestaurantInput[];
  };
  evening?: {
    activities?: ActivityInput[];
    meal?: RestaurantInput;
    meals?: RestaurantInput[];
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
          provider: topHotel.affiliatePartner || "Hotel provider",
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
            provider: hotel.affiliatePartner || "Hotel provider",
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

  const mealsFor = (slot: ItineraryDayInput["morning"]) =>
    slot?.meals ?? (slot?.meal ? [slot.meal] : []);
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

    for (const tip of day.tips ?? []) {
      if (tip.trim())
        components.push({
          type: "Text",
          props: { content: tip, variant: "body" },
        });
    }

    for (const meal of mealsFor(day.morning)) {
      timelineItems.push({
        time: "Morning",
        title: meal.name,
        type: "restaurant",
      });
    }
    day.morning?.activities?.forEach((a) => {
      timelineItems.push({
        time: "Morning",
        title: a.name,
        type: "activity",
      });
    });

    for (const meal of mealsFor(day.afternoon)) {
      timelineItems.push({
        time: "Afternoon",
        title: meal.name,
        type: "restaurant",
      });
    }
    day.afternoon?.activities?.forEach((a) => {
      timelineItems.push({
        time: "Afternoon",
        title: a.name,
        type: "activity",
      });
    });

    day.evening?.activities?.forEach((a) => {
      timelineItems.push({
        time: "Evening",
        title: a.name,
        type: "activity",
      });
    });
    for (const meal of mealsFor(day.evening)) {
      timelineItems.push({
        time: "Evening",
        title: meal.name,
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
          id: activity.id,
          name: activity.name,
          proposedVisitType: readProposedVisitType(activity.proposedVisitType),
          description:
            activity.description ||
            (isViatorContent(activity) ? "" : `Enjoy ${activity.name}`),
          duration:
            typeof activity.duration === "number" &&
            Number.isFinite(activity.duration) &&
            activity.duration > 0
              ? `${activity.duration} hours`
              : "Duration not set",
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
          id: restaurant.id,
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

    for (const meal of mealsFor(day.morning))
      addRestaurantCard(meal, "Morning");
    day.morning?.activities?.forEach((a) => addActivityCard(a, "Morning"));

    for (const meal of mealsFor(day.afternoon))
      addRestaurantCard(meal, "Afternoon");
    day.afternoon?.activities?.forEach((a) => addActivityCard(a, "Afternoon"));

    day.evening?.activities?.forEach((a) => addActivityCard(a, "Evening"));
    for (const meal of mealsFor(day.evening))
      addRestaurantCard(meal, "Evening");
  }

  return components;
}

// ─── 4. Budget Blocks ─────────────────────────────────────────────────────────

export interface BuildBudgetInput {
  topHotel?: HotelInput;
  activities?: ActivityInput[];
  totalEstimatedCost?: number;
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
