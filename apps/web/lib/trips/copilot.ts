import { z } from "zod";
import {
  isTimingNote,
  type ActivityResult,
  type GeneratedItinerary,
  type ItineraryActivity,
  type Restaurant,
  type TimeOfDay,
  type TripDay,
} from "@faroway/types";
import { canDisplayViatorContent } from "@/lib/affiliates/viator-policy";
export {
  analyzeBookingReadiness,
  findOnTripUpNext,
  type BookingReadinessReport,
  type BookingReadinessStop,
  type OnTripUpNext,
} from "@/lib/trips/companion-radar";

export const COPILOT_SLOTS = ["morning", "afternoon", "evening"] as const;
export type CopilotSlot = (typeof COPILOT_SLOTS)[number];

export const COPILOT_ACTIONS = [
  "swap_stop",
  "relax_day",
  "rain_backup",
  "shift_day",
  "undo",
] as const;
export type CopilotAction = (typeof COPILOT_ACTIONS)[number];

export interface CopilotDiffEntry {
  dayNumber: number;
  slot: string;
  before?: string;
  after?: string;
  action: "swapped" | "removed" | "moved";
}

export interface CopilotResult {
  applied: boolean;
  summary: string;
  diff: CopilotDiffEntry[];
  updatedItinerary: GeneratedItinerary;
  previousItinerarySnapshot: GeneratedItinerary;
  notice?: string;
}

export interface CopilotOptions {
  lockedItemIds?: string[];
  backupPool?: Array<
    ItineraryActivity | ActivityResult | Record<string, unknown>
  >;
  undoTargetItinerary?: GeneratedItinerary | null;
}

export const CopilotRequestSchema = z
  .object({
    action: z.enum(COPILOT_ACTIONS).optional(),
    prompt: z.string().trim().max(400).optional(),
    dayNumber: z.number().int().min(1).max(60).optional(),
    slot: z.enum(COPILOT_SLOTS).optional(),
    targetDayNumber: z.number().int().min(1).max(60).optional(),
    targetSlot: z.enum(COPILOT_SLOTS).optional(),
    stopName: z.string().trim().max(200).optional(),
    expectedUpdatedAt: z.string().min(1).optional(),
    expectedPlanRevision: z.string().uuid().nullable().optional(),
    undoRevisionId: z.string().uuid().optional(),
  })
  .refine(
    (data) => Boolean(data.action || (data.prompt && data.prompt.length > 0)),
    { message: "Provide an action or a natural-language instruction." },
  );

export type CopilotRequestInput = z.infer<typeof CopilotRequestSchema>;

// ── Classification helpers ──────────────────────────────────────────────────

const STRONG_INDOOR_KEYWORDS = [
  "museum",
  "gallery",
  "art center",
  "art centre",
  "exhibition",
  "aquarium",
  "planetarium",
  "library",
  "theater",
  "theatre",
  "opera house",
  "concert hall",
  "covered market",
  "market hall",
  "food hall",
  "shopping arcade",
  "department store",
  "indoor",
  "spa",
  "onsen",
  "bathhouse",
  "cooking class",
  "workshop",
  "tasting room",
  "tea house",
  "teahouse",
  "coffee shop",
  "café",
  "cafe",
  "patisserie",
  "bakery",
  "bookstore",
  "bookshop",
  "cathedral",
  "basilica",
  "chapel",
  "conservatory",
  "cinema",
  "winery",
  "brewery",
  "distillery",
  "mall",
  "louvre",
  "orsay",
  "prado",
  "uffizi",
  "british museum",
  "teamlab",
];

const OUTDOOR_KEYWORDS = [
  "park",
  "garden",
  "gardens",
  "walk",
  "walking tour",
  "stroll",
  "beach",
  "viewpoint",
  "overlook",
  "promenade",
  "open-air",
  "open air",
  "street market",
  "flea market",
  "farmers market",
  "night market",
  "market",
  "hike",
  "hiking",
  "trail",
  "boat",
  "cruise",
  "kayak",
  "bike",
  "cycling",
  "outdoor",
  "botanical",
  "bridge",
  "harbor",
  "harbour",
  "waterfront",
  "pier",
  "zoo",
  "rooftop",
  "observation deck",
  "courtyard",
  "plaza",
  "square",
  "boardwalk",
  "coast",
  "cliff",
  "canyon",
  "waterfall",
  "lake",
  "riverfront",
  "ruins",
  "sculpture park",
  "picnic",
];

