/**
 * Offline itinerary and affiliate rubric. Never calls a model or a supplier.
 * A recorded live grade can set live_model_quality_measured. This file does
 * not spend a budget or call a model.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildItineraryBlocks } from "../../../apps/web/lib/json-render/build-spec";
import { buildHotelBlocks } from "../../../apps/web/lib/json-render/build-spec";
import {
  affiliateClickInsert,
  affiliateClickLedgerFailures,
} from "../../../apps/web/lib/affiliates/click-record";
import { buildGYGAffiliateUrl } from "../../../apps/web/lib/affiliates/getyourguide";
import { buildViatorHandoffUrl } from "../../../apps/web/lib/affiliates/viator-link";
import { compileSchedule } from "../../../apps/web/lib/search/schedule-compiler";
import { enrichNonAffiliateCandidates } from "../../../apps/web/lib/search/enrichment";
import {
  draftChapters,
  streamStepState,
} from "../../../apps/web/lib/trips/streaming-dossier";
import type {
  ActivityResult,
  DiningResult,
  SearchPlan,
} from "../../../packages/types/src/index";
import {
  auditHoldoutUse,
  gradeReleaseFixture,
  honestEmptySearchPasses,
  multiCityGoodPasses,
  productLinkMatches,
  releaseMutations,
  type AffiliateScores,
  type DimensionScores,
  type MutationHit,
} from "./itinerary-rubric";

export { productLinkMatches };
export type { AffiliateScores, DimensionScores, MutationHit };

const FILLER =
  /\b(?:dining idea|neighborhood spot|hidden gem|local favorite|must-see|unforgettable)\b/i;
const DIET_CLAIM =
  /\b(?:allerg\w*|anaphyla\w*|c(?:o)?eliac\w*|cross[ -]?(?:contact|contaminat\w*)|(?:gluten|nuts?|peanuts?|shellfish|dairy)[ -]?free|allergy[ -]safe|vegan|vegetarian|halal|kosher)\b/i;
const ACCESS_CLAIM =
  /\b(?:wheelchair[ -](?:accessible|friendly)|step[ -]free|stair[ -]free|fully accessible)\b/i;
const BOOKED_CLAIM =
  /\b(?:already booked|booking confirmed|table is reserved|reserved for you)\b/i;

const plan: SearchPlan = {
  destination: "Tokyo",
  country: "Japan",
  dates: { start: "2026-05-10", end: "2026-05-10", nights: 0 },
  searchPriorities: ["activities", "dining"],
  hotelCriteria: {
    priceRange: { min: 80, max: 180 },
    starRating: [3],
    amenities: [],
    neighborhoods: ["Asakusa"],
  },
  activityCriteria: {
    categories: ["culture", "food"],
    interests: ["temples", "food"],
    pacePreference: "relaxed",
    mustSee: [],
  },
  diningCriteria: {
    cuisineTypes: ["ramen", "sushi"],
    dietaryNeeds: ["peanut allergy"],
    priceRange: "moderate",
    mealPriorities: ["lunch", "dinner"],
  },
  dietaryRestrictions: ["peanut allergy"],
  vibeInterpretation: {
    vibes: ["cultural"],
    searchKeywords: ["temples"],
    avoidKeywords: [],
  },
};

function activity(
  id: string,
  name: string,
  lat: number,
  lng: number,
  extra: Partial<ActivityResult> = {},
): ActivityResult {
  return {
    id,
    name,
    description: extra.description ?? `Visit ${name} and look around the area.`,
    category: "sightseeing",
    duration: extra.duration ?? 90,
    price: extra.price ?? 0,
    currency: extra.currency ?? "",
    priceStatus: extra.priceStatus ?? "unknown",
    rating: 0,
    reviewCount: 0,
    location: { name, address: `${name}, Tokyo`, lat, lng },
    images: [],
    bestTimeOfDay: extra.bestTimeOfDay ?? "any",
    vibeScore: extra.vibeScore ?? 70,
    vibeMatch: [],
    bookingRequired: Boolean(extra.affiliateUrl),
    affiliatePartner: extra.affiliatePartner,
    affiliateUrl: extra.affiliateUrl,
    supplierCatalogOnly: extra.supplierCatalogOnly,
    planningIdea: extra.planningIdea,
  };
}

function meal(
  id: string,
  name: string,
  mealTypes: DiningResult["mealTypes"],
): DiningResult {
  return {
    id,
    name,
    description: `Recorded ${name} fixture.`,
    cuisineTypes: ["ramen"],
    priceLevel: 2,
    priceStatus: "unknown",
    dietaryOptions: [],
    mealTypes,
    location: {
      name,
      address: `${name}, Asakusa`,
      lat: 35.7148,
      lng: 139.7967,
    },
    images: [],
    vibeScore: 60,
    vibeMatch: [],
    rating: 0,
    reviewCount: 0,
  };
}

function clamp(score: number): number {
  return Math.max(1, Math.min(5, Math.round(score)));
}

/** Retired keyword scorer. Kept so the old self-grade stays visible. Not a release gate. */
export function scoreCopy(
  texts: string[],
  destination: string,
): DimensionScores {
  const joined = texts.join(" ");
  const filler = texts.filter((text) => FILLER.test(text)).length;
  const claims =
    Number(DIET_CLAIM.test(joined)) +
    Number(ACCESS_CLAIM.test(joined)) +
    Number(BOOKED_CLAIM.test(joined));
  const specific = texts.filter(
    (text) =>
      text.length >= 80 && text.includes(destination) && !FILLER.test(text),
  ).length;
  const names = new Set(texts.map((text) => text.slice(0, 40)));
  return {
    grounding: clamp(
      texts.every((text) => /planning prompt|not a reserved/i.test(text))
        ? 5
        : 3,
    ),
    preference_fit: clamp(
      joined.includes("Asakusa") &&
        joined.includes("ramen") &&
        joined.includes("dietary")
        ? 5
        : 2,
    ),
    feasibility: 4,
    specificity: clamp(5 - filler * 2 - (specific === texts.length ? 0 : 2)),
    diversity: clamp(names.size >= Math.min(3, texts.length) ? 5 : 2),
    safety_claims: clamp(5 - claims * 2),
  };
}

