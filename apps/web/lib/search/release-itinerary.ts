import { BUDGET_RANGES } from "@faroway/constants";
import type { DayTimingProposal } from "@faroway/types";
import { accessRequested } from "./requirement-corroboration";
import {
  familyActivityReviewReason,
  activityMobilityReviewReason,
  activityTransportReviewReason,
} from "./party-suitability";
import { proposeDayTiming, requestsMiddayRest } from "./schedule-timing";
import { suppliedDistanceKm } from "./supplied-distance";
import { travelerAvailability } from "./traveler-availability";
import type {
  ActivityResult,
  DiningResult,
  SearchPlan,
  SuggestedDay,
} from "./types";

/**
 * Structural gate in front of a published itinerary.
 * These patterns match the release rubric's hard failures. A stop that cannot
 * be made compliant is removed. Copy is rewritten only when the supplier text
 * itself is generic or states an unsourced promise.
 */
const GENERIC =
  /\b(?:things to see and do|local culture|wonderful day|look around the area|enjoy the area|see the sights|hidden gem|must-see|unforgettable|local favorite|dining idea|neighborhood spot)\b/i;
const DIET_PROMISE =
  /\b(?:(?:gluten|nuts?|peanuts?|dairy|shellfish)[ -]?free|allergy[ -]?safe|certified vegan|certified halal|safe for (?:people with |your )?(?:a )?(?:peanut |nut |gluten )?allerg(?:y|ies)?|no (?:peanuts|nuts|gluten) (?:in|used)|can accommodate (?:your |the )?(?:peanut |nut )?allerg)\b/i;
const ACCESS_PROMISE =
  /\b(?:wheelchair[ -](?:accessible|friendly)|step[ -]?free|stair[ -]?free|fully accessible|no stairs|no steps|barrier[ -]?free)\b/i;
const BOOKED_PROMISE =
  /\b(?:already booked|booking confirmed|table is reserved|reserved for you|reservation confirmed|tickets? (?:are )?confirmed|held for you)\b/i;
const KID_PROMISE =
  /\b(?:safe for (?:kids|children|toddlers)|kid[ -]?safe|child[ -]?safe|100% safe)\b/i;
const GUARANTEE = /\b(?:we guarantee|no risk of|guaranteed safe)\b/i;
const CLAIMS = [
  DIET_PROMISE,
  ACCESS_PROMISE,
  BOOKED_PROMISE,
  KID_PROMISE,
  GUARANTEE,
];
const ALCOHOL =
  /\b(?:wine tasting|cocktail|bar crawl|nightlife|pub crawl|nightclub)\b/i;
const STAIRS =
  /\b(?:flights? of stairs|many stairs|steep stairs|has (?:some |several |many )?stairs)\b/i;
const HEDGE = /\b(?:ask|confirm|not a clearance|not a claim)\b/i;
const PARTNER_ID = /^[A-Za-z0-9_-]{1,40}$/;
const SAME_DAY_HOP_KM = 12;
const IMPOSSIBLE_HOP_KM = 80;
const PACE_MINUTES = 600;
const MAX_STOPS = 6;
const SLOTS = ["morning", "afternoon", "evening"] as const;
type Slot = (typeof SLOTS)[number];

export interface ReleaseOptions {
  /** Trip activity and meal ceiling. Omit when the traveler did not set one. */
  activityBudget?: number;
}

export interface ReleaseResult {
  days: SuggestedDay[];
  repairs: string[];
}

interface Kept {
  slot: Slot;
  kind: "activity" | "meal";
  item: ActivityResult | DiningResult;
}

export function tripCity(destination: string): string {
  const city = destination.split(",")[0]?.trim();
  return city || destination.trim();
}

export function tripMonth(start: string): number {
  const month = Number(start.slice(5, 7));
  return Number.isInteger(month) ? month : 0;
}

export function calendarDates(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = Date.parse(`${start}T00:00:00Z`);
  const last = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(cursor) || !Number.isFinite(last) || last < cursor)
    return [];
  const span = Math.floor((last - cursor) / 86400000) + 1;
  if (span > 3660) return [];
  while (cursor <= last) {
    dates.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += 86400000;
  }
  return dates;
}

export function tripActivityBudget(
  level: string | undefined,
  start: string,
  end: string,
): number | undefined {
  const tier = level ? BUDGET_RANGES[level] : undefined;
  const count = calendarDates(start, end).length;
  if (!tier || count < 1 || count > 21) return undefined;
  return tier.daily * count;
}

/** Winter-only activities the supplier text itself marks as seasonal. */
export function seasonMonths(
  name: string,
  description: string,
  latitude?: number,
): number[] | undefined {
  const text = `${name} ${description}`;
  if (/\b(?:indoor|year[- ]round)\b/i.test(text)) return undefined;
  if (/\b(?:ski|snowboard|winter[- ]only)\b/i.test(text)) {
    if (
      typeof latitude === "number" &&
      Number.isFinite(latitude) &&
      latitude < -15
    ) {
      return [6, 7, 8];
    }
    return [12, 1, 2];
  }
  return undefined;
}

