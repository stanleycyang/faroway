import { IMAGE_PATHS } from './images';
import { getImageUrl } from './storage';

export interface InspirationCategory {
  slug: string;
  emoji: string;
  title: string;
  tagline: string;
  heroImage: string;
  gradientColors: [string, string];
  vibes: string[];
  tags: string[];
  highlights: string[];
  suggestedDuration: number;
  suggestedTravelerType: string;
}

export const INSPIRATION_CATEGORIES: InspirationCategory[] = [
  {
    slug: 'beach-getaway',
    emoji: '\u{1F3D6}\uFE0F',
    title: 'Beach Getaway',
    tagline: 'Sun, sand, and endless blue horizons',
    heroImage: getImageUrl(IMAGE_PATHS.inspirations['beach-getaway']),
    gradientColors: ['#0ea5e9', '#06b6d4'],
    vibes: ['relaxation', 'nature'],
    tags: ['beach', 'relaxation', 'views'],
    highlights: ['Crystal waters', 'Sunset dinners', 'Seaside strolls', 'Water sports'],
    suggestedDuration: 7,
    suggestedTravelerType: 'couple',
  },
  {
    slug: 'mountain-escape',
    emoji: '\u{1F3D4}\uFE0F',
    title: 'Mountain Escape',
    tagline: 'Fresh air, epic trails, and breathtaking peaks',
    heroImage: getImageUrl(IMAGE_PATHS.inspirations['mountain-escape']),
    gradientColors: ['#059669', '#10b981'],
    vibes: ['adventure', 'nature'],
    tags: ['mountain', 'adventure', 'nature', 'hiking'],
    highlights: ['Alpine trails', 'Mountain views', 'Cozy lodges', 'Fresh air'],
    suggestedDuration: 5,
    suggestedTravelerType: 'friends',
  },
  {
    slug: 'foodie-adventure',
    emoji: '\u{1F35C}',
    title: 'Foodie Adventure',
    tagline: 'Taste your way through the world\u2019s best flavors',
    heroImage: getImageUrl(IMAGE_PATHS.inspirations['foodie-adventure']),
    gradientColors: ['#ea580c', '#f59e0b'],
    vibes: ['foodie', 'culture'],
    tags: ['food', 'culture', 'shopping'],
    highlights: ['Street food tours', 'Cooking classes', 'Local markets', 'Fine dining'],
    suggestedDuration: 5,
    suggestedTravelerType: 'couple',
  },
  {
    slug: 'art-and-culture',
    emoji: '\u{1F3A8}',
    title: 'Art & Culture',
    tagline: 'Museums, history, and stories around every corner',
    heroImage: getImageUrl(IMAGE_PATHS.inspirations['art-and-culture']),
    gradientColors: ['#7c3aed', '#a855f7'],
    vibes: ['culture', 'romantic'],
    tags: ['culture', 'art', 'heritage', 'architecture'],
    highlights: ['World-class museums', 'Historic quarters', 'Local artisans', 'Guided tours'],
    suggestedDuration: 6,
    suggestedTravelerType: 'couple',
  },
  {
    slug: 'party-weekend',
    emoji: '\u{1F389}',
    title: 'Party Weekend',
    tagline: 'Dance till dawn in the world\u2019s hottest spots',
    heroImage: getImageUrl(IMAGE_PATHS.inspirations['party-weekend']),
    gradientColors: ['#e11d48', '#f43f5e'],
    vibes: ['nightlife', 'adventure'],
    tags: ['party', 'nightlife', 'entertainment', 'urban'],
    highlights: ['Rooftop bars', 'Live music', 'Club hopping', 'Late-night eats'],
    suggestedDuration: 4,
    suggestedTravelerType: 'friends',
  },
  {
    slug: 'romantic-trip',
    emoji: '\u{1F491}',
    title: 'Romantic Trip',
    tagline: 'Unforgettable moments for two',
    heroImage: getImageUrl(IMAGE_PATHS.inspirations['romantic-trip']),
    gradientColors: ['#db2777', '#ec4899'],
    vibes: ['romantic', 'luxury'],
    tags: ['romantic', 'views', 'luxury', 'relaxation'],
    highlights: ['Candlelit dinners', 'Scenic sunsets', 'Couples spa', 'Private tours'],
    suggestedDuration: 7,
    suggestedTravelerType: 'couple',
  },
];

export function getInspirationBySlug(slug: string): InspirationCategory | undefined {
  return INSPIRATION_CATEGORIES.find((c) => c.slug === slug);
}
