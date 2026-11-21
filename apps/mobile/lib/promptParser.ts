import {
  destinationCoverCatalog,
  destinationImage as catalogDestinationImage,
  popularDestinations,
  travelVibes,
} from '@faroway/constants';
import type { TravelerRequirements } from '@faroway/types';
import { travelerRequirementsSchema } from './travelerRequirements';

export type BudgetTier = 'budget' | 'moderate' | 'luxury';
export type TravelerTypeId = 'solo' | 'couple' | 'family' | 'friends' | 'business';

export interface ParsedTripPrompt {
  destination?: string;
  country?: string;
  startDate?: string;
  endDate?: string;
  days?: number;
  travelers?: number;
  travelerType?: TravelerTypeId;
  budget?: BudgetTier;
  vibes: string[];
  requirements?: TravelerRequirements;
  summary: string[];
  source: 'api' | 'local';
}

export interface DestinationSuggestion {
  id: string;
  destination: string;
  country: string;
  image?: string;
  whyItFits: string;
  seasonNote: string;
  suggestedVibes: string[];
  suggestedBudget: BudgetTier;
  suggestedDays: number;
}

export interface SuggestDestinationsInput {
  query: string;
  month?: string;
  budget?: BudgetTier;
  days?: number;
}

const VALID_VIBE_IDS = new Set(travelVibes.map((v) => v.id));

const MONTH_MAP: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const DESTINATION_ALIASES: Array<{ pattern: RegExp; city: string; country: string }> = [
  { pattern: /\b(nyc|new york city|manhattan|brooklyn)\b/i, city: 'New York', country: 'USA' },
  { pattern: /\bamalfi\b/i, city: 'Amalfi Coast', country: 'Italy' },
  { pattern: /\brio\b/i, city: 'Rio de Janeiro', country: 'Brazil' },
  { pattern: /\biceland\b/i, city: 'Reykjavik', country: 'Iceland' },
  { pattern: /\bswiss alps\b/i, city: 'Interlaken', country: 'Switzerland' },
  { pattern: /\bmont blanc\b/i, city: 'Chamonix', country: 'France' },
  { pattern: /\bsan francisco\b/i, city: 'San Francisco', country: 'USA' },
  { pattern: /\blos angeles\b/i, city: 'Los Angeles', country: 'USA' },
  { pattern: /\bflorence\b/i, city: 'Florence', country: 'Italy' },
  { pattern: /\bvenice\b/i, city: 'Venice', country: 'Italy' },
  { pattern: /\bosaka\b/i, city: 'Osaka', country: 'Japan' },
  { pattern: /\bedinburgh\b/i, city: 'Edinburgh', country: 'United Kingdom' },
  { pattern: /\bmelbourne\b/i, city: 'Melbourne', country: 'Australia' },
  { pattern: /\bmexico city\b/i, city: 'Mexico City', country: 'Mexico' },
  { pattern: /\bchiang mai\b/i, city: 'Chiang Mai', country: 'Thailand' },
  { pattern: /\bmontreal\b/i, city: 'Montreal', country: 'Canada' },
  { pattern: /\bseville\b/i, city: 'Seville', country: 'Spain' },
  { pattern: /\bporto\b/i, city: 'Porto', country: 'Portugal' },
  { pattern: /\bathens\b/i, city: 'Athens', country: 'Greece' },
  { pattern: /\bberlin\b/i, city: 'Berlin', country: 'Germany' },
  { pattern: /\bmunich\b/i, city: 'Munich', country: 'Germany' },
  { pattern: /\bzurich\b/i, city: 'Zurich', country: 'Switzerland' },
];

const VIBE_PATTERNS: Array<{ id: string; pattern: RegExp }> = [
  {
    id: 'foodie',
    pattern:
      /\b(food|foodie|ramen|sushi|tapas|pasta|wine|street food|culinary|dining|restaurants?|cafes?|baker(?:y|ies)|markets?|michelin|eat(?:ing)?)\b/i,
  },
  {
    id: 'culture',
    pattern:
      /\b(culture|cultural|history|historic|museum|museums|art|galleries|temples?|shrines?|architecture|heritage|local|old town)\b/i,
  },
  {
    id: 'relaxation',
    pattern:
      /\b(relax|relaxing|relaxation|chill|slow|laid[- ]back|beach|beaches|coastal|resort|unhurried|unwind|easygoing)\b/i,
  },
  {
    id: 'adventure',
    pattern:
      /\b(adventure|adventurous|hiking|hike|trek|ski|skiing|surf|surfing|kayak|zip[- ]?line|climb|alpine|thrill|outdoor)\b/i,
  },
  {
    id: 'nature',
    pattern:
      /\b(nature|scenic|mountains?|lakes?|forest|national park|wildlife|gardens?|waterfalls?|fjords?|countryside|aurora|northern lights)\b/i,
  },
  {
    id: 'romantic',
    pattern: /\b(romantic|romance|anniversary|honeymoon|sunset|couples?|intimate|getaway)\b/i,
  },
  {
    id: 'nightlife',
    pattern: /\b(nightlife|bars?|clubs?|party|cocktails?|music|live music|rooftop|pubs?)\b/i,
  },
  {
    id: 'wellness',
    pattern: /\b(wellness|spa|yoga|retreat|onsen|hot springs?|thermal|mindful|meditation)\b/i,
  },
  {
    id: 'family',
    pattern: /\b(family|kids?|children|toddler|stroller|family[- ]friendly|theme park)\b/i,
  },
  { id: 'luxury', pattern: /\b(luxury|upscale|5[- ]?star|five[- ]?star|splurge|boutique)\b/i },
  { id: 'budget', pattern: /\b(budget|affordable|cheap|backpack(?:er|ing)?|shoestring)\b/i },
  { id: 'solo', pattern: /\b(solo|by myself|alone|independent)\b/i },
];

const DIETARY_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'Vegetarian', pattern: /\bvegetarian\b/i },
  { label: 'Vegan', pattern: /\bvegan|plant[- ]based\b/i },
  { label: 'Halal', pattern: /\bhalal\b/i },
  { label: 'Kosher', pattern: /\bkosher\b/i },
  { label: 'Gluten-free', pattern: /\bgluten[- ]?free|celiac\b/i },
  { label: 'Pescatarian', pattern: /\bpescatarian\b/i },
  { label: 'Dairy-free', pattern: /\bdairy[- ]?free|lactose[- ]?free\b/i },
];

const KNOWN_ALLERGENS = [
  'peanuts',
  'peanut',
  'tree nuts',
  'nuts',
  'nut',
  'shellfish',
  'shrimp',
  'crustaceans',
  'fish',
  'seafood',
  'dairy',
  'milk',
  'eggs',
  'egg',
  'soy',
  'sesame',
  'wheat',
  'gluten',
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
  return next;
}