const POSITIVE_DIET_STYLES = new Set([
  "vegan",
  "vegetarian",
  "halal",
  "kosher",
  "pescatarian",
  "plant",
  "based",
  "organic",
  "macrobiotic",
  "keto",
  "paleo",
  "mediterranean",
  "whole30",
  "flexitarian",
]);

const HAZARD_MODIFIERS = new Set([
  "allergy",
  "allergies",
  "allergic",
  "free",
  "diet",
  "dietary",
  "safe",
  "with",
  "severe",
  "mild",
  "the",
  "and",
  "for",
  "from",
  "your",
  "people",
  "who",
  "have",
  "has",
  "avoid",
  "avoiding",
  "without",
  "restriction",
  "restrictions",
  "need",
  "needs",
  "please",
  "very",
  "food",
  "foods",
  "only",
  "strict",
  "strictly",
  "friendly",
  "options",
]);

export function hazardTokens(plan: SearchPlan): string[] {
  const raw = [
    ...(plan.requirements?.allergies ?? []),
    ...(plan.dietaryRestrictions ?? []),
    ...(plan.diningCriteria?.dietaryNeeds ?? []),
  ];
  const tokens = new Set<string>();
  for (const item of raw) {
    const text = item.toLowerCase();
    // Positive dietary lifestyles (e.g. "vegan", "halal", "kosher", "vegetarian")
    // describe what the traveler *wants* to eat — never block venues matching them.
    const words = text.match(/[a-z0-9]{3,}/g) ?? [];
    const nonModifierWords = words.filter((w) => !HAZARD_MODIFIERS.has(w));
    if (
      nonModifierWords.length > 0 &&
      nonModifierWords.every((w) => POSITIVE_DIET_STYLES.has(w))
    ) {
      continue;
    }
    if (/\btree\s+nuts?\b/.test(text)) tokens.add("nut");
    for (const word of words) {
      if (HAZARD_MODIFIERS.has(word) || POSITIVE_DIET_STYLES.has(word))
        continue;
      if (word === "tree" && /\btree\s+nuts?\b/.test(text)) continue;
      tokens.add(word);
      if (word === "nuts") tokens.add("nut");
      if (word === "eggs") tokens.add("egg");
      if (
        word.endsWith("s") &&
        word.length > 4 &&
        !word.endsWith("ss") &&
        !word.endsWith("us") &&
        !word.endsWith("is")
      )
        tokens.add(word.slice(0, -1));
    }
  }
  return [...tokens];
}

/** Approximate static USD conversion rates for budget-cap enforcement only. */
const FX_TO_USD: Record<string, number> = {
  USD: 1,
  EUR: 1.09,
  GBP: 1.27,
  JPY: 0.0067,
  CHF: 1.13,
  CAD: 0.73,
  AUD: 0.65,
  NZD: 0.6,
  SGD: 0.74,
  HKD: 0.13,
  KRW: 0.00073,
  THB: 0.029,
  IDR: 0.000063,
  MXN: 0.055,
  AED: 0.27,
  INR: 0.012,
  SEK: 0.095,
  NOK: 0.092,
  DKK: 0.146,
  ISK: 0.0072,
  BRL: 0.19,
  TRY: 0.03,
  VND: 0.00004,
  ZAR: 0.055,
  CZK: 0.043,
  PLN: 0.25,
  HUF: 0.0027,
  MAD: 0.1,
};

export function scheduledStopPrice(item: {
  price?: number;
  priceLevel?: number;
  currency?: string;
}): number {
  const currency = item.currency?.trim().toUpperCase() || "USD";
  const rate = FX_TO_USD[currency];
  if (
    typeof item.price === "number" &&
    Number.isFinite(item.price) &&
    item.price > 0
  ) {
    if (rate === undefined) return 0;
    return Math.round(item.price * rate * 100) / 100;
  }
  if (typeof item.priceLevel === "number" && item.priceLevel > 0)
    return item.priceLevel * 15;
  return 0;
}

export function scheduledStopTags(
  item: ActivityResult | DiningResult,
): string[] {
  const tags = [
    "category" in item ? item.category : "",
    ...(item.vibeMatch ?? []),
    ...("cuisineTypes" in item ? (item.cuisineTypes ?? []) : []),
  ];
  return tags.filter((tag) => tag.trim().length > 0);
}

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function haystack(item: ActivityResult | DiningResult): string {
  return norm(`${item.name} ${scheduledStopTags(item).join(" ")}`);
}

function covers(
  item: ActivityResult | DiningResult,
  preference: string,
): boolean {
  const wanted = norm(preference);
  return wanted.length > 0 && haystack(item).includes(wanted);
}

function claimsIn(text: string): boolean {
  return CLAIMS.some((pattern) => pattern.test(text));
}

