/**
 * Aggregator Agent
 * Combines results from all agents into a cohesive itinerary
 */

import { generateObject, gateway as defaultGateway, createGateway } from 'ai';
import { z } from 'zod';
import {
  SearchPlan,
  HotelResult,
  ActivityResult,
  DiningResult,
  SuggestedDay,
} from '../types';

const aiGateway = process.env.AI_GATEWAY_API_KEY
  ? createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })
  : defaultGateway;

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

    return mapAggregatorResult(result, hotels, activities, dining);
  } catch (error) {
    console.error('[Aggregator Agent] generateObject error, attempting recovery...');

    // Try to recover from schema validation errors by parsing the raw response text.
    // Common failure: model returns `days` as a JSON string instead of an array,
    // with topHotelId sometimes embedded inside that string.
    const rawText = (error as any)?.text;
    if (rawText) {
      const recovered = recoverFromRawText(rawText, hotels, activities, dining);
      if (recovered) {
        console.log('[Aggregator Agent] Recovered from raw text successfully');
        return recovered;
      }
    }

    console.error('[Aggregator Agent] Recovery failed, using fallback itinerary');
    return createFallbackItinerary(plan, hotels, activities, dining);
  }
}

/**
 * Map a validated aggregator result (days + topHotelId) to SuggestedDay[] + topHotel.
 * Shared between the happy path and the recovery path.
 */
function mapAggregatorResult(
  result: { days: Array<z.infer<typeof SuggestedDaySchema>>; topHotelId?: string },
  hotels: HotelResult[],
  activities: ActivityResult[],
  dining: DiningResult[],
): { days: SuggestedDay[]; topHotel: HotelResult | null } {
  const topHotel = (result.topHotelId
    ? hotels.find(h => h.id === result.topHotelId)
    : undefined) || hotels[0] || null;

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
}

/**
 * Attempt to recover a usable result from the raw response text when
 * `generateObject` fails schema validation.
 *
 * Common failure modes:
 * 1. `days` comes back as a JSON *string* instead of an array
 * 2. `topHotelId` is embedded inside the `days` string
 * 3. The entire output is a single JSON string containing both
 */
function recoverFromRawText(
  rawText: string,
  hotels: HotelResult[],
  activities: ActivityResult[],
  dining: DiningResult[],
): { days: SuggestedDay[]; topHotel: HotelResult | null } | null {
  try {
    let parsed: any;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // rawText might not be valid JSON at all
      return null;
    }

    let daysArray: any[] | null = null;
    let topHotelId: string | undefined = parsed.topHotelId;

    if (Array.isArray(parsed.days)) {
      // Days is already an array — shouldn't normally get here, but handle it
      daysArray = parsed.days;
    } else if (typeof parsed.days === 'string') {
      const daysStr = parsed.days;

      // Find where the JSON array ends — the last ']' in the string
      const arrayEndIdx = daysStr.lastIndexOf(']');
      if (arrayEndIdx === -1) return null;

      const arrayStr = daysStr.substring(0, arrayEndIdx + 1).trim();
      const remaining = daysStr.substring(arrayEndIdx + 1);

      try {
        daysArray = JSON.parse(arrayStr);
      } catch {
        return null;
      }

      // Extract topHotelId from the remaining text if not already present
      if (!topHotelId) {
        const hotelMatch = remaining.match(/"topHotelId"\s*:\s*"([^"]+)"/);
        if (hotelMatch) {
          topHotelId = hotelMatch[1];
        }
      }
    }

    if (!Array.isArray(daysArray) || daysArray.length === 0) return null;

    // Validate each day has the minimum required fields and normalise shape
    const validDays = daysArray
      .filter((d: any) => d && typeof d.dayNumber === 'number' && d.morning && d.afternoon && d.evening)
      .map((d: any) => ({
        dayNumber: d.dayNumber,
        date: d.date || '',
        title: d.title || `Day ${d.dayNumber}`,
        summary: d.summary || '',
        hotelId: d.hotelId,
        morning: {
          activityIds: d.morning?.activityIds || [],
          mealId: d.morning?.mealId,
        },
        afternoon: {
          activityIds: d.afternoon?.activityIds || [],
          mealId: d.afternoon?.mealId,
        },
        evening: {
          activityIds: d.evening?.activityIds || [],
          mealId: d.evening?.mealId,
        },
        estimatedCost: d.estimatedCost || 0,
        currency: d.currency || 'USD',
        tips: Array.isArray(d.tips) ? d.tips : [],
      }));

    if (validDays.length === 0) return null;

    console.log(`[Aggregator Agent] Recovered ${validDays.length} days from raw text`);
    return mapAggregatorResult({ days: validDays, topHotelId }, hotels, activities, dining);
  } catch {
    return null;
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
