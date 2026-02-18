/**
 * Aggregator Agent
 * Combines results from all agents into a cohesive itinerary
 */

import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import {
  SearchPlan,
  HotelResult,
  ActivityResult,
  DiningResult,
  SuggestedDay,
} from '../types';

const aiGateway = createOpenAI({
  apiKey: process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_AI_GATEWAY_API_KEY,
  baseURL: 'https://ai-gateway.vercel.sh/v1',
});

const MODEL = 'anthropic/claude-sonnet-4-20250514';

const SuggestedDaySchema = z.object({
  dayNumber: z.number(),
  date: z.string(),
  title: z.string(),
  summary: z.string(),
  hotelId: z.string().optional(),
  morning: z.object({
    activityIds: z.array(z.string()),
    mealId: z.string().optional(),
  }),
  afternoon: z.object({
    activityIds: z.array(z.string()),
    mealId: z.string().optional(),
  }),
  evening: z.object({
    activityIds: z.array(z.string()),
    mealId: z.string().optional(),
  }),
  estimatedCost: z.number(),
  currency: z.string().default('USD'),
  tips: z.array(z.string()),
});

const ItinerarySchema = z.object({
  days: z.array(SuggestedDaySchema),
  topHotelId: z.string(),
});

const SYSTEM_PROMPT = `You are a travel itinerary planner. Your job is to take search results (hotels, activities, dining) and organize them into a coherent day-by-day itinerary.

Consider:
1. Geographic proximity - group nearby activities together
2. Time of day - morning activities before afternoon ones
3. Meal timing - breakfast spots for morning, dinner for evening
4. Pacing - don't overload each day
5. Vibe scores - prioritize higher-scoring options
6. Practical logistics - museum hours, booking requirements

Output should reference items by their IDs and organize them into a sensible flow.`;

export async function runAggregatorAgent(
  plan: SearchPlan,
  hotels: HotelResult[],
  activities: ActivityResult[],
  dining: DiningResult[]
): Promise<{ days: SuggestedDay[]; topHotel: HotelResult | null }> {
  const { destination, dates } = plan;
  
  // Calculate number of days
  const startDate = new Date(dates.start);
  const endDate = new Date(dates.end);
  const numDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Format data for the AI
  const hotelSummary = hotels.slice(0, 5).map(h => ({
    id: h.id,
    name: h.name,
    price: h.pricePerNight,
    rating: h.userRating,
    vibeScore: h.vibeScore,
    neighborhood: h.location.neighborhood || h.location.name,
  }));

  const activitySummary = activities.slice(0, 20).map(a => ({
    id: a.id,
    name: a.name,
    category: a.category,
    duration: a.duration,
    price: a.price,
    bestTime: a.bestTimeOfDay,
    vibeScore: a.vibeScore,
    bookingRequired: a.bookingRequired,
  }));

  const diningSummary = dining.slice(0, 15).map(d => ({
    id: d.id,
    name: d.name,
    cuisine: d.cuisineTypes.join(', '),
    priceLevel: d.priceLevel,
    mealTypes: d.mealTypes,
    vibeScore: d.vibeScore,
  }));

  const prompt = `Create a ${numDays}-day itinerary for ${destination} using these search results.

**Trip Dates:** ${dates.start} to ${dates.end}
**Vibes:** ${plan.vibeInterpretation.vibes.join(', ')}
**Pace:** ${plan.activityCriteria.pacePreference}

**Available Hotels (pick the best match):**
${JSON.stringify(hotelSummary, null, 2)}

**Available Activities (assign to days by best time):**
${JSON.stringify(activitySummary, null, 2)}

**Available Dining (assign breakfast/lunch/dinner):**
${JSON.stringify(diningSummary, null, 2)}

Create an itinerary that:
1. Picks the best hotel based on vibeScore and value
2. Spreads activities across days (2-4 per day based on pace)
3. Assigns appropriate meals to each time slot
4. Gives each day a fun title and summary
5. Estimates daily cost
6. Includes helpful tips

Reference items by their IDs. Morning activities should be morning/any time, afternoon activities in afternoon, etc.`;

  try {
    const { object: result } = await generateObject({
      model: aiGateway(MODEL),
      system: SYSTEM_PROMPT,
      prompt,
      schema: ItinerarySchema,
    });

    // Map the IDs back to full objects
    const topHotel = hotels.find(h => h.id === result.topHotelId) || hotels[0] || null;
    
    const days: SuggestedDay[] = result.days.map(day => {
      const morningActivities = day.morning.activityIds
        .map(id => activities.find(a => a.id === id))
        .filter((a): a is ActivityResult => a !== undefined);
      
      const afternoonActivities = day.afternoon.activityIds
        .map(id => activities.find(a => a.id === id))
        .filter((a): a is ActivityResult => a !== undefined);
      
      const eveningActivities = day.evening.activityIds
        .map(id => activities.find(a => a.id === id))
        .filter((a): a is ActivityResult => a !== undefined);

      const morningMeal = day.morning.mealId 
        ? dining.find(d => d.id === day.morning.mealId) 
        : dining.find(d => d.mealTypes.includes('breakfast'));
      
      const afternoonMeal = day.afternoon.mealId
        ? dining.find(d => d.id === day.afternoon.mealId)
        : dining.find(d => d.mealTypes.includes('lunch'));
      
      const eveningMeal = day.evening.mealId
        ? dining.find(d => d.id === day.evening.mealId)
        : dining.find(d => d.mealTypes.includes('dinner'));

      return {
        dayNumber: day.dayNumber,
        date: day.date,
        title: day.title,
        summary: day.summary,
        hotel: topHotel || undefined,
        morning: {
          activities: morningActivities,
          meal: morningMeal,
        },
        afternoon: {
          activities: afternoonActivities,
          meal: afternoonMeal,
        },
        evening: {
          activities: eveningActivities,
          meal: eveningMeal,
        },
        estimatedCost: day.estimatedCost,
        currency: day.currency,
        tips: day.tips,
      };
    });

    return { days, topHotel };
  } catch (error) {
    console.error('[Aggregator Agent] Error:', error);
    
    // Return a basic itinerary structure if AI fails
    return createFallbackItinerary(plan, hotels, activities, dining);
  }
}