function makeValidDate(year: number, month: number, day: number): Date | null {
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
    return null;
  }
  return d;
}

function upcomingMonthStart(month: number, day: number, now: Date): Date {
  const thisYear = makeValidDate(now.getFullYear(), month, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (thisYear && thisYear >= today) {
    return thisYear;
  }
  return (
    makeValidDate(now.getFullYear() + 1, month, day) ??
    new Date(now.getFullYear() + 1, month - 1, Math.min(day, 28))
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function titleCase(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word) => (word.length > 0 ? word[0].toUpperCase() + word.slice(1).toLowerCase() : ''))
    .join(' ');
}

function extractDestination(prompt: string): { destination?: string; country?: string } {
  // 1. Check catalog entries (longest city names first so "Rio de Janeiro" beats shorter matches)
  const catalogEntries = [...destinationCoverCatalog].sort((a, b) => b[1].length - a[1].length);
  for (const [, city, country] of catalogEntries) {
    const pattern = new RegExp(`\\b${escapeRegExp(city)}\\b`, 'i');
    if (pattern.test(prompt)) {
      return { destination: city, country };
    }
  }

  // 2. Check aliases
  for (const alias of DESTINATION_ALIASES) {
    if (alias.pattern.test(prompt)) {
      return { destination: alias.city, country: alias.country };
    }
  }

  // 3. Check country mentions mapped to popular flagship city when user says e.g. "5 days in Japan"
  const countryFallbacks: Array<{ pattern: RegExp; city: string; country: string }> = [
    { pattern: /\bjapan\b/i, city: 'Tokyo', country: 'Japan' },
    { pattern: /\bfrance\b/i, city: 'Paris', country: 'France' },
    { pattern: /\bitaly\b/i, city: 'Rome', country: 'Italy' },
    { pattern: /\bspain\b/i, city: 'Barcelona', country: 'Spain' },
    { pattern: /\bportugal\b/i, city: 'Lisbon', country: 'Portugal' },
    { pattern: /\bgreece\b/i, city: 'Santorini', country: 'Greece' },
    { pattern: /\bthailand\b/i, city: 'Bangkok', country: 'Thailand' },
    { pattern: /\bmorocco\b/i, city: 'Marrakech', country: 'Morocco' },
    { pattern: /\bvietnam\b/i, city: 'Hanoi', country: 'Vietnam' },
    { pattern: /\bsouth korea|korea\b/i, city: 'Seoul', country: 'South Korea' },
    { pattern: /\bscotland\b/i, city: 'Edinburgh', country: 'United Kingdom' },
    { pattern: /\bireland\b/i, city: 'Dublin', country: 'Ireland' },
    { pattern: /\bnetherlands|holland\b/i, city: 'Amsterdam', country: 'Netherlands' },
    { pattern: /\bswitzerland\b/i, city: 'Interlaken', country: 'Switzerland' },
    { pattern: /\bnew zealand\b/i, city: 'Queenstown', country: 'New Zealand' },
    { pattern: /\baustralia\b/i, city: 'Sydney', country: 'Australia' },
    { pattern: /\bcanada\b/i, city: 'Vancouver', country: 'Canada' },
  ];
  for (const fallback of countryFallbacks) {
    if (fallback.pattern.test(prompt)) {
      return { destination: fallback.city, country: fallback.country };
    }
  }

  // 4. Free-form "to <City>" / "visit <City>" extraction (avoid matching months/seasons/generic nouns)
  const stopWords = new Set([
    ...Object.keys(MONTH_MAP),
    'spring',
    'summer',
    'fall',
    'autumn',
    'winter',
    'europe',
    'asia',
    'africa',
    'somewhere',
    'anywhere',
    'beach',
    'mountains',
    'relax',
    'celebrate',
    'eat',
    'explore',
    'escape',
    'go',
    'travel',
    'visit',
    'see',
  ]);
  const freeFormMatch =
    /\b(?:to|visit|exploring|trip\s+to)\s+([A-Z][a-zA-Z'-]+(?:\s+[A-Z][a-zA-Z'-]+){0,2})\b/.exec(
      prompt
    );
  if (freeFormMatch) {
    const candidate = freeFormMatch[1].trim();
    const firstWord = candidate.split(/\s+/)[0]?.toLowerCase() ?? '';
    if (candidate.length >= 3 && !stopWords.has(firstWord)) {
      return { destination: candidate };
    }
  }

  return {};
}

function extractDatesAndDuration(
  prompt: string,
  now: Date
): { startDate?: string; endDate?: string; days?: number } {
  // 1. Explicit ISO dates
  const isoRange = /\b(\d{4}-\d{2}-\d{2})\s*(?:to|through|-|–|—)\s*(\d{4}-\d{2}-\d{2})\b/i.exec(
    prompt
  );
  if (isoRange) {
    const [, startStr, endStr] = isoRange;
    const [sy, sm, sd] = startStr.split('-').map(Number);
    const [ey, em, ed] = endStr.split('-').map(Number);
    const s = makeValidDate(sy, sm, sd);
    const e = makeValidDate(ey, em, ed);
    if (s && e && e >= s) {
      const days = Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
      return { startDate: formatIsoDate(s), endDate: formatIsoDate(e), days };
    }
  }

  // 2. Month + day range: "May 10-15", "Oct 12 to Oct 18", "Nov 28 - Dec 3"
  const monthNames = Object.keys(MONTH_MAP).join('|');
  const monthDayRange = new RegExp(
    `\\b(${monthNames})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|through|-|–|—)\\s*(?:(${monthNames})\\.?\\s+)?(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(20\\d{2}))?\\b`,
    'i'
  ).exec(prompt);
  if (monthDayRange) {
    const startMonth = MONTH_MAP[monthDayRange[1].toLowerCase()];
    const startDay = Number(monthDayRange[2]);
    const endMonth = monthDayRange[3] ? MONTH_MAP[monthDayRange[3].toLowerCase()] : startMonth;
    const endDay = Number(monthDayRange[4]);
    const explicitYear = monthDayRange[5] ? Number(monthDayRange[5]) : undefined;
    const start = explicitYear
      ? makeValidDate(explicitYear, startMonth, startDay)
      : upcomingMonthStart(startMonth, startDay, now);
    if (start) {
      const endYear = endMonth < startMonth ? start.getFullYear() + 1 : start.getFullYear();
      const end = makeValidDate(endYear, endMonth, endDay);
      if (end && end >= start) {
        const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
        if (days <= 30) {
          return { startDate: formatIsoDate(start), endDate: formatIsoDate(end), days };
        }
      }
    }
  }

  // 3. Duration extraction
  let days: number | undefined;
  const daysMatch = /\b(\d{1,2})\s*[-]?\s*(?:days?|nights?)\b/i.exec(prompt);
  if (daysMatch) {
    const parsed = Number(daysMatch[1]);
    if (Number.isFinite(parsed) && parsed >= 1 && parsed <= 21) {
      days = parsed;
    }
  } else if (/\b(?:long weekend|3[- ]day weekend)\b/i.test(prompt)) {
    days = 3;
  } else if (/\bweekend\b/i.test(prompt)) {
    days = 3;
  } else if (/\b(?:two weeks?|2 weeks?|fortnight)\b/i.test(prompt)) {
    days = 14;
  } else if (/\b(?:a week|one week|1 week|weeklong|week-long)\b/i.test(prompt)) {
    days = 7;
  }

  // 4. Month extraction (e.g. "in October", "next May", "October 2027")
  const monthMatch = new RegExp(`\\b(${monthNames})\\b(?:\\s+(20\\d{2}))?`, 'i').exec(prompt);
  if (monthMatch) {
    const month = MONTH_MAP[monthMatch[1].toLowerCase()];
    const explicitYear = monthMatch[2] ? Number(monthMatch[2]) : undefined;
    const start = explicitYear
      ? makeValidDate(explicitYear, month, 10)
      : upcomingMonthStart(month, 10, now);
    if (start) {
      const span = days ?? 5;
      const end = addDays(start, Math.max(1, span - 1));
      return { startDate: formatIsoDate(start), endDate: formatIsoDate(end), days: span };
    }
  }

  // 5. Duration without explicit month -> upcoming dates starting ~30 days out
  if (days !== undefined) {
    const start = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 30);
    const end = addDays(start, Math.max(1, days - 1));
    return { startDate: formatIsoDate(start), endDate: formatIsoDate(end), days };
  }

  return {};
}