function activityText(stop: {
  name?: string;
  description?: string;
  category?: string;
  location?: { name?: string };
}): string {
  return [
    stop.name ?? "",
    stop.description ?? "",
    stop.category ?? "",
    stop.location?.name ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

function compileWordPatterns(keywords: readonly string[]): RegExp[] {
  return keywords.map(
    (kw) =>
      new RegExp(
        `\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+")}\\b`,
        "i",
      ),
  );
}

const STRONG_INDOOR_PATTERNS = compileWordPatterns(STRONG_INDOOR_KEYWORDS);
const OUTDOOR_PATTERNS = compileWordPatterns(OUTDOOR_KEYWORDS);
const INDOOR_TITLE_OVERRIDE_PATTERNS = compileWordPatterns([
  "covered market",
  "market hall",
  "food hall",
  "museum",
  "gallery",
  "aquarium",
  "indoor",
]);

function matchesAnyPattern(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function isIndoorStop(stop: {
  name?: string;
  description?: string;
  category?: string;
  location?: { name?: string };
}): boolean {
  const title = stop.name ?? "";
  const full = activityText(stop);
  if (matchesAnyPattern(title, STRONG_INDOOR_PATTERNS)) return true;
  if (
    matchesAnyPattern(full, STRONG_INDOOR_PATTERNS) &&
    !matchesAnyPattern(title, OUTDOOR_PATTERNS)
  ) {
    return true;
  }
  return false;
}

export function isOutdoorStop(stop: {
  name?: string;
  description?: string;
  category?: string;
  location?: { name?: string };
}): boolean {
  const title = stop.name ?? "";
  const full = activityText(stop);

  // Covered / indoor markets and museums win over generic "market" / "walk" text.
  if (matchesAnyPattern(title, INDOOR_TITLE_OVERRIDE_PATTERNS)) {
    return false;
  }

  if (matchesAnyPattern(title, OUTDOOR_PATTERNS)) return true;
  if (stop.category === "adventure" && !isIndoorStop(stop)) return true;
  if (!isIndoorStop(stop) && matchesAnyPattern(full, OUTDOOR_PATTERNS)) {
    return true;
  }
  return false;
}

// ── Activity / itinerary helpers ────────────────────────────────────────────

type TaggedActivity = ItineraryActivity & {
  planItemId?: string;
  viatorContentVersion?: unknown;
};

function getSlotActivities(day: TripDay, slot: CopilotSlot): TaggedActivity[] {
  const block = day[slot];
  if (!block || !Array.isArray(block.activities)) return [];
  return block.activities as TaggedActivity[];
}

function ensureSlot(
  day: TripDay,
  slot: CopilotSlot,
): {
  activities: TaggedActivity[];
  meals: Restaurant[];
} {
  if (!day[slot]) {
    day[slot] = { activities: [], meals: [] };
  }
  if (!Array.isArray(day[slot].activities)) {
    day[slot].activities = [];
  }
  if (!Array.isArray(day[slot].meals)) {
    day[slot].meals = [];
  }
  return day[slot] as { activities: TaggedActivity[]; meals: Restaurant[] };
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isActivityLocked(
  activity: TaggedActivity,
  lockedSet: Set<string>,
): boolean {
  if (lockedSet.size === 0) return false;
  if (activity.planItemId && lockedSet.has(activity.planItemId)) return true;
  if (activity.id && lockedSet.has(activity.id)) return true;
  return false;
}

function getSlotMeals(day: TripDay, slot: CopilotSlot): Restaurant[] {
  const block = day[slot] as
    | { meals?: Restaurant[]; meal?: Restaurant }
    | undefined;
  if (!block) return [];
  if (Array.isArray(block.meals) && block.meals.length > 0) return block.meals;
  if (block.meal) return [block.meal];
  return [];
}

function generateFreshPlanItemId(): string {
  return `item_${crypto.randomUUID().replace(/-/g, "")}`;
}

function collectUsedIdentifiers(itinerary: GeneratedItinerary): {
  names: Set<string>;
  ids: Set<string>;
} {
  const names = new Set<string>();
  const ids = new Set<string>();
  for (const day of itinerary.days || []) {
    for (const slot of COPILOT_SLOTS) {
      for (const act of getSlotActivities(day, slot)) {
        if (act?.name) names.add(normalizeName(act.name));
        if (act?.id) ids.add(act.id);
      }
      for (const meal of getSlotMeals(day, slot)) {
        if (meal?.name) names.add(normalizeName(meal.name));
        if (meal?.id) ids.add(meal.id);
      }
    }
  }
  return { names, ids };
}

function clearStaleDayTiming(
  day: TripDay,
  itinerary?: GeneratedItinerary,
): void {
  delete day.timingProposal;
  delete day.totalEstimatedCost;
  if (Array.isArray(day.tips)) {
    day.tips = day.tips.filter(
      (tip) => typeof tip === "string" && !isTimingNote(tip),
    );
  }
  day.summary = "Schedule updated. Check travel times and opening hours.";
  if (itinerary) {
    itinerary.overview = "";
  }
}

function mapCategory(raw: unknown): ItineraryActivity["category"] {
  const normalized = typeof raw === "string" ? raw.toLowerCase() : "";
  const categoryMap: Record<string, ItineraryActivity["category"]> = {
    sightseeing: "sightseeing",
    adventure: "adventure",
    cultural: "cultural",
    relaxation: "relaxation",
    entertainment: "entertainment",
    shopping: "shopping",
    food: "cultural",
    nature: "adventure",
    nightlife: "entertainment",
  };
  return categoryMap[normalized] || "sightseeing";
}

/**
 * Normalizes a grounded candidate from `search_results` (`ActivityResult`) or
 * an existing backup `ItineraryActivity` into a valid `ItineraryActivity`.
 * Strictly rejects planning ideas, unnamed stubs, and restricted provider items.
 */
export function normalizeBackupCandidate(
  raw: unknown,
  fallbackSlot: TimeOfDay = "afternoon",
): ItineraryActivity | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  if (item.planningIdea === true) return null;
  if (!canDisplayViatorContent(item)) return null;

  const name = typeof item.name === "string" ? item.name.trim() : "";
  if (!name) return null;

  // Already shaped like ItineraryActivity
  if (
    typeof item.id === "string" &&
    item.id.trim().length > 0 &&
    item.estimatedCost &&
    typeof item.estimatedCost === "object" &&
    !Array.isArray(item.estimatedCost) &&
    item.vibeMatch &&
    typeof item.vibeMatch === "object" &&
    !Array.isArray(item.vibeMatch)
  ) {
    const existing = structuredClone(item) as unknown as ItineraryActivity;
    existing.timeOfDay = fallbackSlot;
    return existing;
  }

  // ActivityResult shape from search_results
  const loc =
    item.location && typeof item.location === "object"
      ? (item.location as Record<string, unknown>)
      : {};
  const lat =
    typeof loc.lat === "number" && Number.isFinite(loc.lat)
      ? loc.lat
      : undefined;
  const lng =
    typeof loc.lng === "number" && Number.isFinite(loc.lng)
      ? loc.lng
      : undefined;
  const existingCoords =
    loc.coordinates && typeof loc.coordinates === "object"
      ? (loc.coordinates as { lat?: number; lng?: number })
      : undefined;
  const coordinates =
    existingCoords &&
    typeof existingCoords.lat === "number" &&
    typeof existingCoords.lng === "number"
      ? { lat: existingCoords.lat, lng: existingCoords.lng }
      : lat !== undefined && lng !== undefined
        ? { lat, lng }
        : undefined;

  const price =
    typeof item.price === "number" &&
    Number.isFinite(item.price) &&
    item.price >= 0
      ? item.price
      : 0;
  const currency = typeof item.currency === "string" ? item.currency : "";
  const priceStatus =
    item.priceStatus === "unknown" || !currency ? "unknown" : "estimate";

  const matchedVibes = Array.isArray(item.vibeMatch)
    ? item.vibeMatch.filter((v): v is string => typeof v === "string")
    : [];

  const duration =
    typeof item.duration === "number" &&
    Number.isFinite(item.duration) &&
    item.duration > 0
      ? item.duration
      : 90;

  const rawBestTime =
    typeof item.bestTimeOfDay === "string"
      ? item.bestTimeOfDay.toLowerCase()
      : "";
  const resolvedTimeOfDay: TimeOfDay =
    rawBestTime === "morning" ||
    rawBestTime === "afternoon" ||
    rawBestTime === "evening"
      ? rawBestTime
      : fallbackSlot;

  const normalized: ItineraryActivity = {
    ...(item.source
      ? { source: item.source as ItineraryActivity["source"] }
      : {}),
    ...(item.proposedVisitType
      ? {
          proposedVisitType:
            item.proposedVisitType as ItineraryActivity["proposedVisitType"],
        }
      : {}),
    id:
      typeof item.id === "string" && item.id.trim()
        ? item.id.trim()
        : `backup_${normalizeName(name).replace(/\s+/g, "_")}`,
    name,
    description:
      typeof item.description === "string" && item.description.trim()
        ? item.description.trim()
        : `${name} from your researched venue options.`,
    duration,
    estimatedCost: {
      amount: priceStatus === "unknown" ? 0 : price,
      status: priceStatus,
      currency: priceStatus === "unknown" ? "" : currency,
    },
    timeOfDay: resolvedTimeOfDay,
    category: mapCategory(item.category),
    location: {
      name:
        (typeof loc.name === "string" && loc.name) ||
        (typeof loc.neighborhood === "string" && loc.neighborhood) ||
        name,
      ...(typeof loc.address === "string" && loc.address
        ? { address: loc.address }
        : {}),
      ...(coordinates ? { coordinates } : {}),
    },
    vibeMatch: {
      matchedVibes,
      reasoning:
        matchedVibes.length > 0
          ? `Matches your ${matchedVibes.join(", ")} style`
          : "Selected from your trip's researched venue pool",
    },
    bookingInfo: {
      requiresReservation: Boolean(item.bookingRequired),
      ...(typeof item.affiliateUrl === "string" && item.affiliateUrl
        ? { bookingUrl: item.affiliateUrl }
        : {}),
      ...(typeof item.affiliatePartner === "string" && item.affiliatePartner
        ? { affiliateId: item.affiliatePartner }
        : {}),
    },
    ...(typeof item.rating === "number" ? { rating: item.rating } : {}),
    ...(typeof item.reviewCount === "number"
      ? { reviewCount: item.reviewCount }
      : {}),
    ...(Array.isArray(item.images)
      ? {
          images: item.images.filter(
            (img): img is string => typeof img === "string",
          ),
        }
      : {}),
    ...(typeof item.tripadvisorRating === "number"
      ? { tripadvisorRating: item.tripadvisorRating }
      : {}),
    ...(typeof item.tripadvisorReviewCount === "number"
      ? { tripadvisorReviewCount: item.tripadvisorReviewCount }
      : {}),
    ...(typeof item.tripadvisorUrl === "string"
      ? { tripadvisorUrl: item.tripadvisorUrl }
      : {}),
  };

  if (
    "viatorContentVersion" in item &&
    item.viatorContentVersion !== undefined
  ) {
    (normalized as TaggedActivity).viatorContentVersion =
      item.viatorContentVersion;
  }

  return normalized;
}

// ── Natural-language command parser ─────────────────────────────────────────

export interface ParsedCopilotIntent {
  action: CopilotAction;
  dayNumber?: number;
  slot?: CopilotSlot;
  targetDayNumber?: number;
  targetSlot?: CopilotSlot;
  stopName?: string;
  clearSlot?: boolean;
}

const ORDINAL_DAY_MAP: Record<string, number> = {
  first: 1,
  one: 1,
  second: 2,
  two: 2,
  third: 3,
  three: 3,
  fourth: 4,
  four: 4,
  fifth: 5,
  five: 5,
  sixth: 6,
  six: 6,
  seventh: 7,
  seven: 7,
};

function findMentionedStop(
  prompt: string,
  itinerary: GeneratedItinerary,
): { name: string; dayNumber: number; slot: CopilotSlot } | null {
  const lower = prompt.toLowerCase();
  let bestMatch: {
    name: string;
    dayNumber: number;
    slot: CopilotSlot;
    score: number;
  } | null = null;

  for (const day of itinerary.days || []) {
    for (const slot of COPILOT_SLOTS) {
      for (const act of getSlotActivities(day, slot)) {
        if (!act?.name) continue;
        const actLower = act.name.toLowerCase();
        if (lower.includes(actLower)) {
          if (!bestMatch || actLower.length > bestMatch.score) {
            bestMatch = {
              name: act.name,
              dayNumber: day.dayNumber,
              slot,
              score: actLower.length + 100,
            };
          }
          continue;
        }
        // Match distinctive words (>= 4 chars) of the stop name
        const tokens = actLower
          .split(/[^a-z0-9]+/)
          .filter(
            (t) =>
              t.length >= 4 &&
              ![
                "tour",
                "walk",
                "visit",
                "with",
                "from",
                "that",
                "this",
                "park",
                "morning",
                "afternoon",
                "evening",
              ].includes(t),
          );
        const matched = tokens.filter((t) => lower.includes(t));
        if (matched.length > 0) {
          const score = matched.reduce((acc, t) => acc + t.length, 0);
          if (score >= 5 && (!bestMatch || score > bestMatch.score)) {
            bestMatch = {
              name: act.name,
              dayNumber: day.dayNumber,
              slot,
              score,
            };
          }
        }
      }
    }
  }
  return bestMatch
    ? {
        name: bestMatch.name,
        dayNumber: bestMatch.dayNumber,
        slot: bestMatch.slot,
      }
    : null;
}

function extractDayNumbers(prompt: string, totalDays: number): number[] {
  const results: number[] = [];
  const regex = /\bday\s*(\d+|one|two|three|four|five|six|seven)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(prompt)) !== null) {
    const raw = match[1].toLowerCase();
    const num = ORDINAL_DAY_MAP[raw] ?? Number.parseInt(raw, 10);
    if (Number.isFinite(num) && num >= 1 && num <= Math.max(1, totalDays)) {
      results.push(num);
    }
  }
  if (results.length === 0) {
    if (/\b(first\s+day|arrival\s+day)\b/i.test(prompt)) results.push(1);
    else if (/\blast\s+day\b/i.test(prompt) && totalDays > 0)
      results.push(totalDays);
  }
  return results;
}

function extractSlots(prompt: string): CopilotSlot[] {
  const results: CopilotSlot[] = [];
  const regex = /\b(morning|afternoon|evening)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(prompt)) !== null) {
    const s = match[1].toLowerCase() as CopilotSlot;
    results.push(s);
  }
  return results;
}

