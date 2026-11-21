import { describe, it, expect } from 'vitest';
import {
  popularDestinations,
  CANONICAL_TRAVEL_VIBE_IDS,
  travelVibes,
  VIBE_ALIASES,
  normalizeVibeId,
  normalizeVibeList,
  travelerTypes,
  VIBE_KEYWORDS,
  BUDGET_RANGES,
  BUDGET_TIERS,
  BUDGET_LABELS,
  BUDGET_TIER_ALIASES,
  normalizeBudgetTier,
  formatBudgetLabel,
  INSPIRATION_CATEGORIES,
  getInspirationBySlug,
  IMAGE_PATHS,
  getImageUrl,
} from '../src/index';

describe('popularDestinations', () => {
  it('is a non-empty array', () => {
    expect(Array.isArray(popularDestinations)).toBe(true);
    expect(popularDestinations.length).toBeGreaterThan(0);
  });

  it('each destination has required fields', () => {
    for (const dest of popularDestinations) {
      expect(typeof dest.id).toBe('string');
      expect(typeof dest.name).toBe('string');
      expect(typeof dest.country).toBe('string');
      expect(typeof dest.description).toBe('string');
      expect(typeof dest.currency).toBe('string');
      expect(typeof dest.language).toBe('string');
      expect(Array.isArray(dest.tags)).toBe(true);
    }
  });

  it('includes Tokyo', () => {
    const tokyo = popularDestinations.find((d) => d.id === 'tokyo');
    expect(tokyo).toBeDefined();
    expect(tokyo?.country).toBe('Japan');
  });

  it('includes Paris', () => {
    const paris = popularDestinations.find((d) => d.id === 'paris');
    expect(paris).toBeDefined();
    expect(paris?.country).toBe('France');
  });
});

describe('travelVibes', () => {
  it('is a non-empty array', () => {
    expect(travelVibes.length).toBeGreaterThan(0);
  });

  it('each vibe has id, label, and emoji', () => {
    for (const vibe of travelVibes) {
      expect(typeof vibe.id).toBe('string');
      expect(typeof vibe.label).toBe('string');
      expect(typeof vibe.emoji).toBe('string');
    }
  });

  it('includes adventure vibe', () => {
    expect(travelVibes.find((v) => v.id === 'adventure')).toBeDefined();
  });

  it('has all 14 canonical vibes with culture, shopping, and photography', () => {
    const ids = travelVibes.map((v) => v.id);
    expect(ids).toEqual([...CANONICAL_TRAVEL_VIBE_IDS]);
    expect(ids).toHaveLength(14);
    expect(new Set(ids).size).toBe(14);
    expect(ids).toContain('culture');
    expect(ids).toContain('shopping');
    expect(ids).toContain('photography');
    expect(ids.slice(0, 5)).toEqual([
      'adventure',
      'relaxation',
      'culture',
      'foodie',
      'nightlife',
    ]);
  });
});

describe('vibe normalization', () => {
  it('maps cultural alias to canonical culture', () => {
    expect(VIBE_ALIASES.cultural).toBe('culture');
    expect(normalizeVibeId('cultural')).toBe('culture');
    expect(normalizeVibeId('  Cultural ')).toBe('culture');
    expect(normalizeVibeId('Culture')).toBe('culture');
    expect(normalizeVibeId('shopping')).toBe('shopping');
    expect(normalizeVibeId('unknown')).toBeUndefined();
    expect(normalizeVibeId(null)).toBeUndefined();
  });

  it('deduplicates, normalizes, drops invalid values, and caps at max', () => {
    expect(
      normalizeVibeList(['cultural', 'culture', 'foodie', 'invalid', 'photography', 'solo', 'budget'])
    ).toEqual(['culture', 'foodie', 'photography', 'solo', 'budget']);
    expect(normalizeVibeList(['adventure', 'relaxation', 'foodie'], 2)).toEqual([
      'adventure',
      'relaxation',
    ]);
  });
});

describe('travelerTypes', () => {
  it('is a non-empty array', () => {
    expect(travelerTypes.length).toBeGreaterThan(0);
  });

  it('each type has id, label, and icon', () => {
    for (const type of travelerTypes) {
      expect(typeof type.id).toBe('string');
      expect(typeof type.label).toBe('string');
      expect(typeof type.icon).toBe('string');
    }
  });

  it('includes solo, couple, family, friends, business', () => {
    const ids = travelerTypes.map((t) => t.id);
    expect(ids).toContain('solo');
    expect(ids).toContain('couple');
    expect(ids).toContain('family');
    expect(ids).toContain('friends');
    expect(ids).toContain('business');
  });
});

describe('VIBE_KEYWORDS', () => {
  it('is an object with string array values', () => {
    expect(typeof VIBE_KEYWORDS).toBe('object');
    for (const [key, value] of Object.entries(VIBE_KEYWORDS)) {
      expect(typeof key).toBe('string');
      expect(Array.isArray(value)).toBe(true);
      for (const keyword of value) {
        expect(typeof keyword).toBe('string');
      }
    }
  });

  it('includes adventure keywords', () => {
    expect(VIBE_KEYWORDS.adventure).toBeDefined();
    expect(VIBE_KEYWORDS.adventure.length).toBeGreaterThan(0);
  });

  it('includes relaxation keywords', () => {
    expect(VIBE_KEYWORDS.relaxation).toBeDefined();
    expect(VIBE_KEYWORDS.relaxation).toContain('spa');
  });

  it('provides parity for culture, cultural, family, budget, luxury, solo, shopping, and photography', () => {
    expect(VIBE_KEYWORDS.culture).toEqual(VIBE_KEYWORDS.cultural);
    for (const key of ['culture', 'cultural', 'family', 'budget', 'luxury', 'solo', 'shopping', 'photography']) {
      expect(VIBE_KEYWORDS[key]).toBeDefined();
      expect(VIBE_KEYWORDS[key]!.length).toBeGreaterThan(0);
    }
  });
});

