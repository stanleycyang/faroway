/** Offline traveler-quality holdout. Runs the schedule compiler, dining repair,
 * aggregator day mapping and recorded supplier decisions. No model or provider calls.
 */
import { createHash } from "node:crypto";
import { compileSchedule } from "../../../apps/web/lib/search/schedule-compiler";
import { repairDiningInventory } from "../../../apps/web/lib/search/repair-dining-inventory";
import { createFallbackItinerary } from "../../../apps/web/lib/search/fallback-itinerary";
import { mapAggregatorResult } from "../../../apps/web/lib/search/agents/aggregator";
import {
  reviewedHoursExclusions,
  reviewedVisitWindows,
  type ReviewedVenueHours,
} from "../../../apps/web/lib/search/reviewed-venue-hours";
import { recoverSupplierSearch } from "../../../apps/web/lib/affiliates/supplier-search-recovery";
import { supplierDurationCeilingMinutes } from "../../../apps/web/lib/search/supplier-duration";
import { suppliedDistanceKm } from "../../../apps/web/lib/search/supplied-distance";
import {
  chronologicalStops,
  transferExceedsPlanningBuffer,
} from "../../../apps/web/lib/search/transfer-review";
import type {
  ActivityResult,
  DiningResult,
  SearchPlan,
  SuggestedDay,
  TransportResult,
} from "../../../apps/web/lib/search/types";

const SLOTS = ["morning", "afternoon", "evening"] as const;
const DIET_CLAIM =
  /\b(?:allerg\w*|anaphyla\w*|c(?:o)?eliac\w*|cross[ -]?(?:contact|contaminat\w*)|(?:gluten|nuts?|peanuts?|shellfish|dairy)[ -]?free|allergy[ -]safe|vegan|vegetarian|halal|kosher)\b/i;
const ACCESS_PROMISE =
  /\b(?:wheelchair[ -](?:accessible|friendly)|step[ -]free|stair[ -]free|fully accessible)\b/i;
const PACE = {
  relaxed: { count: 2, minutes: 240 },
  moderate: { count: 4, minutes: 420 },
  packed: { count: 5, minutes: 600 },
} as const;

export interface HoldoutResult {
  id: string;
  kind: "planner" | "control" | "supplier";
  accepted: boolean;
  failures: string[];
}

function calendar(start: string, count: number) {
  const origin = Date.parse(`${start}T00:00:00Z`);
  return Array.from({ length: count }, (_, index) =>
    new Date(origin + index * 86400000).toISOString().slice(0, 10),
  );
}

function searchPlan(
  input: Partial<SearchPlan> &
    Pick<SearchPlan, "destination" | "country" | "dates"> & {
      pace: SearchPlan["activityCriteria"]["pacePreference"];
    },
): SearchPlan {
  return {
    destination: input.destination,
    country: input.country,
    dates: input.dates,
    travelers: input.travelers ?? 1,
    adults: input.adults ?? 1,
    children: input.children ?? 0,
    searchPriorities: ["activities", "dining"],
    mobilityNeeds: input.mobilityNeeds,
    dietaryRestrictions: input.dietaryRestrictions,
    requirements: input.requirements,
    hotelCriteria: {
      priceRange: { min: 80, max: 250 },
      starRating: [3],
      amenities: [],
      neighborhoods: [],
    },
    activityCriteria: {
      categories: ["sightseeing"],
      pacePreference: input.pace,
      mustSee: input.activityCriteria?.mustSee ?? [],
      interests: input.activityCriteria?.interests ?? ["culture"],
    },
    diningCriteria: {
      cuisineTypes: [],
      priceRange: "moderate",
      dietaryNeeds: input.diningCriteria?.dietaryNeeds ?? [],
      mealPriorities: ["breakfast", "lunch", "dinner"],
    },
    vibeInterpretation: {
      vibes: input.vibeInterpretation?.vibes ?? ["culture"],
      searchKeywords: [],
      avoidKeywords: [],
    },
  };
}

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
    description: extra.description ?? "Recorded independently visitable stop.",
    category: extra.category ?? "sightseeing",
    duration: extra.duration ?? 90,
    price: extra.price ?? 0,
    currency: extra.currency ?? "",
    priceStatus: extra.priceStatus ?? (extra.price ? undefined : "unknown"),
    rating: 0,
    reviewCount: 0,
    location: {
      name,
      address: extra.location?.address ?? `${name} recorded fixture`,
      lat,
      lng,
    },
    images: [],
    bestTimeOfDay: extra.bestTimeOfDay ?? "any",
    vibeScore: extra.vibeScore ?? 70,
    vibeMatch: extra.vibeMatch ?? [],
    bookingRequired: Boolean(extra.affiliatePartner),
    proposedVisitType: extra.proposedVisitType ?? "ordinary_entry",
    affiliatePartner: extra.affiliatePartner,
    affiliateUrl: extra.affiliateUrl,
    supplierCatalogOnly: extra.supplierCatalogOnly,
    planningIdea: extra.planningIdea,
  };
}