export function parseCopilotPrompt(
  prompt: string,
  itinerary: GeneratedItinerary,
): ParsedCopilotIntent {
  const trimmed = prompt.trim();
  const totalDays = itinerary.days?.length ?? 1;
  const days = extractDayNumbers(trimmed, totalDays);
  const slots = extractSlots(trimmed);
  const mentionedStop = findMentionedStop(trimmed, itinerary);

  if (/\b(undo|revert|roll\s*back|go\s+back)\b/i.test(trimmed)) {
    return { action: "undo" };
  }

  if (
    /\b(rain|rainy|umbrella|storm|wet|indoor|indoors|weather\s+backup|bad\s+weather)\b/i.test(
      trimmed,
    )
  ) {
    return {
      action: "rain_backup",
      dayNumber: days[0],
      slot: slots[0],
    };
  }

  // Clear slot / late arrival / later start -> shift_day (clearSlot mode)
  if (
    /\b(clear|free\s+up|later\s+start|start\s+later|sleep\s+in|land\s+at|arrive\s+at|arriving\s+late|late\s+arrival|check[- ]?in)\b/i.test(
      trimmed,
    )
  ) {
    const slotToClear: CopilotSlot =
      slots[0] ??
      (/\b([7-9]\s*pm|19|20|21|22):?00?\b/i.test(trimmed)
        ? "afternoon"
        : "morning");
    return {
      action: "shift_day",
      dayNumber: days[0] ?? 1,
      slot: slotToClear,
      clearSlot: true,
    };
  }

  // Explicit move / shift to another day or slot
  if (
    /\b(move|shift|reschedule|push|put|switch)\b/i.test(trimmed) &&
    (mentionedStop ||
      /\bto\s+(day\s*\d+|morning|afternoon|evening)\b/i.test(trimmed))
  ) {
    const toTargetMatch = trimmed.match(
      /\bto\s+(?:day\s*(\d+|one|two|three|four|five|six|seven))?\s*(morning|afternoon|evening)?/i,
    );
    const parsedTargetDay = toTargetMatch?.[1]
      ? (ORDINAL_DAY_MAP[toTargetMatch[1].toLowerCase()] ??
        Number.parseInt(toTargetMatch[1], 10))
      : undefined;
    const parsedTargetSlot = toTargetMatch?.[2]
      ? (toTargetMatch[2].toLowerCase() as CopilotSlot)
      : undefined;

    const targetDayNumber =
      parsedTargetDay ??
      (days.length >= 2 ? days[1] : (days[0] ?? mentionedStop?.dayNumber ?? 1));
    const targetSlot =
      parsedTargetSlot ??
      (slots.length >= 2 ? slots[1] : (slots[0] ?? "afternoon"));

    return {
      action: "shift_day",
      dayNumber: mentionedStop?.dayNumber ?? days[0],
      slot: mentionedStop?.slot ?? (slots.length >= 2 ? slots[0] : undefined),
      targetDayNumber,
      targetSlot,
      stopName: mentionedStop?.name,
    };
  }

  if (
    /\b(relax|slower|lighter|chill|less\s+packed|breathe|breathing\s+room|trim|drop|remove|cut|too\s+busy|ease\s+up|slow\s+down|overpacked)\b/i.test(
      trimmed,
    )
  ) {
    return {
      action: "relax_day",
      dayNumber: days[0] ?? mentionedStop?.dayNumber,
      slot: slots[0] ?? mentionedStop?.slot,
      stopName: mentionedStop?.name,
    };
  }

  // Default to swap_stop (e.g. "swap Louvre", "replace X with something new")
  return {
    action: "swap_stop",
    dayNumber: mentionedStop?.dayNumber ?? days[0],
    slot: mentionedStop?.slot ?? slots[0],
    stopName: mentionedStop?.name,
  };
}