function extractTravelers(prompt: string): {
  travelers?: number;
  travelerType?: TravelerTypeId;
} {
  let travelerType: TravelerTypeId | undefined;
  let travelers: number | undefined;

  if (/\b(solo|by myself|just me|alone|1 person|one person)\b/i.test(prompt)) {
    travelerType = 'solo';
    travelers = 1;
  } else if (
    /\b(anniversary|honeymoon|couple|my partner|my wife|my husband|my girlfriend|my boyfriend|two of us|2 of us|romantic getaway)\b/i.test(
      prompt
    )
  ) {
    travelerType = 'couple';
    travelers = 2;
  } else if (/\b(family|kids?|children|toddler|parents and kids)\b/i.test(prompt)) {
    travelerType = 'family';
    travelers = 4;
  } else if (
    /\b(friends?|girls trip|guys trip|bachelor|bachelorette|group trip|buddies)\b/i.test(prompt)
  ) {
    travelerType = 'friends';
    travelers = 4;
  } else if (/\b(business|conference|work trip|offsite)\b/i.test(prompt)) {
    travelerType = 'business';
    travelers = 1;
  }

  const explicitCount =
    /\b(?:family of|group of|party of|for)\s+(\d{1,2})\b/i.exec(prompt) ??
    /\b(\d{1,2})\s+(?:travelers?|travellers?|people|adults?|guests?|friends?)\b/i.exec(prompt);
  if (explicitCount) {
    const count = Number(explicitCount[1]);
    if (Number.isFinite(count) && count >= 1 && count <= 10) {
      travelers = count;
      if (!travelerType) {
        travelerType = count === 1 ? 'solo' : count === 2 ? 'couple' : 'friends';
      }
    }
  }

  return { travelers, travelerType };
}

function extractBudget(prompt: string): BudgetTier | undefined {
  if (/\b(luxury|splurge|5[- ]?star|five[- ]?star|upscale|high[- ]?end|lavish)\b/i.test(prompt)) {
    return 'luxury';
  }
  if (
    /\b(budget|cheap|affordable|backpack(?:er|ing)?|shoestring|low[- ]?cost|frugal)\b/i.test(prompt)
  ) {
    return 'budget';
  }
  if (/\b(moderate|mid[- ]?range|midrange|comfort|balanced budget)\b/i.test(prompt)) {
    return 'moderate';
  }
  return undefined;
}

function extractRequirements(prompt: string): TravelerRequirements | undefined {
  const dietaryPreferences: string[] = [];
  for (const item of DIETARY_PATTERNS) {
    if (item.pattern.test(prompt)) {
      dietaryPreferences.push(item.label);
    }
  }

  const allergies = new Set<string>();
  const allergicToMatch =
    /\ballergic\s+to\s+([a-zA-Z\s,-]+?)(?:\.|,|;|and\s+(?:need|want|prefer|looking)|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = allergicToMatch.exec(prompt)) !== null) {
    const raw = match[1].trim();
    const parts = raw
      .split(/\s+and\s+|\s*\/\s*/)
      .map((p) => p.trim())
      .filter((p) => p.length >= 2 && p.length <= 40);
    for (const part of parts) {
      allergies.add(titleCase(part));
    }
  }

  for (const allergen of KNOWN_ALLERGENS) {
    const allergyRegex = new RegExp(
      `\\b${escapeRegExp(allergen)}\\s+(?:allergy|allergies|free)\\b|\\bno\\s+${escapeRegExp(allergen)}\\b`,
      'i'
    );
    if (allergyRegex.test(prompt)) {
      if (allergen === 'gluten' && dietaryPreferences.includes('Gluten-free')) continue;
      if (allergen === 'dairy' && dietaryPreferences.includes('Dairy-free')) continue;
      allergies.add(titleCase(allergen));
    }
  }

  const accessibility: TravelerRequirements['accessibility'] = [];
  if (/\b(wheelchair|step[- ]?free|no stairs|avoid stairs|flat routes?|stroller)\b/i.test(prompt)) {
    accessibility.push('step_free_entrance');
  }
  if (/\baccessible\s+(?:restroom|bathroom|toilet)\b/i.test(prompt)) {
    accessibility.push('accessible_restroom');
  }
  if (/\baccessible\s+seating\b/i.test(prompt)) {
    accessibility.push('accessible_seating');
  }
  if (/\baccessible\s+parking\b/i.test(prompt)) {
    accessibility.push('accessible_parking');
  }

  const notes: string[] = [];
  if (/\b(relaxed mornings?|late mornings?|no early starts?|sleep in)\b/i.test(prompt)) {
    notes.push('Prefer relaxed mornings without early starts');
  }
  if (/\b(midday rest|afternoon nap|rest break|midday break)\b/i.test(prompt)) {
    notes.push('Include midday rest breaks');
  }
  if (/\b(slow pace|unhurried|limited walking|minimal walking|easy pace)\b/i.test(prompt)) {
    notes.push('Keep a gentle pace with manageable walking');
  }

  if (
    allergies.size === 0 &&
    dietaryPreferences.length === 0 &&
    accessibility.length === 0 &&
    notes.length === 0
  ) {
    return undefined;
  }

  const candidate: TravelerRequirements = {
    allergies: Array.from(allergies).slice(0, 20),
    dietaryPreferences: dietaryPreferences.slice(0, 20),
    accessibility,
    mobilityNotes: notes.join('. ').slice(0, 500),
  };

  const validated = travelerRequirementsSchema.safeParse(candidate);
  return validated.success ? validated.data : undefined;
}

