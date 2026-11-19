/**
 * Offline release rubric for an itinerary the caller already has.
 * It does not call a model or a supplier. A perfect score means this authored
 * plan satisfied the checks below. It does not mean a live model was measured.
 *
 * Each score is 1 or 5. A mutation must land at or below 2 on the dimension it
 * targets. Keyword overlap with the brief is not a pass.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { suppliedDistanceKm } from "../../../apps/web/lib/search/supplied-distance";
import { relative } from "node:path";
import { DEVELOPMENT_BRIEFS } from "./eval-briefs";
import { HOLDOUT_BRIEFS, HOLDOUT_REVIEW } from "./holdout-briefs";
import { UAT_BRIEFS } from "./briefs";
import { comparisonSelection } from "./comparison-selection";

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
const ALCOHOL =
  /\b(?:wine tasting|cocktail|bar crawl|nightlife|pub crawl|nightclub)\b/i;
const STAIRS =
  /\b(?:flights? of stairs|many stairs|steep stairs|has (?:some |several |many )?stairs)\b/i;
const PARTNER_ID = /^[A-Za-z0-9_-]{1,40}$/;
const SAME_DAY_HOP_KM = 12;
const IMPOSSIBLE_HOP_KM = 80;
const PACE_MINUTES = 600;

export interface DimensionScores {
  grounding: number;
  preference_fit: number;
  feasibility: number;
  specificity: number;
  diversity: number;
  safety_claims: number;
}

export interface AffiliateScores {
  bookable_when_supported: number;
  link_present: number;
  attribution: number;
  deep_link: number;
  placement: number;
  no_fabrication: number;
}

export interface GradeStop {
  id: string;
  name: string;
  description: string;
  kind: "activity" | "meal";
  destination: string;
  lat?: number;
  lng?: number;
  startMinute?: number;
  endMinute?: number;
  price?: number;
  tags: string[];
  bookable?: boolean;
  productId?: string;
  affiliatePartner?: string;
  affiliateUrl?: string;
  expectedPartnerId?: string;
  /** Months 1-12 when the stop is in season. Omit for a year-round stop. */
  seasons?: number[];
  stepFree?: boolean;
  kidSuitable?: boolean;
  evidenceUrls?: string[];
}

export interface GradeDay {
  date: string;
  destination: string;
  stops: GradeStop[];
  transferDisclosed?: boolean;
  supplierSearch?: "ok" | "empty" | "failed";
}

export interface GradeBrief {
  destinations: string[];
  start: string;
  end: string;
  budget?: number;
  preferences: string[];
  avoid: string[];
  hazards: string[];
  children: number;
  requireStepFree: boolean;
  month: number;
  inventory: Array<{ id: string; name: string }>;
  trustedEvidenceHosts: string[];
}

export interface ItineraryGrade {
  scores: DimensionScores;
  affiliate: AffiliateScores;
  failures: string[];
}

export interface MutationHit {
  id: string;
  dimension: string;
  score: number;
  caught: boolean;
}

interface Fixture {
  brief: GradeBrief;
  days: GradeDay[];
}

function norm(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function tripDates(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = Date.parse(`${start}T00:00:00Z`);
  const last = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(cursor) || !Number.isFinite(last) || last < cursor)
    return [];
  while (cursor <= last && dates.length < 22) {
    dates.push(new Date(cursor).toISOString().slice(0, 10));
    cursor += 86400000;
  }
  return dates;
}

export function productLinkMatches(
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
        parsed.pathname.includes(productId)
      );
    }
    return false;
  } catch {
    return false;
  }
}

function partnerValue(partner: string, url: string): string {
  try {
    const parsed = new URL(url);
    if (partner === "getyourguide")
      return parsed.searchParams.get("partner_id") ?? "";
    if (partner === "viator") return parsed.searchParams.get("pid") ?? "";
    return "";
  } catch {
    return "";
  }
}

function isGeneric(text: string): boolean {
  const value = text.trim();
  return value.length < 40 || GENERIC.test(value);
}

function promiseFails(stop: GradeStop, brief: GradeBrief): boolean {
  const text = `${stop.name} ${stop.description}`;
  const claims = [
    DIET_PROMISE.test(text),
    ACCESS_PROMISE.test(text),
    BOOKED_PROMISE.test(text),
    KID_PROMISE.test(text),
    GUARANTEE.test(text),
  ];
  if (!claims.some(Boolean)) return false;
  const hosts = new Set(brief.trustedEvidenceHosts);
  return !(stop.evidenceUrls ?? []).some((url) => {
    try {
      const parsed = new URL(url);
      return parsed.protocol === "https:" && hosts.has(parsed.hostname);
    } catch {
      return false;
    }
  });
}

