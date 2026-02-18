/**
 * TripGenie AI Prompt Templates
 * Structured prompts for Claude to generate personalized travel itineraries
 */

import { TripPreferences } from './types';

export const SYSTEM_PROMPT = `You are Claude, an expert travel planning AI assistant for TripGenie.

Your expertise includes:
- Deep knowledge of global destinations, attractions, and hidden gems
- Understanding of local cultures, customs, and etiquette
- Expertise in budget optimization and cost estimation
- Ability to match activities and experiences to traveler personalities and "vibes"
- Knowledge of seasonal events, weather patterns, and optimal timing
- Restaurant recommendations across all price points and cuisines
- Practical logistics like transportation, timing, and accessibility

Your personality:
- Enthusiastic but practical
- Detail-oriented with accurate cost estimates
- Culturally sensitive and inclusive
- Focused on creating memorable, personalized experiences
- Clear communicator who explains WHY recommendations match user vibes

Output format:
- Always respond with valid JSON matching the requested schema
- Include realistic cost estimates in local currency
- Provide specific timing (duration in minutes)
- Match activities to user's stated vibes with clear reasoning
- Balance popular attractions with authentic local experiences
- Consider practical factors: walking distances, opening hours, energy levels`;

export function buildItineraryPrompt(preferences: TripPreferences): string {
  const { destination, startDate, endDate, budget, vibes, travelers, interests, dietaryRestrictions, mobilityNeeds } = preferences;
  
  const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  return `Generate a complete ${days}-day travel itinerary for ${destination}.

TRAVELER PROFILE:
- Dates: ${startDate} to ${endDate} (${days} days)
- Budget level: ${budget}
- Travelers: ${travelers.adults} adult(s), ${travelers.children} child(ren)
- Vibes: ${vibes.join(', ')}
${interests && interests.length > 0 ? `- Interests: ${interests.join(', ')}` : ''}
${dietaryRestrictions && dietaryRestrictions.length > 0 ? `- Dietary restrictions: ${dietaryRestrictions.join(', ')}` : ''}
${mobilityNeeds ? `- Mobility needs: ${mobilityNeeds}` : ''}

REQUIREMENTS:
1. Create a day-by-day itinerary with morning, afternoon, and evening sections
2. Include 2-4 activities per day based on energy levels and interests
3. Recommend specific restaurants for breakfast, lunch, and dinner
4. Provide realistic cost estimates in local currency
5. Include duration for each activity (in minutes)
6. Explain WHY each activity matches the specified vibes
7. Consider practical logistics: travel time between locations, opening hours, rest periods
8. Balance popular tourist spots with authentic local experiences
9. Account for the ${budget} budget level throughout
${travelers.children > 0 ? '10. Ensure all activities are family-friendly and engaging for children' : ''}

For each activity, include:
- Name and detailed description
- Duration and best time of day
- Estimated cost with currency
- Location details
- Vibe match explanation (which vibes it satisfies and why)
- Booking requirements if applicable

For each restaurant, include:
- Name and cuisine type
- Price level (1-4 $)
- Description and why it fits the vibe
- Estimated cost per person
- Meal type (breakfast/lunch/dinner)
- Dietary options if relevant

OUTPUT FORMAT:
Return a valid JSON object matching this structure:
{
  "destination": "${destination}",
  "startDate": "${startDate}",
  "endDate": "${endDate}",
  "overview": "2-3 sentence trip overview",
  "days": [
    {
      "dayNumber": 1,
      "date": "YYYY-MM-DD",
      "title": "Engaging day title",
      "summary": "What makes this day special",
      "morning": {
        "activities": [...],
        "meals": [...]
      },
      "afternoon": {
        "activities": [...],
        "meals": [...]
      },
      "evening": {
        "activities": [...],
        "meals": [...]
      },
      "totalEstimatedCost": {"amount": 0, "currency": "USD"},
      "tips": ["Practical tip 1", "Practical tip 2"]
    }
  ],
  "totalEstimatedCost": {"amount": 0, "currency": "USD"},
  "packingList": ["item1", "item2"],
  "generalTips": ["tip1", "tip2"]
}

Generate the complete itinerary now.`;
}

