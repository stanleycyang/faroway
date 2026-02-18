/**
 * TripGenie AI Client
 * Uses Vercel AI SDK with AI Gateway for unified model access
 * 
 * Benefits:
 * - Single API key for all models
 * - Built-in caching & cost optimization
 * - Automatic retries & fallbacks
 * - Usage monitoring via Vercel dashboard
 * 
 * @see https://ai-sdk.dev
 * @see https://vercel.com/ai-gateway
 */

import { generateText, generateObject, streamText, StreamTextResult } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import {
  TripPreferences,
  GeneratedItinerary,
  Activity,
  Restaurant,
  StreamingProgress,
  AIGenerationError,
} from './types';
import {
  SYSTEM_PROMPT,
  buildItineraryPrompt,
  buildActivityRecommendationPrompt,
  buildRestaurantPrompt,
} from './prompts';

// Configure AI Gateway as OpenAI-compatible provider
const aiGateway = createOpenAI({
  apiKey: process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_AI_GATEWAY_API_KEY,
  baseURL: 'https://ai-gateway.vercel.sh/v1',
});

// Default model via AI Gateway (supports anthropic/, openai/, etc.)
const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-20250514';

// Zod schemas matching the TypeScript types
const LocationSchema = z.object({
  name: z.string(),
  address: z.string().optional(),
  coordinates: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
});

const VibeMatchSchema = z.object({
  matchedVibes: z.array(z.string()),
  reasoning: z.string(),
});

const CostSchema = z.object({
  amount: z.number(),
  currency: z.string(),
});

const ActivitySchema = z.object({
  name: z.string(),
  description: z.string(),
  duration: z.number(), // in minutes
  estimatedCost: CostSchema,
  timeOfDay: z.enum(['morning', 'afternoon', 'evening']),
  category: z.enum(['sightseeing', 'adventure', 'cultural', 'relaxation', 'entertainment', 'shopping']),
  location: LocationSchema,
  vibeMatch: VibeMatchSchema,
  bookingInfo: z.object({
    requiresReservation: z.boolean(),
    bookingUrl: z.string().optional(),
  }).optional(),
});

const RestaurantSchema = z.object({
  name: z.string(),
  cuisineType: z.array(z.string()),
  priceLevel: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  description: z.string(),
  estimatedCost: CostSchema.extend({ perPerson: z.boolean() }),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  location: LocationSchema,
  dietaryOptions: z.array(z.string()),
  vibeMatch: VibeMatchSchema,
  reservationInfo: z.object({
    recommended: z.boolean(),
    url: z.string().optional(),
  }).optional(),
});

const TimeSlotSchema = z.object({
  activities: z.array(ActivitySchema),
  meals: z.array(RestaurantSchema),
});

const TripDaySchema = z.object({
  dayNumber: z.number(),
  date: z.string(),
  title: z.string(),
  summary: z.string(),
  morning: TimeSlotSchema,
  afternoon: TimeSlotSchema,
  evening: TimeSlotSchema,
  totalEstimatedCost: CostSchema,
  tips: z.array(z.string()),
});

const ItinerarySchema = z.object({
  destination: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  overview: z.string(),
  totalEstimatedCost: CostSchema,
  days: z.array(TripDaySchema),
  packingList: z.array(z.string()).optional(),
  generalTips: z.array(z.string()).optional(),
});

/**
 * Generate a complete travel itinerary using AI SDK + AI Gateway
 */