const BASELINE_FILLER = [
  "ramen neighborhood spot. Dining idea; choose a venue and confirm menu prices before booking.",
  "Self-guided neighborhood walk in Tokyo. Planning idea; confirm opening times.",
];

function viatorProductUrl(productCode: string): string {
  return (
    buildViatorHandoffUrl(
      `https://www.viator.com/tours/Tokyo/Food-walk/d334-${productCode}?pid=P123&mcid=42383&medium=api`,
      "faroway-tokyo",
      "P123",
    ) || ""
  );
}

function affiliateFixture() {
  const productUrl = buildGYGAffiliateUrl(
    "98765",
    "trip-tokyo",
    "partner-1",
    "2026-05-10",
  );
  const blocks = buildItineraryBlocks([
    {
      dayNumber: 1,
      date: "2026-05-10",
      title: "Asakusa food and a temple",
      morning: {
        activities: [
          {
            id: "activity_gyg_98765",
            name: "Asakusa food walk",
            description: "A recorded supplier food walk.",
            affiliateUrl: productUrl,
            affiliatePartner: "getyourguide",
            duration: 2,
          },
        ],
      },
      afternoon: {
        meals: [
          { id: "ramen-1", name: "Asakusa ramen counter", cuisine: "ramen" },
        ],
      },
    },
  ]);
  const hotel = buildHotelBlocks({
    topHotel: {
      name: "Asakusa stay",
      affiliateUrl: "https://www.tripadvisor.com/Hotel_Review-d99",
      affiliatePartner: "tripadvisor",
      pricePerNight: 120,
      currency: "USD",
    },
  });
  const activityCards = blocks.filter((block) => block.type === "ActivityCard");
  const bookingButtons = [...blocks, ...hotel].filter(
    (block) => block.type === "BookingButton",
  );
  const click = affiliateClickInsert({
    clickId: "click_recorded",
    userId: null,
    itemType: "activity",
    itemId: "98765",
    itemName: "Asakusa food walk",
    affiliatePartner: "getyourguide",
    affiliateUrl: productUrl,
    tripId: null,
    source: "itinerary",
    clickedAt: "2026-05-01T00:00:00.000Z",
  });
  return { productUrl, blocks, activityCards, bookingButtons, click, hotel };
}

