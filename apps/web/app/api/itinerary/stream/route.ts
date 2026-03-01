/**
 * POST /api/itinerary/stream
 * Streaming itinerary generation using json-render
 *
 * Accepts trip parameters and streams back json-render JSON
 * that can be progressively rendered by the mobile app
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { planTrip, type TravelPlanResult } from "@/lib/agents/travel-agent";

export const maxDuration = 60;

const StreamRequestSchema = z.object({
  destination: z.string().min(1).max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  travelers: z.number().int().min(1).max(50).default(1),
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

          // Run the travel planning agent
          const result = await planTrip({
            destination: params.destination,
            startDate: params.startDate,
            endDate: params.startDate,
            travelers: params.travelers,
            vibes: params.vibes || ["adventure"],
            budget: params.budget || "moderate",
          });

          // Convert the agent result to json-render spec
          const spec = convertToJsonRenderSpec(result, params);

          // Stream the spec
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ status: "generating", message: "Building UI..." })}\n\n`,
            ),
          );

          // Send the final spec
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ status: "complete", spec })}\n\n`,
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
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[Itinerary Stream] Request error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Request failed" },
      { status: 500 },
    );
  }
}

/**
 * Convert travel agent result to json-render spec
 */

interface JsonRenderElement {
  type: string;
  props: Record<string, unknown>;
  children: string[];
}

interface AgentHotel {
  name: string;
  rating?: number;
  pricePerNight?: number;
  image?: string;
  affiliateUrl?: string;
}

interface AgentActivity {
  name: string;
  description?: string;
  duration?: number;
  price?: number;
  rating?: number;
  affiliateUrl?: string;
}

interface AgentMeal {
  name: string;
  cuisine?: string;
  priceLevel?: string;
  rating?: number;
  reservationUrl?: string;
}

interface AgentDay {
  dayNumber: number;
  date: string;
  title: string;
  morning?: { activities?: AgentActivity[] };
  afternoon?: { activities?: AgentActivity[]; meal?: AgentMeal };
  evening?: { activities?: AgentActivity[] };
}

interface StreamRequestParams {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  vibes?: string[];
  budget?: string;
}

function convertToJsonRenderSpec(
  result: TravelPlanResult,
  params: StreamRequestParams,
) {
  const elements: Record<string, JsonRenderElement> = {};
  const children: string[] = [];

  // Overview Section
  const overviewId = "section-overview";
  const overviewTextId = "text-overview";

  elements[overviewTextId] = {
    type: "Text",
    props: {
      content: `Welcome to ${params.destination}! Here's your personalized ${Math.ceil(
        (new Date(params.endDate).getTime() -
          new Date(params.startDate).getTime()) /
          (1000 * 60 * 60 * 24),
      )}-day itinerary featuring the best ${params.vibes?.join(", ") || "experiences"} the destination has to offer.`,
    },
    children: [],
  };

  elements[overviewId] = {
    type: "Section",
    props: { title: "Trip Overview" },
    children: [overviewTextId],
  };
  children.push(overviewId);

  // Hotels Section
  if (result.hotels && result.hotels.length > 0) {
    const hotelsId = "section-hotels";
    const hotelCardIds = (result.hotels as AgentHotel[])
      .slice(0, 3)
      .map((hotel: AgentHotel, idx: number) => {
        const id = `hotel-${idx}`;
        elements[id] = {
          type: "HotelCard",
          props: {
            name: hotel.name,
            rating: hotel.rating || 4.5,
            price: hotel.pricePerNight || 150,
            image: hotel.image,
            bookingUrl: hotel.affiliateUrl,
          },
          children: [],
        };
        return id;
      });

    elements[hotelsId] = {
      type: "Section",
      props: { title: "Recommended Hotels" },
      children: hotelCardIds,
    };
    children.push(hotelsId);
  }

  // Daily Itinerary Section
  if (result.itinerary && result.itinerary.days) {
    const itineraryId = "section-itinerary";
    const dayIds = (result.itinerary.days as AgentDay[]).map(
      (day: AgentDay, dayIdx: number) => {
        const dayId = `day-${dayIdx}`;
        const dayChildren: string[] = [];

        // Morning activities
        day.morning?.activities?.forEach(
          (activity: AgentActivity, idx: number) => {
            const actId = `day-${dayIdx}-morning-act-${idx}`;
            elements[actId] = {
              type: "ActivityCard",
              props: {
                name: activity.name,
                description: activity.description || `Enjoy ${activity.name}`,
                duration: activity.duration || 2,
                price: activity.price,
                rating: activity.rating,
                bookingUrl: activity.affiliateUrl,
              },
              children: [],
            };
            dayChildren.push(actId);
          },
        );

        // Afternoon activities
        day.afternoon?.activities?.forEach(
          (activity: AgentActivity, idx: number) => {
            const actId = `day-${dayIdx}-afternoon-act-${idx}`;
            elements[actId] = {
              type: "ActivityCard",
              props: {
                name: activity.name,
                description: activity.description || `Explore ${activity.name}`,
                duration: activity.duration || 3,
                price: activity.price,
                rating: activity.rating,
                bookingUrl: activity.affiliateUrl,
              },
              children: [],
            };
            dayChildren.push(actId);
          },
        );

        // Dining
        if (day.afternoon?.meal) {
          const mealId = `day-${dayIdx}-meal`;
          elements[mealId] = {
            type: "RestaurantCard",
            props: {
              name: day.afternoon.meal.name,
              cuisine: day.afternoon.meal.cuisine || "Local",
              priceLevel: day.afternoon.meal.priceLevel || "$$",
              rating: day.afternoon.meal.rating,
              reservationUrl: day.afternoon.meal.reservationUrl,
            },
            children: [],
          };
          dayChildren.push(mealId);
        }

        elements[dayId] = {
          type: "ItineraryDay",
          props: {
            dayNumber: day.dayNumber,
            date: day.date,
            title: day.title,
          },
          children: dayChildren,
        };

        return dayId;
      },
    );

    elements[itineraryId] = {
      type: "Section",
      props: { title: "Your Itinerary" },
      children: dayIds,
    };
    children.push(itineraryId);
  }

  // Budget Section
  const budgetId = "section-budget";
  const budgetTextId = "text-budget";
  const totalCost = result.itinerary?.totalEstimatedCost || 1000;

  elements[budgetTextId] = {
    type: "Text",
    props: {
      content: `Estimated total cost for this trip: $${totalCost} ${result.itinerary?.currency || "USD"}. This includes accommodation, activities, and dining.`,
    },
    children: [],
  };

  elements[budgetId] = {
    type: "Section",
    props: { title: "Budget Summary" },
    children: [budgetTextId],
  };
  children.push(budgetId);

  return {
    root: "root",
    elements: {
      root: {
        type: "Section",
        props: { title: params.destination },
        children,
      },
      ...elements,
    },
  };
}