function meal(
  id: string,
  name: string,
  lat: number,
  lng: number,
  mealTypes: DiningResult["mealTypes"],
  extra: Partial<DiningResult> = {},
): DiningResult {
  return {
    id,
    name,
    description: extra.description ?? "Recorded restaurant fixture.",
    cuisineTypes: ["local"],
    priceLevel: 2,
    location: {
      name,
      address: extra.location?.address ?? `${name} recorded fixture`,
      lat,
      lng,
    },
    images: [],
    mealTypes,
    vibeScore: 60,
    vibeMatch: [],
    dietaryOptions: extra.dietaryOptions ?? [],
    planningIdea: extra.planningIdea,
    priceStatus: "unknown",
  };
}

function visitsOf(day: SuggestedDay) {
  return SLOTS.flatMap((slot) => day[slot].activities);
}
function mealsOf(day: SuggestedDay) {
  return SLOTS.flatMap((slot) => (day[slot].meal ? [day[slot].meal!] : []));
}
function sequence(day: SuggestedDay) {
  return chronologicalStops(day);
}

function scoreDays(
  id: string,
  plan: SearchPlan,
  days: SuggestedDay[],
  rules: {
    fullMealDays: number[];
    forbidIds?: string[];
    requireIds?: string[];
    phrases?: string[];
    allowEmptyVisitDays?: number[];
  },
): HoldoutResult {
  const failures: string[] = [];
  const start = Date.parse(`${plan.dates.start}T00:00:00Z`);
  const end = Date.parse(`${plan.dates.end}T00:00:00Z`);
  const tripDays =
    Number.isFinite(start) && Number.isFinite(end) && end >= start
      ? Math.round((end - start) / 86400000) + 1
      : 0;
  const expected = calendar(plan.dates.start, tripDays);
  if (days.length !== expected.length)
    failures.push(`${id}:day_count:${days.length}/${expected.length}`);
  const limit = PACE[plan.activityCriteria.pacePreference];
  const scheduled = days.flatMap(visitsOf);
  for (const [index, day] of days.entries()) {
    if (day.dayNumber !== index + 1 || day.date !== expected[index])
      failures.push(`${id}:day_label:${day.date}`);
    const claimed = /^Day (\d+)\b/.exec(day.title);
    if (!claimed || Number(claimed[1]) !== day.dayNumber)
      failures.push(`${id}:day_title:${day.title}`);
    if (day.summary.startsWith("Backup draft:"))
      failures.push(`${id}:fallback_day:${day.date}`);
    if (index > 0 && day.transport)
      failures.push(`${id}:transport_after_day_one:${day.date}`);
    const visits = visitsOf(day);
    const meals = mealsOf(day);
    for (const item of [...visits, ...meals])
      if (item.planningIdea) failures.push(`${id}:placeholder:${item.id}`);
    if (
      !visits.length &&
      !rules.allowEmptyVisitDays?.includes(index) &&
      !day.tips.some((tip) => tip.includes("No suitable unused visits"))
    )
      failures.push(`${id}:silent_empty_day:${day.date}`);
    if (visits.length > limit.count)
      failures.push(`${id}:pace_count:${day.date}`);
    const minutes = visits.reduce((sum, visit) => sum + visit.duration, 0);
    if (minutes > limit.minutes)
      failures.push(`${id}:pace_minutes:${day.date}`);
    if (rules.fullMealDays.includes(index)) {
      for (const slot of SLOTS)
        if (!day[slot].meal || day[slot].meal.planningIdea)
          failures.push(`${id}:meal_gap:${day.date}:${slot}`);
    }
    for (const meal of meals) {
      if (meal.dietaryOptions?.length)
        failures.push(`${id}:dietary_claim:${meal.id}`);
      if (
        DIET_CLAIM.test(meal.description ?? "") ||
        DIET_CLAIM.test(meal.name ?? "") ||
        (meal.cuisineTypes ?? []).some((item) => DIET_CLAIM.test(item))
      )
        failures.push(`${id}:dietary_prose:${meal.id}`);
    }
    for (const visit of visits) {
      if (
        (visit.proposedVisitType === "guided_tour" ||
          visit.proposedVisitType === "event") &&
        !visit.affiliatePartner
      )
        failures.push(`${id}:invented_bookable:${visit.id}`);
      if (visit.supplierCatalogOnly) {
        if (!visit.affiliatePartner)
          failures.push(`${id}:catalog_without_supplier:${visit.id}`);
        if (!day.tips.some((tip) => tip.includes("catalog suggestion only")))
          failures.push(`${id}:catalog_undisclosed:${visit.id}`);
      }
      if (
        (visit.price ?? 0) <= 0 &&
        visit.priceStatus !== "unknown" &&
        visit.priceStatus !== "estimate"
      )
        failures.push(`${id}:price_presented_as_free:${visit.id}`);
      if (
        ACCESS_PROMISE.test(visit.description ?? "") ||
        ACCESS_PROMISE.test(visit.name ?? "") ||
        (visit.vibeMatch ?? []).some((label) => ACCESS_PROMISE.test(label))
      )
        failures.push(`${id}:access_claim:${visit.id}`);
      if (visit.affiliateUrl && !visit.affiliateUrl.startsWith("https://"))
        failures.push(`${id}:affiliate_url:${visit.id}`);
    }
    for (let cursor = 1; cursor < sequence(day).length; cursor++) {
      const prior = sequence(day)[cursor - 1];
      const next = sequence(day)[cursor];
      const distance = suppliedDistanceKm(prior.location, next.location);
      if (distance == null || !transferExceedsPlanningBuffer(distance))
        continue;
      const disclosed = day.tips.some(
        (tip) =>
          tip.includes(`${distance.toFixed(1)} km`) &&
          tip.includes("30-minute planning buffer"),
      );
      if (!disclosed)
        failures.push(
          `${id}:transfer:${prior.name}:${next.name}:${distance.toFixed(1)}`,
        );
    }
    if (day.timingProposal && day.timingProposal.fitsPolicy === false)
      failures.push(`${id}:timing_conflict:${day.date}`);
  }
  for (const forbidden of rules.forbidIds ?? [])
    if (scheduled.some((visit) => visit.id === forbidden))
      failures.push(`${id}:scheduled_forbidden:${forbidden}`);
  for (const required of rules.requireIds ?? [])
    if (!scheduled.some((visit) => visit.id === required))
      failures.push(`${id}:missing_required:${required}`);
  const tips = days.flatMap((day) => day.tips).join(" ");
  for (const phrase of rules.phrases ?? [])
    if (!tips.includes(phrase))
      failures.push(`${id}:requirement_dropped:${phrase}`);
  return { id, kind: "planner", accepted: failures.length === 0, failures };
}

