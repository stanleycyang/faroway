/**
 * TripGenie Travel Agent
 * Uses AI SDK ToolLoopAgent with tools for searching hotels, activities, and dining
 */

import { ToolLoopAgent, tool, Output, stepCountIs, gateway as defaultGateway, createGateway } from 'ai';
import { z } from 'zod';
import {
  searchViatorProducts,
  generateViatorAffiliateUrl,
  mapViatorCategoryToVibe,
  isViatorConfigured,
} from '@/lib/affiliates/viator';

// AI Gateway configuration — use the dedicated gateway provider (not createOpenAI,
// which defaults to the OpenAI Responses API and doesn't work with the AI Gateway)
const aiGateway = process.env.AI_GATEWAY_API_KEY
  ? createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })
  : defaultGateway;

const MODEL = 'anthropic/claude-sonnet-4-20250514';

// ============================================
// Mock Data Generators (fallback)
// ============================================

function generateMockHotels(destination: string, budget: 'budget' | 'moderate' | 'luxury', vibes?: string[]) {
  const priceRanges = {
    budget: { min: 50, max: 100 },
    moderate: { min: 100, max: 250 },
    luxury: { min: 250, max: 800 },
  };
  const range = priceRanges[budget];

  return Array.from({ length: 5 }, (_, i) => ({
    id: `hotel_${Date.now()}_${i}`,
    name: `${['Grand', 'Boutique', 'Modern', 'Historic', 'Luxury'][i]} ${destination} Hotel`,
    rating: 4 + Math.random(),
    reviewCount: Math.floor(Math.random() * 2000) + 500,
    pricePerNight: Math.floor(range.min + Math.random() * (range.max - range.min)),
    currency: 'USD',
    amenities: ['WiFi', 'Breakfast', 'Pool', 'Gym', 'Spa'].slice(0, 3 + i % 3),
    location: { neighborhood: ['Downtown', 'Old Town', 'Beach', 'City Center'][i % 4] },
    vibeMatch: vibes?.slice(0, 2) || [],
    affiliateUrl: `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(destination)}`,
    affiliatePartner: 'booking.com',
  }));
}

function generateMockActivities(destination: string, category?: string, vibes?: string[]) {
  return Array.from({ length: 8 }, (_, i) => ({
    id: `activity_${Date.now()}_${i}`,
    name: `${destination} ${['Walking Tour', 'Food Tour', 'Museum Visit', 'Day Trip', 'Adventure', 'Cultural Experience', 'Night Tour', 'Cooking Class'][i]}`,
    description: `Experience the best of ${destination} with this popular activity.`,
    duration: [2, 3, 4, 6, 8][i % 5],
    price: Math.floor(30 + Math.random() * 150),
    currency: 'USD',
    rating: 4.3 + Math.random() * 0.7,
    reviewCount: Math.floor(Math.random() * 500) + 100,
    category: category || ['sightseeing', 'cultural', 'food', 'adventure'][i % 4],
    vibeMatch: vibes?.slice(0, 2) || [],
    affiliateUrl: `https://www.viator.com/searchResults/all?text=${encodeURIComponent(destination)}`,
    affiliatePartner: 'viator',
  }));
}

// ============================================
// Tool Definitions
// ============================================

const searchHotelsTool = tool({
  description: 'Search for hotels in a destination. Returns a list of hotels with pricing, ratings, and amenities.',
  inputSchema: z.object({
    destination: z.string().describe('City or location to search for hotels'),
    checkIn: z.string().describe('Check-in date (YYYY-MM-DD)'),
    checkOut: z.string().describe('Check-out date (YYYY-MM-DD)'),
    guests: z.number().describe('Number of guests'),
    budget: z.enum(['budget', 'moderate', 'luxury']).describe('Budget level'),
    vibes: z.array(z.string()).optional().describe('Desired vibes like romantic, adventure, relaxation'),
  }),
  execute: async ({ destination, checkIn, checkOut, guests, budget, vibes }) => {
    // TODO: Integrate real hotel API when available
    const hotels = generateMockHotels(destination, budget, vibes);
    return { hotels, searchMetadata: { destination, checkIn, checkOut, totalResults: hotels.length, source: 'mock' } };
  },
});