describe('BUDGET_TIERS and budget helpers', () => {
  it('exports canonical Budget, Moderate, and Luxury labels', () => {
    expect(BUDGET_LABELS).toEqual({
      budget: 'Budget',
      moderate: 'Moderate',
      luxury: 'Luxury',
    });
    expect(BUDGET_TIERS.map((t) => t.id)).toEqual(['budget', 'moderate', 'luxury']);
    expect(BUDGET_TIERS.map((t) => t.label)).toEqual(['Budget', 'Moderate', 'Luxury']);
    expect(BUDGET_TIER_ALIASES.comfort).toBe('moderate');
  });

  it('normalizes legacy labels including Comfort and mid_range', () => {
    expect(normalizeBudgetTier('Comfort')).toBe('moderate');
    expect(normalizeBudgetTier('  comfort ')).toBe('moderate');
    expect(normalizeBudgetTier('mid_range')).toBe('moderate');
    expect(normalizeBudgetTier('mid-range')).toBe('moderate');
    expect(normalizeBudgetTier('Moderate')).toBe('moderate');
    expect(normalizeBudgetTier('BUDGET')).toBe('budget');
    expect(normalizeBudgetTier('luxury')).toBe('luxury');
    expect(normalizeBudgetTier('extreme')).toBeUndefined();
    expect(normalizeBudgetTier(42)).toBeUndefined();

    expect(formatBudgetLabel('comfort')).toBe('Moderate');
    expect(formatBudgetLabel('budget')).toBe('Budget');
    expect(formatBudgetLabel('luxury')).toBe('Luxury');
    expect(formatBudgetLabel('invalid')).toBeUndefined();
  });
});

describe('BUDGET_RANGES', () => {
  it('has budget, moderate, and luxury tiers', () => {
    expect(BUDGET_RANGES.budget).toBeDefined();
    expect(BUDGET_RANGES.moderate).toBeDefined();
    expect(BUDGET_RANGES.luxury).toBeDefined();
  });

  it('budget tier has lower range than luxury', () => {
    expect(BUDGET_RANGES.budget.hotel.max).toBeLessThan(BUDGET_RANGES.luxury.hotel.max);
    expect(BUDGET_RANGES.budget.daily).toBeLessThan(BUDGET_RANGES.luxury.daily);
  });

  it('each tier has hotel.min, hotel.max, and daily', () => {
    for (const tier of Object.values(BUDGET_RANGES)) {
      expect(typeof tier.hotel.min).toBe('number');
      expect(typeof tier.hotel.max).toBe('number');
      expect(typeof tier.daily).toBe('number');
      expect(tier.hotel.min).toBeLessThanOrEqual(tier.hotel.max);
    }
  });
});

describe('INSPIRATION_CATEGORIES', () => {
  it('is a non-empty array', () => {
    expect(INSPIRATION_CATEGORIES.length).toBeGreaterThan(0);
  });

  it('each category has required fields', () => {
    for (const cat of INSPIRATION_CATEGORIES) {
      expect(typeof cat.slug).toBe('string');
      expect(typeof cat.title).toBe('string');
      expect(typeof cat.tagline).toBe('string');
      expect(Array.isArray(cat.vibes)).toBe(true);
      expect(Array.isArray(cat.tags)).toBe(true);
      expect(Array.isArray(cat.highlights)).toBe(true);
      expect(typeof cat.suggestedDuration).toBe('number');
      expect(typeof cat.suggestedTravelerType).toBe('string');
      expect(cat.gradientColors).toHaveLength(2);
    }
  });
});

describe('getInspirationBySlug', () => {
  it('returns category for valid slug', () => {
    const beach = getInspirationBySlug('beach-getaway');
    expect(beach).toBeDefined();
    expect(beach?.title).toBe('Beach Getaway');
  });

  it('returns undefined for invalid slug', () => {
    expect(getInspirationBySlug('nonexistent')).toBeUndefined();
  });
});

describe('IMAGE_PATHS', () => {
  it('has destinations object', () => {
    expect(IMAGE_PATHS.destinations).toBeDefined();
    expect(typeof IMAGE_PATHS.destinations.tokyo).toBe('string');
  });

  it('has inspirations object', () => {
    expect(IMAGE_PATHS.inspirations).toBeDefined();
    expect(typeof IMAGE_PATHS.inspirations['beach-getaway']).toBe('string');
  });

  it('has blog object', () => {
    expect(IMAGE_PATHS.blog).toBeDefined();
  });

  it('has marketing object', () => {
    expect(IMAGE_PATHS.marketing).toBeDefined();
  });
});

describe('getImageUrl', () => {
  it('constructs Supabase storage URL', () => {
    const url = getImageUrl('destinations/tokyo.jpg');
    expect(url).toContain('/storage/v1/object/public/images/destinations/tokyo.jpg');
  });

  it('uses NEXT_PUBLIC_SUPABASE_URL env if set', () => {
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://my-supabase.supabase.co';
    const url = getImageUrl('test.jpg');
    expect(url).toBe('https://my-supabase.supabase.co/storage/v1/object/public/images/test.jpg');
    if (origUrl) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
    } else {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    }
  });
});