function tokyo(): HoldoutResult {
  const plan = searchPlan({
    destination: "Tokyo",
    country: "Japan",
    dates: { start: "2027-04-06", end: "2027-04-08", nights: 2 },
    pace: "moderate",
    travelers: 1,
    adults: 1,
  });
  const base = { lat: 35.7148, lng: 139.7967 };
  const spot = (index: number) => ({
    lat: base.lat + index * 0.002,
    lng: base.lng + (index % 2) * 0.001,
  });
  const activities = [
    ...[0, 1, 2, 3, 4, 5].map((index) =>
      activity(
        `tokyo-visit-${index}`,
        `Asakusa stop ${index}`,
        spot(index).lat,
        spot(index).lng,
        {
          duration: 90,
        },
      ),
    ),
    activity(
      "tokyo-invented-tour",
      "Small group Tokyo food tour",
      base.lat,
      base.lng,
      {
        proposedVisitType: "guided_tour",
        duration: 90,
        vibeScore: 99,
        description: "An organized bookable tour with no supplier record.",
      },
    ),
    activity(
      "tokyo-catalog",
      "Recorded Senso-ji district walk",
      spot(1).lat,
      spot(1).lng,
      {
        supplierCatalogOnly: true,
        affiliatePartner: "viator",
        affiliateUrl: "https://www.viator.com/tours/Tokyo/recorded",
        duration: 90,
        vibeScore: 95,
        price: 40,
        currency: "USD",
        priceStatus: undefined,
      },
    ),
    activity("tokyo-idea", "Neighborhood wander", base.lat, base.lng, {
      planningIdea: true,
      duration: 60,
    }),
  ];
  const dining = (["breakfast", "lunch", "dinner"] as const).map(
    (type, index) =>
      meal(
        `tokyo-${type}`,
        `Asakusa ${type}`,
        spot(index).lat,
        spot(index).lng,
        [type],
        {
          ...(type === "breakfast"
            ? {
                dietaryOptions: ["gluten-free"],
                description:
                  "This kitchen is gluten-free certified for every guest.",
              }
            : {}),
        },
      ),
  );
  const compiled = compileSchedule(plan, activities, dining, [], {
    maxUnverifiedTransferKm: 6,
    maxUnverifiedMealDistanceKm: 3,
  });
  return scoreDays("tokyo-balanced", plan, compiled.days, {
    fullMealDays: [0, 1, 2],
    forbidIds: ["tokyo-invented-tour", "tokyo-idea"],
    requireIds: ["tokyo-catalog"],
  });
}

