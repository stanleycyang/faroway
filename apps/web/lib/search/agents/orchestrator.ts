/**
 * Orchestrator Agent
 * Analyzes user input and creates a search plan for other agents
 */

import { generateObject, gateway as defaultGateway, createGateway } from 'ai';
import { z } from 'zod';
import { SearchInput, SearchPlan } from '../types';
import { VIBE_KEYWORDS, BUDGET_RANGES } from '@faroway/constants';

const aiGateway = process.env.AI_GATEWAY_API_KEY
  ? createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })
  : defaultGateway;

const MODEL = 'anthropic/claude-sonnet-4-20250514';

const SearchPlanSchema = z.object({
  destination: z.string(),
  country: z.string(),
  dates: z.object({
    start: z.string(),
    end: z.string(),
    nights: z.number(),
  }),
  searchPriorities: z.array(z.enum(['hotels', 'activities', 'dining'])),
  hotelCriteria: z.object({
    priceRange: z.object({ min: z.number(), max: z.number() }),
    starRating: z.array(z.number()),
    amenities: z.array(z.string()),
    neighborhoods: z.array(z.string()),
  }),
  activityCriteria: z.object({
    categories: z.array(z.string()),
    pacePreference: z.enum(['relaxed', 'moderate', 'packed']),
    mustSee: z.array(z.string()),
    interests: z.array(z.string()),
  }),
  diningCriteria: z.object({
    cuisineTypes: z.array(z.string()),
    priceRange: z.enum(['budget', 'moderate', 'upscale']),
    dietaryNeeds: z.array(z.string()),
    mealPriorities: z.array(z.enum(['breakfast', 'lunch', 'dinner'])),
  }),
  vibeInterpretation: z.object({
    vibes: z.array(z.string()),
    searchKeywords: z.array(z.string()),
    avoidKeywords: z.array(z.string()),
  }),
});

const SYSTEM_PROMPT = `You are a travel planning expert. Your job is to analyze user travel preferences and create a detailed search plan that will be used by specialized agents to find hotels, activities, and dining options.

Consider:
1. The destination and what it's known for
2. Travel dates and trip duration
3. Who is traveling (solo, couple, family, etc.)
4. Their selected "vibes" (adventure, relaxation, cultural, etc.)
5. Budget constraints

Output a comprehensive search plan with specific criteria for hotels, activities, and dining that match the user's preferences.`;

export async function runOrchestratorAgent(input: SearchInput): Promise<SearchPlan> {
  const nights = Math.ceil(
    (new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  const budgetInfo = BUDGET_RANGES[input.budget || 'moderate'];
  
  // Collect keywords from selected vibes
  const vibeKeywords = input.vibes.flatMap(vibe => VIBE_KEYWORDS[vibe.toLowerCase()] || []);

  const prompt = `Create a search plan for this trip:

**Destination:** ${input.destination}
**Dates:** ${input.startDate} to ${input.endDate} (${nights} nights)
**Travelers:** ${input.travelers} people, ${input.travelerType || 'general'} travel
**Vibes:** ${input.vibes.join(', ')}
**Budget:** ${input.budget || 'moderate'}

Budget guidelines:
- Hotel: $${budgetInfo.hotel.min} - $${budgetInfo.hotel.max} per night
- Daily activities/food: ~$${budgetInfo.daily} per person

Keywords associated with their vibes: ${vibeKeywords.join(', ')}

Create a detailed search plan with:
1. Best neighborhoods to stay in ${input.destination}
2. Hotel amenities that match their vibes
3. Activity categories and must-see attractions
4. Cuisine types and dining style preferences
5. Keywords to search for and avoid based on their preferences`;

  try {
    const { object: plan } = await generateObject({
      model: aiGateway(MODEL),
      system: SYSTEM_PROMPT,
      prompt,
      schema: SearchPlanSchema,
    });

    return plan;
  } catch (error) {
    console.error('[Orchestrator Agent] Error:', error);
    
    // Return a reasonable default plan
    return {
      destination: input.destination,
      country: '', // Will be filled by search
      dates: {
        start: input.startDate,
        end: input.endDate,
        nights,
      },
      searchPriorities: ['hotels', 'activities', 'dining'],
      hotelCriteria: {
        priceRange: budgetInfo.hotel,
        starRating: input.budget === 'luxury' ? [4, 5] : input.budget === 'budget' ? [2, 3] : [3, 4],
        amenities: ['wifi', 'breakfast'],
        neighborhoods: [],
      },
      activityCriteria: {
        categories: input.vibes,
        pacePreference: 'moderate',
        mustSee: [],
        interests: vibeKeywords.slice(0, 10),
      },
      diningCriteria: {
        cuisineTypes: ['local'],
        priceRange: input.budget === 'luxury' ? 'upscale' : input.budget === 'budget' ? 'budget' : 'moderate',
        dietaryNeeds: [],
        mealPriorities: ['dinner', 'lunch', 'breakfast'],
      },
      vibeInterpretation: {
        vibes: input.vibes,
        searchKeywords: vibeKeywords,
        avoidKeywords: [],
      },
    };
  }
}