/** Same acceptance rules as the release rubric's product link check. */
export function affiliateLinkOk(
  partner: string,
  url: string,
  productId: string,
): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    if (partner === "viator") {
      const pid = parsed.searchParams.get("pid") ?? "";
      return (
        (parsed.hostname === "viator.com" ||
          parsed.hostname.endsWith(".viator.com")) &&
        parsed.pathname.startsWith("/tours/") &&
        productId.length > 0 &&
        parsed.pathname.includes(productId) &&
        PARTNER_ID.test(pid)
      );
    }
    if (partner === "getyourguide") {
      const activityPath = parsed.pathname.replace(/\/+$/, "");
      const partnerId = parsed.searchParams.get("partner_id") ?? "";
      return (
        (parsed.hostname === "getyourguide.com" ||
          parsed.hostname.endsWith(".getyourguide.com")) &&
        activityPath === `/activity-t${productId}` &&
        PARTNER_ID.test(partnerId)
      );
    }
    if (partner === "duffel") {
      return (
        parsed.hostname.endsWith("duffel.com") &&
        productId.length > 0 &&
        parsed.pathname.includes(productId)
      );
    }
    return false;
  } catch {
    return false;
  }
}

export function bookableAffiliate(item: {
  id: string;
  affiliatePartner?: string;
  affiliateUrl?: string;
}): { partner: string; url: string; productId: string } | null {
  const partner = item.affiliatePartner ?? "";
  const url = item.affiliateUrl ?? "";
  if (!partner || !url) return null;
  const ids = [item.id];
  try {
    const parsed = new URL(url);
    if (partner === "getyourguide") {
      const match = parsed.pathname.match(/\/activity-t(\d+)\/?$/);
      if (match) ids.unshift(match[1]);
    }
    if (partner === "viator") {
      const last = parsed.pathname.split("/").filter(Boolean).pop();
      if (last) ids.unshift(decodeURIComponent(last));
    }
  } catch {
    return null;
  }
  for (const productId of ids) {
    if (affiliateLinkOk(partner, url, productId))
      return { partner, url, productId };
  }
  return null;
}

function point(item: ActivityResult | DiningResult) {
  const lat = item.location?.lat;
  const lng = item.location?.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return undefined;
  return { lat, lng };
}

function durationMinutes(
  item: ActivityResult | DiningResult,
  slot: Slot,
): number {
  if ("mealTypes" in item) return slot === "morning" ? 45 : 60;
  const duration = item.duration;
  if (!Number.isFinite(duration) || duration <= 0) return 60;
  return Math.round(duration);
}

function factualDescription(
  item: ActivityResult | DiningResult,
  slot: Slot,
): string {
  const minutes = durationMinutes(item, slot);
  const address = item.location?.address?.trim() || item.location?.name || "";
  const where = address ? `${item.name}, ${address}` : item.name;
  const sentence = `Spend about ${minutes} minutes at ${where}. Confirm the day's hours before you go.`;
  return sentence.length >= 40
    ? sentence
    : `${sentence} This is the supplier record for ${item.name}.`;
}

function withoutClaimSentences(text: string): string {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(
      (sentence) => sentence && !claimsIn(sentence) && !GENERIC.test(sentence),
    )
    .join(" ");
}

function hedge(description: string): string {
  if (HEDGE.test(description)) return description;
  return `${description} Ask the venue about this restriction before you go. This sentence is not a clearance.`.trim();
}

function prepareCopy(
  item: ActivityResult | DiningResult,
  slot: Slot,
  hazards: string[],
  stepFree: boolean,
): ActivityResult | DiningResult {
  let description = item.description ?? "";
  const stripped = withoutClaimSentences(description);
  if (GENERIC.test(description) || claimsIn(description))
    description =
      stripped.trim().length >= 40 &&
      !GENERIC.test(stripped) &&
      !claimsIn(stripped)
        ? stripped
        : factualDescription(item, slot);
  const hazardHit = hazards.some((hazard) =>
    new RegExp(`\\b${escapeRegExp(hazard)}`, "i").test(
      `${item.name} ${description}`,
    ),
  );
  if (hazardHit) description = hedge(description);
  if (stepFree && STAIRS.test(description))
    description = factualDescription(item, slot);
  const url = "affiliateUrl" in item ? item.affiliateUrl : undefined;
  const affiliate = url ? bookableAffiliate(item) : null;
  const clearUrl = Boolean(url) && !affiliate;
  if (description === (item.description ?? "") && !clearUrl) return item;
  return {
    ...item,
    description,
    affiliateUrl: clearUrl ? undefined : url,
    affiliatePartner: clearUrl
      ? undefined
      : "affiliatePartner" in item
        ? item.affiliatePartner
        : undefined,
  };
}

function blockedReason(
  plan: SearchPlan,
  item: ActivityResult | DiningResult,
  hazards: string[],
  stepFree: boolean,
  month: number,
): string | null {
  if ("planningIdea" in item && item.planningIdea) return "planning_idea";
  const text = `${item.name} ${item.description ?? ""}`;
  if (claimsIn(item.name)) return "unsourced_claim";
  const seasons = seasonMonths(
    item.name,
    item.description ?? "",
    item.location?.lat,
  );
  if (seasons && !seasons.includes(month)) return "season";
  const children = plan.children ?? 0;
  if (
    children > 0 &&
    (familyActivityReviewReason(item.name) || ALCOHOL.test(text))
  )
    return "kids";
  if (stepFree) {
    const description = item.description ?? "";
    if (
      STAIRS.test(text) ||
      activityMobilityReviewReason(plan, description, item.name) ||
      activityTransportReviewReason(plan, item.name)
    )
      return "step_free";
  }
  for (const hazard of hazards) {
    if (new RegExp(`\\b${escapeRegExp(hazard)}`, "i").test(item.name))
      return "hazard_name";
  }
  const avoided = plan.vibeInterpretation?.avoidKeywords ?? [];
  const stack = haystack(item);
  for (const keyword of avoided) {
    const wanted = norm(keyword);
    if (wanted && stack.includes(wanted)) return "avoid";
  }
  return null;
}