function lisbon(): HoldoutResult {
  const plan = searchPlan({
    destination: "Lisbon",
    country: "Portugal",
    dates: { start: "2027-05-10", end: "2027-05-11", nights: 1 },
    pace: "relaxed",
    travelers: 2,
    adults: 2,
    mobilityNeeds: "step-free",
    dietaryRestrictions: ["gluten-free"],
    requirements: {
      allergies: ["peanuts"],
      dietaryPreferences: ["gluten-free"],
      accessibility: ["step_free_entrance"],
      mobilityNotes: "",
    },
  });
  const lat = 38.7139;
  const lng = -9.1334;
  const activities = [
    activity("lisbon-garden", "Jardim da Estrela walk", lat, lng, {
      duration: 60,
      description:
        "The garden is wheelchair accessible and step-free throughout.",
      vibeMatch: ["wheelchair accessible"],
    }),
    activity(
      "lisbon-miradouro",
      "Miradouro de Santa Catarina",
      lat + 0.003,
      lng,
      {
        duration: 60,
      },
    ),
    activity("lisbon-stairs", "Castle bunker", lat, lng, {
      duration: 90,
      vibeScore: 99,
      description:
        "While it has some stairs, this is a great historical visit.",
    }),
    activity("lisbon-boat", "Lisbon canal cruise", lat, lng, {
      duration: 60,
      vibeScore: 98,
    }),
  ];
  const dining = (["breakfast", "lunch", "dinner"] as const).map((type) =>
    meal(`lisbon-${type}`, `Alfama ${type}`, lat, lng, [type], {
      ...(type === "dinner"
        ? {
            description:
              "The menu is peanut-free and safe for peanut allergies.",
            dietaryOptions: ["nut-free"],
          }
        : {}),
    }),
  );
  const compiled = compileSchedule(plan, activities, dining, [], {
    maxUnverifiedTransferKm: 6,
    maxUnverifiedMealDistanceKm: 3,
  });
  return scoreDays("lisbon-step-free", plan, compiled.days, {
    fullMealDays: [0, 1],
    forbidIds: ["lisbon-stairs", "lisbon-boat"],
    requireIds: ["lisbon-garden"],
    phrases: ["peanuts", "gluten-free", "step free entrance"],
  });
}

function mexicoCity(): HoldoutResult {
  const plan = searchPlan({
    destination: "Mexico City",
    country: "Mexico",
    dates: { start: "2027-06-01", end: "2027-06-02", nights: 1 },
    pace: "moderate",
    travelers: 3,
    adults: 2,
    children: 1,
  });
  const lat = 19.4326;
  const lng = -99.1332;
  const activities = [
    activity("cdmx-park", "Chapultepec park walk", lat, lng, { duration: 90 }),
    activity("cdmx-museum", "Anthropology museum", lat + 0.002, lng, {
      duration: 120,
    }),
    activity(
      "cdmx-market",
      "Roma neighborhood market",
      lat + 0.001,
      lng + 0.001,
      {
        duration: 60,
      },
    ),
    activity("cdmx-center", "Zocalo exterior walk", lat + 0.003, lng - 0.001, {
      duration: 60,
    }),
    activity("cdmx-wine", "Wine tasting experience", lat, lng, {
      duration: 90,
      vibeScore: 100,
    }),
  ];
  const dining = (["breakfast", "lunch", "dinner"] as const).map(
    (type, index) =>
      meal(`cdmx-${type}`, `Roma ${type}`, lat + index * 0.001, lng, [type]),
  );
  const compiled = compileSchedule(plan, activities, dining, [], {
    maxUnverifiedTransferKm: 6,
    maxUnverifiedMealDistanceKm: 3,
  });
  return scoreDays("mexico-city-family", plan, compiled.days, {
    fullMealDays: [0, 1],
    forbidIds: ["cdmx-wine"],
  });
}