function controlFailures(): Array<{ id: string; failed: boolean }> {
  const good = affiliateFixture();
  const spamUrl = buildGYGAffiliateUrl("555", "trip-tokyo", "partner-1");
  const swapped = buildItineraryBlocks([
    {
      dayNumber: 1,
      date: "2026-05-10",
      title: "Wrong product",
      morning: {
        activities: [
          {
            name: "Asakusa food walk",
            affiliatePartner: "getyourguide",
            affiliateUrl: spamUrl,
          },
          {
            name: "Unrelated temple",
            affiliatePartner: "getyourguide",
            affiliateUrl: spamUrl,
          },
          {
            name: "Another copy",
            affiliatePartner: "getyourguide",
            affiliateUrl: spamUrl,
          },
        ],
      },
    },
  ]);
  const swappedUrls = swapped
    .filter((block) => block.type === "ActivityCard")
    .map((block) => String(block.props.bookingUrl || ""));
  const legacy = {
    partner: "viator",
    product_id: "TOKYO1",
    tracking_id: "tg_old",
    click_url: good.productUrl,
  };
  const gyg = buildGYGAffiliateUrl(
    "98765",
    "trip-tokyo",
    "partner-1",
    "2026-05-10",
  );
  const inventedPartner = buildGYGAffiliateUrl(
    "98765",
    "trip-tokyo",
    undefined,
  );
  return [
    {
      id: "generic-filler",
      failed: scoreCopy(BASELINE_FILLER, "Tokyo").specificity <= 2,
    },
    {
      id: "dietary-claim",
      failed: DIET_CLAIM.test("A gluten-free breakfast is confirmed here."),
    },
    {
      id: "access-claim",
      failed: ACCESS_CLAIM.test(
        "The garden is wheelchair-friendly and step-free.",
      ),
    },
    {
      id: "booked-claim",
      failed: BOOKED_CLAIM.test("Your table is reserved for you."),
    },
    {
      id: "http-affiliate-url",
      failed: !productLinkMatches(
        "viator",
        "http://www.viator.com/tours/Tokyo/Food/d334-TOKYO1",
        "TOKYO1",
      ),
    },
    {
      id: "wrong-product-deep-link",
      failed: !productLinkMatches(
        "viator",
        viatorProductUrl("OTHER1"),
        "TOKYO1",
      ),
    },
    {
      id: "spam-repeated-product",
      failed:
        swappedUrls.filter((url) => url.includes("activity-t555")).length > 1,
    },
    {
      id: "legacy-click-columns",
      failed: affiliateClickLedgerFailures(legacy).some((item) =>
        item.startsWith("legacy:"),
      ),
    },
    {
      id: "invented-getyourguide-partner",
      failed:
        inventedPartner === "" &&
        productLinkMatches("getyourguide", gyg, "98765"),
    },
    {
      id: "lookalike-getyourguide-host",
      failed: !productLinkMatches(
        "getyourguide",
        "https://evilgetyourguide.com/activity-t98765/?partner_id=partner-1",
        "98765",
      ),
    },
    {
      id: "longer-getyourguide-activity-id",
      failed: !productLinkMatches(
        "getyourguide",
        "https://www.getyourguide.com/activity-t987650/?partner_id=partner-1",
        "98765",
      ),
    },
    {
      id: "empty-partner-id",
      failed: !productLinkMatches(
        "getyourguide",
        "https://www.getyourguide.com/activity-t98765/?partner_id=",
        "98765",
      ),
    },
    {
      id: "whitespace-partner-id",
      failed: !productLinkMatches(
        "getyourguide",
        "https://www.getyourguide.com/activity-t98765/?partner_id=%20",
        "98765",
      ),
    },
    {
      id: "missing-partner-id",
      failed: !productLinkMatches(
        "getyourguide",
        "https://www.getyourguide.com/activity-t98765/?cmp=trip-tokyo",
        "98765",
      ),
    },
    {
      id: "planning-prompt-not-bookable",
      failed: buildItineraryBlocks([
        {
          dayNumber: 1,
          date: "2026-05-10",
          title: "Prompt",
          morning: {
            activities: [
              {
                name: "Find ramen for lunch near Asakusa in Tokyo",
                affiliateUrl: good.productUrl,
              },
            ],
          },
        },
      ]).every(
        (block) => block.type !== "ActivityCard" || !block.props.bookingUrl,
      ),
    },
  ];
}

export function liveModelCredential(
  env: Record<string, string | undefined> = process.env,
): { name: "FAROWAY_STAGING_AI_GATEWAY_KEY" | "AI_GATEWAY_API_KEY" } | null {
  if (env.FAROWAY_STAGING_AI_GATEWAY_KEY?.trim())
    return { name: "FAROWAY_STAGING_AI_GATEWAY_KEY" };
  if (env.AI_GATEWAY_API_KEY?.trim()) return { name: "AI_GATEWAY_API_KEY" };
  return null;
}

