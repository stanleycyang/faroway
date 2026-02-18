/**
 * TripGenie AI Module
 * Unified exports for AI-powered features
 * 
 * Architecture: AI SDK + Vercel AI Gateway
 * @see https://ai-sdk.dev
 * @see https://vercel.com/ai-gateway
 */

// Main client (AI Gateway + AI SDK)
export {
  generateItinerary,
  streamItinerary,
  generateActivities,
  generateRestaurants,
  generateText_AI,
  validateApiKey,
} from './client';

// Types
export * from './types';

// Prompts (for customization)
export {
  SYSTEM_PROMPT,
  VIBE_EXAMPLES,
  buildItineraryPrompt,
  buildActivityRecommendationPrompt,
  buildRestaurantPrompt,
} from './prompts';

// Legacy direct Anthropic client (for reference/fallback)
export * as legacyClient from './claude';