function edinburgh(): HoldoutResult {
  const plan = searchPlan({
    destination: "Edinburgh",
    country: "United Kingdom",
    dates: { start: "2027-07-12", end: "2027-07-12", nights: 0 },
    pace: "moderate",
    mobilityNeeds: "only use public transport",
    requirements: {
      allergies: [],
      dietaryPreferences: [],
      accessibility: [],
      mobilityNotes: "public transport only",
    },
  });
  const activities = [
    activity("edi-mile", "Royal Mile close", 55.9502, -3.1875, {
      duration: 60,
      bestTimeOfDay: "morning",
    }),
    activity("edi-holyrood", "Holyrood park edge", 55.9722, -3.1875, {
      duration: 60,
      bestTimeOfDay: "morning",
    }),
    activity(
      "edi-car",
      "Private car tour of the Royal Mile",
      55.9502,
      -3.1875,
      {
        duration: 60,
        vibeScore: 100,
      },
    ),
  ];
  const dining = [
    meal("edi-breakfast", "Mile breakfast", 55.9612, -3.1875, ["breakfast"]),
    meal("edi-lunch", "Holyrood lunch", 55.9612, -3.1875, ["lunch"]),
    meal("edi-dinner", "Holyrood dinner", 55.9612, -3.1875, ["dinner"]),
  ];
  const compiled = compileSchedule(plan, activities, dining, [], {
    maxUnverifiedTransferKm: 6,
    maxUnverifiedMealDistanceKm: 3,
  });
  return scoreDays("edinburgh-transit", plan, compiled.days, {
    fullMealDays: [0],
    forbidIds: ["edi-car"],
    requireIds: ["edi-mile", "edi-holyrood"],
    phrases: ["public transport"],
  });
}

function oaxaca(): HoldoutResult {
  const plan = searchPlan({
    destination: "Oaxaca",
    country: "Mexico",
    dates: { start: "2027-08-03", end: "2027-08-04", nights: 1 },
    pace: "relaxed",
    requirements: {
      allergies: [],
      dietaryPreferences: ["vegan"],
      accessibility: [],
      mobilityNotes: "",
    },
  });
  const lat = 17.0732;
  const lng = -96.7266;
  const activities = [
    activity("oaxaca-market", "Benito Juarez market walk", lat, lng, {
      duration: 60,
    }),
    activity("oaxaca-temple", "Santo Domingo exterior", lat + 0.002, lng, {
      duration: 60,
    }),
    activity(
      "oaxaca-ethnobotanical",
      "Ethnobotanical garden",
      lat + 0.001,
      lng + 0.001,
      {
        duration: 90,
      },
    ),
    activity("oaxaca-llano", "Llano park", lat + 0.003, lng, { duration: 60 }),
  ];
  const dining = (["breakfast", "lunch", "dinner"] as const).map((type) =>
    meal(`oaxaca-${type}`, `Centro ${type}`, lat, lng, [type], {
      ...(type === "lunch"
        ? {
            dietaryOptions: ["vegan"],
            description: "The lunch menu is certified vegan and gluten-free.",
          }
        : {}),
    }),
  );
  const compiled = compileSchedule(plan, activities, dining, [], {
    maxUnverifiedTransferKm: 6,
    maxUnverifiedMealDistanceKm: 3,
  });
  return scoreDays("oaxaca-vegan", plan, compiled.days, {
    fullMealDays: [0, 1],
    phrases: ["Dietary preferences: vegan"],
  });
}

function singapore(): HoldoutResult {
  const plan = searchPlan({
    destination: "Singapore",
    country: "Singapore",
    dates: { start: "2027-09-14", end: "2027-09-15", nights: 1 },
    pace: "moderate",
    mobilityNeeds: "arrival on the first day at 18:00",
  });
  const lat = 1.3521;
  const lng = 103.8198;
  const activities = [
    activity("sg-evening", "Gardens by the Bay evening walk", lat, lng, {
      duration: 60,
      bestTimeOfDay: "evening",
    }),
    activity("sg-morning", "Chinatown morning walk", lat + 0.002, lng, {
      duration: 60,
      bestTimeOfDay: "morning",
    }),
    activity("sg-museum", "National Gallery visit", lat + 0.001, lng + 0.001, {
      duration: 90,
    }),
    activity("sg-idea", "Generic neighborhood idea", lat, lng, {
      planningIdea: true,
    }),
  ];
  const dining = (["breakfast", "lunch", "dinner"] as const).map((type) =>
    meal(`sg-${type}`, `Marina ${type}`, lat, lng, [type]),
  );
  const compiled = compileSchedule(plan, activities, dining, [], {
    maxUnverifiedTransferKm: 6,
    maxUnverifiedMealDistanceKm: 3,
  });
  const scored = scoreDays("singapore-arrival", plan, compiled.days, {
    fullMealDays: [1],
    allowEmptyVisitDays: [0],
    forbidIds: ["sg-idea"],
  });
  const first = compiled.days[0];
  if (first.morning.activities.length || first.afternoon.activities.length)
    scored.failures.push("singapore-arrival:arrival_day_overfilled");
  if (first.morning.meal || first.afternoon.meal)
    scored.failures.push("singapore-arrival:arrival_meals_invented");
  if (!first.evening.meal)
    scored.failures.push("singapore-arrival:arrival_dinner_missing");
  scored.accepted = scored.failures.length === 0;
  return scored;
}