function buildSummary(result: Omit<ParsedTripPrompt, 'summary' | 'source'>): string[] {
  const parts: string[] = [];
  if (result.destination) {
    parts.push(result.country ? `${result.destination}, ${result.country}` : result.destination);
  }
  if (result.days) {
    parts.push(`${result.days} day${result.days === 1 ? '' : 's'}`);
  }
  if (result.travelers) {
    parts.push(
      `${result.travelers} ${result.travelers === 1 ? 'traveler' : 'travelers'}${
        result.travelerType ? ` (${result.travelerType})` : ''
      }`
    );
  }
  if (result.budget) {
    parts.push(
      result.budget === 'moderate' ? 'Comfort' : result.budget === 'luxury' ? 'Luxury' : 'Budget'
    );
  }
  if (result.vibes.length > 0) {
    parts.push(result.vibes.slice(0, 3).join(', '));
  }
  if (result.requirements) {
    const reqCount =
      result.requirements.allergies.length +
      result.requirements.dietaryPreferences.length +
      result.requirements.accessibility.length +
      (result.requirements.mobilityNotes ? 1 : 0);
    if (reqCount > 0) {
      parts.push(`${reqCount} dietary/access note${reqCount === 1 ? '' : 's'}`);
    }
  }
  return parts;
}

/**
 * Fast, deterministic natural-language trip prompt parser that works 100% offline.
 */
export function parseDreamTripPromptLocal(
  prompt: string,
  now: Date = new Date()
): ParsedTripPrompt {
  const trimmed = prompt.trim();
  if (!trimmed) {
    return { vibes: [], summary: [], source: 'local' };
  }

  const { destination, country } = extractDestination(trimmed);
  const { startDate, endDate, days } = extractDatesAndDuration(trimmed, now);
  const { travelers, travelerType } = extractTravelers(trimmed);
  const budget = extractBudget(trimmed);
  const vibes: string[] = [];
  for (const entry of VIBE_PATTERNS) {
    if (entry.pattern.test(trimmed) && VALID_VIBE_IDS.has(entry.id) && !vibes.includes(entry.id)) {
      vibes.push(entry.id);
      if (vibes.length >= 5) break;
    }
  }
  const requirements = extractRequirements(trimmed);

  const base = {
    destination,
    country,
    startDate,
    endDate,
    days,
    travelers,
    travelerType,
    budget,
    vibes,
    requirements,
  };

  return {
    ...base,
    summary: buildSummary(base),
    source: 'local',
  };
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Calls the backend NL prompt parser when online, falling back immediately to the
 * deterministic local parser on timeout or error.
 */
export async function parseDreamTripPrompt(
  prompt: string,
  options?: { signal?: AbortSignal; now?: Date; timeoutMs?: number }
): Promise<ParsedTripPrompt> {
  const trimmed = prompt.trim().slice(0, 600);
  const local = parseDreamTripPromptLocal(trimmed, options?.now);
  if (!trimmed) return local;

  try {
    const [{ API_BASE_URL }, { getAuthHeaders }, { requestWithTimeout }] = await Promise.all([
      import('../constants/api'),
      import('./supabase'),
      import('../services/request'),
    ]);
    const authHeaders = await getAuthHeaders().catch(() => ({}) as Record<string, string>);
    if (options?.signal?.aborted) return local;

    const apiData = await requestWithTimeout(
      `${API_BASE_URL}/api/trips/parse-prompt`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ prompt: trimmed }),
        signal: options?.signal,
      },
      async (response) => {
        if (!response.ok) return null;
        return response.json().catch(() => null);
      },
      options?.timeoutMs ?? 3000
    );

    if (!apiData || typeof apiData !== 'object') {
      return local;
    }

    const raw =
      'parsed' in apiData && apiData.parsed && typeof apiData.parsed === 'object'
        ? (apiData.parsed as Record<string, unknown>)
        : (apiData as Record<string, unknown>);

    const apiVibes = Array.isArray(raw.vibes)
      ? Array.from(
          new Set(
            raw.vibes
              .map((v) => (v === 'cultural' ? 'culture' : v))
              .filter((v): v is string => typeof v === 'string' && VALID_VIBE_IDS.has(v))
          )
        ).slice(0, 5)
      : [];

    const apiRequirements = travelerRequirementsSchema.safeParse(raw.requirements);

    const rawDestObj =
      raw.destination && typeof raw.destination === 'object' && !Array.isArray(raw.destination)
        ? (raw.destination as Record<string, unknown>)
        : null;
    const apiDestination =
      typeof raw.destination === 'string' && raw.destination.trim()
        ? raw.destination.trim()
        : rawDestObj && typeof rawDestObj.name === 'string' && rawDestObj.name.trim()
          ? rawDestObj.name.trim()
          : local.destination;
    const apiCountry =
      typeof raw.country === 'string' && raw.country.trim()
        ? raw.country.trim()
        : rawDestObj && typeof rawDestObj.country === 'string' && rawDestObj.country.trim()
          ? rawDestObj.country.trim()
          : local.country;

    const travelersCandidate =
      typeof raw.travelers === 'number' &&
      Number.isInteger(raw.travelers) &&
      raw.travelers >= 1 &&
      raw.travelers <= 10
        ? raw.travelers
        : local.travelers;

    const validTypes: TravelerTypeId[] = ['solo', 'couple', 'family', 'friends', 'business'];
    const travelerType =
      typeof raw.travelerType === 'string' &&
      validTypes.includes(raw.travelerType as TravelerTypeId)
        ? (raw.travelerType as TravelerTypeId)
        : local.travelerType;

    const validBudgets: BudgetTier[] = ['budget', 'moderate', 'luxury'];
    const budget =
      typeof raw.budget === 'string' && validBudgets.includes(raw.budget as BudgetTier)
        ? (raw.budget as BudgetTier)
        : local.budget;

    const merged = {
      destination: apiDestination,
      country: apiCountry,
      startDate: isIsoDate(raw.startDate) ? raw.startDate : local.startDate,
      endDate: isIsoDate(raw.endDate) ? raw.endDate : local.endDate,
      days:
        typeof raw.days === 'number' && Number.isFinite(raw.days) && raw.days >= 1 && raw.days <= 30
          ? Math.round(raw.days)
          : local.days,
      travelers: travelersCandidate,
      travelerType,
      budget,
      vibes: apiVibes.length > 0 ? apiVibes : local.vibes,
      requirements: apiRequirements.success ? apiRequirements.data : local.requirements,
    };

    return {
      ...merged,
      summary: buildSummary(merged),
      source: 'api',
    };
  } catch {
    return local;
  }
}

