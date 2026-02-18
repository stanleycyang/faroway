/**
 * Search-related constants used by the multi-agent search system.
 * Extracted from web's lib/search/types.ts
 */

export const VIBE_KEYWORDS: Record<string, string[]> = {
  adventure: ['hiking', 'outdoor', 'extreme', 'sports', 'thrill', 'adventure', 'excursion', 'tour'],
  relaxation: ['spa', 'beach', 'wellness', 'peaceful', 'quiet', 'relaxing', 'retreat', 'massage'],
  cultural: ['museum', 'history', 'art', 'heritage', 'traditional', 'local', 'architecture', 'historical'],
  foodie: ['culinary', 'food tour', 'cooking class', 'market', 'restaurant', 'tasting', 'michelin', 'local cuisine'],
  nightlife: ['bar', 'club', 'nightclub', 'cocktail', 'live music', 'entertainment', 'rooftop', 'lounge'],
  romantic: ['couples', 'romantic', 'sunset', 'candlelit', 'intimate', 'luxury', 'scenic', 'private'],
  nature: ['park', 'garden', 'wildlife', 'nature', 'scenic', 'landscape', 'trail', 'forest', 'mountain'],
  shopping: ['shopping', 'mall', 'boutique', 'market', 'souvenir', 'fashion', 'outlet', 'vintage'],
  wellness: ['yoga', 'meditation', 'spa', 'fitness', 'health', 'detox', 'wellness', 'healing'],
  photography: ['viewpoint', 'scenic', 'landmark', 'instagram', 'photogenic', 'iconic', 'panoramic', 'sunrise'],
};

export const BUDGET_RANGES: Record<string, { hotel: { min: number; max: number }; daily: number }> = {
  budget: { hotel: { min: 30, max: 100 }, daily: 100 },
  moderate: { hotel: { min: 100, max: 250 }, daily: 200 },
  luxury: { hotel: { min: 250, max: 1000 }, daily: 500 },
};
