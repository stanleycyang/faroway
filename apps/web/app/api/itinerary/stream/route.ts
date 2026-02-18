/**
 * POST /api/itinerary/stream
 * Streaming itinerary generation using json-render
 * 
 * Accepts trip parameters and streams back json-render JSON
 * that can be progressively rendered by the mobile app
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { catalogPrompt } from '@/lib/json-render/catalog-server';
import { planTrip } from '@/lib/agents/travel-agent';


export const maxDuration = 60;

const StreamRequestSchema = z.object({
  destination: z.string(),
  startDate: z.string(), // YYYY-MM-DD
  endDate: z.string(),   // YYYY-MM-DD
  travelers: z.number().min(1).default(1),
  vibes: z.array(z.string()).optional(),
  budget: z.enum(['budget', 'moderate', 'luxury']).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parseResult = StreamRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const params = parseResult.data;

    // Generate the system prompt for the AI that includes the catalog
    const systemPrompt = `${catalogPrompt}

You are generating a travel itinerary UI using json-render components.

IMPORTANT: Your output must be valid JSON that follows the json-render spec format:
{
  "root": "element-id",
  "elements": {
    "element-id": {
      "type": "ComponentName",
      "props": { ... },
      "children": ["child-id", ...]
    }
  }
}

Use the TripGenie catalog components to create a beautiful, informative itinerary:
- Use Section for different parts (Overview, Hotels, Daily Itinerary, etc.)
- Use ItineraryDay for each day
- Use HotelCard for accommodation options
- Use ActivityCard for things to do
- Use RestaurantCard for dining recommendations
- Use Text for descriptions and tips
- Include PriceTag and RatingDisplay where appropriate

Create a complete itinerary with:
1. Overview section with destination intro
2. Hotel recommendations section
3. Day-by-day itinerary with activities and meals
4. Budget summary section

Make sure all element IDs are unique and properly referenced in the children arrays.`;

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Send initial status
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ status: 'started', message: 'Planning your trip...' })}\n\n`)
          );

          // Run the travel planning agent
          const result = await planTrip({
            destination: params.destination,
            startDate: params.startDate,
            endDate: params.startDate,
            travelers: params.travelers,
            vibes: params.vibes || ['adventure'],
            budget: params.budget || 'moderate',
          });

          // Convert the agent result to json-render spec
          const spec = convertToJsonRenderSpec(result, params);

          // Stream the spec
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ status: 'generating', message: 'Building UI...' })}\n\n`)
          );

          // Send the final spec
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ status: 'complete', spec })}\n\n`)
          );

          controller.close();
        } catch (error) {
          console.error('[Itinerary Stream] Error:', error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ 
                status: 'error', 
                message: error instanceof Error ? error.message : 'Generation failed' 
              })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[Itinerary Stream] Request error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Request failed' },
      { status: 500 }
    );
  }
}

/**
 * Convert travel agent result to json-render spec
 */
function convertToJsonRenderSpec(result: any, params: any) {
  const elements: Record<string, any> = {};
  const children: string[] = [];

  // Overview Section
  const overviewId = 'section-overview';
  const overviewTextId = 'text-overview';
  
  elements[overviewTextId] = {
    type: 'Text',
    props: {
      content: `Welcome to ${params.destination}! Here's your personalized ${Math.ceil(
        (new Date(params.endDate).getTime() - new Date(params.startDate).getTime()) / (1000 * 60 * 60 * 24)
      )}-day itinerary featuring the best ${params.vibes?.join(', ') || 'experiences'} the destination has to offer.`
    },
    children: [],
  };

  elements[overviewId] = {
    type: 'Section',
    props: { title: 'Trip Overview' },
    children: [overviewTextId],
  };
  children.push(overviewId);

  // Hotels Section
  if (result.hotels && result.hotels.length > 0) {
    const hotelsId = 'section-hotels';
    const hotelCardIds = result.hotels.slice(0, 3).map((hotel: any, idx: number) => {
      const id = `hotel-${idx}`;
      elements[id] = {
        type: 'HotelCard',
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
      type: 'Section',
      props: { title: 'Recommended Hotels' },
      children: hotelCardIds,
    };
    children.push(hotelsId);
  }

  // Daily Itinerary Section
  if (result.itinerary && result.itinerary.days) {
    const itineraryId = 'section-itinerary';
    const dayIds = result.itinerary.days.map((day: any, dayIdx: number) => {
      const dayId = `day-${dayIdx}`;
      const dayChildren: string[] = [];

      // Morning activities
      day.morning?.activities?.forEach((activity: any, idx: number) => {
        const actId = `day-${dayIdx}-morning-act-${idx}`;
        elements[actId] = {
          type: 'ActivityCard',
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
      });

      // Afternoon activities
      day.afternoon?.activities?.forEach((activity: any, idx: number) => {
        const actId = `day-${dayIdx}-afternoon-act-${idx}`;
        elements[actId] = {
          type: 'ActivityCard',
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
      });

      // Dining
      if (day.afternoon?.meal) {
        const mealId = `day-${dayIdx}-meal`;
        elements[mealId] = {
          type: 'RestaurantCard',
          props: {
            name: day.afternoon.meal.name,
            cuisine: day.afternoon.meal.cuisine || 'Local',
            priceLevel: day.afternoon.meal.priceLevel || '$$',
            rating: day.afternoon.meal.rating,
            reservationUrl: day.afternoon.meal.reservationUrl,
          },
          children: [],
        };
        dayChildren.push(mealId);
      }

      elements[dayId] = {
        type: 'ItineraryDay',
        props: {
          dayNumber: day.dayNumber,
          date: day.date,
          title: day.title,
        },
        children: dayChildren,
      };

      return dayId;
    });

    elements[itineraryId] = {
      type: 'Section',
      props: { title: 'Your Itinerary' },
      children: dayIds,
    };
    children.push(itineraryId);
  }

  // Budget Section
  const budgetId = 'section-budget';
  const budgetTextId = 'text-budget';
  const totalCost = result.itinerary?.totalEstimatedCost || 1000;

  elements[budgetTextId] = {
    type: 'Text',
    props: {
      content: `Estimated total cost for this trip: $${totalCost} ${result.itinerary?.currency || 'USD'}. This includes accommodation, activities, and dining.`
    },
    children: [],
  };

  elements[budgetId] = {
    type: 'Section',
    props: { title: 'Budget Summary' },
    children: [budgetTextId],
  };
  children.push(budgetId);

  return {
    root: 'root',
    elements: {
      root: {
        type: 'Section',
        props: { title: params.destination },
        children,
      },
      ...elements,
    },
  };
}
