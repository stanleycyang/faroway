/**
 * Search-related constants used by the multi-agent search system.
 * Extracted from web's lib/search/types.ts
 */

const CULTURE_KEYWORDS = [
  'museum',
  'history',
  'art',
  'heritage',
  'traditional',
  'local',
  'architecture',
  'historical',
];

export const VIBE_KEYWORDS: Record<string, string[]> = {
  adventure: ['hiking', 'outdoor', 'extreme', 'sports', 'thrill', 'adventure', 'excursion', 'tour'],
  relaxation: ['spa', 'beach', 'wellness', 'peaceful', 'quiet', 'relaxing', 'retreat', 'massage'],
  culture: CULTURE_KEYWORDS,
  cultural: CULTURE_KEYWORDS,
  foodie: ['culinary', 'food tour', 'cooking class', 'market', 'restaurant', 'tasting', 'michelin', 'local cuisine'],
  nightlife: ['bar', 'club', 'nightclub', 'cocktail', 'live music', 'entertainment', 'rooftop', 'lounge'],
  romantic: ['couples', 'romantic', 'sunset', 'candlelit', 'intimate', 'luxury', 'scenic', 'private'],
  nature: ['park', 'garden', 'wildlife', 'nature', 'scenic', 'landscape', 'trail', 'forest', 'mountain'],
  family: ['family-friendly', 'kids', 'zoo', 'aquarium', 'theme park', 'interactive', 'museum', 'park'],
  budget: ['free', 'walking tour', 'street food', 'market', 'public park', 'viewpoint', 'affordable', 'local'],
  luxury: ['michelin', 'private tour', 'five-star', 'yacht', 'spa', 'fine dining', 'vip', 'boutique'],
  solo: ['walking tour', 'cafe', 'museum', 'hostel', 'food market', 'local', 'scenic', 'gallery'],
  shopping: ['shopping', 'mall', 'boutique', 'market', 'souvenir', 'fashion', 'outlet', 'vintage'],
  wellness: ['yoga', 'meditation', 'spa', 'fitness', 'health', 'detox', 'wellness', 'healing'],
  photography: ['viewpoint', 'scenic', 'landmark', 'instagram', 'photogenic', 'iconic', 'panoramic', 'sunrise'],
};

export const BUDGET_RANGES: Record<string, { hotel: { min: number; max: number }; daily: number }> = {
  budget: { hotel: { min: 30, max: 100 }, daily: 100 },
  moderate: { hotel: { min: 100, max: 250 }, daily: 200 },
  luxury: { hotel: { min: 250, max: 1000 }, daily: 500 },
};

export type BudgetTierId = 'budget' | 'moderate' | 'luxury';
export type BudgetTierLabel = 'Budget' | 'Moderate' | 'Luxury';

export interface BudgetTierOption {
  id: BudgetTierId;
  label: BudgetTierLabel;
  description: string;
  legacyLabels: readonly string[];
  icon: string;
}

export const BUDGET_TIERS: readonly BudgetTierOption[] = [
  {
    id: 'budget',
    label: 'Budget',
    description: 'Best value & thoughtful stays',
    legacyLabels: ['Budget'],
    icon: 'wallet-outline',
  },
  {
    id: 'moderate',
    label: 'Moderate',
    description: 'Balance of comfort & cost',
    legacyLabels: ['Comfort', 'Moderate'],
    icon: 'cash-outline',
  },
  {
    id: 'luxury',
    label: 'Luxury',
    description: 'Exceptional stays & experiences',
    legacyLabels: ['Luxury'],
    icon: 'sparkles-outline',
  },
] as const;

export const BUDGET_LABELS: Record<BudgetTierId, BudgetTierLabel> = {
  budget: 'Budget',
  moderate: 'Moderate',
  luxury: 'Luxury',
};

export const BUDGET_TIER_ALIASES: Record<string, BudgetTierId> = {
  budget: 'budget',
  moderate: 'moderate',
  comfort: 'moderate',
  mid_range: 'moderate',
  'mid-range': 'moderate',
  luxury: 'luxury',
};

export function normalizeBudgetTier(value: unknown): BudgetTierId | undefined {
  if (typeof value !== 'string') return undefined;
  const key = value.trim().toLowerCase();
  return key ? BUDGET_TIER_ALIASES[key] : undefined;
}

export function formatBudgetLabel(value: unknown): BudgetTierLabel | undefined {
  const tier = normalizeBudgetTier(value);
  return tier ? BUDGET_LABELS[tier] : undefined;
}