export function liveQualityGate(
  env: Record<string, string | undefined> = process.env,
): { allowed: boolean; reason: string; budgetUsd: number } {
  if (env.FAROWAY_LIVE_QUALITY_EVAL !== "1") {
    return {
      allowed: false,
      reason:
        "Set FAROWAY_LIVE_QUALITY_EVAL=1 to generate and grade one development brief. No model is called without that flag.",
      budgetUsd: 0,
    };
  }
  const budget = Number(env.FAROWAY_LIVE_EVAL_BUDGET_USD);
  if (!Number.isFinite(budget) || budget <= 0 || budget > 5) {
    return {
      allowed: false,
      reason:
        "FAROWAY_LIVE_EVAL_BUDGET_USD must be a number from 0 exclusive to 5 inclusive.",
      budgetUsd: 0,
    };
  }
  if (!liveModelCredential(env)) {
    return {
      allowed: false,
      reason:
        "Set FAROWAY_STAGING_AI_GATEWAY_KEY or AI_GATEWAY_API_KEY. Live mode does not call a model when neither is set.",
      budgetUsd: budget,
    };
  }
  return {
    allowed: true,
    reason:
      "One development brief will be generated with the staging model and graded. The spend ceiling is FAROWAY_LIVE_EVAL_BUDGET_USD.",
    budgetUsd: budget,
  };
}

function streamingReleaseChecks(): Array<{ id: string; caught: boolean }> {
  const empty = draftChapters(null, []);
  const failed = streamStepState("activities", "searching", {
    activities: "failed",
  });
  const errored = streamStepState("dining", "complete", { dining: "error" });
  const loading = streamStepState("hotels", "connecting", null);
  const searching = streamStepState("hotels", "searching", {
    hotels: "searching",
  });
  const httpChapters = draftChapters(null, [
    { type: "ItineraryDay", props: { dayNumber: 1, title: "Day 1" } },
    {
      type: "ActivityCard",
      props: { name: "Canal walk", bookingUrl: "http://example.com/walk" },
    },
  ]);
  const unqualified = productLinkMatches(
    "getyourguide",
    "https://www.getyourguide.com/activity-t98765/?cmp=trip-tokyo",
    "98765",
  );
  return [
    { id: "stream-empty-invents-nothing", caught: empty.length === 0 },
    {
      id: "stream-failed-search-not-done",
      caught: failed === "interrupted" && errored === "interrupted",
    },
    {
      id: "stream-loading-not-done",
      caught: loading !== "done" && searching === "active",
    },
    {
      id: "stream-http-not-supplier",
      caught: httpChapters[0]?.stops[0]?.supplierLink === false,
    },
    {
      id: "stream-missing-partner-not-qualified",
      caught: unqualified === false,
    },
  ];
}

function credentialPresence(
  env: Record<string, string | undefined> = process.env,
): Record<string, boolean> {
  const names = [
    "AI_GATEWAY_API_KEY",
    "OPENAI_API_KEY",
    "ANTHROPIC_API_KEY",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "VERCEL_OIDC_TOKEN",
    "GETYOURGUIDE_API_KEY",
    "GETYOURGUIDE_PARTNER_ID",
    "VIATOR_API_KEY",
    "TAVILY_API_KEY",
  ];
  return Object.fromEntries(names.map((name) => [name, Boolean(env[name])]));
}

const recordedGradePath = fileURLToPath(
  new URL("../../fixtures/live-generation-grade.json", import.meta.url),
);

/** True only when a live call's grade was saved. Missing or partial files stay false. */
export function recordedLiveGrade(): boolean {
  try {
    const parsed = JSON.parse(readFileSync(recordedGradePath, "utf8")) as {
      live_model_quality_measured?: unknown;
      brief_id?: unknown;
      estimated_usd?: unknown;
      scores?: unknown;
    };
    return (
      parsed.live_model_quality_measured === true &&
      typeof parsed.brief_id === "string" &&
      parsed.brief_id.length > 0 &&
      typeof parsed.estimated_usd === "number" &&
      parsed.estimated_usd >= 0 &&
      parsed.scores !== null &&
      typeof parsed.scores === "object"
    );
  } catch {
    return false;
  }
}