const searchActivitiesTool = tool({
  description: 'Search for activities and experiences at a destination. Returns tours, attractions, and things to do.',
  inputSchema: z.object({
    destination: z.string().describe('City or location'),
    date: z.string().describe('Date for the activity (YYYY-MM-DD)'),
    category: z.enum(['sightseeing', 'adventure', 'cultural', 'food', 'nature', 'entertainment']).optional(),
    vibes: z.array(z.string()).optional().describe('Desired vibes'),
  }),
  execute: async ({ destination, date, category, vibes }) => {
    // Query Viator for activities
    if (isViatorConfigured()) {
      try {
        const viatorProducts = await searchViatorProducts({
          destination, startDate: date, categories: category ? [category] : undefined, limit: 15,
        });

        if (viatorProducts.length > 0) {
          const trackingId = `tg_${Date.now()}`;
          const activities = viatorProducts
            .map(product => normalizeViatorToActivity(product, trackingId, date, category, vibes))
            .sort((a, b) => (b.vibeScore || 0) - (a.vibeScore || 0));

          return { activities: activities.slice(0, 15), searchMetadata: { destination, date, totalResults: activities.length, source: 'viator' } };
        }
      } catch (error) {
        console.error('[TravelAgent] Viator search failed, falling back to mock:', error);
      }
    }

    // Fallback: generate mock activity data
    const mockActivities = generateMockActivities(destination, category, vibes);
    return { activities: mockActivities, searchMetadata: { destination, date, totalResults: mockActivities.length, source: 'mock' } };
  },
});

// ============================================
// Activity Normalization Helpers
// ============================================

function normalizeViatorToActivity(
  product: any,
  trackingId: string,
  date: string,
  category?: string,
  vibes?: string[]
) {
  const durationHours = product.duration.fixedDurationInMinutes
    ? Math.round(product.duration.fixedDurationInMinutes / 60)
    : product.duration.variableDurationFromMinutes
      ? Math.round(product.duration.variableDurationFromMinutes / 60)
      : 3;

  const categoryVibes = product.categories.length > 0
    ? mapViatorCategoryToVibe(product.categories[0])
    : [];
  const matchedVibes = vibes?.filter(v => categoryVibes.includes(v)) || [];

  return {
    id: `activity_${product.productCode}`,
    name: product.title,
    description: product.shortDescription || product.description.substring(0, 200),
    duration: durationHours,
    price: product.price.amount,
    currency: product.price.currencyCode,
    rating: product.rating,
    reviewCount: product.reviewCount,
    category: category || 'sightseeing',
    vibeMatch: matchedVibes,
    vibeScore: matchedVibes.length * 25,
    affiliateUrl: generateViatorAffiliateUrl(product.productCode, trackingId, { date }),
    affiliatePartner: 'viator',
    images: product.images.slice(0, 2).map((img: any) => img.url),
    highlights: product.highlights.slice(0, 3),
  };
}

const searchDiningTool = tool({
  description: 'Search for restaurants and dining options at a destination.',
  inputSchema: z.object({
    destination: z.string().describe('City or location'),
    cuisine: z.string().optional().describe('Type of cuisine (Italian, Japanese, etc.)'),
    mealType: z.enum(['breakfast', 'lunch', 'dinner']).describe('Meal type'),
    priceLevel: z.enum(['$', '$$', '$$$', '$$$$']).optional(),
    vibes: z.array(z.string()).optional(),
  }),
  execute: async ({ destination, cuisine, mealType, priceLevel, vibes }) => {
    // TODO: Integrate OpenTable/Yelp API when available
    // For now, generate realistic restaurant data
    const restaurants = Array.from({ length: 6 }, (_, i) => ({
      id: `restaurant_${Date.now()}_${i}`,
      name: `${['The', 'Le', 'Casa', 'Ristorante', 'Cafe', 'Bistro'][i]} ${['Garden', 'Terrace', 'Corner', 'Place', 'Kitchen', 'Table'][i]}`,
      cuisine: cuisine || ['Local', 'Italian', 'French', 'Asian', 'Mediterranean', 'American'][i],
      priceLevel: priceLevel || ['$$', '$$$'][i % 2],
      rating: 4.2 + Math.random() * 0.8,
      reviewCount: Math.floor(Math.random() * 800) + 200,
      description: `Popular ${mealType} spot in ${destination} known for excellent ${cuisine || 'local'} cuisine.`,
      vibeMatch: vibes?.slice(0, 2) || [],
      reservationUrl: `https://www.opentable.com/s?term=${encodeURIComponent(destination)}`,
      affiliatePartner: 'opentable',
    }));

    return { restaurants, searchMetadata: { destination, mealType, totalResults: restaurants.length, source: 'mock' } };
  },
});