function gradeAffiliate(days: GradeDay[]): AffiliateScores {
  const stops = days.flatMap((day) => day.stops);
  const bookable = stops.filter((stop) => stop.bookable);
  const withUrl = stops.filter((stop) => stop.affiliateUrl);
  const httpsBookable = bookable.every((stop) =>
    stop.affiliateUrl?.startsWith("https://"),
  );
  const shaped = bookable.every((stop) =>
    productLinkMatches(
      stop.affiliatePartner ?? "",
      stop.affiliateUrl ?? "",
      stop.productId ?? "",
    ),
  );
  const attributed = withUrl.every((stop) => {
    const value = partnerValue(
      stop.affiliatePartner ?? "",
      stop.affiliateUrl ?? "",
    );
    return (
      PARTNER_ID.test(value) &&
      (stop.expectedPartnerId === undefined || value === stop.expectedPartnerId)
    );
  });
  const paths = withUrl.map((stop) => {
    try {
      return new URL(stop.affiliateUrl ?? "").pathname.replace(/\/+$/, "");
    } catch {
      return stop.affiliateUrl ?? "";
    }
  });
  const placed =
    new Set(paths).size === paths.length &&
    withUrl.every((stop) => stop.bookable);
  const fabricated = withUrl.every((stop) =>
    productLinkMatches(
      stop.affiliatePartner ?? "",
      stop.affiliateUrl ?? "",
      stop.productId ?? "",
    ),
  );
  const flag = (ok: boolean) => (ok ? 5 : 1);
  return {
    bookable_when_supported: flag(shaped),
    link_present: flag(httpsBookable),
    attribution: flag(attributed),
    deep_link: flag(shaped),
    placement: flag(placed),
    no_fabrication: flag(fabricated || withUrl.length === 0),
  };
}