/**
 * Create a simple fallback itinerary when AI generation fails
 */
function createFallbackItinerary(
  plan: SearchPlan,
  hotels: HotelResult[],
  activities: ActivityResult[],
  dining: DiningResult[]
): { days: SuggestedDay[]; topHotel: HotelResult | null } {
  const { dates } = plan;
  const startDate = new Date(dates.start);
  const numDays = dates.nights + 1;
  
  const topHotel = hotels[0] || null;
  const days: SuggestedDay[] = [];

  // Sort activities by best time
  const morningActivities = activities.filter(a => a.bestTimeOfDay === 'morning' || a.bestTimeOfDay === 'any');
  const afternoonActivities = activities.filter(a => a.bestTimeOfDay === 'afternoon' || a.bestTimeOfDay === 'any');
  const eveningActivities = activities.filter(a => a.bestTimeOfDay === 'evening' || a.bestTimeOfDay === 'any');

  // Sort dining by meal type
  const breakfastSpots = dining.filter(d => d.mealTypes.includes('breakfast'));
  const lunchSpots = dining.filter(d => d.mealTypes.includes('lunch'));
  const dinnerSpots = dining.filter(d => d.mealTypes.includes('dinner'));

  for (let i = 0; i < numDays; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    days.push({
      dayNumber: i + 1,
      date: date.toISOString().split('T')[0],
      title: `Day ${i + 1} in ${plan.destination}`,
      summary: `Explore ${plan.destination} with a mix of activities and dining.`,
      hotel: topHotel || undefined,
      morning: {
        activities: morningActivities.slice(i * 2, i * 2 + 2),
        meal: breakfastSpots[i % breakfastSpots.length],
      },
      afternoon: {
        activities: afternoonActivities.slice(i * 2, i * 2 + 2),
        meal: lunchSpots[i % lunchSpots.length],
      },
      evening: {
        activities: eveningActivities.slice(i, i + 1),
        meal: dinnerSpots[i % dinnerSpots.length],
      },
      estimatedCost: 200,
      currency: 'USD',
      tips: ['Book popular attractions in advance', 'Check opening hours before visiting'],
    });
  }

  return { days, topHotel };
}
