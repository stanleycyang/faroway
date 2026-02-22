/**
 * Activities Agent
 * Searches for tours, attractions, and experiences
 * Uses Google Places API + AI for matching and ranking
 */

import { generateObject, gateway as defaultGateway, createGateway } from 'ai';
import { z } from 'zod';
import { SearchPlan, ActivityResult } from '../types';
import { VIBE_KEYWORDS } from '@tripgenie/constants';
import {
  searchViatorProducts,
  generateViatorAffiliateUrl,
  mapViatorCategoryToVibe,
  isViatorConfigured,
} from '@/lib/affiliates/viator';

const aiGateway = process.env.AI_GATEWAY_API_KEY
  ? createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })
  : defaultGateway;

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
  affiliateUrl: z.string().optional(),
  affiliatePartner: z.string().optional(),
  bestTimeOfDay: z.enum(['morning', 'afternoon', 'evening', 'any']),
  vibeScore: z.number().min(0).max(100),
  vibeMatch: z.array(z.string()),
  bookingRequired: z.boolean(),
});

const ActivityListSchema = z.object({
  activities: z.array(ActivitySchema),
});

const SYSTEM_PROMPT = `You are a travel activities expert. Generate realistic, bookable activities and attractions for the destination.

When real Viator data is provided as context, use those activity names and prices. Only generate synthetic data for categories not covered by the real results.

For each activity, provide:
1. Real attraction/tour names that exist at the destination
2. Accurate descriptions of what visitors will experience
3. Realistic pricing (use Viator as reference)
4. Appropriate duration estimates
5. Best time of day to visit
6. How well it matches the traveler's vibes

Generate diverse options across categories like:
- Sightseeing & landmarks
- Tours (walking, food, history)
- Museums & cultural sites
- Outdoor activities
- Unique local experiences

Do NOT generate fake affiliate URLs. Leave affiliateUrl and affiliatePartner empty — only real API-sourced activities should have booking links.`;

export async function runActivitiesAgent(
  plan: SearchPlan,
  count: number = 15
): Promise<ActivityResult[]> {
  const { destination, dates, activityCriteria, vibeInterpretation } = plan;
  const vibes = vibeInterpretation.vibes;

  // Search Viator for real activity data
  let realActivities: ActivityResult[] = [];

  try {
    const viatorProducts = isViatorConfigured()
      ? await searchViatorProducts({ destination: destination, startDate: dates.start, limit: 15 })
      : [];

    const trackingId = `tg_${Date.now()}`;

    for (const product of viatorProducts) {
      const durationMinutes = product.duration.fixedDurationInMinutes
        || product.duration.variableDurationFromMinutes
        || 180;
      const categoryVibes = product.categories.length > 0
        ? mapViatorCategoryToVibe(product.categories[0])
        : [];
      const { score, matchedVibes } = calculateVibeScore(
        { name: product.title, description: product.description, category: product.categories[0] || '' },
        vibes
      );

      realActivities.push({
        id: `activity_v_${product.productCode}`,
        name: product.title,
        description: product.shortDescription || product.description.substring(0, 200),
        category: product.categories[0] || 'sightseeing',
        duration: durationMinutes,
        price: product.price.amount,
        currency: product.price.currencyCode,
        rating: product.rating,
        reviewCount: product.reviewCount,
        location: {
          name: product.location.city || destination,
          address: product.location.address || '',
          lat: product.location.coordinates?.latitude || 0,
          lng: product.location.coordinates?.longitude || 0,
        },
        images: product.images.slice(0, 3).map((img: any) => img.url),
        affiliateUrl: generateViatorAffiliateUrl(product.productCode, trackingId, { date: dates.start, productUrl: product.productUrl }),
        affiliatePartner: 'viator',
        bestTimeOfDay: 'any',
        vibeScore: score || matchedVibes.length * 25,
        vibeMatch: matchedVibes.length > 0 ? matchedVibes : categoryVibes.filter(v => vibes.includes(v)),
        bookingRequired: true,
      });
    }
  } catch (error) {
    console.error('[Activities Agent] Viator search error:', error);
  }

  // If we have enough real results, return them
  if (realActivities.length >= count) {
    return realActivities
      .sort((a, b) => b.vibeScore - a.vibeScore)
      .slice(0, count);
  }

  // Supplement with AI-generated activities for gaps
  const remaining = count - realActivities.length;
  const realContext = realActivities.length > 0
    ? `\n\n**Already sourced from APIs (do NOT duplicate these):**\n${realActivities.map(a => `- ${a.name} ($${a.price}, ${a.affiliatePartner})`).join('\n')}`
    : '';

  const prompt = `Generate ${remaining} bookable activities and attractions for ${destination}.

**Trip Details:**
- Duration: ${dates.nights} nights
- Pace: ${activityCriteria.pacePreference}
- Must-see: ${activityCriteria.mustSee.join(', ') || 'popular attractions'}
- Interests: ${activityCriteria.interests.join(', ')}

**Vibes to match:** ${vibes.join(', ')}
**Keywords to incorporate:** ${vibeInterpretation.searchKeywords.slice(0, 10).join(', ')}
**Avoid:** ${vibeInterpretation.avoidKeywords.join(', ') || 'nothing specific'}${realContext}

Generate a diverse mix covering categories NOT already represented above.
Score each activity 0-100 on how well it matches the traveler's vibes.`;

  try {
    const { object: result } = await generateObject({
      model: aiGateway(MODEL),
      system: SYSTEM_PROMPT,
      prompt,
      schema: ActivityListSchema,
    });

    const aiActivities = result.activities.map((activity, index) => ({
      ...activity,
      id: `activity_${Date.now()}_${index}`,
    }));

    return [...realActivities, ...aiActivities]
      .sort((a, b) => b.vibeScore - a.vibeScore)
      .slice(0, count);
  } catch (error) {
    console.error('[Activities Agent] AI generation error:', error);
    return realActivities.sort((a, b) => b.vibeScore - a.vibeScore);
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