function slotWindow(slot: Slot, kind: "activity" | "meal"): [number, number] {
  if (kind === "meal" && slot === "morning") return [480, 600];
  if (slot === "morning") return [540, 780];
  if (kind === "meal" && slot === "afternoon") return [720, 840];
  if (slot === "afternoon") return [840, 1080];
  return [1080, 1320];
}

function fitsWindow(
  slot: Slot,
  kind: "activity" | "meal",
  duration: number,
  window?: { earliestMinute: number; latestMinute: number },
): boolean {
  const [start, end] = slotWindow(slot, kind);
  const earliest = Math.max(start, window?.earliestMinute ?? 0);
  const latest = Math.min(end, window?.latestMinute ?? 1440);
  return earliest + duration <= latest;
}

function alignToAvailability(
  stops: Kept[],
  window?: { earliestMinute: number; latestMinute: number },
): Kept[] {
  const meals = stops.filter(
    (stop) =>
      stop.kind === "meal" &&
      fitsWindow(
        stop.slot,
        "meal",
        durationMinutes(stop.item, stop.slot),
        window,
      ),
  );
  const open = SLOTS.filter((slot) => fitsWindow(slot, "activity", 60, window));
  const visits = stops
    .filter((stop) => stop.kind === "activity")
    .flatMap((stop) => {
      const duration = Math.min(durationMinutes(stop.item, stop.slot), 180);
      if (fitsWindow(stop.slot, "activity", duration, window)) return [stop];
      const slot = open.find((candidate) =>
        fitsWindow(candidate, "activity", duration, window),
      );
      return slot ? [{ ...stop, slot }] : [];
    });
  return chronological([...meals, ...visits]);
}

function localChain(stops: Kept[]): Kept[] {
  if (stops.length < 2) return stops;
  const first = stops[0];
  if (!first) return stops;
  const score = (chain: Kept[]) =>
    chain.length * 10 + chain.filter((stop) => stop.kind === "activity").length;
  let best: Kept[] = [first];
  for (const origin of stops) {
    const remaining = stops.filter((stop) => stop !== origin);
    const chain = [origin];
    while (remaining.length) {
      const last = chain[chain.length - 1];
      const nextIndex = remaining.findIndex((stop) => {
        const distance = suppliedDistanceKm(point(last.item), point(stop.item));
        return distance == null || distance <= SAME_DAY_HOP_KM;
      });
      if (nextIndex < 0) break;
      const next = remaining.splice(nextIndex, 1)[0];
      if (next) chain.push(next);
    }
    if (score(chain) > score(best)) best = chain;
  }
  return chronological(best);
}

function chronological(kept: Kept[]): Kept[] {
  const rank = (stop: Kept) => {
    if (stop.slot === "morning" && stop.kind === "meal") return 0;
    if (stop.slot === "morning") return 1;
    if (stop.slot === "afternoon" && stop.kind === "meal") return 2;
    if (stop.slot === "afternoon") return 3;
    if (stop.kind === "activity") return 4;
    return 5;
  };
  return [...kept].sort((a, b) => rank(a) - rank(b));
}

function signature(stops: Kept[]): string {
  return stops
    .map((stop) => norm(stop.item.name))
    .sort()
    .join("|");
}

function dayStops(day: SuggestedDay): Kept[] {
  const stops: Kept[] = [];
  for (const slot of SLOTS) {
    const block = day[slot];
    if (block.meal) stops.push({ slot, kind: "meal", item: block.meal });
    for (const activity of block.activities)
      stops.push({ slot, kind: "activity", item: activity });
  }
  return stops;
}

function localEnough(stops: Kept[]): boolean {
  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1];
    const current = stops[index];
    if (!previous || !current) continue;
    const distance = suppliedDistanceKm(
      point(previous.item),
      point(current.item),
    );
    if (distance != null && distance > SAME_DAY_HOP_KM) return false;
  }
  return true;
}

function scrubTravelerCopy(day: SuggestedDay): SuggestedDay {
  const clean = (text: string) =>
    text
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.trim())
      .filter(
        (sentence) =>
          sentence && !(claimsIn(sentence) && !HEDGE.test(sentence)),
      )
      .join(" ");
  const title = clean(day.title);
  const summary = clean(day.summary);
  const tips = day.tips.map(clean).filter((tip) => tip.length > 0);
  const sameTips =
    tips.length === day.tips.length &&
    tips.every((tip, index) => tip === day.tips[index]);
  if (title === day.title && summary === day.summary && sameTips) return day;
  return {
    ...day,
    title: title || `Day ${day.dayNumber}`,
    summary,
    tips,
  };
}

