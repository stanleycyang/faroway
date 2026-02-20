export interface Currency {
  code: string;
  symbol: string;
  name: string;
  flag: string;
  exchangeRate: number; // 1 USD = X
  destinations: string[];
  tips: string[];
}

export const currencies: Currency[] = [
  {
    code: 'USD',
    symbol: '$',
    name: 'US Dollar',
    flag: '🇺🇸',
    exchangeRate: 1,
    destinations: ['new-york'],
    tips: [
      'Cards accepted almost everywhere',
      'Tipping 15-20% is standard at restaurants',
      'ATMs widely available with low fees',
    ],
  },
  {
    code: 'EUR',
    symbol: '€',
    name: 'Euro',
    flag: '🇪🇺',
    exchangeRate: 0.92,
    destinations: ['paris', 'barcelona', 'santorini', 'rome', 'lisbon'],
    tips: [
      'Cards widely accepted in Western Europe',
      'Small cash handy for markets and cafés',
      'Tipping 5-10% is customary but not required',
      'Avoid currency exchange at airports — use ATMs instead',
    ],
  },
  {
    code: 'GBP',
    symbol: '£',
    name: 'British Pound',
    flag: '🇬🇧',
    exchangeRate: 0.79,
    destinations: ['london'],
    tips: [
      'Contactless payments accepted almost everywhere',
      'Tipping 10-15% at restaurants is common',
      'Use Monzo or Revolut to avoid foreign transaction fees',
    ],
  },
  {
    code: 'JPY',
    symbol: '¥',
    name: 'Japanese Yen',
    flag: '🇯🇵',
    exchangeRate: 150,
    destinations: ['tokyo'],
    tips: [
      'Japan is still largely a cash society',
      'Withdraw from 7-Eleven or Japan Post ATMs',
      'No tipping culture — it can even be considered rude',
      'IC cards (Suica/Pasmo) work for transit and convenience stores',
    ],
  },
  {
    code: 'THB',
    symbol: '฿',
    name: 'Thai Baht',
    flag: '🇹🇭',
    exchangeRate: 35,
    destinations: ['bangkok'],
    tips: [
      'Cash preferred at street stalls and markets',
      'Cards accepted at malls, hotels, and restaurants',
      'SuperRich exchange offices offer the best rates',
      'Always carry small bills for tuk-tuks and street food',
    ],
  },
  {
    code: 'IDR',
    symbol: 'Rp',
    name: 'Indonesian Rupiah',
    flag: '🇮🇩',
    exchangeRate: 15500,
    destinations: ['bali'],
    tips: [
      'Cash is king — especially at warungs and local shops',
      'ATMs widely available but charge withdrawal fees',
      'Negotiate prices at markets — it\'s expected',
      'Large denominations (Rp 100,000) can be hard to break',
    ],
  },
  {
    code: 'AED',
    symbol: 'د.إ',
    name: 'UAE Dirham',
    flag: '🇦🇪',
    exchangeRate: 3.67,
    destinations: ['dubai'],
    tips: [
      'Cards widely accepted at malls and restaurants',
      'Fixed exchange rate to USD (1 USD ≈ 3.67 AED)',
      'No tipping required but 10% is appreciated',
      'Some taxis prefer cash',
    ],
  },
  {
    code: 'ISK',
    symbol: 'kr',
    name: 'Icelandic Króna',
    flag: '🇮🇸',
    exchangeRate: 138,
    destinations: ['reykjavik'],
    tips: [
      'Cards accepted virtually everywhere — even hot dog stands',
      'Almost no need to carry cash',
      'Tipping is not customary',
      'One of the most expensive countries for food and drink',
    ],
  },
  {
    code: 'MAD',
    symbol: 'د.م.',
    name: 'Moroccan Dirham',
    flag: '🇲🇦',
    exchangeRate: 10,
    destinations: ['marrakech'],
    tips: [
      'Cash essential for souks, taxis, and small shops',
      'Haggling is expected and part of the culture',
      'Exchange money at banks for better rates',
      'Keep small bills for tips and purchases',
    ],
  },
  {
    code: 'ZAR',
    symbol: 'R',
    name: 'South African Rand',
    flag: '🇿🇦',
    exchangeRate: 18.5,
    destinations: ['cape-town'],
    tips: [
      'Cards accepted at most restaurants and shops',
      'Carry cash for markets and informal vendors',
      'Tipping 10-15% is customary at restaurants',
      'Great value for international travelers',
    ],
  },
  {
    code: 'AUD',
    symbol: 'A$',
    name: 'Australian Dollar',
    flag: '🇦🇺',
    exchangeRate: 1.55,
    destinations: ['sydney'],
    tips: [
      'Cards and contactless payments accepted everywhere',
      'Tipping not required but rounding up is appreciated',
      'No need to carry much cash',
      'Comparable costs to major US cities',
    ],
  },
];

export function getCurrencyByCode(code: string): Currency | undefined {
  return currencies.find((c) => c.code === code);
}

export function getCurrencyForDestination(destinationSlug: string): Currency | undefined {
  return currencies.find((c) => c.destinations.includes(destinationSlug));
}

export function convertCurrency(amount: number, fromCode: string, toCode: string): number {
  const from = getCurrencyByCode(fromCode);
  const to = getCurrencyByCode(toCode);
  if (!from || !to) return 0;
  // Convert to USD first, then to target
  const usdAmount = amount / from.exchangeRate;
  return usdAmount * to.exchangeRate;
}