export function buildActivityRecommendationPrompt(
  destination: string,
  vibes: string[],
  timeOfDay: 'morning' | 'afternoon' | 'evening',
  budget: string
): string {
  return `Recommend 5 specific activities in ${destination} for ${timeOfDay}.

CRITERIA:
- Must match these vibes: ${vibes.join(', ')}
- Budget level: ${budget}
- Time of day: ${timeOfDay}

For each activity, provide:
1. Name and detailed description (2-3 sentences)
2. Duration in minutes
3. Estimated cost in local currency
4. Exact location name
5. Category (sightseeing/adventure/cultural/relaxation/entertainment/shopping)
6. Vibe match explanation: specifically explain which vibes it satisfies and why

OUTPUT FORMAT:
Return a JSON array of activity objects:
[
  {
    "name": "Activity name",
    "description": "Detailed description",
    "duration": 120,
    "estimatedCost": {"amount": 25, "currency": "USD"},
    "timeOfDay": "${timeOfDay}",
    "category": "cultural",
    "location": {"name": "Specific location"},
    "vibeMatch": {
      "matchedVibes": ["vibe1", "vibe2"],
      "reasoning": "This activity matches [vibe1] because... and [vibe2] because..."
    },
    "bookingInfo": {
      "requiresReservation": false
    }
  }
]`;
}

export function buildRestaurantPrompt(
  destination: string,
  vibes: string[],
  mealType: 'breakfast' | 'lunch' | 'dinner',
  budget: string,
  dietaryRestrictions?: string[]
): string {
  return `Recommend 5 specific restaurants in ${destination} for ${mealType}.

CRITERIA:
- Must match these vibes: ${vibes.join(', ')}
- Budget level: ${budget}
- Meal type: ${mealType}
${dietaryRestrictions && dietaryRestrictions.length > 0 ? `- Dietary accommodations needed: ${dietaryRestrictions.join(', ')}` : ''}

For each restaurant, provide:
1. Name and cuisine type
2. Price level (1-4, where 1=$ and 4=$$$$)
3. Description (2-3 sentences about the atmosphere and specialties)
4. Estimated cost per person
5. Location details
6. Dietary options available
7. Vibe match explanation

Aim for variety in cuisine types and price points within the ${budget} budget.

OUTPUT FORMAT:
Return a JSON array of restaurant objects:
[
  {
    "name": "Restaurant name",
    "cuisineType": ["Italian", "Seafood"],
    "priceLevel": 2,
    "description": "Description of atmosphere and specialties",
    "estimatedCost": {"amount": 30, "currency": "USD", "perPerson": true},
    "mealType": "${mealType}",
    "location": {"name": "Neighborhood/area"},
    "dietaryOptions": ["vegetarian", "gluten-free"],
    "vibeMatch": {
      "matchedVibes": ["foodie", "local"],
      "reasoning": "Explanation of why this matches the vibes"
    },
    "reservationInfo": {
      "recommended": true
    }
  }
]`;
}

export const VIBE_EXAMPLES = {
  adventure: 'hiking, kayaking, zip-lining, exploring off-the-beaten-path locations',
  foodie: 'local markets, cooking classes, Michelin restaurants, street food tours',
  relaxed: 'spa days, beach time, slow-paced sightseeing, sunset watching',
  cultural: 'museums, historical sites, local traditions, art galleries, theater',
  nightlife: 'bars, clubs, live music venues, evening entertainment',
  nature: 'parks, gardens, wildlife, scenic viewpoints, outdoor activities',
  luxury: 'high-end dining, premium experiences, private tours, upscale accommodations',
  budget: 'free activities, local eateries, public transportation, self-guided tours',
  romantic: 'sunset spots, intimate dining, couples activities, scenic walks',
  family: 'kid-friendly attractions, interactive museums, outdoor play, family restaurants',
  photography: 'scenic viewpoints, golden hour locations, architectural gems, street scenes',
  shopping: 'local boutiques, markets, malls, artisan workshops, souvenir hunting'
};