// ── Core surgical co-pilot execution ────────────────────────────────────────

function findDayByNumber(
  days: TripDay[],
  dayNumber?: number,
): TripDay | undefined {
  if (!days.length) return undefined;
  if (dayNumber !== undefined) {
    return days.find((d) => d.dayNumber === dayNumber) ?? days[dayNumber - 1];
  }
  return days[0];
}

function findBusiestDay(
  days: TripDay[],
  lockedSet: Set<string>,
): TripDay | undefined {
  if (!days.length) return undefined;
  let best: TripDay | undefined;
  let bestCount = -1;
  for (const day of days) {
    const unlockedCount = COPILOT_SLOTS.reduce(
      (sum, slot) =>
        sum +
        getSlotActivities(day, slot).filter(
          (a) => !isActivityLocked(a, lockedSet),
        ).length,
      0,
    );
    if (unlockedCount > bestCount) {
      bestCount = unlockedCount;
      best = day;
    }
  }
  return best ?? days[0];
}

function selectBestBackup(
  pool: ItineraryActivity[],
  used: { names: Set<string>; ids: Set<string> },
  preferredSlot: CopilotSlot,
  requireIndoor: boolean,
): ItineraryActivity | null {
  const candidates = pool.filter((candidate) => {
    const norm = normalizeName(candidate.name);
    if (!norm || used.names.has(norm) || used.ids.has(candidate.id)) {
      return false;
    }
    if (requireIndoor) {
      return isIndoorStop(candidate) && !isOutdoorStop(candidate);
    }
    return true;
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aSlotScore = a.timeOfDay === preferredSlot ? 1 : 0;
    const bSlotScore = b.timeOfDay === preferredSlot ? 1 : 0;
    if (bSlotScore !== aSlotScore) return bSlotScore - aSlotScore;
    const aRating = a.rating ?? a.tripadvisorRating ?? 0;
    const bRating = b.rating ?? b.tripadvisorRating ?? 0;
    return bRating - aRating;
  });

  return candidates[0];
}