function writeStops(day: SuggestedDay, stops: Kept[]): SuggestedDay {
  const morning = {
    activities: [] as ActivityResult[],
    meal: undefined as DiningResult | undefined,
  };
  const afternoon = {
    activities: [] as ActivityResult[],
    meal: undefined as DiningResult | undefined,
  };
  const evening = {
    activities: [] as ActivityResult[],
    meal: undefined as DiningResult | undefined,
  };
  const blocks = { morning, afternoon, evening };
  for (const stop of stops) {
    if (stop.kind === "meal") {
      if (!blocks[stop.slot].meal)
        blocks[stop.slot].meal = stop.item as DiningResult;
    } else blocks[stop.slot].activities.push(stop.item as ActivityResult);
  }
  return { ...day, morning, afternoon, evening };
}

function sameStops(before: Kept[], after: Kept[]): boolean {
  if (before.length !== after.length) return false;
  return before.every(
    (stop, index) =>
      stop.slot === after[index]?.slot &&
      stop.kind === after[index]?.kind &&
      stop.item.id === after[index]?.item.id &&
      stop.item.name === after[index]?.item.name &&
      stop.item.description === after[index]?.item.description &&
      ("affiliateUrl" in stop.item ? stop.item.affiliateUrl : undefined) ===
        (after[index]?.item && "affiliateUrl" in after[index].item
          ? after[index].item.affiliateUrl
          : undefined),
  );
}

function preferenceCovered(stops: Kept[], preference: string): boolean {
  return stops.some((stop) => covers(stop.item, preference));
}

function soleCover(
  stops: Kept[],
  index: number,
  preferences: string[],
): boolean {
  const item = stops[index]?.item;
  if (!item) return false;
  return preferences.some(
    (preference) =>
      covers(item, preference) &&
      stops.filter((stop) => covers(stop.item, preference)).length === 1,
  );
}

