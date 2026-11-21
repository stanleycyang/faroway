import { destinationCoverCatalog } from "@faroway/constants";
import { z } from "zod";

export const VALID_BUDGETS = ["budget", "moderate", "luxury"] as const;
export type BudgetTier = (typeof VALID_BUDGETS)[number];

export const VALID_TRAVELER_TYPES = [
  "solo",
  "couple",
  "family",
  "friends",
  "business",
] as const;
export type TravelerType = (typeof VALID_TRAVELER_TYPES)[number];

export const VALID_VIBES = [
  "adventure",
  "relaxation",
  "cultural",
  "foodie",
  "nightlife",
  "romantic",
  "nature",
  "shopping",
  "wellness",
  "photography",
] as const;
export type VibeId = (typeof VALID_VIBES)[number];

export const VALID_DIETARY = [
  "Vegetarian",
  "Vegan",
  "Halal",
  "Kosher",
  "Gluten-free",
  "Pescatarian",
] as const;
export type DietaryOption = (typeof VALID_DIETARY)[number];

export const VALID_ACCESSIBILITY = [
  "step_free_entrance",
  "accessible_restroom",
  "accessible_seating",
  "accessible_parking",
] as const;
export type AccessibilityOptionId = (typeof VALID_ACCESSIBILITY)[number];

export type PacingPreference = "relaxed" | "balanced" | "packed";

export const DreamTripPromptInputSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(2, "Tell us a little about the trip you have in mind.")
    .max(600, "Keep your trip description under 600 characters."),
});

export const ParsedDreamTripSchema = z.object({
  destination: z
    .object({
      name: z.string().trim().min(2).max(120),
      country: z.string().trim().min(1).max(80).optional(),
      slug: z.string().trim().min(1).max(80).optional(),
      source: z.enum(["catalog", "user"]),
    })
    .optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  durationDays: z.number().int().min(1).max(30).optional(),
  monthHint: z.string().trim().max(40).optional(),
  travelers: z.number().int().min(1).max(50).optional(),
  travelerType: z.enum(VALID_TRAVELER_TYPES).optional(),
  budget: z.enum(VALID_BUDGETS).optional(),
  vibes: z.array(z.enum(VALID_VIBES)).max(5),
  dietaryPreferences: z.array(z.enum(VALID_DIETARY)).max(6),
  allergies: z.array(z.string().trim().min(1).max(100)).max(10),
  accessibility: z.array(z.enum(VALID_ACCESSIBILITY)).max(4),
  mobilityNotes: z.string().trim().max(500).optional(),
  pacingPreference: z.enum(["relaxed", "balanced", "packed"]).optional(),
  originHint: z.string().trim().max(100).optional(),
  confidence: z.enum(["high", "medium", "low"]),
  source: z.enum(["deterministic", "hybrid"]),
  matchedFields: z.array(z.string()),
});

export type ParsedDreamTrip = z.infer<typeof ParsedDreamTripSchema>;

interface CatalogMatchEntry {
  slug: string;
  name: string;
  country: string;
  patterns: string[];
}

const CATALOG_ALIASES: Record<string, string[]> = {
  "new-york": ["new york city", "nyc", "manhattan"],
  "amalfi-coast": ["amalfi", "positano", "ravello"],
  "rio-de-janeiro": ["rio"],
  "buenos-aires": ["buenos aires"],
  "cape-town": ["cape town"],
  "costa-rica": ["costa rica"],
  bali: ["ubud", "seminyak", "canggu"],
  tokyo: ["shinjuku", "shibuya"],
  london: ["london"],
  dubai: ["dubai"],
  paris: ["paris"],
  santorini: ["oia", "santorini"],
  reykjavik: ["iceland", "reykjavik"],
  maldives: ["maldives"],
  zanzibar: ["zanzibar"],
};

const SORTED_CATALOG_ENTRIES: CatalogMatchEntry[] = destinationCoverCatalog
  .map(([slug, name, country]) => ({
    slug,
    name,
    country,
    patterns: [name.toLowerCase(), ...(CATALOG_ALIASES[slug] ?? [])].sort(
      (a, b) => b.length - a.length,
    ),
  }))
  .sort((a, b) => b.name.length - a.name.length);

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const MONTH_MAP: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12,
};

const SEASON_DEFAULT_MONTH: Record<string, { month: number; label: string }> = {
  spring: { month: 4, label: "Spring" },
  summer: { month: 7, label: "Summer" },
  autumn: { month: 10, label: "Autumn" },
  fall: { month: 10, label: "Fall" },
  winter: { month: 1, label: "Winter" },
};

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  a: 1,
  an: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  fourteen: 14,
};

const NON_DESTINATION_WORDS = new Set([
  "a",
  "an",
  "the",
  "my",
  "our",
  "your",
  "this",
  "next",
  "some",
  "somewhere",
  "anywhere",
  "solo",
  "couple",
  "family",
  "friends",
  "business",
  "anniversary",
  "honeymoon",
  "weekend",
  "week",
  "weeks",
  "day",
  "days",
  "night",
  "nights",
  "budget",
  "moderate",
  "luxury",
  "comfort",
  "relaxed",
  "mornings",
  "midday",
  "rest",
  "spring",
  "summer",
  "autumn",
  "fall",
  "winter",
  "vegetarian",
  "vegan",
  "halal",
  "kosher",
  "pescatarian",
  "gluten",
  "wheelchair",
  "stroller",
  "warm",
  "beach",
  "beaches",
  "mountains",
  "europe",
  "asia",
  "africa",
  "oceania",
  "america",
  ...Object.keys(MONTH_MAP),
]);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasPhrase(text: string, phrase: string): boolean {
  return new RegExp(`\\b${escapeRegex(phrase)}\\b`, "i").test(text);
}

function parseSmallNumber(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase();
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return NUMBER_WORDS[trimmed] ?? null;
}

function daysInMonth(year: number, month1Based: number): number {
  return new Date(year, month1Based, 0).getDate();
}