// ─── "Help Me Decide" Destination Matcher ───────────────────────────────────

interface CatalogMetadata {
  region: 'asia' | 'europe' | 'americas' | 'africa' | 'oceania' | 'middle-east';
  climate: 'warm' | 'temperate' | 'cool' | 'tropical' | 'alpine';
  bestMonths: number[];
  vibes: string[];
  budgetFit: BudgetTier;
  suggestedDays: number;
  highlight: string;
  seasonNote: string;
}

const CATALOG_METADATA: Record<string, CatalogMetadata> = {
  tokyo: {
    region: 'asia',
    climate: 'temperate',
    bestMonths: [3, 4, 5, 10, 11],
    vibes: ['foodie', 'culture', 'nightlife', 'solo'],
    budgetFit: 'moderate',
    suggestedDays: 5,
    highlight: 'World-class ramen, distinct neighborhoods, and effortless transit',
    seasonNote: 'Crisp springs and golden autumns are ideal for walking',
  },
  kyoto: {
    region: 'asia',
    climate: 'temperate',
    bestMonths: [3, 4, 5, 10, 11],
    vibes: ['culture', 'foodie', 'romantic', 'wellness'],
    budgetFit: 'moderate',
    suggestedDays: 4,
    highlight: 'Historic temples, tea houses, and tranquil garden districts',
    seasonNote: 'Spring blossoms and autumn foliage are standout seasons',
  },
  bali: {
    region: 'asia',
    climate: 'tropical',
    bestMonths: [4, 5, 6, 7, 8, 9, 10],
    vibes: ['relaxation', 'wellness', 'nature', 'budget'],
    budgetFit: 'budget',
    suggestedDays: 6,
    highlight: 'Terraced highlands, spa retreats, and warm Indian Ocean surf',
    seasonNote: 'Dry season runs April through October with sunny days',
  },
  bangkok: {
    region: 'asia',
    climate: 'tropical',
    bestMonths: [11, 12, 1, 2],
    vibes: ['foodie', 'culture', 'nightlife', 'budget'],
    budgetFit: 'budget',
    suggestedDays: 4,
    highlight: 'Electric street-food markets, riverside temples, and rooftop views',
    seasonNote: 'Cooler, drier evenings from November through February',
  },
  dubai: {
    region: 'middle-east',
    climate: 'warm',
    bestMonths: [11, 12, 1, 2, 3],
    vibes: ['luxury', 'relaxation', 'family', 'nightlife'],
    budgetFit: 'luxury',
    suggestedDays: 4,
    highlight: 'Winter beach sun, desert excursions, and bold architecture',
    seasonNote: 'Warm and sunny from November through March',
  },
  paris: {
    region: 'europe',
    climate: 'temperate',
    bestMonths: [4, 5, 6, 9, 10],
    vibes: ['romantic', 'foodie', 'culture', 'luxury'],
    budgetFit: 'moderate',
    suggestedDays: 5,
    highlight: 'Walkable bistros, landmark museums, and riverside cafés',
    seasonNote: 'Pleasant café weather in spring and early autumn',
  },
  barcelona: {
    region: 'europe',
    climate: 'warm',
    bestMonths: [5, 6, 9, 10],
    vibes: ['foodie', 'culture', 'relaxation', 'nightlife'],
    budgetFit: 'moderate',
    suggestedDays: 4,
    highlight: 'Gaudí architecture, tapas bars, and city beaches in one trip',
    seasonNote: 'Warm Mediterranean weather without peak August heat in May–June and Sep–Oct',
  },
  santorini: {
    region: 'europe',
    climate: 'warm',
    bestMonths: [5, 6, 9, 10],
    vibes: ['romantic', 'relaxation', 'luxury', 'foodie'],
    budgetFit: 'luxury',
    suggestedDays: 4,
    highlight: 'Caldera sunsets, cliffside villages, and Aegean boat days',
    seasonNote: 'Shoulder months May–June and Sep–Oct bring sun with calmer crowds',
  },
  london: {
    region: 'europe',
    climate: 'temperate',
    bestMonths: [5, 6, 7, 8, 9],
    vibes: ['culture', 'foodie', 'family', 'solo'],
    budgetFit: 'moderate',
    suggestedDays: 5,
    highlight: 'Free world-class museums, West End theater, and neighborhood markets',
    seasonNote: 'Long daylight hours from May through September',
  },
  rome: {
    region: 'europe',
    climate: 'warm',
    bestMonths: [4, 5, 9, 10],
    vibes: ['culture', 'foodie', 'romantic', 'family'],
    budgetFit: 'moderate',
    suggestedDays: 4,
    highlight: 'Ancient piazzas, neighborhood trattorias, and timeless art',
    seasonNote: 'Spring and autumn offer comfortable sightseeing temperatures',
  },
  lisbon: {
    region: 'europe',
    climate: 'warm',
    bestMonths: [4, 5, 6, 9, 10],
    vibes: ['foodie', 'culture', 'relaxation', 'budget'],
    budgetFit: 'budget',
    suggestedDays: 4,
    highlight: 'Sunlit tiled hills, Atlantic viewpoints, and standout seafood',
    seasonNote: 'Mild coastal sunshine across spring, summer, and autumn',
  },
  reykjavik: {
    region: 'europe',
    climate: 'cool',
    bestMonths: [6, 7, 8, 9, 10, 2, 3],
    vibes: ['nature', 'adventure', 'wellness', 'solo'],
    budgetFit: 'luxury',
    suggestedDays: 5,
    highlight: 'Geothermal lagoons, waterfalls, and glacier day trips',
    seasonNote: 'Midnight sun in summer; northern lights season from September to March',
  },
  'new-york': {
    region: 'americas',
    climate: 'temperate',
    bestMonths: [4, 5, 6, 9, 10, 11],
    vibes: ['foodie', 'culture', 'nightlife', 'solo'],
    budgetFit: 'moderate',
    suggestedDays: 4,
    highlight: 'Neighborhood dining, iconic parks, museums, and live shows',
    seasonNote: 'Crisp spring and autumn weather is ideal for exploring on foot',
  },
  marrakech: {
    region: 'africa',
    climate: 'warm',
    bestMonths: [3, 4, 5, 10, 11],
    vibes: ['culture', 'foodie', 'adventure', 'budget'],
    budgetFit: 'budget',
    suggestedDays: 4,
    highlight: 'Courtyard riads, spice souks, and Atlas Mountain day trips',
    seasonNote: 'Comfortable sunny days in spring and autumn',
  },
  'cape-town': {
    region: 'africa',
    climate: 'warm',
    bestMonths: [11, 12, 1, 2, 3],
    vibes: ['nature', 'adventure', 'foodie', 'romantic'],
    budgetFit: 'moderate',
    suggestedDays: 6,
    highlight: 'Table Mountain hikes, coastal drives, and nearby winelands',
    seasonNote: 'Southern Hemisphere summer from November to March brings clear skies',
  },
  singapore: {
    region: 'asia',
    climate: 'tropical',
    bestMonths: [2, 3, 4, 7, 8],
    vibes: ['foodie', 'family', 'culture', 'luxury'],
    budgetFit: 'moderate',
    suggestedDays: 4,
    highlight: 'Hawker centers, futuristic gardens, and easy family transit',
    seasonNote: 'Warm year-round with slightly drier weather February–April',
  },
  hanoi: {
    region: 'asia',
    climate: 'temperate',
    bestMonths: [10, 11, 3, 4],
    vibes: ['foodie', 'culture', 'budget', 'solo'],
    budgetFit: 'budget',
    suggestedDays: 4,
    highlight: 'Old Quarter coffee culture, pho stalls, and nearby limestone bays',
    seasonNote: 'Mild, pleasant weather in October–November and March–April',
  },
  phuket: {
    region: 'asia',
    climate: 'tropical',
    bestMonths: [11, 12, 1, 2, 3, 4],
    vibes: ['relaxation', 'family', 'wellness', 'budget'],
    budgetFit: 'budget',
    suggestedDays: 5,
    highlight: 'Andaman Sea coves, island hopping, and coastal dining',
    seasonNote: 'Calm, sunny beach weather from November to April',
  },
  seoul: {
    region: 'asia',
    climate: 'temperate',
    bestMonths: [4, 5, 9, 10, 11],
    vibes: ['foodie', 'culture', 'nightlife', 'solo'],
    budgetFit: 'moderate',
    suggestedDays: 5,
    highlight: 'Late-night food markets, royal palaces, and design neighborhoods',
    seasonNote: 'Spring cherry blossoms and crisp autumn skies are peak times',
  },
  jaipur: {
    region: 'asia',
    climate: 'warm',
    bestMonths: [10, 11, 12, 1, 2, 3],
    vibes: ['culture', 'foodie', 'budget', 'adventure'],
    budgetFit: 'budget',
    suggestedDays: 4,
    highlight: 'Hilltop forts, heritage palaces, and vibrant artisan bazaars',
    seasonNote: 'Pleasant daytime warmth from October through March',
  },
  petra: {
    region: 'middle-east',
    climate: 'warm',
    bestMonths: [3, 4, 5, 10, 11],
    vibes: ['culture', 'adventure', 'nature'],
    budgetFit: 'moderate',
    suggestedDays: 3,
    highlight: 'Rose-red canyon monuments and desert stargazing',
    seasonNote: 'Mild hiking temperatures in spring and autumn',
  },
  amsterdam: {
    region: 'europe',
    climate: 'temperate',
    bestMonths: [4, 5, 6, 9],
    vibes: ['culture', 'foodie', 'solo', 'romantic'],
    budgetFit: 'moderate',
    suggestedDays: 4,
    highlight: 'Canal-side cycling, Dutch masters museums, and cozy cafés',
    seasonNote: 'Spring tulips and mild early-autumn canal walks',
  },
  istanbul: {
    region: 'europe',
    climate: 'temperate',
    bestMonths: [4, 5, 9, 10],
    vibes: ['culture', 'foodie', 'budget', 'romantic'],
    budgetFit: 'budget',
    suggestedDays: 4,
    highlight: 'Bosphorus ferries, historic mosques, and rich culinary crossroads',
    seasonNote: 'Warm, breezy spring and autumn weather',
  },
  prague: {
    region: 'europe',
    climate: 'temperate',
    bestMonths: [4, 5, 6, 9, 10],
    vibes: ['culture', 'romantic', 'budget', 'nightlife'],
    budgetFit: 'budget',
    suggestedDays: 3,
    highlight: 'Cobblestone bridges, castle panoramas, and classic beer halls',
    seasonNote: 'Spring and early autumn offer pleasant strolls and softer crowds',
  },
  vienna: {
    region: 'europe',
    climate: 'temperate',
    bestMonths: [4, 5, 6, 9, 10, 12],
    vibes: ['culture', 'foodie', 'romantic', 'wellness'],
    budgetFit: 'moderate',
    suggestedDays: 4,
    highlight: 'Coffeehouse traditions, classical concert halls, and palace gardens',
    seasonNote: 'Lovely in spring, autumn, and December market season',
  },
  dublin: {
    region: 'europe',
    climate: 'cool',
    bestMonths: [5, 6, 7, 8, 9],
    vibes: ['culture', 'nightlife', 'solo', 'nature'],
    budgetFit: 'moderate',
    suggestedDays: 4,
    highlight: 'Literary history, live traditional music, and coastal cliff walks',
    seasonNote: 'Bright, mild days from May through September',
  },
  copenhagen: {
    region: 'europe',
    climate: 'cool',
    bestMonths: [5, 6, 7, 8, 9],
    vibes: ['foodie', 'culture', 'wellness', 'family'],
    budgetFit: 'luxury',
    suggestedDays: 4,
    highlight: 'Nordic bakeries, harbor swims, and bike-friendly design',
    seasonNote: 'Sunlit waterfronts and long summer days May–September',
  },
  interlaken: {
    region: 'europe',
    climate: 'alpine',
    bestMonths: [6, 7, 8, 9, 12, 1, 2, 3],
    vibes: ['adventure', 'nature', 'family', 'wellness'],
    budgetFit: 'luxury',
    suggestedDays: 4,
    highlight: 'Turquoise glacial lakes, scenic mountain trains, and alpine trails',
    seasonNote: 'Summer for hiking; winter for alpine snowscapes',
  },
  'amalfi-coast': {
    region: 'europe',
    climate: 'warm',
    bestMonths: [5, 6, 9, 10],
    vibes: ['romantic', 'foodie', 'relaxation', 'luxury'],
    budgetFit: 'luxury',
    suggestedDays: 4,
    highlight: 'Lemon groves, cliffside villages, and coastal boat excursions',
    seasonNote: 'May–June and September bring warm sea breezes with calmer roads',
  },
  ibiza: {
    region: 'europe',
    climate: 'warm',
    bestMonths: [5, 6, 9, 10],
    vibes: ['nightlife', 'relaxation', 'wellness', 'luxury'],
    budgetFit: 'luxury',
    suggestedDays: 4,
    highlight: 'Turquoise pine-fringed coves alongside iconic sunset clubs',
    seasonNote: 'Warm Mediterranean swimming from May through October',
  },
  chamonix: {
    region: 'europe',
    climate: 'alpine',
    bestMonths: [6, 7, 8, 9, 12, 1, 2, 3],
    vibes: ['adventure', 'nature', 'wellness'],
    budgetFit: 'moderate',
    suggestedDays: 4,
    highlight: 'Cable cars beneath Mont Blanc, valley trails, and hearty alpine fare',
    seasonNote: 'High-mountain hiking in summer and skiing in winter',
  },
  cancun: {
    region: 'americas',
    climate: 'tropical',
    bestMonths: [12, 1, 2, 3, 4],
    vibes: ['relaxation', 'family', 'nightlife', 'adventure'],
    budgetFit: 'moderate',
    suggestedDays: 5,
    highlight: 'Caribbean turquoise water, cenote swims, and Mayan ruins nearby',
    seasonNote: 'Sunny, low-humidity beach season runs December through April',
  },
  'rio-de-janeiro': {
    region: 'americas',
    climate: 'tropical',
    bestMonths: [5, 6, 7, 8, 9, 10],
    vibes: ['nature', 'nightlife', 'adventure', 'culture'],
    budgetFit: 'moderate',
    suggestedDays: 5,
    highlight: 'Lush coastal peaks, samba neighborhoods, and golden beaches',
    seasonNote: 'Dry, warm coastal days from May through October',
  },
  'costa-rica': {
    region: 'americas',
    climate: 'tropical',
    bestMonths: [12, 1, 2, 3, 4],
    vibes: ['nature', 'adventure', 'family', 'wellness'],
    budgetFit: 'moderate',
    suggestedDays: 7,
    highlight: 'Cloud forests, wildlife reserves, hot springs, and Pacific surf',
    seasonNote: 'Dry sunshine across the Pacific coast December through April',
  },
  'buenos-aires': {
    region: 'americas',
    climate: 'temperate',
    bestMonths: [10, 11, 3, 4],
    vibes: ['foodie', 'culture', 'nightlife', 'romantic'],
    budgetFit: 'budget',
    suggestedDays: 5,
    highlight: 'Leafy café barrios, parillas, tango halls, and grand bookstores',
    seasonNote: 'Jacaranda spring (Oct–Nov) and mild autumn (Mar–Apr) shine',
  },
  havana: {
    region: 'americas',
    climate: 'tropical',
    bestMonths: [11, 12, 1, 2, 3, 4],
    vibes: ['culture', 'nightlife', 'budget'],
    budgetFit: 'budget',
    suggestedDays: 4,
    highlight: 'Historic plazas, live jazz and salsa, and oceanfront promenades',
    seasonNote: 'Warm and breezy dry season from November to April',
  },
  vancouver: {
    region: 'americas',
    climate: 'cool',
    bestMonths: [5, 6, 7, 8, 9],
    vibes: ['nature', 'foodie', 'family', 'adventure'],
    budgetFit: 'moderate',
    suggestedDays: 4,
    highlight: 'Seawall bike paths, Pacific seafood, and mountain parks minutes away',
    seasonNote: 'Bright, dry Pacific Northwest summers May through September',
  },
  cairo: {
    region: 'africa',
    climate: 'warm',
    bestMonths: [10, 11, 12, 1, 2, 3],
    vibes: ['culture', 'adventure', 'budget'],
    budgetFit: 'budget',
    suggestedDays: 4,
    highlight: 'Ancient pyramids, Nile felucca sails, and bustling historic bazaars',
    seasonNote: 'Cooler sightseeing temperatures from October through March',
  },
  zanzibar: {
    region: 'africa',
    climate: 'tropical',
    bestMonths: [6, 7, 8, 9, 10, 1, 2],
    vibes: ['relaxation', 'romantic', 'culture', 'nature'],
    budgetFit: 'moderate',
    suggestedDays: 5,
    highlight: 'White-sand reefs, spice farms, and historic Stone Town alleys',
    seasonNote: 'Dry Indian Ocean sunshine June–October and January–February',
  },
  queenstown: {
    region: 'oceania',
    climate: 'alpine',
    bestMonths: [12, 1, 2, 3, 7, 8],
    vibes: ['adventure', 'nature', 'romantic', 'luxury'],
    budgetFit: 'luxury',
    suggestedDays: 5,
    highlight: 'Dramatic fjords, lakefront trails, and Central Otago vineyards',
    seasonNote: 'Warm lake adventures Dec–Mar; ski peaks Jul–Aug',
  },
  maldives: {
    region: 'asia',
    climate: 'tropical',
    bestMonths: [11, 12, 1, 2, 3, 4],
    vibes: ['relaxation', 'romantic', 'luxury', 'wellness'],
    budgetFit: 'luxury',
    suggestedDays: 5,
    highlight: 'Crystal-clear lagoons, coral snorkeling, and serene island stays',
    seasonNote: 'Dry northeast monsoon brings calm waters November through April',
  },
  sydney: {
    region: 'oceania',
    climate: 'warm',
    bestMonths: [10, 11, 12, 1, 2, 3],
    vibes: ['relaxation', 'foodie', 'nature', 'family'],
    budgetFit: 'moderate',
    suggestedDays: 5,
    highlight: 'Harbor ferries, coastal cliff walks, and vibrant neighborhood dining',
    seasonNote: 'Warm coastal spring and summer from October through March',
  },
};

