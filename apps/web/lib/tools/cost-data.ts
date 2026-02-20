export interface CostProfile {
  slug: string;
  costMultiplier: number; // Relative to BUDGET_RANGES daily rate
  breakdown: {
    accommodation: number; // Percentage
    food: number;
    transport: number;
    activities: number;
    misc: number;
  };
  currency: string;
  currencySymbol: string;
  exchangeRate: number; // 1 USD = X local
  samplePrices: { item: string; priceUSD: number }[];
}

export const costProfiles: CostProfile[] = [
  {
    slug: 'tokyo',
    costMultiplier: 1.1,
    breakdown: { accommodation: 35, food: 25, transport: 15, activities: 15, misc: 10 },
    currency: 'JPY',
    currencySymbol: '¥',
    exchangeRate: 150,
    samplePrices: [
      { item: 'Bowl of ramen', priceUSD: 8 },
      { item: 'Metro day pass', priceUSD: 6 },
      { item: 'Museum entry', priceUSD: 10 },
      { item: 'Sushi lunch set', priceUSD: 12 },
    ],
  },
  {
    slug: 'bali',
    costMultiplier: 0.5,
    breakdown: { accommodation: 30, food: 25, transport: 15, activities: 20, misc: 10 },
    currency: 'IDR',
    currencySymbol: 'Rp',
    exchangeRate: 15500,
    samplePrices: [
      { item: 'Nasi goreng at warung', priceUSD: 2 },
      { item: 'Scooter rental/day', priceUSD: 5 },
      { item: 'Surf lesson', priceUSD: 25 },
      { item: 'Villa per night', priceUSD: 40 },
    ],
  },
  {
    slug: 'bangkok',
    costMultiplier: 0.45,
    breakdown: { accommodation: 30, food: 25, transport: 10, activities: 20, misc: 15 },
    currency: 'THB',
    currencySymbol: '฿',
    exchangeRate: 35,
    samplePrices: [
      { item: 'Pad thai from street stall', priceUSD: 1.5 },
      { item: 'BTS day pass', priceUSD: 4 },
      { item: 'Thai massage (1hr)', priceUSD: 8 },
      { item: 'Grand Palace entry', priceUSD: 15 },
    ],
  },
  {
    slug: 'dubai',
    costMultiplier: 1.5,
    breakdown: { accommodation: 40, food: 20, transport: 10, activities: 20, misc: 10 },
    currency: 'AED',
    currencySymbol: 'د.إ',
    exchangeRate: 3.67,
    samplePrices: [
      { item: 'Burj Khalifa ticket', priceUSD: 40 },
      { item: 'Desert safari', priceUSD: 50 },
      { item: 'Shawarma', priceUSD: 3 },
      { item: 'Metro day pass', priceUSD: 6 },
    ],
  },
  {
    slug: 'paris',
    costMultiplier: 1.3,
    breakdown: { accommodation: 40, food: 25, transport: 10, activities: 15, misc: 10 },
    currency: 'EUR',
    currencySymbol: '€',
    exchangeRate: 0.92,
    samplePrices: [
      { item: 'Croissant & coffee', priceUSD: 5 },
      { item: 'Metro carnet (10 rides)', priceUSD: 18 },
      { item: 'Louvre entry', priceUSD: 20 },
      { item: 'Bistro dinner', priceUSD: 35 },
    ],
  },
  {
    slug: 'barcelona',
    costMultiplier: 0.9,
    breakdown: { accommodation: 35, food: 25, transport: 10, activities: 20, misc: 10 },
    currency: 'EUR',
    currencySymbol: '€',
    exchangeRate: 0.92,
    samplePrices: [
      { item: 'Tapas & beer', priceUSD: 10 },
      { item: 'Sagrada Familia ticket', priceUSD: 28 },
      { item: 'T-Casual metro (10 rides)', priceUSD: 12 },
      { item: 'Paella for two', priceUSD: 25 },
    ],
  },
  {
    slug: 'santorini',
    costMultiplier: 1.2,
    breakdown: { accommodation: 45, food: 20, transport: 10, activities: 15, misc: 10 },
    currency: 'EUR',
    currencySymbol: '€',
    exchangeRate: 0.92,
    samplePrices: [
      { item: 'Greek salad', priceUSD: 8 },
      { item: 'Caldera boat tour', priceUSD: 45 },
      { item: 'Wine tasting', priceUSD: 20 },
      { item: 'ATV rental/day', priceUSD: 30 },
    ],
  },
  {
    slug: 'london',
    costMultiplier: 1.4,
    breakdown: { accommodation: 40, food: 20, transport: 15, activities: 15, misc: 10 },
    currency: 'GBP',
    currencySymbol: '£',
    exchangeRate: 0.79,
    samplePrices: [
      { item: 'Fish & chips', priceUSD: 12 },
      { item: 'Tube day pass (Zone 1-2)', priceUSD: 10 },
      { item: 'West End show', priceUSD: 50 },
      { item: 'Afternoon tea', priceUSD: 40 },
    ],
  },
  {
    slug: 'rome',
    costMultiplier: 1.0,
    breakdown: { accommodation: 35, food: 25, transport: 10, activities: 20, misc: 10 },
    currency: 'EUR',
    currencySymbol: '€',
    exchangeRate: 0.92,
    samplePrices: [
      { item: 'Pizza al taglio', priceUSD: 4 },
      { item: 'Colosseum ticket', priceUSD: 18 },
      { item: 'Gelato', priceUSD: 3.5 },
      { item: 'Trattoria dinner', priceUSD: 25 },
    ],
  },
  {
    slug: 'lisbon',
    costMultiplier: 0.7,
    breakdown: { accommodation: 30, food: 25, transport: 10, activities: 20, misc: 15 },
    currency: 'EUR',
    currencySymbol: '€',
    exchangeRate: 0.92,
    samplePrices: [
      { item: 'Pastel de nata & coffee', priceUSD: 2.5 },
      { item: 'Tram 28 ride', priceUSD: 3.5 },
      { item: 'Fado show', priceUSD: 25 },
      { item: 'Sintra palace entry', priceUSD: 15 },
    ],
  },
  {
    slug: 'reykjavik',
    costMultiplier: 1.8,
    breakdown: { accommodation: 35, food: 25, transport: 15, activities: 15, misc: 10 },
    currency: 'ISK',
    currencySymbol: 'kr',
    exchangeRate: 138,
    samplePrices: [
      { item: 'Blue Lagoon entry', priceUSD: 75 },
      { item: 'Hot dog (Baejarins Beztu)', priceUSD: 5 },
      { item: 'Golden Circle tour', priceUSD: 60 },
      { item: 'Whale watching', priceUSD: 80 },
    ],
  },
  {
    slug: 'new-york',
    costMultiplier: 1.5,
    breakdown: { accommodation: 45, food: 20, transport: 10, activities: 15, misc: 10 },
    currency: 'USD',
    currencySymbol: '$',
    exchangeRate: 1,
    samplePrices: [
      { item: 'Slice of pizza', priceUSD: 3.5 },
      { item: 'Subway ride', priceUSD: 2.9 },
      { item: 'Broadway show', priceUSD: 80 },
      { item: 'Statue of Liberty ferry', priceUSD: 24 },
    ],
  },
  {
    slug: 'marrakech',
    costMultiplier: 0.45,
    breakdown: { accommodation: 30, food: 20, transport: 10, activities: 25, misc: 15 },
    currency: 'MAD',
    currencySymbol: 'د.م.',
    exchangeRate: 10,
    samplePrices: [
      { item: 'Tagine at local café', priceUSD: 4 },
      { item: 'Hammam experience', priceUSD: 15 },
      { item: 'Souk shopping spree', priceUSD: 20 },
      { item: 'Atlas Mountains day trip', priceUSD: 30 },
    ],
  },
  {
    slug: 'cape-town',
    costMultiplier: 0.55,
    breakdown: { accommodation: 30, food: 20, transport: 15, activities: 25, misc: 10 },
    currency: 'ZAR',
    currencySymbol: 'R',
    exchangeRate: 18.5,
    samplePrices: [
      { item: 'Table Mountain cable car', priceUSD: 16 },
      { item: 'Wine tasting (Stellenbosch)', priceUSD: 8 },
      { item: 'Meal at waterfront', priceUSD: 12 },
      { item: 'Cape Peninsula tour', priceUSD: 40 },
    ],
  },
  {
    slug: 'sydney',
    costMultiplier: 1.3,
    breakdown: { accommodation: 40, food: 20, transport: 15, activities: 15, misc: 10 },
    currency: 'AUD',
    currencySymbol: 'A$',
    exchangeRate: 1.55,
    samplePrices: [
      { item: 'Flat white coffee', priceUSD: 4 },
      { item: 'Opal card day cap', priceUSD: 12 },
      { item: 'Opera House tour', priceUSD: 30 },
      { item: 'Fish & chips at Bondi', priceUSD: 15 },
    ],
  },
];

export function getCostProfile(slug: string): CostProfile | undefined {
  return costProfiles.find((p) => p.slug === slug);
}