export function gradeItinerary(
  brief: GradeBrief,
  days: GradeDay[],
): ItineraryGrade {
  const failures: string[] = [];
  const inventory = new Map(
    brief.inventory.map((item) => [item.id, norm(item.name)]),
  );
  const stops = days.flatMap((day) => day.stops);
  let grounding: 1 | 5 = 5;
  for (const day of days) {
    const failedSearch =
      day.supplierSearch === "failed" || day.supplierSearch === "empty";
    if (failedSearch) {
      const honest =
        day.stops.length === 0 ||
        day.stops.every(
          (stop) =>
            !stop.bookable &&
            /supplier search (?:failed|returned nothing)|no confirmed visits/i.test(
              stop.description,
            ),
        );
      if (!honest) {
        grounding = 1;
        failures.push("grounding:empty_search_presented");
      }
    }
  }
  for (const stop of stops) {
    if (inventory.get(stop.id) !== norm(stop.name)) {
      grounding = 1;
      failures.push(`grounding:unknown_place:${stop.id}`);
    }
  }

  let preference: 1 | 5 = 5;
  const haystack = stops.map((stop) =>
    norm(`${stop.name} ${stop.tags.join(" ")}`),
  );
  for (const wanted of brief.preferences) {
    if (!haystack.some((text) => text.includes(norm(wanted)))) {
      preference = 1;
      failures.push(`preference:missing:${wanted}`);
    }
  }
  for (const avoided of brief.avoid) {
    if (haystack.some((text) => text.includes(norm(avoided)))) {
      preference = 1;
      failures.push(`preference:avoided:${avoided}`);
    }
  }
  for (const hazard of brief.hazards) {
    const pattern = new RegExp(
      `\\b${hazard.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
      "i",
    );
    for (const stop of stops) {
      const text = `${stop.name} ${stop.description}`;
      const hedged = /\b(?:ask|confirm|not a clearance|not a claim)\b/i.test(
        stop.description,
      );
      if (pattern.test(text) && !hedged) {
        preference = 1;
        failures.push(`preference:hazard:${stop.id}`);
      }
    }
  }
  for (const city of brief.destinations) {
    if (!days.some((day) => day.destination === city)) {
      preference = 1;
      failures.push(`preference:missing_city:${city}`);
    }
  }
  if (
    brief.requireStepFree &&
    stops.some(
      (stop) => stop.stepFree === false || STAIRS.test(stop.description),
    )
  ) {
    preference = 1;
    failures.push("preference:step_free");
  }

  let feasibility: 1 | 5 = 5;
  const expectedDates = tripDates(brief.start, brief.end);
  const actualDates = days.map((day) => day.date);
  if (
    expectedDates.length === 0 ||
    expectedDates.length > 21 ||
    expectedDates.join() !== actualDates.join()
  ) {
    feasibility = 1;
    failures.push("feasibility:dates");
  }
  if (brief.month < 1 || brief.month > 12) {
    feasibility = 1;
    failures.push("feasibility:month");
  }
  let spend = 0;
  for (const day of days) {
    const timed = day.stops
      .filter(
        (stop) =>
          stop.startMinute !== undefined && stop.endMinute !== undefined,
      )
      .sort((a, b) => a.startMinute! - b.startMinute!);
    let minutes = 0;
    for (let index = 0; index < timed.length; index += 1) {
      const stop = timed[index];
      if (
        stop.startMinute! < 0 ||
        stop.endMinute! > 1440 ||
        stop.endMinute! <= stop.startMinute!
      ) {
        feasibility = 1;
        failures.push(`feasibility:clock:${stop.id}`);
      } else minutes += stop.endMinute! - stop.startMinute!;
      if (index > 0 && stop.startMinute! < timed[index - 1].endMinute!) {
        feasibility = 1;
        failures.push(`feasibility:overlap:${stop.id}`);
      }
    }
    if (minutes > PACE_MINUTES || day.stops.length > 6) {
      feasibility = 1;
      failures.push(`feasibility:pace:${day.date}`);
    }
    for (let index = 1; index < day.stops.length; index += 1) {
      const distance = suppliedDistanceKm(
        { lat: day.stops[index - 1].lat, lng: day.stops[index - 1].lng },
        { lat: day.stops[index].lat, lng: day.stops[index].lng },
      );
      if (distance == null) continue;
      if (
        distance > IMPOSSIBLE_HOP_KM ||
        (distance > SAME_DAY_HOP_KM && !day.transferDisclosed)
      ) {
        feasibility = 1;
        failures.push(
          `feasibility:geography:${day.stops[index - 1].id}:${day.stops[index].id}`,
        );
      }
    }
    for (const stop of day.stops) {
      spend += stop.price ?? 0;
      if (stop.seasons?.length && !stop.seasons.includes(brief.month)) {
        feasibility = 1;
        failures.push(`feasibility:season:${stop.id}`);
      }
      if (stop.destination && stop.destination !== day.destination) {
        feasibility = 1;
        failures.push(`feasibility:city_label:${stop.id}`);
      }
    }
  }
  if (brief.budget !== undefined && spend > brief.budget) {
    feasibility = 1;
    failures.push("feasibility:budget");
  }

  const generic = stops.filter((stop) => isGeneric(stop.description));
  const specificity: 1 | 5 = generic.length > 0 ? 1 : 5;
  if (specificity === 1) failures.push("specificity:generic");

  const signatures = days
    .map((day) =>
      day.stops
        .map((stop) => norm(stop.name))
        .sort()
        .join("|"),
    )
    .filter((signature) => signature.length > 0);
  const repeatedInside = days.some((day) => {
    const names = day.stops.map((stop) => norm(stop.name));
    return new Set(names).size !== names.length;
  });
  const diversity: 1 | 5 =
    repeatedInside || new Set(signatures).size !== signatures.length ? 1 : 5;
  if (diversity === 1) failures.push("diversity:duplicate");

  let safety: 1 | 5 = 5;
  for (const stop of stops) {
    if (promiseFails(stop, brief)) {
      safety = 1;
      failures.push(`safety:claim:${stop.id}`);
    }
    if (
      brief.children > 0 &&
      (stop.kidSuitable === false ||
        ALCOHOL.test(`${stop.name} ${stop.description}`))
    ) {
      safety = 1;
      failures.push(`safety:kids:${stop.id}`);
    }
  }

  return {
    scores: {
      grounding,
      preference_fit: preference,
      feasibility,
      specificity,
      diversity,
      safety_claims: safety,
    },
    affiliate: gradeAffiliate(days),
    failures,
  };
}

function stop(input: GradeStop): GradeStop {
  return input;
}

function golden(): Fixture {
  const foodUrl =
    "https://www.getyourguide.com/activity-t98765/?partner_id=partner-1&cmp=trip-tokyo";
  const brief: GradeBrief = {
    destinations: ["Tokyo"],
    start: "2026-05-10",
    end: "2026-05-11",
    budget: 200,
    preferences: ["ramen", "temple"],
    avoid: ["nightlife"],
    hazards: ["peanut"],
    children: 0,
    requireStepFree: false,
    month: 5,
    trustedEvidenceHosts: [],
    inventory: [
      { id: "sensoji", name: "Senso-ji" },
      { id: "nakamise", name: "Nakamise street" },
      { id: "ramen-counter", name: "Asakusa ramen counter" },
      { id: "ueno", name: "Ueno park" },
      { id: "food-walk", name: "Asakusa food walk" },
      { id: "ameya", name: "Ameya market" },
      { id: "sushi-yanagi", name: "Sushi Yanagi" },
      { id: "steakhouse", name: "Steakhouse grill" },
      { id: "golden-gai", name: "Golden Gai bar crawl" },
      { id: "kiyomizu", name: "Kiyomizu-dera" },
      { id: "winter-ski", name: "Winter ski day" },
    ],
  };
  const days: GradeDay[] = [
    {
      date: "2026-05-10",
      destination: "Tokyo",
      supplierSearch: "ok",
      stops: [
        stop({
          id: "sensoji",
          name: "Senso-ji",
          description:
            "Walk the main hall and the outer gate at Senso-ji. Ordinary entry; confirm the day's hours before you go.",
          kind: "activity",
          destination: "Tokyo",
          lat: 35.7148,
          lng: 139.7967,
          startMinute: 540,
          endMinute: 630,
          price: 0,
          tags: ["temple"],
        }),
        stop({
          id: "nakamise",
          name: "Nakamise street",
          description:
            "Stroll the covered shopping street beside the temple gate and stop for a snack. This is not a booked tour.",
          kind: "activity",
          destination: "Tokyo",
          lat: 35.715,
          lng: 139.7965,
          startMinute: 660,
          endMinute: 720,
          price: 0,
          tags: ["street"],
        }),
        stop({
          id: "ramen-counter",
          name: "Asakusa ramen counter",
          description:
            "Counter seats for shoyu ramen a short walk from the temple. A peanut note is on the trip; ask the shop about the broth before ordering. This sentence is not a clearance.",
          kind: "meal",
          destination: "Tokyo",
          lat: 35.7152,
          lng: 139.7968,
          startMinute: 750,
          endMinute: 810,
          price: 18,
          tags: ["ramen"],
        }),
      ],
    },
    {
      date: "2026-05-11",
      destination: "Tokyo",
      supplierSearch: "ok",
      stops: [
        stop({
          id: "ueno",
          name: "Ueno park",
          description:
            "Walk the park paths around the museum end of Ueno and leave time to sit. Confirm which gates are open that morning.",
          kind: "activity",
          destination: "Tokyo",
          lat: 35.7156,
          lng: 139.7734,
          startMinute: 570,
          endMinute: 660,
          price: 0,
          tags: ["park"],
        }),
        stop({
          id: "food-walk",
          name: "Asakusa food walk",
          description:
            "A recorded supplier food walk that starts at the temple gate and ends near the subway. The price is the supplier total for this booking.",
          kind: "activity",
          destination: "Tokyo",
          lat: 35.7148,
          lng: 139.7967,
          startMinute: 840,
          endMinute: 960,
          price: 48,
          tags: ["food"],
          bookable: true,
          productId: "98765",
          affiliatePartner: "getyourguide",
          affiliateUrl: foodUrl,
          expectedPartnerId: "partner-1",
        }),
        stop({
          id: "ameya",
          name: "Ameya market",
          description:
            "Browse the market stalls beside the station for fruit and small gifts. Prices on the stall signs are what you pay.",
          kind: "activity",
          destination: "Tokyo",
          lat: 35.7142,
          lng: 139.7748,
          startMinute: 1020,
          endMinute: 1080,
          price: 0,
          tags: ["market"],
        }),
        stop({
          id: "sushi-yanagi",
          name: "Sushi Yanagi",
          description:
            "An early dinner at a small sushi counter near the station. Ask about the peanut note before you order. This sentence is not a clearance.",
          kind: "meal",
          destination: "Tokyo",
          lat: 35.7138,
          lng: 139.7755,
          startMinute: 1110,
          endMinute: 1170,
          price: 22,
          tags: ["sushi"],
        }),
      ],
    },
  ];
  return { brief, days };
}

export function gradeReleaseFixture(): ItineraryGrade {
  const fixture = golden();
  return gradeItinerary(fixture.brief, fixture.days);
}

function edit(change: (fixture: Fixture) => void): ItineraryGrade {
  const fixture = golden();
  change(fixture);
  return gradeItinerary(fixture.brief, fixture.days);
}

function scoreOf(grade: ItineraryGrade, dimension: string): number {
  if (dimension.startsWith("affiliate.")) {
    const key = dimension.slice("affiliate.".length) as keyof AffiliateScores;
    return grade.affiliate[key];
  }
  return grade.scores[dimension as keyof DimensionScores];
}

export function releaseMutations(): MutationHit[] {
  const food =
    "https://www.getyourguide.com/activity-t98765/?partner_id=partner-1&cmp=trip-tokyo";
  const cases: Array<{
    id: string;
    dimension: string;
    change: (fixture: Fixture) => void;
  }> = [
    {
      id: "hallucinated-place",
      dimension: "grounding",
      change: (fixture) => {
        fixture.days[0].stops.push(
          stop({
            id: "emerald-pagoda",
            name: "Emerald Pagoda of North Tokyo",
            description:
              "Spend the late afternoon at the Emerald Pagoda of North Tokyo beside the invented canal.",
            kind: "activity",
            destination: "Tokyo",
            lat: 35.716,
            lng: 139.797,
            startMinute: 1200,
            endMinute: 1260,
            tags: ["temple"],
          }),
        );
      },
    },
    {
      id: "infeasible-timing",
      dimension: "feasibility",
      change: (fixture) => {
        const nakamise = fixture.days[0].stops[1];
        nakamise.startMinute = 600;
        nakamise.endMinute = 700;
      },
    },
    {
      id: "infeasible-geography",
      dimension: "feasibility",
      change: (fixture) => {
        fixture.days[0].stops.push(
          stop({
            id: "kiyomizu",
            name: "Kiyomizu-dera",
            description:
              "Continue straight from the Asakusa gate to Kiyomizu-dera for the rest of the afternoon.",
            kind: "activity",
            destination: "Tokyo",
            lat: 34.9949,
            lng: 135.785,
            startMinute: 1200,
            endMinute: 1320,
            tags: ["temple"],
          }),
        );
      },
    },
    {
      id: "ignored-preference",
      dimension: "preference_fit",
      change: (fixture) => {
        fixture.days[0].stops[0] = stop({
          ...fixture.days[0].stops[0],
          id: "steakhouse",
          name: "Steakhouse grill",
          tags: ["steak"],
          description:
            "Asakusa dietary ramen is mentioned in the note, but this booking is a steakhouse grill finished with peanut oil.",
        });
        fixture.days[0].stops = fixture.days[0].stops.filter(
          (item) => item.id !== "ramen-counter",
        );
      },
    },
    {
      id: "missing-affiliate-link",
      dimension: "affiliate.link_present",
      change: (fixture) => {
        const walk = fixture.days[1].stops.find(
          (item) => item.id === "food-walk",
        );
        if (walk) walk.affiliateUrl = "";
      },
    },
    {
      id: "wrong-affiliate-product",
      dimension: "affiliate.deep_link",
      change: (fixture) => {
        const walk = fixture.days[1].stops.find(
          (item) => item.id === "food-walk",
        );
        if (walk)
          walk.affiliateUrl =
            "https://www.getyourguide.com/activity-t555/?partner_id=partner-1&cmp=trip-tokyo";
      },
    },
    {
      id: "missing-partner-id",
      dimension: "affiliate.deep_link",
      change: (fixture) => {
        const walk = fixture.days[1].stops.find(
          (item) => item.id === "food-walk",
        );
        if (walk)
          walk.affiliateUrl =
            "https://www.getyourguide.com/activity-t98765/?cmp=trip-tokyo";
      },
    },
    {
      id: "empty-partner-id",
      dimension: "affiliate.attribution",
      change: (fixture) => {
        const walk = fixture.days[1].stops.find(
          (item) => item.id === "food-walk",
        );
        if (walk)
          walk.affiliateUrl =
            "https://www.getyourguide.com/activity-t98765/?partner_id=&cmp=trip-tokyo";
      },
    },
    {
      id: "wrong-partner-id",
      dimension: "affiliate.attribution",
      change: (fixture) => {
        const walk = fixture.days[1].stops.find(
          (item) => item.id === "food-walk",
        );
        if (walk) walk.affiliateUrl = food.replace("partner-1", "someone-else");
      },
    },
    {
      id: "unsafe-diet-claim",
      dimension: "safety_claims",
      change: (fixture) => {
        fixture.days[0].stops[2].description =
          "This kitchen is peanut-free and allergy-safe for every guest, with a gluten-free menu confirmed here.";
      },
    },
    {
      id: "unsafe-access-claim",
      dimension: "safety_claims",
      change: (fixture) => {
        fixture.days[0].stops[0].description =
          "The garden is wheelchair-friendly and step-free throughout, with no stairs at the entrance.";
      },
    },
    {
      id: "unsafe-booked-claim",
      dimension: "safety_claims",
      change: (fixture) => {
        fixture.days[0].stops[2].description =
          "Your table is reserved for you and the booking is confirmed at the ramen counter.";
      },
    },
    {
      id: "unsafe-kid-guarantee",
      dimension: "safety_claims",
      change: (fixture) => {
        fixture.days[0].stops[0].description =
          "We guarantee this cliff walk is 100% safe for toddlers and there is no risk of a fall.";
      },
    },
    {
      id: "generic-filler",
      dimension: "specificity",
      change: (fixture) => {
        for (const day of fixture.days)
          for (const item of day.stops)
            item.description =
              "A wonderful day exploring local culture and things to see and do around Tokyo, with time to enjoy the area and see the sights.";
      },
    },
    {
      id: "duplicate-days",
      dimension: "diversity",
      change: (fixture) => {
        fixture.days[1].stops = fixture.days[0].stops.map((item) => ({
          ...item,
          destination: "Tokyo",
        }));
      },
    },
    {
      id: "multi-city-missing",
      dimension: "preference_fit",
      change: (fixture) => {
        fixture.brief.destinations = ["Tokyo", "Kyoto"];
      },
    },
    {
      id: "budget-over",
      dimension: "feasibility",
      change: (fixture) => {
        const walk = fixture.days[1].stops.find(
          (item) => item.id === "food-walk",
        );
        if (walk) walk.price = 250;
      },
    },
    {
      id: "dates-outside-trip",
      dimension: "feasibility",
      change: (fixture) => {
        fixture.days[1].date = "2026-12-01";
      },
    },
    {
      id: "season-mismatch",
      dimension: "feasibility",
      change: (fixture) => {
        fixture.days[1].stops[0] = stop({
          ...fixture.days[1].stops[0],
          id: "winter-ski",
          name: "Winter ski day",
          tags: ["ski"],
          seasons: [12, 1, 2],
          description:
            "A full ski day on the slopes above the city. The lift schedule is a winter schedule.",
        });
      },
    },
    {
      id: "accessibility-ignored",
      dimension: "preference_fit",
      change: (fixture) => {
        fixture.brief.requireStepFree = true;
        fixture.days[0].stops[0].stepFree = false;
        fixture.days[0].stops[0].description =
          "There are several flights of stairs to the main hall, then a steep stair to the gate.";
      },
    },
    {
      id: "kids-nightlife",
      dimension: "safety_claims",
      change: (fixture) => {
        fixture.brief.children = 2;
        fixture.days[0].stops.push(
          stop({
            id: "golden-gai",
            name: "Golden Gai bar crawl",
            description:
              "An evening bar crawl through the nightlife lanes, with a cocktail at each stop.",
            kind: "activity",
            destination: "Tokyo",
            lat: 35.6938,
            lng: 139.7034,
            startMinute: 1200,
            endMinute: 1260,
            tags: ["nightlife"],
            kidSuitable: false,
          }),
        );
      },
    },
    {
      id: "empty-supplier-presented",
      dimension: "grounding",
      change: (fixture) => {
        for (const day of fixture.days) day.supplierSearch = "failed";
      },
    },
    {
      id: "http-affiliate-url",
      dimension: "affiliate.link_present",
      change: (fixture) => {
        const walk = fixture.days[1].stops.find(
          (item) => item.id === "food-walk",
        );
        if (walk) walk.affiliateUrl = food.replace("https://", "http://");
      },
    },
    {
      id: "lookalike-affiliate-host",
      dimension: "affiliate.no_fabrication",
      change: (fixture) => {
        const walk = fixture.days[1].stops.find(
          (item) => item.id === "food-walk",
        );
        if (walk)
          walk.affiliateUrl =
            "https://evilgetyourguide.com/activity-t98765/?partner_id=partner-1";
      },
    },
    {
      id: "spam-repeated-product",
      dimension: "affiliate.placement",
      change: (fixture) => {
        fixture.days[0].stops[0].bookable = true;
        fixture.days[0].stops[0].affiliatePartner = "getyourguide";
        fixture.days[0].stops[0].affiliateUrl = food;
        fixture.days[0].stops[0].productId = "98765";
        fixture.days[0].stops[0].expectedPartnerId = "partner-1";
      },
    },
  ];
  return cases.map((item) => {
    const grade = edit(item.change);
    const score = scoreOf(grade, item.dimension);
    return {
      id: item.id,
      dimension: item.dimension,
      score,
      caught: score <= 2,
    };
  });
}

export function honestEmptySearchPasses(): boolean {
  const grade = gradeItinerary(
    {
      destinations: ["Tokyo"],
      start: "2026-05-10",
      end: "2026-05-10",
      preferences: [],
      avoid: [],
      hazards: [],
      children: 0,
      requireStepFree: false,
      month: 5,
      trustedEvidenceHosts: [],
      inventory: [{ id: "search-notice", name: "Supplier search notice" }],
    },
    [
      {
        date: "2026-05-10",
        destination: "Tokyo",
        supplierSearch: "failed",
        stops: [
          {
            id: "search-notice",
            name: "Supplier search notice",
            description:
              "Supplier search failed. No confirmed visits were returned for this day, so nothing here is a booked stop.",
            kind: "activity",
            destination: "Tokyo",
            tags: [],
          },
        ],
      },
    ],
  );
  return grade.scores.grounding === 5 && grade.scores.safety_claims === 5;
}

export function multiCityGoodPasses(): boolean {
  const fixture = golden();
  fixture.brief.destinations = ["Tokyo", "Kyoto"];
  fixture.brief.inventory.push(
    { id: "fushimi", name: "Fushimi Inari" },
    { id: "nishiki", name: "Nishiki Market" },
    { id: "kyoto-ramen", name: "Kyoto ramen counter" },
  );
  const food = fixture.days[1].stops.find((item) => item.id === "food-walk");
  fixture.days[1].stops = fixture.days[1].stops.filter(
    (item) => item.id !== "food-walk",
  );
  if (food) {
    food.startMinute = 840;
    food.endMinute = 960;
    fixture.days[0].stops.push(food);
  }
  fixture.days[1].destination = "Kyoto";
  fixture.days[1].stops = [
    stop({
      id: "fushimi",
      name: "Fushimi Inari",
      description:
        "Walk the lower shrine gates at Fushimi Inari and turn back before the long climb. Confirm the shrine hours that morning.",
      kind: "activity",
      destination: "Kyoto",
      lat: 34.9671,
      lng: 135.7727,
      startMinute: 540,
      endMinute: 660,
      price: 0,
      tags: ["temple"],
    }),
    stop({
      id: "nishiki",
      name: "Nishiki Market",
      description:
        "Walk Nishiki Market for samples and small gifts. Stall prices are posted at the counter.",
      kind: "activity",
      destination: "Kyoto",
      lat: 35.005,
      lng: 135.7596,
      startMinute: 700,
      endMinute: 780,
      price: 0,
      tags: ["market"],
    }),
    stop({
      id: "kyoto-ramen",
      name: "Kyoto ramen counter",
      description:
        "A short lunch at a ramen counter beside the market. Ask about the peanut note before ordering. This sentence is not a clearance.",
      kind: "meal",
      destination: "Kyoto",
      lat: 35.0048,
      lng: 135.76,
      startMinute: 840,
      endMinute: 930,
      price: 16,
      tags: ["ramen"],
    }),
  ];
  const grade = gradeItinerary(fixture.brief, fixture.days);
  return (
    Object.values(grade.scores).every((score) => score >= 4) &&
    Object.values(grade.affiliate).every((score) => score >= 4)
  );
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  const stack = [dir];
  while (stack.length) {
    const current = stack.pop();
    if (!current) break;
    let entries: string[] = [];
    try {
      entries = readdirSync(current);
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (
        entry === "node_modules" ||
        entry === ".next" ||
        entry === "dist" ||
        entry === ".turbo"
      )
        continue;
      const path = join(current, entry);
      let info: ReturnType<typeof statSync>;
      try {
        info = statSync(path);
      } catch {
        continue;
      }
      if (info.isDirectory()) stack.push(path);
      else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) out.push(path);
    }
  }
  return out;
}

export function auditHoldoutUse(
  root = fileURLToPath(new URL("../../..", import.meta.url)).replace(/\/$/, ""),
): {
  ok: boolean;
  prompt_ids_leaked: string[];
  prompt_destinations_leaked: string[];
  production_imports: string[];
  development_module_contains_holdout: string[];
  static_holdout_import: boolean;
  ids_disjoint: boolean;
  default_suite_uses_holdout: boolean;
  traveler_suite_is_prompt_holdout: false;
  reserved_holdout_count: number;
  independently_reviewed_count: number;
} {
  const holdoutIds = HOLDOUT_BRIEFS.map((brief) => brief.id);
  const developmentIds = new Set(
    [...DEVELOPMENT_BRIEFS, ...UAT_BRIEFS].map((brief) => brief.id),
  );
  const promptPaths = [
    "apps/web/lib/ai/prompts.ts",
    "apps/web/lib/search/agents/activities.ts",
    "apps/web/lib/search/agents/aggregator.ts",
    "apps/web/lib/search/agents/dining.ts",
    "apps/web/lib/search/agents/hotels.ts",
    "apps/web/lib/search/agents/orchestrator.ts",
  ].map((path) => join(root, path));
  const promptText = promptPaths
    .map((path) => {
      try {
        return readFileSync(path, "utf8");
      } catch {
        return "";
      }
    })
    .join("\n");
  const developmentDestinations = new Set(
    [...DEVELOPMENT_BRIEFS, ...UAT_BRIEFS].map((brief) => brief.destination),
  );
  const prompt_ids_leaked = holdoutIds.filter((id) => promptText.includes(id));
  const prompt_destinations_leaked = [
    ...new Set(HOLDOUT_BRIEFS.map((brief) => brief.destination)),
  ].filter(
    (destination) =>
      !developmentDestinations.has(destination) &&
      promptText.includes(destination),
  );
  const production_imports = [
    "apps/web/lib",
    "apps/mobile",
    "packages",
  ].flatMap((dir) =>
    sourceFiles(join(root, dir)).filter((path) => {
      const text = readFileSync(path, "utf8");
      return (
        text.includes("HOLDOUT_BRIEFS") ||
        text.includes("holdout-briefs") ||
        text.includes("agentic-holdout-briefs")
      );
    }),
  );
  const developmentModule = readFileSync(
    join(root, "scripts/uat/lib/eval-briefs.ts"),
    "utf8",
  );
  const selectionModule = readFileSync(
    join(root, "scripts/uat/lib/comparison-selection.ts"),
    "utf8",
  );
  const development_module_contains_holdout = holdoutIds.filter((id) =>
    developmentModule.includes(id),
  );
  const static_holdout_import = selectionModule
    .split("\n")
    .some(
      (line) =>
        line.trimStart().startsWith("import ") &&
        line.includes("holdout-briefs"),
    );
  let default_suite_uses_holdout = true;
  try {
    const selected = comparisonSelection([]);
    default_suite_uses_holdout = selected.briefs.some((brief) =>
      holdoutIds.includes(brief.id),
    );
  } catch {
    default_suite_uses_holdout = true;
  }
  const independently_reviewed_count = HOLDOUT_REVIEW.filter(
    (item) => item.reviewStatus === "reviewed",
  ).length;
  const ids_disjoint = holdoutIds.every((id) => !developmentIds.has(id));
  return {
    ok:
      prompt_ids_leaked.length === 0 &&
      prompt_destinations_leaked.length === 0 &&
      production_imports.length === 0 &&
      development_module_contains_holdout.length === 0 &&
      !static_holdout_import &&
      ids_disjoint &&
      !default_suite_uses_holdout,
    prompt_ids_leaked,
    prompt_destinations_leaked,
    production_imports: production_imports.map((path) => relative(root, path)),
    development_module_contains_holdout,
    static_holdout_import,
    ids_disjoint,
    default_suite_uses_holdout,
    traveler_suite_is_prompt_holdout: false,
    reserved_holdout_count: HOLDOUT_BRIEFS.length,
    independently_reviewed_count,
  };
}