const createItineraryTool = tool({
  description: 'Create a day-by-day itinerary from the searched hotels, activities, and restaurants.',
  inputSchema: z.object({
    destination: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    hotels: z.array(z.any()).describe('List of hotel options'),
    activities: z.array(z.any()).describe('List of activity options'),
    restaurants: z.array(z.any()).describe('List of restaurant options'),
    vibes: z.array(z.string()).optional(),
  }),
  execute: async ({ destination, startDate, endDate, hotels, activities, restaurants, vibes }) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

    const topHotel = hotels[0];
    const days = Array.from({ length: nights + 1 }, (_, dayIndex) => {
      const date = new Date(start);
      date.setDate(date.getDate() + dayIndex);

      return {
        dayNumber: dayIndex + 1,
        date: date.toISOString().split('T')[0],
        title: dayIndex === 0 ? `Arrival in ${destination}` :
               dayIndex === nights ? `Departure Day` :
               `Exploring ${destination}`,
        morning: {
          activities: [activities[dayIndex * 2 % activities.length]],
          meal: restaurants.find(r => r.cuisine?.includes('Local')) || restaurants[0],
        },
        afternoon: {
          activities: [activities[(dayIndex * 2 + 1) % activities.length]],
          meal: restaurants[dayIndex % restaurants.length],
        },
        evening: {
          activities: dayIndex < nights ? [activities[(dayIndex + 3) % activities.length]] : [],
          meal: restaurants[(dayIndex + 2) % restaurants.length],
        },
        estimatedCost: 150 + Math.floor(Math.random() * 100),
        currency: 'USD',
        tips: [`Book ${activities[dayIndex % activities.length]?.name} in advance`, 'Stay hydrated'],
      };
    });

    return {
      itinerary: {
        destination,
        startDate,
        endDate,
        nights,
        topHotel,
        days,
        totalEstimatedCost: days.reduce((sum, d) => sum + d.estimatedCost, 0) + (topHotel?.pricePerNight || 150) * nights,
        currency: 'USD',
      },
    };
  },
});

// ============================================
// Travel Planning Agent
// ============================================

const TravelPlanningAgentSchema = z.object({
  itinerary: z.object({
    destination: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    nights: z.number(),
    topHotel: z.any(),
    days: z.array(z.any()),
    totalEstimatedCost: z.number(),
    currency: z.string(),
  }),
  hotels: z.array(z.any()),
  activities: z.array(z.any()),
  restaurants: z.array(z.any()),
  summary: z.string(),
});

export const travelPlanningAgent = new ToolLoopAgent({
  model: aiGateway(MODEL),
  instructions: `You are TripGenie, an expert AI travel planner. Your job is to create personalized travel itineraries.

When a user provides trip details:
1. First, search for hotels that match their budget and vibes
2. Then, search for activities and experiences at the destination
3. Search for dining options for each meal type
4. Finally, create a comprehensive day-by-day itinerary

Always consider the user's vibes (romantic, adventure, relaxation, cultural, etc.) when selecting options.
Prioritize highly-rated options with good reviews.
Balance the itinerary with a mix of activities, rest time, and great food.

Be thorough - search multiple categories and create a complete itinerary.`,
  tools: {
    searchHotels: searchHotelsTool,
    searchActivities: searchActivitiesTool,
    searchDining: searchDiningTool,
    createItinerary: createItineraryTool,
  },
  output: Output.object({
    schema: TravelPlanningAgentSchema,
  }),
  stopWhen: stepCountIs(15), // Allow up to 15 tool calls
});

// ============================================
// Export for use in workflows
// ============================================

export type TravelPlanResult = z.infer<typeof TravelPlanningAgentSchema>;

export async function planTrip(params: {
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  vibes?: string[];
  budget?: string;
}): Promise<TravelPlanResult> {
  const { destination, startDate, endDate, travelers, vibes, budget } = params;

  const prompt = `Plan a trip to ${destination} from ${startDate} to ${endDate} for ${travelers} traveler(s).
${vibes?.length ? `Vibes: ${vibes.join(', ')}` : ''}
${budget ? `Budget: ${budget}` : 'Budget: moderate'}

Please search for hotels, activities, and restaurants, then create a complete itinerary.`;

  const result = await travelPlanningAgent.generate({ prompt });

  return result.output!;
}