export async function runGenerationQualityEval(): Promise<{
  mode: "offline";
  live_model_quality_measured: boolean;
  scores_measure_model_output: false;
  keyword_self_score_is_release_gate: false;
  live_gate: ReturnType<typeof liveQualityGate>;
  baseline: DimensionScores;
  current: DimensionScores;
  keyword_self_score: DimensionScores;
  affiliate: AffiliateScores;
  affiliate_builder: AffiliateScores;
  planner_case: {
    bookable_selected: boolean;
    distant_bookable_rejected: boolean;
    fits: boolean;
    ideas_unscheduled: boolean;
  };
  negative_controls: number;
  negative_controls_detected: number;
  missed_controls: string[];
  mutations: MutationHit[];
  mutations_missed: string[];
  coverage: {
    multi_city: boolean;
    multi_city_good: boolean;
    budget: boolean;
    dates: boolean;
    season: boolean;
    accessibility: boolean;
    kids: boolean;
    empty_supplier: boolean;
    honest_empty_search: boolean;
    partner_id: boolean;
    streaming: boolean;
  };
  streaming_checks: Array<{ id: string; caught: boolean }>;
  holdout_integrity: ReturnType<typeof auditHoldoutUse>;
  live_run: {
    credentials_present: boolean;
    credentials: Record<string, boolean>;
    blocked_reason: string;
  };
  thresholds: { dimension_min: number; mutation_max: number };
  accepted: boolean;
}> {
  const enriched = await enrichNonAffiliateCandidates(plan, {
    liveSearch: false,
  });
  const currentTexts = [...enriched.activities, ...enriched.dining].map(
    (item) => `${item.name}. ${item.description}`,
  );
  const keyword_self_score = scoreCopy(currentTexts, plan.destination);
  const graded = gradeReleaseFixture();
  const current = graded.scores;
  const baseline = scoreCopy(BASELINE_FILLER, plan.destination);
  const near = { lat: 35.7148, lng: 139.7967 };
  const bookable = activity(
    "activity_v_TOKYO1",
    "Asakusa food walk",
    near.lat,
    near.lng,
    {
      vibeScore: 74,
      affiliatePartner: "viator",
      affiliateUrl: viatorProductUrl("TOKYO1"),
      price: 48,
      currency: "USD",
      priceStatus: undefined,
      description: "Recorded Viator food walk in Asakusa.",
    },
  );
  const generic = activity(
    "generic-view",
    "Sunset viewpoint",
    near.lat,
    near.lng,
    { vibeScore: 78, description: "A generic viewpoint with no supplier." },
  );
  const idea = activity("enriched_idea", "Find ramen", near.lat, near.lng, {
    planningIdea: true,
    vibeScore: 99,
    description: "Planning prompt, not a reserved stop.",
  });
  const selected = compileSchedule(
    plan,
    [generic, bookable, idea],
    [
      meal("lunch", "Asakusa ramen", ["lunch"]),
      meal("dinner", "Asakusa sushi", ["dinner"]),
    ],
  );
  const distant = activity("far-tour", "Nikko day tour", 36.72, 139.7, {
    vibeScore: 76,
    bestTimeOfDay: "afternoon",
    affiliatePartner: "viator",
    affiliateUrl: viatorProductUrl("NIKKO1"),
    description: "A long recorded tour far from Asakusa.",
  });
  const anchor = activity("sensoji", "Senso-ji", near.lat, near.lng, {
    vibeScore: 96,
    bestTimeOfDay: "morning",
    description: "Recorded temple visit in Asakusa.",
  });
  const companion = activity(
    "nakamise",
    "Nakamise street",
    near.lat + 0.002,
    near.lng,
    {
      vibeScore: 70,
      bestTimeOfDay: "afternoon",
      description: "Recorded shopping street beside the temple.",
    },
  );
  const paced = {
    ...plan,
    activityCriteria: {
      ...plan.activityCriteria,
      pacePreference: "moderate" as const,
    },
  };
  const geography = compileSchedule(
    paced,
    [anchor, companion, distant],
    [
      meal("lunch", "Asakusa ramen", ["lunch"]),
      meal("dinner", "Asakusa sushi", ["dinner"]),
    ],
  );
  const scheduled = selected.days.flatMap((day) =>
    [day.morning, day.afternoon, day.evening].flatMap((slot) => [
      ...slot.activities.map((item) => item.id),
      ...(slot.meal ? [slot.meal.id] : []),
    ]),
  );
  const pacedIds = geography.days.flatMap((day) =>
    [day.morning, day.afternoon, day.evening].flatMap((slot) =>
      slot.activities.map((item) => item.id),
    ),
  );
  const planner_case = {
    bookable_selected: scheduled.includes(bookable.id),
    distant_bookable_rejected: !pacedIds.includes(distant.id),
    fits: selected.timingProposals.every((item) => item.fitsPolicy),
    ideas_unscheduled: !scheduled.includes(idea.id),
  };
  const offer = affiliateFixture();
  const activityUrl = String(offer.activityCards[0]?.props.bookingUrl || "");
  const restaurantHasBooking = offer.blocks.some(
    (block) => block.type === "RestaurantCard" && block.props.bookingUrl,
  );
  const hotelButton = offer.bookingButtons.find(
    (block) =>
      block.props.url === "https://www.tripadvisor.com/Hotel_Review-d99",
  );
  const affiliate_builder: AffiliateScores = {
    bookable_when_supported: planner_case.bookable_selected ? 5 : 1,
    link_present:
      activityUrl === offer.productUrl && Boolean(hotelButton) ? 5 : 1,
    attribution:
      affiliateClickLedgerFailures(offer.click).length === 0 &&
      offer.click.affiliate_url.includes(offer.click.item_id)
        ? 5
        : 1,
    deep_link: productLinkMatches("getyourguide", activityUrl, "98765") ? 5 : 1,
    placement:
      offer.activityCards.length === 1 && !restaurantHasBooking ? 5 : 1,
    no_fabrication:
      buildGYGAffiliateUrl("1", "trip", undefined) === "" &&
      offer.productUrl.includes("activity-t98765") &&
      viatorProductUrl("TOKYO1").includes("TOKYO1")
        ? 5
        : 1,
  };
  const affiliate = graded.affiliate;
  const controls = controlFailures();
  const missed_controls = controls
    .filter((item) => !item.failed)
    .map((item) => item.id);
  const mutations = releaseMutations();
  const mutations_missed = mutations
    .filter((item) => !item.caught)
    .map((item) => item.id);
  const streaming_checks = streamingReleaseChecks();
  const coverage = {
    multi_city: mutations.some(
      (item) => item.id === "multi-city-missing" && item.caught,
    ),
    multi_city_good: multiCityGoodPasses(),
    budget: mutations.some((item) => item.id === "budget-over" && item.caught),
    dates: mutations.some(
      (item) => item.id === "dates-outside-trip" && item.caught,
    ),
    season: mutations.some(
      (item) => item.id === "season-mismatch" && item.caught,
    ),
    accessibility: mutations.some(
      (item) => item.id === "accessibility-ignored" && item.caught,
    ),
    kids: mutations.some((item) => item.id === "kids-nightlife" && item.caught),
    empty_supplier: mutations.some(
      (item) => item.id === "empty-supplier-presented" && item.caught,
    ),
    honest_empty_search: honestEmptySearchPasses(),
    partner_id: ["missing-partner-id", "empty-partner-id"].every((id) =>
      mutations.some((item) => item.id === id && item.caught),
    ),
    streaming: streaming_checks.every((item) => item.caught),
  };
  const holdout_integrity = auditHoldoutUse();
  const credentials = credentialPresence();
  const liveMeasured = recordedLiveGrade();
  const dimensions = Object.values(current);
  const affiliateValues = Object.values(affiliate);
  const accepted =
    dimensions.every((score) => score >= 4) &&
    affiliateValues.every((score) => score >= 4) &&
    Object.values(affiliate_builder).every((score) => score >= 4) &&
    Object.values(planner_case).every(Boolean) &&
    baseline.specificity <= 2 &&
    current.specificity > baseline.specificity &&
    missed_controls.length === 0 &&
    mutations_missed.length === 0 &&
    Object.values(coverage).every(Boolean) &&
    holdout_integrity.ok;
  return {
    mode: "offline",
    live_model_quality_measured: liveMeasured,
    scores_measure_model_output: false,
    keyword_self_score_is_release_gate: false,
    live_gate: liveQualityGate({}),
    baseline,
    current,
    keyword_self_score,
    affiliate,
    affiliate_builder,
    planner_case,
    negative_controls: controls.length,
    negative_controls_detected: controls.length - missed_controls.length,
    missed_controls,
    mutations,
    mutations_missed,
    coverage,
    streaming_checks,
    holdout_integrity,
    live_run: {
      credentials_present: Object.values(credentials).some(Boolean),
      credentials,
      blocked_reason: liveMeasured
        ? "This command does not start a paid call. A recorded live grade is on file."
        : Object.values(credentials).some(Boolean)
          ? "Credentials are present, but this command does not start a paid call."
          : "No model or supplier credential is set. A live quality run has not been measured.",
    },
    thresholds: { dimension_min: 4, mutation_max: 2 },
    accepted,
  };
}