export function suggestDestinationsLocal(input: SuggestDestinationsInput): DestinationSuggestion[] {
  const query = input.query.trim().toLowerCase();
  const parsed = parseDreamTripPromptLocal(input.query);
  const requestedMonth =
    input.month && MONTH_MAP[input.month.trim().toLowerCase()]
      ? MONTH_MAP[input.month.trim().toLowerCase()]
      : parsed.startDate
        ? Number(parsed.startDate.split('-')[1])
        : undefined;
  const requestedBudget = input.budget ?? parsed.budget;

  const regionTerms: Record<CatalogMetadata['region'], RegExp> = {
    asia: /\b(asia|asian|east asia|southeast asia|japan|thai|vietnam|bali|korea)\b/i,
    europe: /\b(europe|european|mediterranean|italy|spain|france|portugal|greece|alps|nordic)\b/i,
    americas:
      /\b(americas?|north america|south america|latin america|caribbean|mexico|usa|canada)\b/i,
    africa: /\b(africa|african|morocco|egypt|safari|cape)\b/i,
    oceania: /\b(oceania|australia|new zealand|pacific)\b/i,
    'middle-east': /\b(middle east|desert|dubai|jordan|arabia)\b/i,
  };

  const climateTerms: Record<CatalogMetadata['climate'], RegExp> = {
    warm: /\b(warm|sunny|sun|sunshine|mediterranean|mild)\b/i,
    tropical: /\b(tropical|beach|island|ocean|swim|snorkel|palm|warm)\b/i,
    alpine: /\b(alpine|mountain|mountains|ski|snow|hike|hiking|peaks)\b/i,
    cool: /\b(cool|crisp|northern|aurora|fjord|sweater)\b/i,
    temperate: /\b(city|walkable|urban|spring|autumn|fall)\b/i,
  };

  const popularById = new Map(popularDestinations.map((d) => [d.id, d]));

  const scored = destinationCoverCatalog.map(([slug, city, country]) => {
    const meta = CATALOG_METADATA[slug];
    const popular = popularById.get(slug);
    let score = 0;
    const reasons: string[] = [];

    if (query) {
      if (query.includes(city.toLowerCase()) || query.includes(country.toLowerCase())) {
        score += 12;
      }
      if (meta) {
        if (regionTerms[meta.region].test(query)) {
          score += 5;
        }
        if (climateTerms[meta.climate].test(query)) {
          score += 4;
          reasons.push(
            meta.climate === 'tropical'
              ? 'Warm coastal setting'
              : meta.climate === 'alpine'
                ? 'Dramatic mountain scenery'
                : meta.climate === 'warm'
                  ? 'Sunny, inviting weather'
                  : 'Great walkable conditions'
          );
        }
        for (const vibe of parsed.vibes) {
          if (meta.vibes.includes(vibe)) {
            score += 4;
          }
        }
        if (requestedBudget && meta.budgetFit === requestedBudget) {
          score += 3;
        }
        if (requestedMonth && meta.bestMonths.includes(requestedMonth)) {
          score += 3;
          reasons.push('Great seasonal timing');
        }
        // Keyword overlap against highlight & tags
        const words = query.split(/[^a-z]+/).filter((w) => w.length >= 4);
        const corpus =
          `${meta.highlight} ${popular?.description ?? ''} ${(popular?.tags ?? []).join(' ')}`.toLowerCase();
        for (const word of words) {
          if (corpus.includes(word)) score += 2;
        }
      }
    } else {
      // No query: prefer well-rounded popular picks in season
      if (popular) score += 2;
      if (requestedMonth && meta?.bestMonths.includes(requestedMonth)) score += 3;
      if (requestedBudget && meta?.budgetFit === requestedBudget) score += 2;
    }

    const whyItFits =
      meta?.highlight ??
      popular?.description ??
      (reasons[0] ? `${reasons[0]} in ${country}` : `Distinctive getaway in ${country}`);

    return {
      score,
      region: meta?.region ?? 'europe',
      suggestion: {
        id: slug,
        destination: city,
        country,
        image: catalogDestinationImage(`${city}, ${country}`) ?? popular?.image,
        whyItFits,
        seasonNote:
          meta?.seasonNote ?? popular?.bestTime ?? 'Check local seasonal weather before booking',
        suggestedVibes: meta?.vibes.slice(0, 3) ?? ['culture', 'foodie'],
        suggestedBudget: requestedBudget ?? meta?.budgetFit ?? 'moderate',
        suggestedDays: input.days ?? parsed.days ?? meta?.suggestedDays ?? 5,
      } satisfies DestinationSuggestion,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // Pick top 3 with light geographic variety when scores are close
  const picks: DestinationSuggestion[] = [];
  const usedRegions = new Set<string>();

  for (const item of scored) {
    if (picks.length >= 3) break;
    if (
      picks.length < 2 ||
      !usedRegions.has(item.region) ||
      item.score >= (scored[0]?.score ?? 0) - 1
    ) {
      picks.push(item.suggestion);
      usedRegions.add(item.region);
    }
  }

  for (const item of scored) {
    if (picks.length >= 3) break;
    if (!picks.some((p) => p.id === item.suggestion.id)) {
      picks.push(item.suggestion);
    }
  }

  return picks.slice(0, 3);
}

export async function suggestDestinations(
  input: SuggestDestinationsInput,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<DestinationSuggestion[]> {
  const local = suggestDestinationsLocal(input);
  if (!input.query.trim()) return local;

  try {
    const [{ API_BASE_URL }, { getAuthHeaders }, { requestWithTimeout }] = await Promise.all([
      import('../constants/api'),
      import('./supabase'),
      import('../services/request'),
    ]);
    const authHeaders = await getAuthHeaders().catch(() => ({}) as Record<string, string>);
    if (options?.signal?.aborted) return local;

    const apiData = await requestWithTimeout(
      `${API_BASE_URL}/api/trips/suggest-destinations`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(input),
        signal: options?.signal,
      },
      async (response) => {
        if (!response.ok) return null;
        return response.json().catch(() => null);
      },
      options?.timeoutMs ?? 3000
    );

    const list =
      apiData &&
      typeof apiData === 'object' &&
      Array.isArray((apiData as { suggestions?: unknown }).suggestions)
        ? (apiData as { suggestions: unknown[] }).suggestions
        : null;

    if (!list || list.length === 0) return local;

    const normalized: DestinationSuggestion[] = [];
    for (const item of list) {
      if (!item || typeof item !== 'object') continue;
      const record = item as Record<string, unknown>;
      const destination =
        typeof record.destination === 'string' && record.destination.trim()
          ? record.destination.trim()
          : typeof record.city === 'string' && record.city.trim()
            ? record.city.trim()
            : '';
      const country = typeof record.country === 'string' ? record.country.trim() : '';
      if (!destination) continue;

      const vibes = Array.isArray(record.suggestedVibes)
        ? record.suggestedVibes
            .filter((v): v is string => typeof v === 'string' && VALID_VIBE_IDS.has(v))
            .slice(0, 3)
        : ['culture', 'foodie'];
      const budget =
        record.suggestedBudget === 'budget' ||
        record.suggestedBudget === 'moderate' ||
        record.suggestedBudget === 'luxury'
          ? record.suggestedBudget
          : 'moderate';

      normalized.push({
        id:
          typeof record.id === 'string' && record.id
            ? record.id
            : destination.toLowerCase().replace(/\s+/g, '-'),
        destination,
        country,
        image:
          catalogDestinationImage(country ? `${destination}, ${country}` : destination) ??
          (typeof record.image === 'string' ? record.image : undefined),
        whyItFits:
          typeof record.whyItFits === 'string' && record.whyItFits.trim()
            ? record.whyItFits.trim()
            : `Tailored match for ${destination}`,
        seasonNote:
          typeof record.seasonNote === 'string' && record.seasonNote.trim()
            ? record.seasonNote.trim()
            : 'Check seasonal weather before booking',
        suggestedVibes: vibes,
        suggestedBudget: budget,
        suggestedDays:
          typeof record.suggestedDays === 'number' &&
          Number.isFinite(record.suggestedDays) &&
          record.suggestedDays >= 1
            ? Math.min(21, Math.round(record.suggestedDays))
            : (input.days ?? 5),
      });
      if (normalized.length >= 3) break;
    }

    return normalized.length > 0 ? normalized : local;
  } catch {
    return local;
  }
}
