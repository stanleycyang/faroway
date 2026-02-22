/**
 * Dining Agent
 * Searches for restaurant recommendations
 * Uses AI generation + optional Google Places integration
 */

import { generateObject, gateway as defaultGateway, createGateway } from 'ai';
import { z } from 'zod';
import { SearchPlan, DiningResult } from '../types';
import { VIBE_KEYWORDS } from '@tripgenie/constants';

const aiGateway = process.env.AI_GATEWAY_API_KEY
  ? createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })
  : defaultGateway;

const MODEL = 'anthropic/claude-sonnet-4-20250514';

const DiningSchema = z.object({
  name: z.string(),
  description: z.string(),
  cuisineTypes: z.array(z.string()),
  priceLevel: z.number().min(1).max(4),
  rating: z.number().min(0).max(5),
  reviewCount: z.number(),
  location: z.object({
    name: z.string(),
    address: z.string(),
    lat: z.number(),
    lng: z.number(),
    neighborhood: z.string().optional(),
  }),
  images: z.array(z.string()),
  reservationUrl: z.string().optional(),
  affiliatePartner: z.string().optional(),
  mealTypes: z.array(z.enum(['breakfast', 'lunch', 'dinner'])),
  vibeScore: z.number().min(0).max(100),
  vibeMatch: z.array(z.string()),
  dietaryOptions: z.array(z.string()),
});

const DiningListSchema = z.object({
  restaurants: z.array(DiningSchema),
});

const SYSTEM_PROMPT = `You are a food and restaurant expert. Generate realistic restaurant recommendations for travelers.

For each restaurant, provide:
1. Real restaurant names that exist at the destination (or realistic-sounding names)
2. Accurate cuisine types and pricing
3. Typical ratings and review counts
4. Which meals they're best for (breakfast, lunch, dinner)
5. How well the atmosphere matches the traveler's vibes

Price levels:
- 1 ($): Budget, ~$10-20/person
- 2 ($$): Moderate, ~$20-40/person  
- 3 ($$$): Upscale, ~$40-80/person
- 4 ($$$$): Fine dining, ~$80+/person

Include common dietary options if applicable (vegetarian, vegan, gluten-free, halal, kosher).

For reservation URLs, use format: https://opentable.com/r/[restaurant-slug] or leave empty if not needed.`;

export async function runDiningAgent(
  plan: SearchPlan,
  count: number = 12
): Promise<DiningResult[]> {
  const { destination, dates, diningCriteria, vibeInterpretation } = plan;
  const { cuisineTypes, priceRange, dietaryNeeds, mealPriorities } = diningCriteria;

  // Map price range to price levels
  const priceLevels = {
    budget: [1, 2],
    moderate: [2, 3],
    upscale: [3, 4],
  }[priceRange] || [2, 3];

  const prompt = `Generate ${count} restaurant recommendations for ${destination}.

**Dining Preferences:**
- ${dates.nights + 1} days of dining
- Price range: ${priceRange} (levels ${priceLevels.join('-')})
- Cuisine interests: ${cuisineTypes.join(', ') || 'local cuisine'}
- Dietary needs: ${dietaryNeeds.join(', ') || 'none specified'}
- Meal priorities: ${mealPriorities.join(', ')}

**Vibes to match:** ${vibeInterpretation.vibes.join(', ')}

Generate a diverse mix of:
- 3-4 breakfast/brunch spots
- 4-5 lunch options
- 4-5 dinner restaurants
- Include both local favorites and hidden gems
- Mix of price levels within the range

For vibes like:
- "Foodie" → renowned restaurants, food markets, unique experiences
- "Romantic" → intimate settings, fine dining, scenic views
- "Cultural" → traditional local cuisine, historic restaurants
- "Nightlife" → late-night spots, rooftop bars with food
- "Wellness" → healthy options, organic, farm-to-table

Score each restaurant 0-100 on how well it matches the traveler's vibes.`;

  try {
    const { object: result } = await generateObject({
      model: aiGateway(MODEL),
      system: SYSTEM_PROMPT,
      prompt,
      schema: DiningListSchema,
    });

    // Add unique IDs and sort by vibe score
    return result.restaurants
      .map((restaurant, index) => ({
        ...restaurant,
        id: `dining_${Date.now()}_${index}`,
        priceLevel: restaurant.priceLevel as 1 | 2 | 3 | 4,
      }))
      .sort((a, b) => b.vibeScore - a.vibeScore);
  } catch (error) {
    console.error('[Dining Agent] Error:', error);
    return [];
  }
}

/**
 * Search restaurants via Google Places (when API key is available)
 */
export async function searchGooglePlacesDining(
  destination: string,
  cuisineTypes: string[]
): Promise<any[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.log('[Dining Agent] No Google Places API key, using AI-generated data');
    return [];
  }

  try {
    const queries = cuisineTypes.length > 0
      ? cuisineTypes.map(cuisine => `${cuisine} restaurant in ${destination}`)
      : [`restaurant in ${destination}`];

    const results: any[] = [];

    for (const query of queries.slice(0, 3)) {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?` +
          `query=${encodeURIComponent(query)}&type=restaurant&key=${apiKey}`
      );
      const data = await response.json();

      if (data.results) {
        results.push(...data.results);
      }
    }

    return results;
  } catch (error) {
    console.error('[Dining Agent] Google Places error:', error);
    return [];
  }
}

/**
 * Calculate vibe score for a restaurant
 */
export function calculateDiningVibeScore(
  restaurant: { name: string; description: string; cuisineTypes: string[] },
  vibes: string[]
): { score: number; matchedVibes: string[] } {
  const text = `${restaurant.name} ${restaurant.description} ${restaurant.cuisineTypes.join(' ')}`.toLowerCase();
  const matchedVibes: string[] = [];
  let score = 50;

  for (const vibe of vibes) {
    const keywords = VIBE_KEYWORDS[vibe.toLowerCase()] || [];
    const matches = keywords.filter(keyword => text.includes(keyword.toLowerCase()));

    if (matches.length > 0) {
      matchedVibes.push(vibe);
      score += matches.length * 12;
    }
  }

  // Vibe-specific bonuses
  if (vibes.includes('Foodie')) score += 15; // Foodies appreciate all good food
  if (vibes.includes('Romantic') && text.includes('intimate')) score += 20;
  if (vibes.includes('Cultural') && text.includes('traditional')) score += 20;

  return {
    score: Math.min(100, score),
    matchedVibes,
  };
}