async function lisbonRepair(): Promise<HoldoutResult> {
  const plan = searchPlan({
    destination: "Lisbon",
    country: "Portugal",
    dates: { start: "2027-05-18", end: "2027-05-18", nights: 0 },
    pace: "relaxed",
  });
  const lat = 38.712;
  const lng = -9.14;
  const activities = [
    activity("repair-view", "Alfama viewpoint", lat, lng, { duration: 60 }),
  ];
  const existing = [
    meal("repair-lunch", "Alfama lunch", lat, lng, ["lunch"]),
    meal("repair-dinner", "Alfama dinner", lat, lng, ["dinner"]),
  ];
  const discovered = meal("repair-breakfast", "Alfama breakfast", lat, lng, [
    "breakfast",
  ]);
  const repaired = await repairDiningInventory(
    existing,
    (inventory) =>
      compileSchedule(plan, activities, inventory, [], {
        maxUnverifiedTransferKm: 6,
        maxUnverifiedMealDistanceKm: 3,
      }),
    async () => [
      discovered,
      { ...discovered, id: "repair-idea", planningIdea: true },
    ],
  );
  const scored = scoreDays("lisbon-meal-repair", plan, repaired.compiled.days, {
    fullMealDays: [0],
    requireIds: ["repair-view"],
    forbidIds: ["repair-idea"],
  });
  if (repaired.compiled.days[0].morning.meal?.planningIdea)
    scored.failures.push("lisbon-meal-repair:placeholder_breakfast");
  scored.accepted = scored.failures.length === 0;
  return scored;
}

function kyotoAdmission(): HoldoutResult {
  const plan = searchPlan({
    destination: "Kyoto",
    country: "Japan",
    dates: { start: "2027-04-07", end: "2027-04-07", nights: 0 },
    pace: "relaxed",
    mobilityNeeds: "no starts before 11:00",
  });
  const address = "527 Chayacho, Kyoto recorded fixture";
  const museum = activity(
    "kyoto-museum",
    "Kyoto National Museum",
    35.0116,
    135.7717,
    {
      duration: 90,
      bestTimeOfDay: "afternoon",
      location: {
        name: "Kyoto National Museum",
        address,
        lat: 35.0116,
        lng: 135.7717,
      },
    },
  );
  const walk = activity(
    "kyoto-walk",
    "Philosopher path walk",
    35.026,
    135.798,
    {
      duration: 60,
      bestTimeOfDay: "afternoon",
    },
  );
  const asOf = "2026-11-01";
  const fact: ReviewedVenueHours = {
    id: "kyoto-museum-hours",
    destination: "Kyoto",
    aliases: ["Kyoto National Museum"],
    addresses: [address],
    sourceUrl: "https://www.kyoto-museums.example/hours",
    sourceSha256: createHash("sha256")
      .update("kyoto-museum-hours")
      .digest("hex"),
    observedAt: "2026-10-01",
    reviewAfter: "2027-10-01",
    branchReview: "Ordinary published hours for this named branch only.",
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    visitTypes: ["ordinary_entry"],
    week: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      intervals: [[540, 1020]] as Array<[number, number]>,
      lastEntryMinute: 660,
    })),
  };
  const dates = ["2027-04-07"];
  const exclusions = reviewedHoursExclusions(
    plan,
    [museum, walk],
    dates,
    [fact],
    asOf,
  );
  const windows = reviewedVisitWindows(
    "Kyoto",
    [museum, walk],
    dates,
    [fact],
    asOf,
  );
  const compiled = compileSchedule(
    plan,
    [museum, walk],
    [
      meal("kyoto-breakfast", "Kyoto breakfast", 35.026, 135.798, [
        "breakfast",
      ]),
      meal("kyoto-lunch", "Kyoto lunch", 35.026, 135.798, ["lunch"]),
      meal("kyoto-dinner", "Kyoto dinner", 35.026, 135.798, ["dinner"]),
    ],
    exclusions,
    {
      maxUnverifiedTransferKm: 6,
      maxUnverifiedMealDistanceKm: 3,
      visitWindows: windows,
    },
  );
  const scored = scoreDays("kyoto-last-admission", plan, compiled.days, {
    fullMealDays: [],
    forbidIds: ["kyoto-museum"],
    requireIds: ["kyoto-walk"],
  });
  if (compiled.days[0].morning.meal)
    scored.failures.push("kyoto-last-admission:breakfast_outside_window");
  if (!exclusions.some((item) => item.activityId === museum.id))
    scored.failures.push("kyoto-last-admission:hours_not_applied");
  const proposed = compiled.timingProposals.flatMap(
    (proposal) => proposal.events,
  );
  if (
    proposed.some(
      (event) =>
        event.id === `activity:${museum.id}` && event.startMinute > 660,
    )
  )
    scored.failures.push("kyoto-last-admission:starts_after_last_entry");
  scored.accepted = scored.failures.length === 0;
  return scored;
}