function pickLighterDestinationSlot(
  days: TripDay[],
  sourceDayIndex: number,
  sourceSlot: CopilotSlot,
): { dayIndex: number; slot: CopilotSlot } | null {
  const slotOrder: CopilotSlot[] =
    sourceSlot === "morning"
      ? ["afternoon", "evening"]
      : sourceSlot === "afternoon"
        ? ["evening", "morning"]
        : ["afternoon", "morning"];

  // First try later slots on the same day with <= 2 activities
  const sameDay = days[sourceDayIndex];
  for (const candidateSlot of slotOrder) {
    if (getSlotActivities(sameDay, candidateSlot).length < 2) {
      return { dayIndex: sourceDayIndex, slot: candidateSlot };
    }
  }

  // Next try the lightest slot across subsequent future days (never wrap back to Day 1)
  let bestFuture: {
    dayIndex: number;
    slot: CopilotSlot;
    count: number;
  } | null = null;
  for (let idx = sourceDayIndex + 1; idx < days.length; idx++) {
    const day = days[idx];
    for (const s of COPILOT_SLOTS) {
      const len = getSlotActivities(day, s).length;
      if (!bestFuture || len < bestFuture.count) {
        bestFuture = { dayIndex: idx, slot: s, count: len };
      }
    }
  }
  if (bestFuture) {
    return { dayIndex: bestFuture.dayIndex, slot: bestFuture.slot };
  }

  // Fallback to same day afternoon/evening even if it already has 2 items
  return { dayIndex: sourceDayIndex, slot: slotOrder[0] };
}

