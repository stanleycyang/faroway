/**
 * TripGenie Claude API Wrapper
 * Handles AI itinerary generation using Anthropic's Claude API
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  TripPreferences,
  GeneratedItinerary,
  TripDay,
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

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 16000;

/**
 * Generate a complete travel itinerary based on user preferences
 */
export async function generateItinerary(
  preferences: TripPreferences,
  options?: {
    model?: string;
    onProgress?: (progress: StreamingProgress) => void;
    userId?: string;
  }
): Promise<GeneratedItinerary> {
  const model = options?.model || DEFAULT_MODEL;
  const onProgress = options?.onProgress;

  try {
    // Calculate trip duration
    const days = Math.ceil(
      (new Date(preferences.endDate).getTime() - new Date(preferences.startDate).getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1;

    // Notify start
    if (onProgress) {
      onProgress({
        status: 'started',
        totalDays: days,
        message: `Starting itinerary generation for ${preferences.destination}...`,
      });
    }

    // Build the prompt
    const prompt = buildItineraryPrompt(preferences);

    // Make API call with streaming
    const stream = await anthropic.messages.create({
      model,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      stream: true,
    });

    let fullResponse = '';
    let currentDay = 0;

    // Process streaming response
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullResponse += event.delta.text;

        // Try to parse partial JSON to track progress
        try {
          const partial = JSON.parse(fullResponse);
          if (partial.days && partial.days.length > currentDay) {
            currentDay = partial.days.length;
            if (onProgress) {
              onProgress({
                status: 'processing',
                currentDay,
                totalDays: days,
                message: `Generated day ${currentDay} of ${days}...`,
              });
            }
          }
        } catch {
          // Partial JSON not yet valid, continue streaming
        }
      }
    }

    // Parse final response
    const parsedResponse = parseItineraryResponse(fullResponse);

    // Add metadata
    const itinerary: GeneratedItinerary = {
      tripId: options?.userId ? `trip_${options.userId}_${Date.now()}` : `trip_${Date.now()}`,
      ...parsedResponse,
      generatedAt: new Date().toISOString(),
    };

    // Notify completion
    if (onProgress) {
      onProgress({
        status: 'completed',
        totalDays: days,
        message: 'Itinerary generation complete!',
        partialItinerary: itinerary,
      });
    }

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
 * Generate activity recommendations for a specific time and context
 */
export async function generateActivities(
  destination: string,
  vibes: string[],
  timeOfDay: 'morning' | 'afternoon' | 'evening',
  budget: string
): Promise<Activity[]> {
  try {
    const prompt = buildActivityRecommendationPrompt(destination, vibes, timeOfDay, budget);

    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    return parseActivitiesResponse(content.text);
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

    const response = await anthropic.messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    return parseRestaurantsResponse(content.text);
  } catch (error) {
    throw {
      code: 'RESTAURANT_GENERATION_FAILED',
      message: error instanceof Error ? error.message : 'Failed to generate restaurants',
      details: error,
    } as AIGenerationError;
  }
}

/**
 * Parse Claude's itinerary response into structured format
 */
function parseItineraryResponse(response: string): Omit<GeneratedItinerary, 'tripId' | 'generatedAt'> {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(jsonStr);

    // Add unique IDs to activities and restaurants
    parsed.days = parsed.days.map((day: TripDay) => ({
      ...day,
      morning: {
        activities: day.morning.activities.map((a: Activity) => ({
          ...a,
          id: generateId('activity'),
        })),
        meals: day.morning.meals.map((m: Restaurant) => ({
          ...m,
          id: generateId('restaurant'),
        })),
      },
      afternoon: {
        activities: day.afternoon.activities.map((a: Activity) => ({
          ...a,
          id: generateId('activity'),
        })),
        meals: day.afternoon.meals.map((m: Restaurant) => ({
          ...m,
          id: generateId('restaurant'),
        })),
      },
      evening: {
        activities: day.evening.activities.map((a: Activity) => ({
          ...a,
          id: generateId('activity'),
        })),
        meals: day.evening.meals.map((m: Restaurant) => ({
          ...m,
          id: generateId('restaurant'),
        })),
      },
    }));

    return parsed;
  } catch (error) {
    throw new Error(`Failed to parse itinerary response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse activities response
 */
function parseActivitiesResponse(response: string): Activity[] {
  try {
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(jsonStr);
    return parsed.map((a: Activity) => ({
      ...a,
      id: generateId('activity'),
    }));
  } catch (error) {
    throw new Error(`Failed to parse activities response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse restaurants response
 */
function parseRestaurantsResponse(response: string): Restaurant[] {
  try {
    let jsonStr = response.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(jsonStr);
    return parsed.map((r: Restaurant) => ({
      ...r,
      id: generateId('restaurant'),
    }));
  } catch (error) {
    throw new Error(`Failed to parse restaurants response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate unique IDs
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate API key is configured
 */
export function validateApiKey(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Get estimated token count (rough estimation)
 */
export function estimateTokens(text: string): number {
  // Rough estimate: ~4 characters per token
  return Math.ceil(text.length / 4);
}

/**
 * Calculate estimated cost based on tokens
 * Claude Sonnet 4 pricing (as of Feb 2025):
 * Input: $3 per million tokens
 * Output: $15 per million tokens
 */
export function estimateCost(inputTokens: number, outputTokens: number): number {
  const inputCost = (inputTokens / 1_000_000) * 3;
  const outputCost = (outputTokens / 1_000_000) * 15;
  return inputCost + outputCost;
}