function aggregatorLabels(): HoldoutResult {
  const start = "2027-05-02";
  const flight: TransportResult = {
    id: "flight-1",
    type: "flight",
    provider: "recorded",
    departure: {
      airport: "SFO",
      city: "San Francisco",
      dateTime: `${start}T16:00:00Z`,
    },
    arrival: {
      airport: "NRT",
      city: "Tokyo",
      dateTime: "2027-05-03T20:00:00Z",
    },
    duration: 660,
    stops: 0,
    price: 900,
    currency: "USD",
    airlines: ["Recorded"],
    segments: [],
    affiliateUrl: "https://example.test/outbound",
    affiliatePartner: "recorded",
    source: "duffel",
    vibeScore: 0,
    vibeMatch: [],
  };
  const blank = (
    index: number,
    title: string,
    date: string,
    transportId?: string,
  ) => ({
    dayNumber: index === 2 ? 1 : index + 1,
    date,
    title,
    summary: "Recorded model day",
    morning: { activityIds: [] as string[] },
    afternoon: { activityIds: [] as string[] },
    evening: { activityIds: [] as string[] },
    transportId,
    tips: [] as string[],
  });
  const mapped = mapAggregatorResult(
    {
      days: [
        blank(0, "Day 1 in Tokyo", start, flight.id),
        blank(1, "Day 2 in Tokyo", calendar(start, 3)[1]),
        blank(2, "Day 1 in Tokyo", start, flight.id),
      ],
    },
    start,
    [],
    [],
    [],
    [flight],
  );
  const failures: string[] = [];
  const expected = calendar(start, 3);
  mapped.days.forEach((day, index) => {
    if (day.date !== expected[index] || day.dayNumber !== index + 1)
      failures.push(`aggregator-day-labels:calendar:${index}`);
    const claimed = /^Day (\d+)\b/.exec(day.title);
    if (claimed && Number(claimed[1]) !== index + 1)
      failures.push(`aggregator-day-labels:title:${day.title}`);
    if (index > 0 && day.transport)
      failures.push("aggregator-day-labels:repeated_outbound");
  });
  if (mapped.days[0].transport?.id !== flight.id)
    failures.push("aggregator-day-labels:missing_outbound");
  return {
    id: "aggregator-day-labels",
    kind: "planner",
    accepted: failures.length === 0,
    failures,
  };
}

function supplierCases(): HoldoutResult[] {
  const relaxed = searchPlan({
    destination: "Tokyo",
    country: "Japan",
    dates: { start: "2027-04-06", end: "2027-04-08", nights: 2 },
    pace: "relaxed",
    activityCriteria: {
      categories: [],
      pacePreference: "relaxed",
      mustSee: [],
      interests: ["food"],
    },
    vibeInterpretation: {
      vibes: ["food"],
      searchKeywords: [],
      avoidKeywords: [],
    },
  });
  const nature = searchPlan({
    destination: "Hakone",
    country: relaxed.country,
    dates: relaxed.dates,
    pace: "relaxed",
    activityCriteria: {
      categories: [],
      pacePreference: "relaxed",
      mustSee: ["Mount Fuji day trip"],
      interests: ["nature"],
    },
    vibeInterpretation: {
      vibes: ["nature"],
      searchKeywords: [],
      avoidKeywords: [],
    },
  });
  const failures: string[] = [];
  if (supplierDurationCeilingMinutes(relaxed) !== 180)
    failures.push("supplier-duration:relaxed");
  if (
    supplierDurationCeilingMinutes({
      ...relaxed,
      activityCriteria: {
        ...relaxed.activityCriteria,
        pacePreference: "packed",
      },
    }) !== 360
  )
    failures.push("supplier-duration:packed");
  if (supplierDurationCeilingMinutes(nature) !== undefined)
    failures.push("supplier-duration:day_trip");
  const recorded = [
    { id: "fuji", duration: 600 },
    { id: "walk", duration: 120 },
  ];
  const ceiling = supplierDurationCeilingMinutes(relaxed);
  const admitted = recorded.filter(
    (product) => ceiling === undefined || product.duration <= ceiling,
  );
  if (admitted.map((product) => product.id).join() !== "walk")
    failures.push("supplier-duration:recorded_filter");
  const catalog = recoverSupplierSearch(
    { status: "timeout" as const, dated: true },
    {
      status: "products" as const,
      products: [{ id: "real", catalogOnly: undefined }],
    },
  );
  if (!catalog.usedCatalogFallback || catalog.products[0]?.catalogOnly !== true)
    failures.push("supplier-recovery:timeout");
  for (const primary of [
    { status: "empty" as const },
    { status: "error" as const },
    { status: "timeout" as const, dated: false },
    {
      status: "products" as const,
      products: [] as Array<{ id: string; catalogOnly?: true }>,
    },
  ]) {
    const result = recoverSupplierSearch(primary, {
      status: "products",
      products: [{ id: "should-not-enter" }],
    });
    if (result.usedCatalogFallback || result.products.length)
      failures.push(`supplier-recovery:leaked:${primary.status}`);
  }
  return [
    {
      id: "recorded-supplier-decisions",
      kind: "supplier",
      accepted: failures.length === 0,
      failures,
    },
  ];
}

