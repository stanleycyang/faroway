/**
 * POST /api/itinerary/stream
 * Streaming itinerary generation using json-render
 *
 * Accepts trip parameters and streams back json-render JSON
 * that can be progressively rendered by the mobile app
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { executeTravelSearch } from "@/lib/search/workflow";
import { mapSearchResultsToItinerary } from "@/lib/search/bridge";
import {
  buildJsonRenderSpec,
  buildSummaryBlocks,
  type ActivityInput,
  type BuildSpecInput,
  type HotelInput,
  type ItineraryDayInput,
  type RestaurantInput,
} from "@/lib/json-render/build-spec";
import type {
  ActivityResult,
  DiningResult,
  HotelResult,
  ItineraryActivity,
  Restaurant,
  SearchResults,
  TripDay,
} from "@faroway/types";

export const maxDuration = 60;

const StreamRequestSchema = z.object({
  destination: z.string().min(1).max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  travelers: z.number().int().min(1).max(50).default(1),
  travelerType: z
    .enum(["solo", "couple", "family", "friends", "business"])
    .optional(),
  originCity: z.string().max(200).optional(),
  originAirport: z.string().max(10).optional(),
  vibes: z.array(z.string().max(50)).max(10).optional(),
  budget: z.enum(["budget", "moderate", "luxury"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = StreamRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const params = parseResult.data;

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial status
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ status: "started", message: "Planning your trip..." })}\n\n`,
            ),
          );
          controller.enqueue(
            encoder.encode(
              `event: spec-block\ndata: ${JSON.stringify({
                blocks: buildSummaryBlocks({
                  destination: params.destination,
                  startDate: params.startDate,
                  endDate: params.endDate,
                  travelers: params.travelers,
                  budget: params.budget,
                }),
              })}\n\n`,
            ),
          );

          if (request.signal.aborted) {
            controller.close();
            return;
          }

          const result = await executeTravelSearch(
            `stream_${crypto.randomUUID()}`,
            {
              destination: params.destination,
              startDate: params.startDate,
              endDate: params.endDate,
              travelers: params.travelers,
              travelerType: params.travelerType,
              originCity: params.originCity,
              originAirport: params.originAirport,
              vibes: params.vibes || ["adventure"],
              budget: params.budget || "moderate",
            },
            {
              onProgress: async (stage, agentStatus) => {
                if (request.signal.aborted) return;
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({
                      status: "progress",
                      stage,
                      agentStatus,
                    })}\n\n`,
                  ),
                );
              },
            },
          );

          if (result.status !== "completed" || !result.results) {
            throw new Error(result.error || "Generation failed");
          }

          if (request.signal.aborted) {
            controller.close();
            return;
          }

          const spec = buildStreamSpec(result.results, params);

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                status: "generating",
                message: "Building UI...",
              })}\n\n`,
            ),
          );

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                status: "complete",
                spec,
              })}\n\n`,
            ),
          );

          controller.close();
        } catch (error) {
          console.error("[Itinerary Stream] Error:", error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                status: "error",
                message:
                  error instanceof Error ? error.message : "Generation failed",
              })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    console.error("[Itinerary Stream] Request error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 500 },
    );
  }
}

interface StreamRequestParams {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  travelerType?: "solo" | "couple" | "family" | "friends" | "business";
  originCity?: string;
  originAirport?: string;
  vibes?: string[];
  budget?: string;
}

function buildStreamSpec(results: SearchResults, params: StreamRequestParams) {
  const mapped = mapSearchResultsToItinerary(
    results,
    results.itinerary?.[0]?.hotel || results.hotels[0] || null,
  );

  const specInput: BuildSpecInput = {
    destination: params.destination,
    startDate: params.startDate,
    endDate: params.endDate,
    travelers: params.travelers,
    budget: params.budget,
    hotels: mapped.hotels.map(mapHotel),
    activities: mapped.activities.map(mapActivity),
    restaurants: mapped.dining.map(mapDining),
    days: mapped.days.map(mapDay),
    topHotel: mapped.topHotel ? mapHotel(mapped.topHotel) : undefined,
    totalEstimatedCost: mapped.totalEstimatedCost,
    currency: mapped.currency,
    summary: `Your personalized ${mapped.days.length}-day trip to ${params.destination}`,
  };

  return buildJsonRenderSpec(specInput);
}

function mapHotel(hotel: HotelResult): HotelInput {
  return {
    id: hotel.id,
    name: hotel.name,
    rating: hotel.userRating,
    reviewCount: hotel.reviewCount,
    pricePerNight: hotel.pricePerNight,
    currency: hotel.currency,
    amenities: hotel.amenities,
    description: hotel.description,
    affiliateUrl: hotel.affiliateUrl,
    images: hotel.images,
    starRating: hotel.starRating,
  };
}

function mapActivity(activity: ActivityResult): ActivityInput {
  return {
    id: activity.id,
    name: activity.name,
    description: activity.description,
    duration: activity.duration,
    price: activity.price,
    currency: activity.currency,
    rating: activity.rating,
    reviewCount: activity.reviewCount,
    category: activity.category,
    affiliateUrl: activity.affiliateUrl,
    images: activity.images,
    location: {
      name: activity.location?.name,
      neighborhood: activity.location?.neighborhood,
      city: activity.location?.name,
    },
  };
}

function mapDining(restaurant: DiningResult): RestaurantInput {
  return {
    id: restaurant.id,
    name: restaurant.name,
    cuisine: restaurant.cuisineTypes.join(", "),
    priceLevel: restaurant.priceLevel,
    rating: restaurant.rating,
    reviewCount: restaurant.reviewCount,
    description: restaurant.description,
    reservationUrl: restaurant.reservationUrl,
    images: restaurant.images,
  };
}

function mapDay(day: TripDay): ItineraryDayInput {
  return {
    dayNumber: day.dayNumber,
    date: day.date,
    title: day.title,
    morning: {
      activities: day.morning.activities.map(mapItineraryActivity),
      meal: day.morning.meals[0]
        ? mapRestaurant(day.morning.meals[0])
        : undefined,
    },
    afternoon: {
      activities: day.afternoon.activities.map(mapItineraryActivity),
      meal: day.afternoon.meals[0]
        ? mapRestaurant(day.afternoon.meals[0])
        : undefined,
    },
    evening: {
      activities: day.evening.activities.map(mapItineraryActivity),
      meal: day.evening.meals[0]
        ? mapRestaurant(day.evening.meals[0])
        : undefined,
    },
    estimatedCost: day.totalEstimatedCost?.amount,
    currency: day.totalEstimatedCost?.currency,
  };
}

function mapItineraryActivity(activity: ItineraryActivity): ActivityInput {
  return {
    id: activity.id,
    name: activity.name,
    description: activity.description,
    duration: activity.duration / 60,
    price: activity.estimatedCost.amount,
    currency: activity.estimatedCost.currency,
    category: activity.category,
    affiliateUrl: activity.bookingInfo?.bookingUrl,
    location: { name: activity.location.name },
  };
}

function mapRestaurant(restaurant: Restaurant): RestaurantInput {
  return {
    id: restaurant.id,
    name: restaurant.name,
    cuisine: restaurant.cuisineType.join(", "),
    priceLevel: restaurant.priceLevel,
    description: restaurant.description,
    reservationUrl: restaurant.reservationInfo?.url,
  };
}