export function enforceReleaseItinerary(
  plan: SearchPlan,
  days: SuggestedDay[],
  activities: readonly ActivityResult[],
  dining: readonly DiningResult[],
  options: ReleaseOptions = {},
): ReleaseResult {
  const repairs: string[] = [];
  const note = (code: string) => {
    repairs.push(code);
  };
  const hazards = hazardTokens(plan);
  const stepFree = accessRequested(plan);
  const month = tripMonth(plan.dates.start);
  const preferences = (plan.activityCriteria?.interests ?? []).filter(
    (interest) => interest.trim().length > 0,
  );
  const dates = calendarDates(plan.dates.start, plan.dates.end);
  const incoming = new Map(days.map((day) => [day.date, day]));

  const resolve = (item: ActivityResult | DiningResult, slot: Slot) => {
    const pool = "mealTypes" in item ? dining : activities;
    const source = pool.find(
      (candidate) =>
        candidate.id === item.id && norm(candidate.name) === norm(item.name),
    );
    if (!source) {
      note(`drop:unknown:${item.id}`);
      return null;
    }
    const reason = blockedReason(plan, source, hazards, stepFree, month);
    if (reason) {
      note(`drop:${reason}:${source.id}`);
      return null;
    }
    return prepareCopy(source, slot, hazards, stepFree);
  };

  let scheduled: Array<{ day: SuggestedDay; stops: Kept[] }> = (
    dates.length > 0 ? dates : days.map((day) => day.date)
  ).map((date, index) => {
    const existing =
      incoming.get(date) ??
      ({
        dayNumber: index + 1,
        date,
        title: `Day ${index + 1}`,
        summary: "",
        morning: { activities: [] },
        afternoon: { activities: [] },
        evening: { activities: [] },
        tips: [
          "Supplier search returned nothing that fits this day, so there are no confirmed visits.",
        ],
      } satisfies SuggestedDay);
    const stops: Kept[] = [];
    for (const candidate of dayStops(existing)) {
      const item = resolve(candidate.item, candidate.slot);
      if (!item) continue;
      if (stops.some((stop) => norm(stop.item.name) === norm(item.name))) {
        note(`drop:duplicate_name:${item.id}`);
        continue;
      }
      stops.push({ slot: candidate.slot, kind: candidate.kind, item });
    }
    return {
      day: { ...existing, dayNumber: index + 1, date },
      stops: chronological(stops),
    };
  });

  const separated: typeof scheduled = [];
  for (const entry of scheduled) {
    const chain = localChain(entry.stops);
    for (const stop of entry.stops) {
      if (!chain.includes(stop)) note(`drop:geography:${stop.item.id}`);
    }
    separated.push({ ...entry, stops: chain });
  }
  scheduled = separated;

  const seenPaths = new Set<string>();
  scheduled = scheduled.map((entry) => ({
    ...entry,
    stops: entry.stops.map((stop) => {
      const affiliate = bookableAffiliate(stop.item);
      if (!affiliate) return stop;
      let path = affiliate.url;
      try {
        path = new URL(affiliate.url).pathname.replace(/\/+$/, "");
      } catch {
        path = affiliate.url;
      }
      if (seenPaths.has(path)) {
        note(`drop:affiliate_path:${stop.item.id}`);
        const item = {
          ...stop.item,
          affiliateUrl: undefined,
          affiliatePartner: undefined,
        };
        return { ...stop, item };
      }
      seenPaths.add(path);
      return stop;
    }),
  }));

  const budget = options.activityBudget;
  if (budget !== undefined && Number.isFinite(budget)) {
    const priceOf = (stop: Kept) => scheduledStopPrice(stop.item);
    let guard = 0;
    while (
      scheduled
        .flatMap((entry) => entry.stops)
        .reduce((sum, stop) => sum + priceOf(stop), 0) > budget &&
      guard < 40
    ) {
      guard += 1;
      const all = scheduled.flatMap((entry, dayIndex) =>
        entry.stops.map((stop, stopIndex) => ({ dayIndex, stopIndex, stop })),
      );
      const costly = [...all].sort((a, b) => priceOf(b.stop) - priceOf(a.stop));
      const victim =
        costly.find(
          (candidate) =>
            priceOf(candidate.stop) > 0 &&
            !soleCover(
              scheduled[candidate.dayIndex].stops,
              candidate.stopIndex,
              preferences,
            ),
        ) ?? costly.find((candidate) => priceOf(candidate.stop) > 0);
      if (!victim) break;
      note(`drop:budget:${victim.stop.item.id}`);
      scheduled[victim.dayIndex].stops.splice(victim.stopIndex, 1);
    }
  }

  const trimPace = () => {
    for (const entry of scheduled) {
      let guard = 0;
      while (guard < 20) {
        guard += 1;
        const minutes = entry.stops.reduce(
          (sum, stop) => sum + durationMinutes(stop.item, stop.slot),
          0,
        );
        if (entry.stops.length <= MAX_STOPS && minutes <= PACE_MINUTES) break;
        const index = [...entry.stops.keys()]
          .reverse()
          .find((candidate) => !soleCover(entry.stops, candidate, preferences));
        const dropAt = index ?? entry.stops.length - 1;
        const removed = entry.stops[dropAt];
        if (!removed) break;
        note(`drop:pace:${removed.item.id}`);
        entry.stops.splice(dropAt, 1);
      }
    }
  };
  trimPace();

  const usedIds = () =>
    new Set(
      scheduled.flatMap((entry) => entry.stops.map((stop) => stop.item.id)),
    );

  const unused = () => {
    const used = usedIds();
    return [...activities, ...dining].filter(
      (item) => !used.has(item.id) && !item.planningIdea,
    );
  };

  const place = (item: ActivityResult | DiningResult): Kept | null => {
    const slot: Slot =
      "mealTypes" in item
        ? item.mealTypes.includes("breakfast")
          ? "morning"
          : item.mealTypes.includes("lunch")
            ? "afternoon"
            : "evening"
        : item.bestTimeOfDay === "morning" ||
            item.bestTimeOfDay === "afternoon" ||
            item.bestTimeOfDay === "evening"
          ? item.bestTimeOfDay
          : "afternoon";
    const prepared = resolve(item, slot);
    if (!prepared) return null;
    return {
      slot,
      kind: "mealTypes" in item ? "meal" : "activity",
      item: prepared,
    };
  };

  const fitsWith = (entry: (typeof scheduled)[number], extra: Kept) => {
    const next = chronological([...entry.stops, extra]);
    if (next.length > MAX_STOPS) return false;
    const minutes = next.reduce(
      (sum, stop) => sum + durationMinutes(stop.item, stop.slot),
      0,
    );
    if (minutes > PACE_MINUTES) return false;
    if (
      next.some(
        (stop, index) =>
          index > 0 && norm(stop.item.name) === norm(next[index - 1].item.name),
      )
    )
      return false;
    for (let index = 1; index < next.length; index += 1) {
      const distance = suppliedDistanceKm(
        point(next[index - 1].item),
        point(next[index].item),
      );
      if (
        distance != null &&
        (distance > IMPOSSIBLE_HOP_KM || distance > SAME_DAY_HOP_KM)
      )
        return false;
    }
    const spend =
      scheduled
        .flatMap((day) => day.stops)
        .reduce((sum, stop) => sum + scheduledStopPrice(stop.item), 0) +
      scheduledStopPrice(extra.item);
    if (budget !== undefined && spend > budget) return false;
    return true;
  };

  for (const preference of preferences) {
    if (scheduled.some((entry) => preferenceCovered(entry.stops, preference)))
      continue;
    const candidate = unused().find((item) => covers(item, preference));
    if (!candidate) continue;
    const extra = place(candidate);
    if (!extra) continue;
    const host =
      scheduled.find((entry) => fitsWith(entry, extra)) ??
      scheduled.find((entry) => entry.stops.length === 0);
    if (!host || !fitsWith(host, extra)) continue;
    host.stops = chronological([...host.stops, extra]);
    note(`add:preference:${candidate.id}`);
  }

  let diversityGuard = 0;
  while (diversityGuard < 12) {
    diversityGuard += 1;
    let changed = false;
    const seenNames = new Set<string>();
    for (const entry of scheduled) {
      const next: Kept[] = [];
      entry.stops.forEach((stop, stopIndex) => {
        const name = norm(stop.item.name);
        if (!seenNames.has(name)) {
          seenNames.add(name);
          next.push(stop);
          return;
        }
        const interests = preferences.filter((preference) =>
          covers(stop.item, preference),
        );
        const coveredElsewhere = interests.every(
          (preference) =>
            next.some((kept) => covers(kept.item, preference)) ||
            scheduled.some(
              (other) =>
                other !== entry && preferenceCovered(other.stops, preference),
            ),
        );
        if (
          interests.length === 0 ||
          coveredElsewhere ||
          !soleCover(entry.stops, stopIndex, preferences)
        ) {
          note(`drop:diversity:${stop.item.id}`);
          // When deduplicating a repeated meal, substitute an unused, safety-checked
          // compatible restaurant so later days do not lose breakfast/lunch/dinner.
          if (stop.kind === "meal") {
            const wantedMealType =
              stop.slot === "morning"
                ? "breakfast"
                : stop.slot === "afternoon"
                  ? "lunch"
                  : "dinner";
            const droppedPrice = scheduledStopPrice(stop.item);
            const currentSpendWithoutDropped =
              scheduled
                .flatMap((day) => day.stops)
                .reduce((sum, s) => sum + scheduledStopPrice(s.item), 0) -
              droppedPrice;
            const replacement = unused().find(
              (candidate): candidate is DiningResult => {
                if (!("cuisineTypes" in candidate)) return false;
                if (seenNames.has(norm(candidate.name))) return false;
                if (!candidate.mealTypes.includes(wantedMealType)) return false;
                if (
                  blockedReason(plan, candidate, hazards, stepFree, month) !==
                  null
                )
                  return false;
                const prepared = prepareCopy(
                  candidate,
                  stop.slot,
                  hazards,
                  stepFree,
                );
                const placed: Kept = {
                  slot: stop.slot,
                  kind: "meal",
                  item: prepared,
                };
                const candidateStops = chronological([
                  ...next,
                  ...entry.stops.slice(stopIndex + 1),
                  placed,
                ]);
                if (candidateStops.length > MAX_STOPS) return false;
                const minutes = candidateStops.reduce(
                  (sum, s) => sum + durationMinutes(s.item, s.slot),
                  0,
                );
                if (minutes > PACE_MINUTES) return false;
                if (localChain(candidateStops).length !== candidateStops.length)
                  return false;
                if (
                  budget !== undefined &&
                  currentSpendWithoutDropped + scheduledStopPrice(prepared) >
                    budget
                )
                  return false;
                return true;
              },
            );
            if (replacement) {
              const placed: Kept = {
                slot: stop.slot,
                kind: "meal",
                item: prepareCopy(replacement, stop.slot, hazards, stepFree),
              };
              seenNames.add(norm(placed.item.name));
              next.push(placed);
              note(`replace:diversity:${replacement.id}`);
            }
          }
          changed = true;
          return;
        }
        next.push(stop);
      });
      entry.stops = next;
    }
    if (!changed) break;
  }

  for (const preference of preferences) {
    if (scheduled.some((entry) => preferenceCovered(entry.stops, preference)))
      continue;
    const candidate = unused().find((item) => covers(item, preference));
    if (!candidate) continue;
    const extra = place(candidate);
    if (!extra) continue;
    const host = scheduled.find((entry) => fitsWith(entry, extra));
    if (!host) continue;
    host.stops = chronological([...host.stops, extra]);
    note(`add:preference:${candidate.id}`);
  }
  trimPace();
  for (const preference of preferences) {
    if (scheduled.some((entry) => preferenceCovered(entry.stops, preference)))
      continue;
    const candidate = unused().find((item) => covers(item, preference));
    if (!candidate) continue;
    const extra = place(candidate);
    if (!extra) continue;
    const host = scheduled.find((entry) => fitsWith(entry, extra));
    if (!host) continue;
    host.stops = chronological([...host.stops, extra]);
    note(`add:preference:${candidate.id}`);
  }

  const availability = travelerAvailability(
    plan,
    Math.max(scheduled.length, 1),
  ).windows;
  const published = scheduled.map((entry, index) => {
    const original = dayStops(entry.day);
    let stops = entry.stops;
    let day = writeStops(entry.day, stops);
    if (
      stops.length === 0 &&
      !day.tips.some((tip) => /no confirmed visits|supplier search/i.test(tip))
    ) {
      day = {
        ...day,
        tips: [
          ...day.tips,
          "Supplier search returned nothing that fits this day, so there are no confirmed visits.",
        ],
      };
    }
    if (sameStops(original, stops) && day.timingProposal?.fitsPolicy) {
      return day;
    }
    let timed = writeStops(
      day,
      alignToAvailability(stops, availability[index]),
    );
    for (let attempt = 0; attempt < 8; attempt += 1) {
      timed = writeStops(
        timed,
        alignToAvailability(dayStops(timed), availability[index]),
      );
      const proposal = proposeDayTiming(
        timed,
        availability[index],
        requestsMiddayRest(plan),
      );
      const accept = (
        value: ReturnType<typeof proposeDayTiming>,
        next: SuggestedDay,
      ) => {
        const timingProposal: DayTimingProposal = {
          policy: value.policy,
          basis: value.basis,
          fitsPolicy: true,
          verified: false,
          events: value.events,
          conflict: null,
        };
        return { ...next, timingProposal };
      };
      if (proposal.fitsPolicy) return accept(proposal, timed);
      const activitiesLeft = dayStops(timed).filter(
        (stop) => stop.kind === "activity",
      );
      if (activitiesLeft.length === 0) {
        const mealsLeft = dayStops(timed).filter(
          (stop) => stop.kind === "meal",
        );
        if (mealsLeft.length <= 1) {
          const cleared = writeStops(timed, []);
          note(`drop:timing:${timed.date}`);
          return { ...cleared, timingProposal: undefined };
        }
        // Drop only the conflicting meal (or the last meal) instead of wiping every meal on the day.
        const conflictEventId = proposal.conflict?.eventId;
        const conflictingMeal =
          (conflictEventId
            ? mealsLeft.find(
                (stop) =>
                  conflictEventId === `meal:${stop.slot}:${stop.item.id}`,
              )
            : undefined) ?? mealsLeft[mealsLeft.length - 1];
        note(`drop:timing:${conflictingMeal.item.id}`);
        stops = dayStops(timed).filter(
          (stop) =>
            !(
              stop.kind === "meal" &&
              stop.slot === conflictingMeal.slot &&
              stop.item.id === conflictingMeal.item.id
            ),
        );
        timed = writeStops(timed, stops);
        continue;
      }
      const victim =
        [...activitiesLeft]
          .reverse()
          .find(
            (stop) =>
              !preferences.some(
                (preference) =>
                  covers(stop.item, preference) &&
                  activitiesLeft.filter((other) =>
                    covers(other.item, preference),
                  ).length === 1,
              ),
          ) ?? activitiesLeft[activitiesLeft.length - 1];
      note(`drop:timing:${victim.item.id}`);
      stops = dayStops(timed).filter((stop) => stop.item.id !== victim.item.id);
      timed = writeStops(timed, stops);
    }
    return timed;
  });

  const distinct = [...published];
  for (let guard = 0; guard < 8; guard += 1) {
    const seen = new Map<string, number>();
    let changed = false;
    for (let index = 0; index < distinct.length; index += 1) {
      const stops = dayStops(distinct[index]);
      const key = signature(stops);
      if (!key) continue;
      const prior = seen.get(key);
      if (prior === undefined) {
        seen.set(key, index);
        continue;
      }
      const priorNames = new Set(
        dayStops(distinct[prior]).map((stop) => norm(stop.item.name)),
      );
      const dropAt = stops.findIndex((stop, stopIndex) => {
        if (!priorNames.has(norm(stop.item.name))) return false;
        const interests = preferences.filter((preference) =>
          covers(stop.item, preference),
        );
        const coveredEarlier = interests.every((preference) =>
          distinct
            .slice(0, index)
            .some((day) => preferenceCovered(dayStops(day), preference)),
        );
        return (
          interests.length === 0 ||
          coveredEarlier ||
          !soleCover(stops, stopIndex, preferences)
        );
      });
      if (dropAt < 0) continue;
      note(`drop:diversity:${stops[dropAt].item.id}`);
      const next = writeStops(
        distinct[index],
        stops.filter((_, stopIndex) => stopIndex !== dropAt),
      );
      const proposal = proposeDayTiming(
        next,
        availability[index],
        requestsMiddayRest(plan),
      );
      distinct[index] = proposal.fitsPolicy
        ? {
            ...next,
            timingProposal: {
              policy: proposal.policy,
              basis: proposal.basis,
              fitsPolicy: true,
              verified: false,
              events: proposal.events,
              conflict: null,
            },
          }
        : { ...next, timingProposal: undefined };
      changed = true;
    }
    if (!changed) break;
  }

  for (const preference of preferences) {
    if (distinct.some((day) => preferenceCovered(dayStops(day), preference)))
      continue;
    const used = new Set(
      distinct.flatMap((day) => dayStops(day).map((stop) => stop.item.id)),
    );
    const candidate = [...activities, ...dining].find(
      (item) =>
        !item.planningIdea && !used.has(item.id) && covers(item, preference),
    );
    if (!candidate) continue;
    const extra = place(candidate);
    if (!extra) continue;
    for (let index = 0; index < distinct.length; index += 1) {
      const aligned = alignToAvailability(
        chronological([...dayStops(distinct[index]), extra]),
        availability[index],
      );
      if (!aligned.some((stop) => stop.item.id === extra.item.id)) continue;
      const minutes = aligned.reduce(
        (sum, stop) => sum + durationMinutes(stop.item, stop.slot),
        0,
      );
      const spend = distinct
        .flatMap((day) => dayStops(day))
        .reduce((sum, stop) => sum + scheduledStopPrice(stop.item), 0);
      if (
        aligned.length > MAX_STOPS ||
        minutes > PACE_MINUTES ||
        !localEnough(aligned) ||
        (budget !== undefined &&
          spend + scheduledStopPrice(extra.item) > budget)
      )
        continue;
      const next = writeStops(distinct[index], aligned);
      const proposal = proposeDayTiming(
        next,
        availability[index],
        requestsMiddayRest(plan),
      );
      if (!proposal.fitsPolicy) continue;
      distinct[index] = {
        ...next,
        timingProposal: {
          policy: proposal.policy,
          basis: proposal.basis,
          fitsPolicy: true,
          verified: false,
          events: proposal.events,
          conflict: null,
        },
      };
      note(`add:preference:${candidate.id}`);
      break;
    }
  }

  return { days: distinct.map(scrubTravelerCopy), repairs };
}