export function applyCopilotEdit(
  currentItinerary: GeneratedItinerary,
  request: CopilotRequestInput,
  options: CopilotOptions = {},
): CopilotResult {
  const previousSnapshot = structuredClone(currentItinerary);
  const updated = structuredClone(currentItinerary);
  const lockedSet = new Set(options.lockedItemIds ?? []);

  if (!Array.isArray(updated.days) || updated.days.length === 0) {
    return {
      applied: false,
      summary: "There are no scheduled days in this itinerary to edit yet.",
      diff: [],
      updatedItinerary: previousSnapshot,
      previousItinerarySnapshot: previousSnapshot,
      notice: "Generate your itinerary first before running co-pilot tweaks.",
    };
  }

  const parsedIntent = request.prompt
    ? parseCopilotPrompt(request.prompt, updated)
    : null;

  const action: CopilotAction =
    request.action ?? parsedIntent?.action ?? "swap_stop";
  const isPromptDriven = Boolean(request.prompt && !request.action);
  const dayNumber = isPromptDriven
    ? (parsedIntent?.dayNumber ?? request.dayNumber)
    : (request.dayNumber ?? parsedIntent?.dayNumber);
  const slot = isPromptDriven
    ? (parsedIntent?.slot ?? request.slot)
    : (request.slot ?? parsedIntent?.slot);
  const targetDayNumber =
    request.targetDayNumber ?? parsedIntent?.targetDayNumber;
  const targetSlot = request.targetSlot ?? parsedIntent?.targetSlot;
  const stopName = request.stopName ?? parsedIntent?.stopName;
  const clearSlot =
    parsedIntent?.clearSlot ||
    (action === "shift_day" &&
      !stopName &&
      !targetDayNumber &&
      !targetSlot &&
      Boolean(slot));

  const normalizedPool: ItineraryActivity[] = (options.backupPool ?? [])
    .map((candidate) =>
      normalizeBackupCandidate(candidate, slot ?? "afternoon"),
    )
    .filter((c): c is ItineraryActivity => c !== null);

  // ── 1. UNDO ───────────────────────────────────────────────────────────────
  if (action === "undo") {
    const snap = options.undoTargetItinerary;
    if (!snap || !Array.isArray(snap.days)) {
      return {
        applied: false,
        summary: "No previous revision is available to undo.",
        diff: [],
        updatedItinerary: previousSnapshot,
        previousItinerarySnapshot: previousSnapshot,
      };
    }
    const restored = structuredClone(snap);
    return {
      applied: true,
      summary: "Reverted your last co-pilot change.",
      diff: [],
      updatedItinerary: restored,
      previousItinerarySnapshot: previousSnapshot,
    };
  }

  // ── 2. SWAP STOP ──────────────────────────────────────────────────────────
  if (action === "swap_stop") {
    let targetDay: TripDay | undefined;
    let targetSlotFound: CopilotSlot | undefined;
    let targetIdx = -1;
    let blockedByLock = false;

    if (stopName) {
      const needle = stopName.toLowerCase();
      for (const day of updated.days) {
        if (dayNumber !== undefined && day.dayNumber !== dayNumber) continue;
        for (const s of COPILOT_SLOTS) {
          if (slot && s !== slot) continue;
          const acts = getSlotActivities(day, s);
          const idx = acts.findIndex((a) =>
            a.name.toLowerCase().includes(needle),
          );
          if (idx !== -1) {
            if (isActivityLocked(acts[idx], lockedSet)) {
              blockedByLock = true;
              continue;
            }
            targetDay = day;
            targetSlotFound = s;
            targetIdx = idx;
            break;
          }
        }
        if (targetDay) break;
      }
    } else {
      const day = findDayByNumber(updated.days, dayNumber);
      if (day) {
        const candidateSlots = slot ? [slot] : [...COPILOT_SLOTS];
        // Pick the heaviest (longest duration) unlocked stop in the chosen slot/day
        let maxDuration = -1;
        for (const s of candidateSlots) {
          const acts = getSlotActivities(day, s);
          acts.forEach((act, idx) => {
            if (isActivityLocked(act, lockedSet)) {
              blockedByLock = true;
              return;
            }
            const dur = act.duration ?? 60;
            if (dur > maxDuration) {
              maxDuration = dur;
              targetDay = day;
              targetSlotFound = s;
              targetIdx = idx;
            }
          });
        }
      }
    }

    if (!targetDay || !targetSlotFound || targetIdx === -1) {
      return {
        applied: false,
        summary: blockedByLock
          ? "That stop is locked and was kept untouched."
          : "Could not find an editable stop matching that request.",
        diff: [],
        updatedItinerary: previousSnapshot,
        previousItinerarySnapshot: previousSnapshot,
        notice: blockedByLock
          ? "Unlock the stop in Make this plan yours if you want to swap it."
          : undefined,
      };
    }

    const used = collectUsedIdentifiers(updated);
    const replacement = selectBestBackup(
      normalizedPool,
      used,
      targetSlotFound,
      false,
    );

    if (!replacement) {
      return {
        applied: false,
        summary: `No unused grounded backup venues are cached for ${targetDay.title || `Day ${targetDay.dayNumber}`} yet.`,
        diff: [],
        updatedItinerary: previousSnapshot,
        previousItinerarySnapshot: previousSnapshot,
        notice:
          "Faroway only swaps in researched venues — we never invent unverified places. Tweak your trip brief and regenerate to pull fresh options.",
      };
    }

    const slotBlock = ensureSlot(targetDay, targetSlotFound);
    const oldActivity = slotBlock.activities[targetIdx];
    const nextActivity: TaggedActivity = {
      ...structuredClone(replacement),
      timeOfDay: targetSlotFound,
      planItemId: generateFreshPlanItemId(),
    };
    slotBlock.activities[targetIdx] = nextActivity;
    clearStaleDayTiming(targetDay, updated);

    return {
      applied: true,
      summary: `Swapped ${oldActivity.name} for ${nextActivity.name} on Day ${targetDay.dayNumber} ${targetSlotFound}.`,
      diff: [
        {
          dayNumber: targetDay.dayNumber,
          slot: targetSlotFound,
          before: oldActivity.name,
          after: nextActivity.name,
          action: "swapped",
        },
      ],
      updatedItinerary: updated,
      previousItinerarySnapshot: previousSnapshot,
      notice:
        "Schedule timing was refreshed. Confirm opening hours and availability directly with the venue.",
    };
  }

  // ── 3. RELAX DAY ──────────────────────────────────────────────────────────
  if (action === "relax_day") {
    const day =
      dayNumber !== undefined
        ? findDayByNumber(updated.days, dayNumber)
        : findBusiestDay(updated.days, lockedSet);

    if (!day) {
      return {
        applied: false,
        summary: "Could not find that day in your itinerary.",
        diff: [],
        updatedItinerary: previousSnapshot,
        previousItinerarySnapshot: previousSnapshot,
      };
    }

    const candidates: Array<{
      slot: CopilotSlot;
      index: number;
      activity: TaggedActivity;
      priorityScore: number;
    }> = [];

    for (const s of COPILOT_SLOTS) {
      if (slot && s !== slot) continue;
      const acts = getSlotActivities(day, s);
      acts.forEach((act, idx) => {
        if (isActivityLocked(act, lockedSet)) return;
        // Lower priorityScore => better candidate to trim first
        let score = 0;
        if (act.bookingInfo?.requiresReservation) score += 30;
        if (act.bookingInfo?.bookingUrl) score += 20;
        if (act.rating) score += act.rating * 3;
        if (acts.length >= 2) score -= 25; // prefer trimming crowded slots
        if (s === "afternoon" || s === "evening") score -= 5;
        if (
          stopName &&
          act.name.toLowerCase().includes(stopName.toLowerCase())
        ) {
          score -= 100;
        }
        candidates.push({
          slot: s,
          index: idx,
          activity: act,
          priorityScore: score,
        });
      });
    }

    const totalDayActivities = COPILOT_SLOTS.reduce(
      (sum, s) => sum + getSlotActivities(day, s).length,
      0,
    );

    if (candidates.length === 0 || (totalDayActivities <= 1 && !stopName)) {
      return {
        applied: false,
        summary: `Day ${day.dayNumber} already has breathing room (or its remaining stops are locked).`,
        diff: [],
        updatedItinerary: previousSnapshot,
        previousItinerarySnapshot: previousSnapshot,
        notice:
          candidates.length === 0
            ? "Locked stops are always protected from trimming."
            : "We kept your anchor stop so the day stays balanced.",
      };
    }

    candidates.sort((a, b) => a.priorityScore - b.priorityScore);
    const toRemove = candidates[0];
    const slotBlock = ensureSlot(day, toRemove.slot);
    slotBlock.activities.splice(toRemove.index, 1);
    clearStaleDayTiming(day, updated);

    return {
      applied: true,
      summary: `Trimmed ${toRemove.activity.name} from Day ${day.dayNumber} ${toRemove.slot} to give you more breathing room.`,
      diff: [
        {
          dayNumber: day.dayNumber,
          slot: toRemove.slot,
          before: toRemove.activity.name,
          action: "removed",
        },
      ],
      updatedItinerary: updated,
      previousItinerarySnapshot: previousSnapshot,
      notice:
        "Day timing estimates were cleared so you can move at an unhurried pace.",
    };
  }

  // ── 4. RAIN BACKUP ────────────────────────────────────────────────────────
  if (action === "rain_backup") {
    const day =
      dayNumber !== undefined
        ? findDayByNumber(updated.days, dayNumber)
        : (updated.days.find((d) =>
            COPILOT_SLOTS.some((s) =>
              getSlotActivities(d, s).some(
                (a) => !isActivityLocked(a, lockedSet) && isOutdoorStop(a),
              ),
            ),
          ) ?? updated.days[0]);

    if (!day) {
      return {
        applied: false,
        summary: "Could not find a day to check for rainy-day backups.",
        diff: [],
        updatedItinerary: previousSnapshot,
        previousItinerarySnapshot: previousSnapshot,
      };
    }

    const outdoorMatches: Array<{
      slot: CopilotSlot;
      index: number;
      activity: TaggedActivity;
    }> = [];
    const lockedOutdoor: string[] = [];

    for (const s of COPILOT_SLOTS) {
      if (slot && s !== slot) continue;
      const acts = getSlotActivities(day, s);
      acts.forEach((act, idx) => {
        if (!isOutdoorStop(act)) return;
        if (isActivityLocked(act, lockedSet)) {
          lockedOutdoor.push(act.name);
        } else {
          outdoorMatches.push({ slot: s, index: idx, activity: act });
        }
      });
    }

    if (outdoorMatches.length === 0) {
      return {
        applied: false,
        summary:
          lockedOutdoor.length > 0
            ? `Outdoor stops on Day ${day.dayNumber} (${lockedOutdoor.join(", ")}) are locked and were kept untouched.`
            : `Day ${day.dayNumber} already looks mostly indoor-friendly.`,
        diff: [],
        updatedItinerary: previousSnapshot,
        previousItinerarySnapshot: previousSnapshot,
        notice:
          lockedOutdoor.length > 0
            ? "Unlock those stops in Make this plan yours to swap them for indoor options."
            : "No exposed outdoor stops needed swapping on this day.",
      };
    }

    const used = collectUsedIdentifiers(updated);
    const diff: CopilotDiffEntry[] = [];
    const unswapped: string[] = [];

    for (const target of outdoorMatches) {
      const indoorBackup = selectBestBackup(
        normalizedPool,
        used,
        target.slot,
        true,
      );
      if (!indoorBackup) {
        unswapped.push(target.activity.name);
        continue;
      }
      const slotBlock = ensureSlot(day, target.slot);
      const nextActivity: TaggedActivity = {
        ...structuredClone(indoorBackup),
        timeOfDay: target.slot,
        planItemId: generateFreshPlanItemId(),
      };
      slotBlock.activities[target.index] = nextActivity;
      used.names.add(normalizeName(nextActivity.name));
      used.ids.add(nextActivity.id);
      diff.push({
        dayNumber: day.dayNumber,
        slot: target.slot,
        before: target.activity.name,
        after: nextActivity.name,
        action: "swapped",
      });
    }

    if (diff.length === 0) {
      return {
        applied: false,
        summary: `Flagged ${unswapped.length} outdoor stop${unswapped.length > 1 ? "s" : ""} on Day ${day.dayNumber} (${unswapped.join(", ")}), but no indoor grounded backups are cached for this trip yet.`,
        diff: [],
        updatedItinerary: previousSnapshot,
        previousItinerarySnapshot: previousSnapshot,
        notice:
          "We never invent unverified venues. Review those outdoor stops before heading out, or tweak your brief to gather indoor museums, galleries, or covered markets.",
      };
    }

    clearStaleDayTiming(day, updated);
    const notices: string[] = [];
    if (unswapped.length > 0) {
      notices.push(
        `Still outdoor (no additional indoor backup cached): ${unswapped.join(", ")}.`,
      );
    }
    if (lockedOutdoor.length > 0) {
      notices.push(`Kept locked outdoor stops: ${lockedOutdoor.join(", ")}.`);
    }
    notices.push(
      "Confirm indoor venue hours and timed-entry availability before heading out.",
    );

    return {
      applied: true,
      summary: `Swapped ${diff.length} outdoor stop${diff.length > 1 ? "s" : ""} on Day ${day.dayNumber} for grounded indoor backup${diff.length > 1 ? "s" : ""}.`,
      diff,
      updatedItinerary: updated,
      previousItinerarySnapshot: previousSnapshot,
      notice: notices.join(" "),
    };
  }

  // ── 5. SHIFT DAY ──────────────────────────────────────────────────────────
  if (action === "shift_day") {
    // Mode A: Clear a slot (e.g. "we land at 3pm on Day 1, clear Day 1 morning")
    if (clearSlot) {
      const srcDayNum = dayNumber ?? 1;
      const srcDayIdx = updated.days.findIndex(
        (d) => d.dayNumber === srcDayNum,
      );
      const effectiveIdx = srcDayIdx !== -1 ? srcDayIdx : 0;
      const srcDay = updated.days[effectiveIdx];
      const srcSlot: CopilotSlot = slot ?? "morning";
      const srcBlock = ensureSlot(srcDay, srcSlot);

      const unlockedToMove: TaggedActivity[] = [];
      const keptLocked: TaggedActivity[] = [];

      for (const act of srcBlock.activities) {
        if (isActivityLocked(act, lockedSet)) {
          keptLocked.push(act);
        } else {
          unlockedToMove.push(act);
        }
      }

      if (unlockedToMove.length === 0) {
        return {
          applied: false,
          summary:
            keptLocked.length > 0
              ? `Day ${srcDay.dayNumber} ${srcSlot} only has locked stops, so nothing was moved.`
              : `Day ${srcDay.dayNumber} ${srcSlot} is already clear.`,
          diff: [],
          updatedItinerary: previousSnapshot,
          previousItinerarySnapshot: previousSnapshot,
          notice:
            keptLocked.length > 0
              ? "Unlock those stops first if you want to shift them."
              : undefined,
        };
      }

      srcBlock.activities = keptLocked;
      clearStaleDayTiming(srcDay);
      const diff: CopilotDiffEntry[] = [];
      const touchedDays = new Set<number>([effectiveIdx]);

      for (const act of unlockedToMove) {
        const dest = pickLighterDestinationSlot(
          updated.days,
          effectiveIdx,
          srcSlot,
        );
        if (!dest) continue;
        const destDay = updated.days[dest.dayIndex];
        const destBlock = ensureSlot(destDay, dest.slot);
        destBlock.activities.push({ ...act, timeOfDay: dest.slot });
        touchedDays.add(dest.dayIndex);
        diff.push({
          dayNumber: destDay.dayNumber,
          slot: dest.slot,
          before: `${act.name} (Day ${srcDay.dayNumber} ${srcSlot})`,
          after: `${act.name} (Day ${destDay.dayNumber} ${dest.slot})`,
          action: "moved",
        });
      }

      for (const idx of touchedDays) {
        clearStaleDayTiming(updated.days[idx], updated);
      }

      return {
        applied: true,
        summary: `Cleared Day ${srcDay.dayNumber} ${srcSlot} and shifted ${diff.length} stop${diff.length > 1 ? "s" : ""} to lighter slots.`,
        diff,
        updatedItinerary: updated,
        previousItinerarySnapshot: previousSnapshot,
        notice:
          keptLocked.length > 0
            ? `Kept locked stop${keptLocked.length > 1 ? "s" : ""} in place: ${keptLocked.map((a) => a.name).join(", ")}.`
            : "Check opening hours and transit times for your shifted stops.",
      };
    }

    // Mode B: Move a specific stop to (targetDayNumber, targetSlot)
    let srcDayIndex = -1;
    let srcSlotFound: CopilotSlot | undefined;
    let srcActIndex = -1;
    let lockedFound = false;

    if (stopName) {
      const needle = stopName.toLowerCase();
      for (let dIdx = 0; dIdx < updated.days.length; dIdx++) {
        const d = updated.days[dIdx];
        if (dayNumber !== undefined && d.dayNumber !== dayNumber) continue;
        for (const s of COPILOT_SLOTS) {
          if (slot && s !== slot) continue;
          const acts = getSlotActivities(d, s);
          const idx = acts.findIndex((a) =>
            a.name.toLowerCase().includes(needle),
          );
          if (idx !== -1) {
            if (isActivityLocked(acts[idx], lockedSet)) {
              lockedFound = true;
              continue;
            }
            srcDayIndex = dIdx;
            srcSlotFound = s;
            srcActIndex = idx;
            break;
          }
        }
        if (srcDayIndex !== -1) break;
      }
    } else {
      const d = findDayByNumber(updated.days, dayNumber);
      if (d) {
        const dIdx = updated.days.indexOf(d);
        const searchSlots = slot ? [slot] : [...COPILOT_SLOTS];
        for (const s of searchSlots) {
          const acts = getSlotActivities(d, s);
          for (let idx = acts.length - 1; idx >= 0; idx--) {
            if (isActivityLocked(acts[idx], lockedSet)) {
              lockedFound = true;
              continue;
            }
            srcDayIndex = dIdx;
            srcSlotFound = s;
            srcActIndex = idx;
            break;
          }
          if (srcDayIndex !== -1) break;
        }
      }
    }

    if (srcDayIndex === -1 || !srcSlotFound || srcActIndex === -1) {
      return {
        applied: false,
        summary: lockedFound
          ? "That stop is locked and cannot be moved."
          : "Could not find which stop to move. Try naming the stop and destination day/slot.",
        diff: [],
        updatedItinerary: previousSnapshot,
        previousItinerarySnapshot: previousSnapshot,
        notice: lockedFound
          ? "Unlock the stop in Make this plan yours before moving it."
          : undefined,
      };
    }

    const srcDay = updated.days[srcDayIndex];
    const destDay =
      findDayByNumber(updated.days, targetDayNumber ?? srcDay.dayNumber) ??
      srcDay;
    const destSlot: CopilotSlot =
      targetSlot ??
      (srcSlotFound === "morning"
        ? "afternoon"
        : srcSlotFound === "afternoon"
          ? "evening"
          : "morning");

    if (destDay.dayNumber === srcDay.dayNumber && destSlot === srcSlotFound) {
      return {
        applied: false,
        summary: `That stop is already scheduled for Day ${destDay.dayNumber} ${destSlot}.`,
        diff: [],
        updatedItinerary: previousSnapshot,
        previousItinerarySnapshot: previousSnapshot,
      };
    }

    const srcBlock = ensureSlot(srcDay, srcSlotFound);
    const [moved] = srcBlock.activities.splice(srcActIndex, 1);
    const destBlock = ensureSlot(destDay, destSlot);
    destBlock.activities.push({ ...moved, timeOfDay: destSlot });

    clearStaleDayTiming(srcDay, updated);
    clearStaleDayTiming(destDay, updated);

    return {
      applied: true,
      summary: `Moved ${moved.name} to Day ${destDay.dayNumber} ${destSlot}.`,
      diff: [
        {
          dayNumber: destDay.dayNumber,
          slot: destSlot,
          before: `${moved.name} (Day ${srcDay.dayNumber} ${srcSlotFound})`,
          after: `${moved.name} (Day ${destDay.dayNumber} ${destSlot})`,
          action: "moved",
        },
      ],
      updatedItinerary: updated,
      previousItinerarySnapshot: previousSnapshot,
      notice:
        "Day timing estimates were cleared. Confirm opening hours for the new day and time.",
    };
  }

  return {
    applied: false,
    summary: "Unsupported co-pilot action.",
    diff: [],
    updatedItinerary: previousSnapshot,
    previousItinerarySnapshot: previousSnapshot,
  };
}
