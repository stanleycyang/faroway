/**
 * Activities Agent
 * Searches for tours, attractions, and experiences
 * Uses Google Places API + AI for matching and ranking
 */

import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { SearchPlan, ActivityResult } from '../types';
import { VIBE_KEYWORDS } from '@tripgenie/constants';

const aiGateway = createOpenAI({
  apiKey: process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_AI_GATEWAY_API_KEY,
  baseURL: 'https://ai-gateway.vercel.sh/v1',
});

const MODEL = 'anthropic/claude-sonnet-4-20250514';

const ActivitySchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.string(),
  duration: z.number(), // minutes
  price: z.number(),
  currency: z.string().default('USD'),
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
  affiliateUrl: z.string(),
  affiliatePartner: z.string(),
  bestTimeOfDay: z.enum(['morning', 'afternoon', 'evening', 'any']),
  vibeScore: z.number().min(0).max(100),
  vibeMatch: z.array(z.string()),
  bookingRequired: z.boolean(),
});

const ActivityListSchema = z.object({
  activities: z.array(ActivitySchema),
});

const SYSTEM_PROMPT = `You are a travel activities expert. Generate realistic, bookable activities and attractions for the destination.

For each activity, provide:
1. Real attraction/tour names that exist at the destination
2. Accurate descriptions of what visitors will experience
3. Realistic pricing (use Viator/GetYourGuide as reference)
4. Appropriate duration estimates
5. Best time of day to visit
6. How well it matches the traveler's vibes

Generate diverse options across categories like:
- Sightseeing & landmarks
- Tours (walking, food, history)
- Museums & cultural sites
- Outdoor activities
- Unique local experiences

Use realistic affiliate URLs (format: https://viator.com/tour/[destination-slug] or https://getyourguide.com/[destination]/[activity])`;

export async function runActivitiesAgent(
  plan: SearchPlan,
  count: number = 15
): Promise<ActivityResult[]> {
  const { destination, dates, activityCriteria, vibeInterpretation } = plan;

  const prompt = `Generate ${count} bookable activities and attractions for ${destination}.

**Trip Details:**
- Duration: ${dates.nights} nights
- Pace: ${activityCriteria.pacePreference}
- Must-see: ${activityCriteria.mustSee.join(', ') || 'popular attractions'}
- Interests: ${activityCriteria.interests.join(', ')}

**Vibes to match:** ${vibeInterpretation.vibes.join(', ')}
**Keywords to incorporate:** ${vibeInterpretation.searchKeywords.slice(0, 10).join(', ')}
**Avoid:** ${vibeInterpretation.avoidKeywords.join(', ') || 'nothing specific'}

Generate a diverse mix of:
- 3-4 iconic must-see attractions
- 3-4 guided tours (walking, food, cultural)
- 2-3 outdoor/nature activities
- 2-3 unique local experiences
- 2-3 evening activities

Score each activity 0-100 on how well it matches the traveler's vibes.`;

  try {
    const { object: result } = await generateObject({
      model: aiGateway(MODEL),
      system: SYSTEM_PROMPT,
      prompt,
      schema: ActivityListSchema,
    });

    // Add unique IDs and sort by vibe score
    return result.activities
      .map((activity, index) => ({
        ...activity,
        id: `activity_${Date.now()}_${index}`,
      }))
      .sort((a, b) => b.vibeScore - a.vibeScore);
  } catch (error) {
    console.error('[Activities Agent] Error:', error);
    return [];
  }
}

/**
 * Search Google Places for activities (when API key is available)
 */
export async function searchGooglePlacesActivities(
  destination: string,
  types: string[]
): Promise<any[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    console.log('[Activities Agent] No Google Places API key, using AI-generated data');
    return [];
  }

  try {
    // Google Places Text Search
    const searchQueries = types.map(type => `${type} in ${destination}`);
    const results: any[] = [];

    for (const query of searchQueries.slice(0, 3)) { // Limit to 3 queries
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`
      );
      const data = await response.json();
      
      if (data.results) {
        results.push(...data.results);
      }
    }

    return results;
  } catch (error) {
    console.error('[Activities Agent] Google Places error:', error);
    return [];
  }
}

/**
 * Calculate vibe match score for an activity
 */
export function calculateVibeScore(
  activity: { name: string; description: string; category: string },
  vibes: string[]
): { score: number; matchedVibes: string[] } {
  const text = `${activity.name} ${activity.description} ${activity.category}`.toLowerCase();
  const matchedVibes: string[] = [];
  let score = 0;

  for (const vibe of vibes) {
    const keywords = VIBE_KEYWORDS[vibe.toLowerCase()] || [];
    const matches = keywords.filter(keyword => text.includes(keyword.toLowerCase()));
    
    if (matches.length > 0) {
      matchedVibes.push(vibe);
      score += matches.length * 15; // 15 points per keyword match
    }
  }

  return {
    score: Math.min(100, score),
    matchedVibes,
  };
}