function formatDateOnly(
  year: number,
  month1Based: number,
  day: number,
): string {
  const clampedDay = Math.max(1, Math.min(day, daysInMonth(year, month1Based)));
  const mm = String(month1Based).padStart(2, "0");
  const dd = String(clampedDay).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function addDaysToDateOnly(dateOnly: string, deltaDays: number): string {
  const [y, m, d] = dateOnly.split("-").map(Number);
  const dt = new Date(y, m - 1, d + deltaDays);
  return formatDateOnly(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

function diffDaysInclusive(start: string, end: string): number {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const startUtc = Date.UTC(sy, sm - 1, sd);
  const endUtc = Date.UTC(ey, em - 1, ed);
  return Math.round((endUtc - startUtc) / (24 * 60 * 60 * 1000)) + 1;
}

function resolveUpcomingYear(
  month1Based: number,
  day: number,
  ref: Date,
  explicitYear?: number,
): number {
  if (explicitYear && explicitYear >= 2024 && explicitYear <= 2035) {
    return explicitYear;
  }
  const refYear = ref.getFullYear();
  const refMonth = ref.getMonth() + 1;
  const refDay = ref.getDate();
  if (month1Based < refMonth || (month1Based === refMonth && day < refDay)) {
    return refYear + 1;
  }
  return refYear;
}

function titleCasePlace(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (
        index > 0 &&
        ["de", "da", "do", "del", "la", "le", "of", "and"].includes(lower)
      ) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

function extractOrigin(prompt: string): {
  originHint?: string;
  withoutOrigin: string;
} {
  const match = prompt.match(
    /\b(?:(?:flying|departing|leaving)\s+from|from)\s+([A-Z]{3}\b|[A-Za-z]+(?:\s+[A-Za-z]+)?)(?=\s+(?:to|for|in|on|with|during|under|around|next|this)\b|[,.;!?]|$)/i,
  );
  if (!match) return { withoutOrigin: prompt };
  const candidate = match[1].trim();
  const lower = candidate.toLowerCase();
  if (
    NON_DESTINATION_WORDS.has(lower) ||
    /\d/.test(candidate) ||
    lower.startsWith("day")
  ) {
    return { withoutOrigin: prompt };
  }
  const normalized =
    candidate.length === 3 && candidate === candidate.toUpperCase()
      ? candidate
      : titleCasePlace(candidate);
  const withoutOrigin =
    prompt.slice(0, match.index ?? 0) +
    " " +
    prompt.slice((match.index ?? 0) + match[0].length);
  return { originHint: normalized, withoutOrigin };
}

function extractDestination(
  text: string,
): ParsedDreamTrip["destination"] | undefined {
  // 1. Check catalog entries & aliases first (longest names first)
  for (const entry of SORTED_CATALOG_ENTRIES) {
    for (const pattern of entry.patterns) {
      if (hasPhrase(text, pattern)) {
        return {
          name: entry.name,
          country: entry.country,
          slug: entry.slug,
          source: "catalog",
        };
      }
    }
  }

  // 2. Free-form city extraction after prepositions like "to", "in", "visit"
  const monthStopWords = Object.keys(MONTH_MAP).join("|");
  const stopBoundary = `(?=\\s+(?:for|in|on|with|during|under|around|from|next|this|by|over|that|where|and|or|but|budget|luxury|moderate|comfort|solo|couple|family|friends|foodie|romantic|relaxed|vegetarian|vegan|halal|kosher|gluten|peanut|shellfish|wheelchair|stroller|step|midday|${monthStopWords}|\\d)\\b|[,.;!?()]|$)`;
  const freeFormRegex = new RegExp(
    `\\b(?:trip\\s+to|getaway\\s+to|vacation\\s+to|travel\\s+to|visiting|visit|going\\s+to|head(?:ing)?\\s+to|explore|to|in)\\s+([A-Za-z][A-Za-z'-]*(?:\\s+[A-Za-z][A-Za-z'-]*){0,2}(?:,\\s*[A-Za-z][A-Za-z'-]*(?:\\s+[A-Za-z][A-Za-z'-]*){0,1})?)${stopBoundary}`,
    "gi",
  );

  for (const match of text.matchAll(freeFormRegex)) {
    const rawCandidate = match[1].trim().replace(/[.,;:!?]+$/, "");
    const words = rawCandidate.split(/[\s,]+/).filter(Boolean);
    if (words.length === 0 || words.length > 4) continue;
    if (words.every((w) => NON_DESTINATION_WORDS.has(w.toLowerCase())))
      continue;
    if (NON_DESTINATION_WORDS.has(words[0].toLowerCase())) continue;

    // Avoid matching phrases like "my anniversary" or "the beach"
    const [cityPart, countryPart] = rawCandidate
      .split(",")
      .map((s) => s.trim());
    if (!cityPart || cityPart.length < 2) continue;

    // Re-check if cityPart matches a catalog entry cleanly
    const catalogMatch = SORTED_CATALOG_ENTRIES.find(
      (entry) =>
        entry.name.toLowerCase() === cityPart.toLowerCase() ||
        entry.patterns.includes(cityPart.toLowerCase()),
    );
    if (catalogMatch) {
      return {
        name: catalogMatch.name,
        country: catalogMatch.country,
        slug: catalogMatch.slug,
        source: "catalog",
      };
    }

    return {
      name: countryPart
        ? `${titleCasePlace(cityPart)}, ${titleCasePlace(countryPart)}`
        : titleCasePlace(cityPart),
      country: countryPart ? titleCasePlace(countryPart) : undefined,
      source: "user",
    };
  }

  return undefined;
}

function extractDuration(text: string): number | undefined {
  // "5 days", "5-day", "five days", "4 nights"
  const dayMatch = text.match(
    /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fourteen)[\s-]+days?\b/i,
  );
  if (dayMatch) {
    const n = parseSmallNumber(dayMatch[1]);
    if (n && n >= 1 && n <= 30) return n;
  }

  const nightMatch = text.match(
    /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)[\s-]+nights?\b/i,
  );
  if (nightMatch) {
    const n = parseSmallNumber(nightMatch[1]);
    if (n && n >= 1 && n <= 29) return n + 1;
  }

  const weekMatch = text.match(/\b(a|an|1|one|2|two|3|three)[\s-]+weeks?\b/i);
  if (weekMatch) {
    const n = parseSmallNumber(weekMatch[1]);
    if (n && n >= 1 && n <= 4) return n * 7;
  }

  if (/\blong\s+weekend\b/i.test(text)) return 3;
  if (/\bweekend\b/i.test(text)) return 3;

  return undefined;
}

function extractDates(
  text: string,
  ref: Date,
): {
  startDate?: string;
  endDate?: string;
  durationDays?: number;
  monthHint?: string;
} {
  const monthPattern = Object.keys(MONTH_MAP).join("|");
  const durationDays = extractDuration(text);

  function isValidIsoCalendarDate(iso: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
    const [y, m, d] = iso.split("-").map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return (
      dt.getUTCFullYear() === y &&
      dt.getUTCMonth() === m - 1 &&
      dt.getUTCDate() === d
    );
  }

  // 1. Explicit ISO date range: 2026-10-10 to 2026-10-15
  const isoRange = text.match(
    /\b(\d{4}-\d{2}-\d{2})\s*(?:to|through|thru|–|—|-)\s*(\d{4}-\d{2}-\d{2})\b/i,
  );
  if (isoRange) {
    const start = isoRange[1];
    const end = isoRange[2];
    if (
      isValidIsoCalendarDate(start) &&
      isValidIsoCalendarDate(end) &&
      end >= start
    ) {
      const days = Math.min(30, Math.max(1, diffDaysInclusive(start, end)));
      const monthIdx = Number(start.slice(5, 7)) - 1;
      return {
        startDate: start,
        endDate: addDaysToDateOnly(start, days - 1),
        durationDays: days,
        monthHint: MONTH_NAMES[monthIdx],
      };
    }
  }

  // 2. Cross-month named range: "May 28 to June 3" or "May 28 - Jun 3, 2026"
  const crossMonthRegex = new RegExp(
    `\\b(${monthPattern})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|through|thru|–|—|-)\\s*(${monthPattern})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(20\\d{2}))?\\b`,
    "i",
  );
  const crossMonth = text.match(crossMonthRegex);
  if (crossMonth) {
    const m1 = MONTH_MAP[crossMonth[1].toLowerCase()];
    const d1 = Number(crossMonth[2]);
    const m2 = MONTH_MAP[crossMonth[3].toLowerCase()];
    const d2 = Number(crossMonth[4]);
    const explicitYear = crossMonth[5] ? Number(crossMonth[5]) : undefined;
    const startYear = resolveUpcomingYear(m1, d1, ref, explicitYear);
    const endYear = m2 < m1 ? startYear + 1 : startYear;
    const start = formatDateOnly(startYear, m1, d1);
    const end = formatDateOnly(endYear, m2, d2);
    if (end >= start) {
      const days = Math.min(30, Math.max(1, diffDaysInclusive(start, end)));
      return {
        startDate: start,
        endDate: addDaysToDateOnly(start, days - 1),
        durationDays: days,
        monthHint: MONTH_NAMES[m1 - 1],
      };
    }
  }

  // 3. Same-month named range: "May 10-15" or "May 10 to 15, 2026"
  const sameMonthRegex = new RegExp(
    `\\b(${monthPattern})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|through|thru|–|—|-)\\s*(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(20\\d{2}))?\\b`,
    "i",
  );
  const sameMonth = text.match(sameMonthRegex);
  if (sameMonth) {
    const m = MONTH_MAP[sameMonth[1].toLowerCase()];
    const d1 = Number(sameMonth[2]);
    const d2 = Number(sameMonth[3]);
    const explicitYear = sameMonth[4] ? Number(sameMonth[4]) : undefined;
    if (d1 >= 1 && d1 <= 31 && d2 >= d1 && d2 <= 31) {
      const year = resolveUpcomingYear(m, d1, ref, explicitYear);
      const start = formatDateOnly(year, m, d1);
      const end = formatDateOnly(year, m, d2);
      const days = Math.min(30, Math.max(1, diffDaysInclusive(start, end)));
      return {
        startDate: start,
        endDate: addDaysToDateOnly(start, days - 1),
        durationDays: days,
        monthHint: MONTH_NAMES[m - 1],
      };
    }
  }

  // 4. Day-first range: "10-15 May" or "10 to 15 October"
  const dayFirstRegex = new RegExp(
    `\\b(\\d{1,2})(?:st|nd|rd|th)?\\s*(?:to|through|thru|–|—|-)\\s*(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthPattern})\\.?(?:,?\\s*(20\\d{2}))?\\b`,
    "i",
  );
  const dayFirst = text.match(dayFirstRegex);
  if (dayFirst) {
    const d1 = Number(dayFirst[1]);
    const d2 = Number(dayFirst[2]);
    const m = MONTH_MAP[dayFirst[3].toLowerCase()];
    const explicitYear = dayFirst[4] ? Number(dayFirst[4]) : undefined;
    if (d1 >= 1 && d1 <= 31 && d2 >= d1 && d2 <= 31) {
      const year = resolveUpcomingYear(m, d1, ref, explicitYear);
      const start = formatDateOnly(year, m, d1);
      const end = formatDateOnly(year, m, d2);
      const days = Math.min(30, Math.max(1, diffDaysInclusive(start, end)));
      return {
        startDate: start,
        endDate: addDaysToDateOnly(start, days - 1),
        durationDays: days,
        monthHint: MONTH_NAMES[m - 1],
      };
    }
  }

  // 5. Single named date ("May 10" or "October 12, 2026") + optional duration
  const singleDateRegex = new RegExp(
    `\\b(${monthPattern})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(20\\d{2}))?\\b`,
    "i",
  );
  const singleDate = text.match(singleDateRegex);
  if (singleDate) {
    const m = MONTH_MAP[singleDate[1].toLowerCase()];
    const d = Number(singleDate[2]);
    const explicitYear = singleDate[3] ? Number(singleDate[3]) : undefined;
    if (d >= 1 && d <= 31) {
      const year = resolveUpcomingYear(m, d, ref, explicitYear);
      const days = durationDays ?? 5;
      const start = formatDateOnly(year, m, d);
      const end = addDaysToDateOnly(start, days - 1);
      return {
        startDate: start,
        endDate: end,
        durationDays: days,
        monthHint: MONTH_NAMES[m - 1],
      };
    }
  }

  // 6. Named month (with or without explicit duration): "5 days in October"
  const monthOnlyRegex = new RegExp(
    `\\b(?:in|during|next|this|around|early|mid|late)?\\s*(${monthPattern})\\.?(?:\\s+(20\\d{2}))?\\b`,
    "i",
  );
  const monthMatch = text.match(monthOnlyRegex);
  if (monthMatch) {
    // Avoid matching the verb "may" unless preceded by in/during/next/around/early/mid/late or capitalized
    const rawMonth = monthMatch[1];
    const fullMatch = monthMatch[0];
    const isAmbiguousMay =
      rawMonth.toLowerCase() === "may" &&
      rawMonth === "may" &&
      !/\b(in|during|next|this|around|early|mid|late)\b/i.test(fullMatch);
    if (!isAmbiguousMay) {
      const m = MONTH_MAP[rawMonth.toLowerCase()];
      const explicitYear = monthMatch[2] ? Number(monthMatch[2]) : undefined;
      const defaultDay = /\bearly\b/i.test(fullMatch)
        ? 5
        : /\blate\b/i.test(fullMatch)
          ? 22
          : 10;
      const year = resolveUpcomingYear(m, defaultDay, ref, explicitYear);
      const days = durationDays ?? 5;
      const start = formatDateOnly(year, m, defaultDay);
      const end = addDaysToDateOnly(start, days - 1);
      return {
        startDate: start,
        endDate: end,
        durationDays: days,
        monthHint: MONTH_NAMES[m - 1],
      };
    }
  }

  // 7. Season hint (spring / summer / autumn / fall / winter)
  const seasonMatch = text.match(/\b(spring|summer|autumn|fall|winter)\b/i);
  if (seasonMatch) {
    const info = SEASON_DEFAULT_MONTH[seasonMatch[1].toLowerCase()];
    if (info) {
      const year = resolveUpcomingYear(info.month, 10, ref);
      const days = durationDays ?? 5;
      const start = formatDateOnly(year, info.month, 10);
      const end = addDaysToDateOnly(start, days - 1);
      return {
        startDate: start,
        endDate: end,
        durationDays: days,
        monthHint: info.label,
      };
    }
  }

  // 8. Duration only (e.g., "5-day trip", "long weekend")
  if (durationDays) {
    const defaultStart = new Date(
      ref.getFullYear(),
      ref.getMonth(),
      ref.getDate() + 30,
    );
    const start = formatDateOnly(
      defaultStart.getFullYear(),
      defaultStart.getMonth() + 1,
      defaultStart.getDate(),
    );
    const end = addDaysToDateOnly(start, durationDays - 1);
    return {
      startDate: start,
      endDate: end,
      durationDays,
    };
  }

  return {};
}

function extractTravelers(text: string): {
  travelers?: number;
  travelerType?: TravelerType;
} {
  let travelers: number | undefined;
  let travelerType: TravelerType | undefined;

  // "2 adults and 2 kids" / "2 adults, 1 child"
  const adultsKids = text.match(
    /\b(\d{1,2}|one|two|three|four|five|six)\s+adults?(?:\s*(?:,|and|&|\+)\s*(\d{1,2}|one|two|three|four|five|six)\s+(?:kids?|children|toddlers?|bab(?:y|ies)))/i,
  );
  if (adultsKids) {
    const adults = parseSmallNumber(adultsKids[1]) ?? 2;
    const kids = parseSmallNumber(adultsKids[2]) ?? 1;
    travelers = Math.min(50, Math.max(1, adults + kids));
    travelerType = "family";
    return { travelers, travelerType };
  }

  // "family of 4" / "family of four"
  const familyOf = text.match(
    /\bfamily\s+of\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\b/i,
  );
  if (familyOf) {
    const n = parseSmallNumber(familyOf[1]);
    if (n && n >= 1 && n <= 50) {
      return { travelers: n, travelerType: "family" };
    }
  }

  // "group of 6" / "party of 5"
  const groupOf = text.match(
    /\b(?:group|party)\s+of\s+(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\b/i,
  );
  if (groupOf) {
    const n = parseSmallNumber(groupOf[1]);
    if (n && n >= 1 && n <= 50) {
      travelers = n;
      travelerType = n === 1 ? "solo" : n === 2 ? "couple" : "friends";
    }
  }

  // "with 3 friends" (me + 3 friends = 4) vs "4 friends" (4 total)
  const withFriends = text.match(
    /\bwith\s+(\d{1,2}|one|two|three|four|five|six|seven|eight)\s+friends\b/i,
  );
  if (withFriends) {
    const n = parseSmallNumber(withFriends[1]);
    if (n && n >= 1 && n <= 49) {
      travelers = n + 1;
      travelerType = "friends";
    }
  } else {
    const friendsCount = text.match(
      /\b(\d{1,2}|two|three|four|five|six|seven|eight|nine|ten)\s+friends\b/i,
    );
    if (friendsCount) {
      const n = parseSmallNumber(friendsCount[1]);
      if (n && n >= 2 && n <= 50) {
        travelers = n;
        travelerType = "friends";
      }
    }
  }

  // Explicit people/travelers count: "for 3 people", "4 travelers", "for two"
  if (travelers === undefined) {
    const countMatch = text.match(
      /\b(?:for\s+)?(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:people|persons|travelers|travellers|guests|adults)\b/i,
    );
    if (countMatch) {
      const n = parseSmallNumber(countMatch[1]);
      if (n && n >= 1 && n <= 50) travelers = n;
    } else {
      const forCount = text.match(
        /\bfor\s+(two|three|four|five|six|2|3|4|5|6)(?=\s*(?:[,.;!?]|in\b|to\b|on\b|at\b|with\b|$))/i,
      );
      if (forCount) {
        const n = parseSmallNumber(forCount[1]);
        if (n && n >= 1 && n <= 50) travelers = n;
      }
    }
  }

  // Group type inference
  if (!travelerType) {
    if (/\b(?:solo|by\s+myself|just\s+me|myself)\b/i.test(text)) {
      travelerType = "solo";
      if (travelers === undefined) travelers = 1;
    } else if (
      /\b(?:anniversary|honeymoon|couple|couples|romantic\s+getaway|my\s+partner|my\s+wife|my\s+husband|my\s+girlfriend|my\s+boyfriend|fianc[eé]e?|spouse)\b/i.test(
        text,
      )
    ) {
      travelerType = "couple";
      if (travelers === undefined) travelers = 2;
    } else if (
      /\b(?:family|with\s+kids?|with\s+children|with\s+(?:a\s+)?(?:toddler|baby)|stroller|parents\s+and\s+kids?)\b/i.test(
        text,
      )
    ) {
      travelerType = "family";
      if (travelers === undefined) travelers = 4;
    } else if (
      /\b(?:friends|girls\s+trip|boys\s+trip|bachelor|bachelorette|crew|buddies)\b/i.test(
        text,
      )
    ) {
      travelerType = "friends";
      if (travelers === undefined) travelers = 4;
    } else if (
      /\b(?:business|work\s+trip|conference|bleisure|client\s+visit)\b/i.test(
        text,
      )
    ) {
      travelerType = "business";
      if (travelers === undefined) travelers = 1;
    } else if (travelers === 1) {
      travelerType = "solo";
    } else if (travelers === 2) {
      travelerType = "couple";
    }
  }

  return { travelers, travelerType };
}

function extractBudget(text: string): BudgetTier | undefined {
  if (
    /\b(?:luxury|luxurious|5[\s-]?star|five[\s-]?star|splurge|high[\s-]?end|upscale|first[\s-]?class|pamper(?:ing)?|boutique\s+luxury|fine\s+dining\s+and\s+spas?)\b/i.test(
      text,
    )
  ) {
    return "luxury";
  }
  if (
    /\b(?:moderate|mid[\s-]?range|comfortable|comfort\s+tier|balanced\s+budget)\b/i.test(
      text,
    )
  ) {
    return "moderate";
  }
  if (
    /\b(?:on\s+a\s+budget|budget[\s-]+(?:friendly|trip|travel|getaway|stay|hotel)|cheap|affordable|backpack(?:er|ing)?|shoestring|frugal|low[\s-]?cost|inexpensive|save\s+money)\b/i.test(
      text,
    ) ||
    /(?<!\b(?:moderate|luxury|high|big|flexible|no|unlimited)\s)\bbudget\b/i.test(
      text,
    )
  ) {
    return "budget";
  }
  return undefined;
}

const VIBE_PATTERNS: Array<{ id: VibeId; regex: RegExp }> = [
  {
    id: "foodie",
    regex:
      /\b(?:foodie|food|culinary|gastronomy|street\s+food|ramen|tapas|wine|vineyard|cafes?|coffee|baker(?:y|ies)|restaurants?|dining|markets?|cooking\s+class|eat(?:ing)?|tacos|sushi|pasta)\b/i,
  },
  {
    id: "cultural",
    regex:
      /\b(?:cultural|culture|museums?|history|historic(?:al)?|architecture|art\s+galleries|art|temples?|shrines?|heritage|ruins|old\s+town|local\s+traditions?|castles?|palaces?)\b/i,
  },
  {
    id: "romantic",
    regex:
      /\b(?:romantic|romance|anniversary|honeymoon|intimate|candlelight|sunsets?|couples?\s+retreat)\b/i,
  },
  {
    id: "relaxation",
    regex:
      /\b(?:relax(?:ed|ing|ation)?|chill|unwind|beach(?:es)?|resort|laid[\s-]?back|peaceful|sunbath(?:e|ing)|slow\s+pace|unhurried)\b/i,
  },
  {
    id: "adventure",
    regex:
      /\b(?:adventure|hik(?:e|ing)|trek(?:king)?|surf(?:ing)?|ski(?:ing)?|scuba|div(?:e|ing)|kayak(?:ing)?|climb(?:ing)?|rafting|zip[\s-]?lin(?:e|ing)|outdoor\s+thrills?)\b/i,
  },
  {
    id: "nature",
    regex:
      /\b(?:nature|mountains?|national\s+parks?|forests?|wildlife|scenery|scenic|lakes?|waterfalls?|fjords?|countryside|islands?|coast(?:al|line)?|volcano(?:es)?|gardens?)\b/i,
  },
  {
    id: "wellness",
    regex:
      /\b(?:wellness|spas?|yoga|onsen|hot\s+springs?|retreat|meditation|massage|thermal\s+baths?|hammam)\b/i,
  },
  {
    id: "nightlife",
    regex:
      /\b(?:nightlife|bars?|cocktails?|clubs?|live\s+music|jazz|rooftop\s+bars?|party|pubs?|late\s+night)\b/i,
  },
  {
    id: "shopping",
    regex:
      /\b(?:shopping|boutiques?|vintage|fashion|design\s+shops?|souvenirs?|artisan\s+shops?)\b/i,
  },
  {
    id: "photography",
    regex:
      /\b(?:photography|photo(?:s|genic)?|viewpoints?|golden\s+hour|street\s+photo)\b/i,
  },
];

function extractVibes(text: string): VibeId[] {
  const matched: VibeId[] = [];
  for (const { id, regex } of VIBE_PATTERNS) {
    if (regex.test(text) && !matched.includes(id)) {
      matched.push(id);
      if (matched.length >= 5) break;
    }
  }
  return matched;
}

const DIETARY_PATTERNS: Array<{ option: DietaryOption; regex: RegExp }> = [
  {
    option: "Vegetarian",
    regex: /\b(?:vegetarian|veggie|meatless|no\s+meat)\b/i,
  },
  { option: "Vegan", regex: /\b(?:vegan|plant[\s-]?based)\b/i },
  { option: "Halal", regex: /\bhalal\b/i },
  { option: "Kosher", regex: /\bkosher\b/i },
  {
    option: "Gluten-free",
    regex: /\b(?:gluten[\s-]?free|celiac|coeliac|no\s+gluten)\b/i,
  },
  { option: "Pescatarian", regex: /\b(?:pescatarian|pescetarian)\b/i },
];

function extractDietary(text: string): DietaryOption[] {
  const matched: DietaryOption[] = [];
  for (const { option, regex } of DIETARY_PATTERNS) {
    if (regex.test(text) && !matched.includes(option)) {
      matched.push(option);
    }
  }
  return matched;
}

const KNOWN_ALLERGENS = [
  "peanuts",
  "peanut",
  "tree nuts",
  "tree nut",
  "nuts",
  "nut",
  "shellfish",
  "shrimp",
  "crustaceans",
  "dairy",
  "lactose",
  "milk",
  "sesame",
  "soy",
  "eggs",
  "egg",
  "fish",
  "wheat",
  "almonds",
  "cashews",
  "walnuts",
  "strawberries",
];

function normalizeAllergen(raw: string): string {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/^(?:severe|mild|a|an|the)\s+/i, "")
    .replace(/\s+allerg(?:y|ies)$/i, "")
    .trim();
  if (cleaned === "peanut") return "peanuts";
  if (cleaned === "nut") return "nuts";
  if (cleaned === "tree nut") return "tree nuts";
  if (cleaned === "egg") return "eggs";
  return cleaned;
}

function extractAllergies(text: string): string[] {
  const found = new Set<string>();

  // Pattern 1: "allergic to peanuts, shellfish, and sesame" or "allergic to shellfish, step-free entrance"
  const allergicToRegex =
    /\b(?:allergic\s+to|allerg(?:y|ies)\s+to)\s+([a-z][a-z\s,&/-]{1,80}?)(?=[.;!?]|$)/gi;
  const nonAllergenClause =
    /\b(?:step[\s-]?free|accessible|wheelchair|stroller|midday|relaxed|morning|early|budget|moderate|luxury|vegetarian|vegan|halal|kosher|gluten|pescatarian|we|i|need|want|prefer|looking)\b/i;

  for (const match of text.matchAll(allergicToRegex)) {
    const clauses = match[1].split(",");
    for (let idx = 0; idx < clauses.length; idx++) {
      const clause = clauses[idx].trim();
      if (!clause) continue;
      // After the first comma, stop if the next clause is clearly a different requirement
      if (idx > 0 && nonAllergenClause.test(clause)) break;
      const items = clause.split(/\s*(?:&|\/|\band\b)\s*/i);
      for (const item of items) {
        if (nonAllergenClause.test(item)) break;
        const normalized = normalizeAllergen(item);
        if (
          normalized.length >= 2 &&
          normalized.length <= 40 &&
          (idx === 0 || KNOWN_ALLERGENS.includes(normalized))
        ) {
          found.add(normalized);
        }
      }
    }
  }

  // Pattern 2: "<allergen> allergy" / "<allergen> allergies"
  const allergenBeforeRegex = /\b([a-z]+(?:\s+[a-z]+)?)\s+allerg(?:y|ies)\b/gi;
  for (const match of text.matchAll(allergenBeforeRegex)) {
    const candidate = match[1].trim().toLowerCase();
    // Trim leading non-allergen words like "severe peanut" or "with peanut"
    const words = candidate.split(/\s+/);
    const tail2 = words.slice(-2).join(" ");
    const tail1 = words[words.length - 1];
    if (KNOWN_ALLERGENS.includes(tail2)) {
      found.add(normalizeAllergen(tail2));
    } else if (KNOWN_ALLERGENS.includes(tail1)) {
      found.add(normalizeAllergen(tail1));
    } else if (
      tail1 &&
      ![
        "food",
        "severe",
        "mild",
        "a",
        "my",
        "our",
        "have",
        "has",
        "with",
      ].includes(tail1)
    ) {
      found.add(normalizeAllergen(tail1));
    }
  }

  // Pattern 3: "<allergen>-free" (excluding gluten-free which is dietary)
  const freeRegex =
    /\b(peanut|nut|tree[\s-]nut|shellfish|dairy|sesame|soy|egg)[\s-]+free\b/gi;
  for (const match of text.matchAll(freeRegex)) {
    found.add(normalizeAllergen(match[1].replace(/-/g, " ")));
  }

  if (/\blactose[\s-]+intoleran(?:t|ce)\b/i.test(text)) {
    found.add("dairy");
  }

  return [...found].slice(0, 10);
}

function extractAccessibility(text: string): AccessibilityOptionId[] {
  const found: AccessibilityOptionId[] = [];
  const add = (id: AccessibilityOptionId) => {
    if (!found.includes(id)) found.push(id);
  };

  if (
    /\b(?:step[\s-]?free|wheelchair|no\s+stairs|avoid\s+stairs|elevator\s+access|mobility\s+scooter|accessible\s+entrance|ramp\s+access)\b/i.test(
      text,
    )
  ) {
    add("step_free_entrance");
  }
  if (
    /\b(?:accessible\s+(?:restroom|bathroom|toilet)s?|wheelchair\s+(?:restroom|bathroom))\b/i.test(
      text,
    )
  ) {
    add("accessible_restroom");
  }
  if (
    /\b(?:accessible\s+seating|wheelchair\s+seating|priority\s+seating)\b/i.test(
      text,
    )
  ) {
    add("accessible_seating");
  }
  if (
    /\b(?:accessible\s+parking|disabled\s+parking|handicapped\s+parking)\b/i.test(
      text,
    )
  ) {
    add("accessible_parking");
  }

  return found;
}

function extractPacingAndMobility(text: string): {
  mobilityNotes?: string;
  pacingPreference?: PacingPreference;
} {
  const notes: string[] = [];
  let pacingPreference: PacingPreference | undefined;

  if (
    /\b(?:relaxed\s+mornings?|slow\s+mornings?|no\s+early\s+(?:mornings?|starts?)|avoid\s+early\s+(?:mornings?|starts?)|sleep\s+in|late\s+starts?)\b/i.test(
      text,
    )
  ) {
    notes.push("Relaxed mornings (avoid early starts)");
    pacingPreference = "relaxed";
  }

  if (
    /\b(?:midday\s+(?:rest|break)|afternoon\s+(?:rest|nap|break)|nap\s+time|siesta)\b/i.test(
      text,
    )
  ) {
    notes.push("Midday rest break");
    pacingPreference = "relaxed";
  }

  if (
    /\b(?:stroller[\s-]?friendly|with\s+a?\s*stroller|pushchair)\b/i.test(text)
  ) {
    notes.push("Stroller-friendly routes");
  }

  if (
    /\b(?:minimal\s+walking|light\s+walking|avoid\s+long\s+walks|limited\s+mobility|bad\s+knees?|elderly|grandparents?)\b/i.test(
      text,
    )
  ) {
    notes.push("Lighter walking with frequent rest stops");
    pacingPreference = "relaxed";
  }

  if (
    /\b(?:packed|action[\s-]?packed|fast[\s-]?paced?|see\s+as\s+much\s+as\s+possible|maximize\s+every\s+day)\b/i.test(
      text,
    )
  ) {
    pacingPreference = "packed";
  } else if (
    !pacingPreference &&
    /\b(?:slow\s+pace|unhurried|easygoing|relaxed\s+pace|take\s+it\s+slow)\b/i.test(
      text,
    )
  ) {
    pacingPreference = "relaxed";
    notes.push("Unhurried pace");
  } else if (/\bbalanced\s+pace\b/i.test(text)) {
    pacingPreference = "balanced";
  }

  return {
    mobilityNotes: notes.length > 0 ? notes.join("; ") : undefined,
    pacingPreference,
  };
}

function computeMatchedFields(
  parsed: Omit<ParsedDreamTrip, "confidence" | "matchedFields">,
): string[] {
  const fields: string[] = [];
  if (parsed.destination) fields.push("destination");
  if (parsed.startDate && parsed.endDate) fields.push("dates");
  if (parsed.travelers !== undefined || parsed.travelerType !== undefined)
    fields.push("travelers");
  if (parsed.budget) fields.push("budget");
  if (parsed.vibes.length > 0) fields.push("vibes");
  if (parsed.dietaryPreferences.length > 0) fields.push("dietary");
  if (parsed.allergies.length > 0) fields.push("allergies");
  if (parsed.accessibility.length > 0) fields.push("accessibility");
  if (parsed.mobilityNotes || parsed.pacingPreference) fields.push("pacing");
  return fields;
}

function computeConfidence(
  matchedFields: string[],
  hasDestination: boolean,
): "high" | "medium" | "low" {
  if (matchedFields.length >= 3 && hasDestination) return "high";
  if (matchedFields.length >= 2) return "medium";
  return "low";
}

/**
 * Deterministic natural-language dream trip prompt parser.
 * Works 100% offline with zero network calls or AI credentials.
 */
export function parseDreamTripPrompt(
  rawPrompt: string,
  referenceDate: Date = new Date(),
): ParsedDreamTrip {
  const prompt = rawPrompt.trim().slice(0, 600);
  if (!prompt) {
    return {
      vibes: [],
      dietaryPreferences: [],
      allergies: [],
      accessibility: [],
      confidence: "low",
      source: "deterministic",
      matchedFields: [],
    };
  }

  const { originHint, withoutOrigin } = extractOrigin(prompt);
  const destination = extractDestination(withoutOrigin);
  const dates = extractDates(prompt, referenceDate);
  const { travelers, travelerType } = extractTravelers(prompt);
  const budget = extractBudget(prompt);
  const vibes = extractVibes(prompt);
  const dietaryPreferences = extractDietary(prompt);
  const allergies = extractAllergies(prompt);
  const accessibility = extractAccessibility(prompt);
  const { mobilityNotes, pacingPreference } = extractPacingAndMobility(prompt);

  const partial = {
    destination,
    startDate: dates.startDate,
    endDate: dates.endDate,
    durationDays: dates.durationDays,
    monthHint: dates.monthHint,
    travelers,
    travelerType,
    budget,
    vibes,
    dietaryPreferences,
    allergies,
    accessibility,
    mobilityNotes,
    pacingPreference,
    originHint,
    source: "deterministic" as const,
  };

  const matchedFields = computeMatchedFields(partial);
  const confidence = computeConfidence(matchedFields, Boolean(destination));

  return {
    ...partial,
    matchedFields,
    confidence,
  };
}

export interface LlmPromptEnhancement {
  destinationName?: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  travelerType?: TravelerType;
  budget?: BudgetTier;
  vibes?: VibeId[];
  dietaryPreferences?: DietaryOption[];
  allergies?: string[];
  accessibility?: AccessibilityOptionId[];
  mobilityNotes?: string;
  pacingPreference?: PacingPreference;
}

/**
 * Safely merges validated LLM structured extraction into a deterministic parse.
 * Strong deterministic signals take precedence; LLM fills gaps and enriches vibes.
 */
export function mergeParsedDreamTrip(
  base: ParsedDreamTrip,
  ai: LlmPromptEnhancement,
): ParsedDreamTrip {
  let destination = base.destination;
  if (
    !destination &&
    ai.destinationName &&
    ai.destinationName.trim().length >= 2
  ) {
    const cleaned = ai.destinationName.trim().slice(0, 120);
    const catalogMatch = SORTED_CATALOG_ENTRIES.find(
      (entry) =>
        entry.name.toLowerCase() === cleaned.toLowerCase() ||
        entry.patterns.includes(cleaned.toLowerCase()),
    );
    destination = catalogMatch
      ? {
          name: catalogMatch.name,
          country: catalogMatch.country,
          slug: catalogMatch.slug,
          source: "catalog",
        }
      : {
          name: titleCasePlace(cleaned),
          source: "user",
        };
  }

  let startDate = base.startDate;
  let endDate = base.endDate;
  let durationDays = base.durationDays;
  const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (
    (!startDate || !endDate) &&
    ai.startDate &&
    ai.endDate &&
    isoPattern.test(ai.startDate) &&
    isoPattern.test(ai.endDate) &&
    ai.endDate >= ai.startDate
  ) {
    const days = diffDaysInclusive(ai.startDate, ai.endDate);
    if (days >= 1 && days <= 30) {
      startDate = ai.startDate;
      endDate = ai.endDate;
      durationDays = days;
    }
  }

  const travelers =
    base.travelers ??
    (typeof ai.travelers === "number" &&
    Number.isInteger(ai.travelers) &&
    ai.travelers >= 1 &&
    ai.travelers <= 50
      ? ai.travelers
      : undefined);

  const travelerType =
    base.travelerType ??
    (ai.travelerType && VALID_TRAVELER_TYPES.includes(ai.travelerType)
      ? ai.travelerType
      : undefined);

  const budget =
    base.budget ??
    (ai.budget && VALID_BUDGETS.includes(ai.budget) ? ai.budget : undefined);

  const mergedVibes = [
    ...new Set([
      ...base.vibes,
      ...(ai.vibes ?? []).filter((v): v is VibeId => VALID_VIBES.includes(v)),
    ]),
  ].slice(0, 5);

  const mergedDietary = [
    ...new Set([
      ...base.dietaryPreferences,
      ...(ai.dietaryPreferences ?? []).filter((d): d is DietaryOption =>
        VALID_DIETARY.includes(d),
      ),
    ]),
  ];

  const mergedAllergies = [
    ...new Set([
      ...base.allergies,
      ...(ai.allergies ?? [])
        .map(normalizeAllergen)
        .filter((a) => a.length >= 2 && a.length <= 40),
    ]),
  ].slice(0, 10);

  const mergedAccessibility = [
    ...new Set([
      ...base.accessibility,
      ...(ai.accessibility ?? []).filter((a): a is AccessibilityOptionId =>
        VALID_ACCESSIBILITY.includes(a),
      ),
    ]),
  ];

  const mobilityNotes =
    base.mobilityNotes ??
    (ai.mobilityNotes && ai.mobilityNotes.trim().length > 0
      ? ai.mobilityNotes.trim().slice(0, 500)
      : undefined);

  const pacingPreference = base.pacingPreference ?? ai.pacingPreference;

  const partial = {
    destination,
    startDate,
    endDate,
    durationDays,
    monthHint: base.monthHint,
    travelers,
    travelerType,
    budget,
    vibes: mergedVibes,
    dietaryPreferences: mergedDietary,
    allergies: mergedAllergies,
    accessibility: mergedAccessibility,
    mobilityNotes,
    pacingPreference,
    originHint: base.originHint,
    source: "hybrid" as const,
  };

  const matchedFields = computeMatchedFields(partial);
  const confidence = computeConfidence(matchedFields, Boolean(destination));

  return {
    ...partial,
    matchedFields,
    confidence,
  };
}

const BUDGET_LABELS: Record<BudgetTier, string> = {
  budget: "Budget",
  moderate: "Comfort",
  luxury: "Luxury",
};

const GROUP_LABELS: Record<TravelerType, string> = {
  solo: "Solo",
  couple: "Couple",
  family: "Family",
  friends: "Friends",
  business: "Business",
};

const VIBE_LABELS: Record<VibeId, string> = {
  adventure: "Adventure",
  relaxation: "Relaxation",
  cultural: "Cultural",
  foodie: "Foodie",
  nightlife: "Nightlife",
  romantic: "Romantic",
  nature: "Nature",
  shopping: "Shopping",
  wellness: "Wellness",
  photography: "Photography",
};

/** Build crisp human-readable summary pills for what was extracted. */
export function summarizeParsedDreamTrip(parsed: ParsedDreamTrip): string[] {
  const summary: string[] = [];
  if (parsed.destination) {
    summary.push(parsed.destination.name);
  }
  if (parsed.startDate && parsed.endDate) {
    const [, sm, sd] = parsed.startDate.split("-").map(Number);
    const [, em, ed] = parsed.endDate.split("-").map(Number);
    const startMonth = MONTH_NAMES[sm - 1];
    const endMonth = MONTH_NAMES[em - 1];
    if (startMonth && endMonth && Number.isFinite(sd) && Number.isFinite(ed)) {
      const startLabel = `${startMonth.slice(0, 3)} ${sd}`;
      const endLabel = sm === em ? `${ed}` : `${endMonth.slice(0, 3)} ${ed}`;
      summary.push(`${startLabel}–${endLabel}`);
    }
  }
  if (parsed.travelers !== undefined || parsed.travelerType) {
    const parts: string[] = [];
    if (parsed.travelers !== undefined) parts.push(`${parsed.travelers}`);
    if (parsed.travelerType) parts.push(GROUP_LABELS[parsed.travelerType]);
    summary.push(parts.join(" · "));
  }
  if (parsed.budget) {
    summary.push(BUDGET_LABELS[parsed.budget]);
  }
  if (parsed.vibes.length > 0) {
    summary.push(parsed.vibes.map((v) => VIBE_LABELS[v]).join(", "));
  }
  if (parsed.dietaryPreferences.length > 0) {
    summary.push(parsed.dietaryPreferences.join(", "));
  }
  if (parsed.allergies.length > 0) {
    summary.push(`Allergies: ${parsed.allergies.join(", ")}`);
  }
  if (parsed.accessibility.length > 0) {
    summary.push(
      `${parsed.accessibility.length} accessibility ${parsed.accessibility.length === 1 ? "need" : "needs"}`,
    );
  }
  if (parsed.mobilityNotes) {
    summary.push(parsed.mobilityNotes);
  }
  return summary;
}
