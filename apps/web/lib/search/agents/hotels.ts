/**
 * Hotels Agent
 * Searches for accommodation options from affiliate partners
 * Uses AI generation + optional RapidAPI/Google Places integration
 */

import { generateObject, gateway as defaultGateway, createGateway } from 'ai';
import { z } from 'zod';
import { SearchPlan, HotelResult } from '../types';
import { VIBE_KEYWORDS } from '@tripgenie/constants';

const aiGateway = process.env.AI_GATEWAY_API_KEY
  ? createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })
  : defaultGateway;

const MODEL = 'anthropic/claude-sonnet-4-20250514';

const HotelSchema = z.object({
  name: z.string(),
  description: z.string(),
  starRating: z.number().min(1).max(5),
  userRating: z.number().min(0).max(10),
  reviewCount: z.number(),
  pricePerNight: z.number(),
  totalPrice: z.number(),
  currency: z.string().default('USD'),
  amenities: z.array(z.string()),
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
  vibeScore: z.number().min(0).max(100),
  vibeMatch: z.array(z.string()),
});

const HotelListSchema = z.object({
  hotels: z.array(HotelSchema),
});

const SYSTEM_PROMPT = `You are a hotel booking expert. Generate realistic hotel recommendations for travelers.

For each hotel, provide:
1. Real hotel names that exist at the destination (use actual hotel names)
2. Accurate star ratings and typical user ratings
3. Realistic nightly pricing based on star rating and location
4. Common amenities for that hotel tier
5. Location in a popular neighborhood
6. How well it matches the traveler's preferences

Use realistic affiliate URLs in format:
- https://booking.com/hotel/[country-code]/[hotel-slug]
- https://hotels.com/ho[id]/[hotel-name]

Price ranges by star rating (per night):
- 2-star: $40-80
- 3-star: $80-150
- 4-star: $150-300
- 5-star: $300-800+`;

export async function runHotelsAgent(
  plan: SearchPlan,
  count: number = 10
): Promise<HotelResult[]> {
  const { destination, dates, hotelCriteria, vibeInterpretation } = plan;
  const { priceRange, starRating, amenities, neighborhoods } = hotelCriteria;

  const prompt = `Generate ${count} real hotel recommendations for ${destination}.

**Stay Details:**
- ${dates.nights} nights (${dates.start} to ${dates.end})
- Price range: $${priceRange.min} - $${priceRange.max} per night
- Preferred star ratings: ${starRating.join(', ')}-star
- Desired amenities: ${amenities.join(', ') || 'wifi, breakfast'}
- Preferred neighborhoods: ${neighborhoods.join(', ') || 'central/popular areas'}

**Vibes to match:** ${vibeInterpretation.vibes.join(', ')}

Generate hotels matching these criteria:
- Include actual hotel names that exist in ${destination}
- Calculate total price (nights × nightly rate)
- Score each hotel 0-100 on how well it matches the traveler's vibes
- Include a mix of star ratings within the price range

For vibes like:
- "Romantic" → boutique hotels, luxury properties
- "Adventure" → hotels near outdoor activities
- "Cultural" → historic hotels, local character
- "Relaxation" → spa hotels, beach resorts`;

  try {
    console.log('[Hotels Agent] Using AI Gateway with model:', MODEL);
    console.log('[Hotels Agent] API Key present:', !!process.env.AI_GATEWAY_API_KEY || !!process.env.VERCEL_AI_GATEWAY_API_KEY);
    
    const { object: result } = await generateObject({
      model: aiGateway(MODEL),
      system: SYSTEM_PROMPT,
      prompt,
      schema: HotelListSchema,
    });

    console.log('[Hotels Agent] Generated', result.hotels.length, 'hotels');

    // Add unique IDs and sort by vibe score
    return result.hotels
      .map((hotel, index) => ({
        ...hotel,
        id: `hotel_${Date.now()}_${index}`,
      }))
      .sort((a, b) => b.vibeScore - a.vibeScore);
  } catch (error) {
    console.error('[Hotels Agent] Error:', error);
    // Re-throw to bubble up to the execute handler
    throw error;
  }
}

/**
 * Search hotels via RapidAPI (optional integration)
 */
export async function searchRapidAPIHotels(
  destination: string,
  checkIn: string,
  checkOut: string,
  guests: number
): Promise<any[]> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    console.log('[Hotels Agent] No RapidAPI key, using AI-generated data');
    return [];
  }

  try {
    // Booking.com API via RapidAPI
    const response = await fetch(
      `https://booking-com.p.rapidapi.com/v1/hotels/search?` +
        `dest_type=city&dest_name=${encodeURIComponent(destination)}&` +
        `checkin_date=${checkIn}&checkout_date=${checkOut}&` +
        `adults_number=${guests}&room_number=1&` +
        `order_by=popularity&filter_by_currency=USD&locale=en-us&units=metric`,
      {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'booking-com.p.rapidapi.com',
        },
      }
    );

    const data = await response.json();
    return data.result || [];
  } catch (error) {
    console.error('[Hotels Agent] RapidAPI error:', error);
    return [];
  }
}

/**
 * Calculate vibe score for a hotel
 */
export function calculateHotelVibeScore(
  hotel: { name: string; description: string; amenities: string[] },
  vibes: string[]
): { score: number; matchedVibes: string[] } {
  const text = `${hotel.name} ${hotel.description} ${hotel.amenities.join(' ')}`.toLowerCase();
  const matchedVibes: string[] = [];
  let score = 50; // Base score

  for (const vibe of vibes) {
    const keywords = VIBE_KEYWORDS[vibe.toLowerCase()] || [];
    const matches = keywords.filter(keyword => text.includes(keyword.toLowerCase()));

    if (matches.length > 0) {
      matchedVibes.push(vibe);
      score += matches.length * 10;
    }
  }

  // Bonus for specific vibe-hotel matches
  if (vibes.includes('Romantic') && text.includes('boutique')) score += 20;
  if (vibes.includes('Relaxation') && text.includes('spa')) score += 25;
  if (vibes.includes('Wellness') && (text.includes('spa') || text.includes('fitness'))) score += 20;

  return {
    score: Math.min(100, score),
    matchedVibes,
  };
}