function negativeControls(): HoldoutResult[] {
  const plan = searchPlan({
    destination: "Lisbon",
    country: "Portugal",
    dates: { start: "2027-05-10", end: "2027-05-10", nights: 0 },
    pace: "relaxed",
  });
  const fallback = createFallbackItinerary(
    plan,
    [],
    [
      activity("fb-idea", "Generic sight", 38.71, -9.14, {
        planningIdea: true,
      }),
    ],
    [
      meal(
        "fb-meal",
        "Breakfast in the neighborhood",
        38.71,
        -9.14,
        ["breakfast"],
        { planningIdea: true },
      ),
    ],
  );
  const fallbackScore = scoreDays("control-fallback", plan, fallback.days, {
    fullMealDays: [0],
  });
  fallbackScore.kind = "control";
  fallbackScore.accepted = fallbackScore.failures.some(
    (failure) =>
      failure.includes("fallback_day") || failure.includes("placeholder"),
  );
  if (!fallbackScore.accepted)
    fallbackScore.failures.push("control-fallback:rubric_missed_backup_draft");

  const conflict = structuredClone(fallback.days);
  conflict[0].summary = "A real day";
  conflict[0].title = "Day 1 · 2027-05-10 in Lisbon";
  conflict[0].timingProposal = {
    policy: "day-timing-v1",
    basis: "control",
    fitsPolicy: false,
    verified: false,
    events: [],
    conflict: { eventId: "control", overrunMinutes: 30 },
  };
  const conflictScore = scoreDays("control-timing", plan, conflict, {
    fullMealDays: [],
    allowEmptyVisitDays: [0],
  });
  conflictScore.kind = "control";
  conflictScore.accepted = conflictScore.failures.some((failure) =>
    failure.includes("timing_conflict"),
  );

  const mislabeled = structuredClone(fallback.days);
  mislabeled[0].summary =
    "Suggested visits: a museum. Keep the remaining time flexible.";
  mislabeled[0].title = "Day 4 in Lisbon";
  mislabeled[0].dayNumber = 1;
  const labelScore = scoreDays("control-day-label", plan, mislabeled, {
    fullMealDays: [],
    allowEmptyVisitDays: [0],
  });
  labelScore.kind = "control";
  labelScore.accepted = labelScore.failures.some(
    (failure) =>
      failure.includes("day_title") || failure.includes("fallback_day"),
  );
  const truncated = scoreDays(
    "control-truncated",
    searchPlan({
      destination: "Lisbon",
      country: "Portugal",
      dates: { start: "2027-05-10", end: "2027-05-12", nights: 2 },
      pace: "relaxed",
    }),
    fallback.days,
    { fullMealDays: [], allowEmptyVisitDays: [0] },
  );
  truncated.kind = "control";
  truncated.accepted = truncated.failures.some((failure) =>
    failure.includes("day_count"),
  );
  return [fallbackScore, conflictScore, labelScore, truncated];
}

export async function runTravelerHoldout() {
  const planner = [
    tokyo(),
    lisbon(),
    mexicoCity(),
    edinburgh(),
    oaxaca(),
    singapore(),
    await lisbonRepair(),
    kyotoAdmission(),
    aggregatorLabels(),
  ];
  const supplier = supplierCases();
  const controls = negativeControls();
  const plannerAccepted = planner.filter((item) => item.accepted).length;
  const controlsDetected = controls.filter((item) => item.accepted).length;
  return {
    mode: "offline traveler holdout; fixtures and recorded supplier decisions only",
    live_model_quality_measured: false,
    planner_cases: planner.length,
    planner_accepted: plannerAccepted,
    planner_failed: planner.length - plannerAccepted,
    negative_controls: controls.length,
    negative_controls_detected: controlsDetected,
    supplier_accepted: supplier.filter((item) => item.accepted).length,
    accepted:
      plannerAccepted === planner.length &&
      controlsDetected === controls.length &&
      supplier.every((item) => item.accepted),
    results: [...planner, ...supplier, ...controls],
  };
}