export async function generateItinerary(
  preferences: TripPreferences,
  options?: {
    model?: string;
    onProgress?: (progress: StreamingProgress) => void;
    userId?: string;
  }
): Promise<GeneratedItinerary> {
  const modelName = options?.model || DEFAULT_MODEL;
  const onProgress = options?.onProgress;

  try {
    const days = Math.ceil(
      (new Date(preferences.endDate).getTime() - new Date(preferences.startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1;

    if (onProgress) {
      onProgress({
        status: 'started',
        totalDays: days,
        message: `Starting itinerary generation for ${preferences.destination}...`,
      });
    }

    const prompt = buildItineraryPrompt(preferences);

    // Use generateObject for structured output with Zod validation
    const { object: itineraryData, usage } = await generateObject({
      model: aiGateway(modelName),
      system: SYSTEM_PROMPT,
      prompt,
      schema: ItinerarySchema,
    });

    // Add IDs to activities and restaurants
    const processedDays = itineraryData.days.map((day) => ({
      ...day,
      morning: {
        activities: day.morning.activities.map((a) => ({ ...a, id: generateId('activity') })),
        meals: day.morning.meals.map((m) => ({ ...m, id: generateId('restaurant') })),
      },
      afternoon: {
        activities: day.afternoon.activities.map((a) => ({ ...a, id: generateId('activity') })),
        meals: day.afternoon.meals.map((m) => ({ ...m, id: generateId('restaurant') })),
      },
      evening: {
        activities: day.evening.activities.map((a) => ({ ...a, id: generateId('activity') })),
        meals: day.evening.meals.map((m) => ({ ...m, id: generateId('restaurant') })),
      },
    }));

    // Cast to GeneratedItinerary (Zod validates structure, we add IDs)
    const itinerary = {
      tripId: options?.userId ? `trip_${options.userId}_${Date.now()}` : `trip_${Date.now()}`,
      ...itineraryData,
      days: processedDays,
      generatedAt: new Date().toISOString(),
    } as GeneratedItinerary;

    if (onProgress) {
      onProgress({
        status: 'completed',
        totalDays: days,
        message: 'Itinerary generation complete!',
        partialItinerary: itinerary,
      });
    }

    console.log(`[AI Gateway] Tokens used: ${usage?.totalTokens || 'unknown'}`);
    return itinerary;
  } catch (error) {
    const aiError: AIGenerationError = {
      code: 'GENERATION_FAILED',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      details: error,
    };

    if (onProgress) {
      onProgress({
        status: 'error',
        totalDays: 0,
        message: aiError.message,
      });
    }

    throw aiError;
  }
}

/**
 * Stream itinerary generation with real-time updates
 * Returns a ReadableStream for SSE
 */
export async function streamItinerary(
  preferences: TripPreferences,
  options?: { model?: string }
): Promise<StreamTextResult<Record<string, never>, never>> {
  const modelName = options?.model || DEFAULT_MODEL;
  const prompt = buildItineraryPrompt(preferences);

  return streamText({
    model: aiGateway(modelName),
    system: SYSTEM_PROMPT,
    prompt,
  });
}

/**
 * Generate activity recommendations
 */
export async function generateActivities(
  destination: string,
  vibes: string[],
  timeOfDay: 'morning' | 'afternoon' | 'evening',
  budget: string
): Promise<Activity[]> {
  try {
    const prompt = buildActivityRecommendationPrompt(destination, vibes, timeOfDay, budget);

    const { object: activities } = await generateObject({
      model: aiGateway(DEFAULT_MODEL),
      system: SYSTEM_PROMPT,
      prompt,
      schema: z.array(ActivitySchema),
    });

    return activities.map((a) => ({ ...a, id: generateId('activity') }));
  } catch (error) {
    throw {
      code: 'ACTIVITY_GENERATION_FAILED',
      message: error instanceof Error ? error.message : 'Failed to generate activities',
      details: error,
    } as AIGenerationError;
  }
}

/**
 * Generate restaurant recommendations
 */
export async function generateRestaurants(
  destination: string,
  vibes: string[],
  mealType: 'breakfast' | 'lunch' | 'dinner',
  budget: string,
  dietaryRestrictions?: string[]
): Promise<Restaurant[]> {
  try {
    const prompt = buildRestaurantPrompt(destination, vibes, mealType, budget, dietaryRestrictions);

    const { object: restaurants } = await generateObject({
      model: aiGateway(DEFAULT_MODEL),
      system: SYSTEM_PROMPT,
      prompt,
      schema: z.array(RestaurantSchema),
    });

    return restaurants.map((r) => ({ ...r, id: generateId('restaurant') }));
  } catch (error) {
    throw {
      code: 'RESTAURANT_GENERATION_FAILED',
      message: error instanceof Error ? error.message : 'Failed to generate restaurants',
      details: error,
    } as AIGenerationError;
  }
}

/**
 * Simple text generation for conversational features
 */
export async function generateText_AI(prompt: string, systemPrompt?: string) {
  const { text, usage } = await generateText({
    model: aiGateway(DEFAULT_MODEL),
    system: systemPrompt || SYSTEM_PROMPT,
    prompt,
  });

  return { text, usage };
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate AI Gateway API key is configured
 */
export function validateApiKey(): boolean {
  return !!(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_AI_GATEWAY_API_KEY);
}
