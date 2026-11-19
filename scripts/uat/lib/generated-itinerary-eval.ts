/**
 * Grades itineraries the planner actually built for development briefs.
 * Supplier rows are recorded stand-ins with the same shape as a search result.
 * Holdout briefs are not loaded.
 */
import type {
  ActivityResult,
  DiningResult,
  SearchPlan,
} from "../../../apps/web/lib/search/types";
import { compileSchedule } from "../../../apps/web/lib/search/schedule-compiler";
import { mapAggregatorResult } from "../../../apps/web/lib/search/agents/aggregator";
import { accessRequested } from "../../../apps/web/lib/search/requirement-corroboration";
import {
  bookableAffiliate,
  calendarDates,
  enforceReleaseItinerary,
  hazardTokens,
  scheduledStopPrice,
  scheduledStopTags,
  seasonMonths,
  tripActivityBudget,
  tripCity,
  tripMonth,
} from "../../../apps/web/lib/search/release-itinerary";
import type { UatBrief } from "./briefs";
import { DEVELOPMENT_BRIEFS } from "./eval-briefs";
import {
  gradeItinerary,
  type AffiliateScores,
  type DimensionScores,
  type GradeBrief,
  type GradeDay,
  type GradeStop,
  type ItineraryGrade,
} from "./itinerary-rubric";

const ALCOHOL =
  /\b(?:wine tasting|cocktail|bar crawl|nightlife|pub crawl|nightclub)\b/i;
const STAIRS =
  /\b(?:flights? of stairs|many stairs|steep stairs|has (?:some |several |many )?stairs)\b/i;

type DimensionKey = keyof DimensionScores;

const DIMENSIONS: DimensionKey[] = [
  "grounding",
  "preference_fit",
  "feasibility",
  "specificity",
  "diversity",
  "safety_claims",
];

export interface GeneratedPathScore {
  dimensions: DimensionScores;
  affiliate: AffiliateScores;
}

export interface GeneratedItineraryReport {
  briefs: number;
  holdout_used: false;
  before: { compiler: GeneratedPathScore; model: GeneratedPathScore };
  after: { compiler: GeneratedPathScore; model: GeneratedPathScore };
  empty_search: {
    grounding: number;
    stops: number;
    honest: boolean;
  };
  failures_after: string[];
  accepted: boolean;
}

interface Catalog {
  plan: SearchPlan;
  activities: ActivityResult[];
  dining: DiningResult[];
  budget: number;
}

function hash(value: string): number {
  let h = 2166136261;
  for (const char of value) h = Math.imul(h ^ char.charCodeAt(0), 16777619);
  return h >>> 0;
}

function concrete(name: string, city: string, minutes: number): string {
  return `Spend about ${minutes} minutes at ${name} in ${city}. Confirm the day's hours before you go.`;
}

function activity(
  id: string,
  name: string,
  city: string,
  lat: number,
  lng: number,
  extra: Partial<ActivityResult> = {},
): ActivityResult {
  const duration = extra.duration ?? 90;
  return {
    id,
    name,
    description: extra.description ?? concrete(name, city, duration),
    category: extra.category ?? "sightseeing",
    duration,
    price: extra.price ?? 0,
    currency: "USD",
    priceStatus: (extra.price ?? 0) > 0 ? "estimate" : "unknown",
    rating: 0,
    reviewCount: 0,
    location: {
      name: city,
      address: `${name}, ${city}`,
      lat,
      lng,
      neighborhood: city,
    },
    images: [],
    bestTimeOfDay: extra.bestTimeOfDay ?? "any",
    vibeScore: extra.vibeScore ?? 70,
    vibeMatch: extra.vibeMatch ?? [],
    bookingRequired: Boolean(extra.affiliateUrl),
    affiliatePartner: extra.affiliatePartner,
    affiliateUrl: extra.affiliateUrl,
  };
}

function meal(
  id: string,
  name: string,
  city: string,
  lat: number,
  lng: number,
  mealTypes: DiningResult["mealTypes"],
  cuisine: string,
): DiningResult {
  return {
    id,
    name,
    description: concrete(name, city, 60),
    cuisineTypes: [cuisine],
    priceLevel: 1,
    priceStatus: "estimate",
    rating: 0,
    reviewCount: 0,
    location: { name: city, address: `${name}, ${city}`, lat, lng },
    images: [],
    mealTypes,
    vibeScore: 60,
    vibeMatch: [cuisine],
    dietaryOptions: [],
  };
}

export function catalogForBrief(brief: UatBrief): Catalog {
  const city = tripCity(brief.destination);
  const country = brief.destination.split(",")[1]?.trim() || city;
  const dates = calendarDates(brief.startDate, brief.endDate);
  const budget =
    tripActivityBudget(brief.budget, brief.startDate, brief.endDate) ?? 0;
  const origin = hash(city);
  const baseLat = (origin % 5000) / 100 - 20;
  const baseLng = ((origin >>> 10) % 10000) / 100 - 50;
  const interests = brief.interests.filter((interest) => interest.trim());
  const activities: ActivityResult[] = interests
    .slice(0, 3)
    .map((interest, index) => {
      const name = `${city} ${interest} visit`;
      const row = activity(
        `${brief.id}-${interest}`,
        name,
        city,
        baseLat + index * 0.008,
        baseLng + index * 0.008,
        {
          category: interest,
          vibeMatch: [interest],
          price: 20,
          vibeScore: 80,
        },
      );
      if (index === 0) {
        const productId = String(10000 + (hash(brief.id) % 80000));
        row.affiliatePartner = "getyourguide";
        row.affiliateUrl = `https://www.getyourguide.com/activity-t${productId}/?partner_id=devpartner&cmp=recorded`;
        row.bookingRequired = true;
        row.price = 40;
      }
      return row;
    });
  const notice = (
    id: string,
    name: string,
    lat: number,
    lng: number,
    extra: Partial<ActivityResult> = {},
  ) =>
    activity(`${brief.id}-${id}`, name, city, lat, lng, {
      category: "notice",
      vibeScore: 10,
      ...extra,
    });
  activities.push(
    notice("generic", `${city} open hours board`, baseLat, baseLng, {
      description:
        "A wonderful day to look around the area and see the sights with a local favorite.",
      vibeScore: 99,
    }),
    notice("far", `${city} far ridge lookout`, baseLat + 2, baseLng, {
      vibeScore: 98,
    }),
    notice("price", `${city} private charter desk`, baseLat, baseLng, {
      price: budget + 500,
      vibeScore: 97,
    }),
    notice("ski", "Winter ski day", baseLat + 2, baseLng + 2, {
      description: concrete("Winter ski day", city, 90),
      vibeScore: 96,
    }),
    notice("link", `${city} broken link desk`, baseLat, baseLng, {
      affiliatePartner: "getyourguide",
      affiliateUrl: "http://getyourguide.com/activity-t1/?partner_id=",
      vibeScore: 95,
    }),
  );
  if (interests[0]) {
    activities.push(
      notice(
        "copy",
        `${city} ${interests[0]} visit`,
        baseLat + 0.004,
        baseLng,
        {
          category: interests[0],
          vibeMatch: [interests[0]],
          vibeScore: 40,
        },
      ),
    );
  }
  if ((brief.children ?? 0) > 0) {
    activities.push(
      notice("bar", `${city} cocktail bar crawl`, baseLat, baseLng, {
        vibeScore: 94,
      }),
    );
  }
  if (
    brief.requirements?.accessibility?.includes("step_free_entrance") ||
    /step[- ]free|wheelchair|stroller/i.test(brief.mobilityNeeds ?? "")
  ) {
    activities.push(
      notice("stairs", `${city} hill gate`, baseLat, baseLng, {
        description:
          "The entrance has several stairs before the ticket window. Allow 60 minutes and confirm the day's hours before you go.",
        vibeScore: 93,
      }),
    );
  }
  const hazard = [
    ...(brief.dietaryRestrictions ?? []),
    ...(brief.requirements?.allergies ?? []),
  ].join(" ");
  if (/\bpeanut|\bnut|\bgluten|\bshellfish|\bdairy|\bsesame/i.test(hazard)) {
    activities.push(
      notice("allergen", `${city} sauce counter`, baseLat, baseLng, {
        description:
          "The sauce counter uses crushed peanuts in the house sauce. Spend about 40 minutes and confirm the day's hours before you go.",
        vibeScore: 92,
      }),
    );
  }
  const cuisine = interests[0] ?? "food";
  const dining = (["breakfast", "lunch", "dinner"] as const).map((type) =>
    meal(
      `${brief.id}-${type}`,
      `${city} ${cuisine} ${type}`,
      city,
      baseLat + 0.002,
      baseLng + 0.002,
      [type],
      cuisine,
    ),
  );
  const plan: SearchPlan = {
    destination: brief.destination,
    country,
    dates: {
      start: brief.startDate,
      end: brief.endDate,
      nights: Math.max(0, dates.length - 1),
    },
    travelers: brief.travelers,
    adults: brief.adults,
    children: brief.children,
    childAges: brief.childAges,
    roomCount: brief.roomCount,
    travelerType: brief.travelerType,
    dietaryRestrictions: brief.dietaryRestrictions,
    mobilityNeeds: brief.mobilityNeeds,
    requirements: brief.requirements
      ? {
          allergies: brief.requirements.allergies,
          dietaryPreferences: brief.requirements.dietaryPreferences,
          accessibility: brief.requirements.accessibility as NonNullable<
            SearchPlan["requirements"]
          >["accessibility"],
          mobilityNotes: brief.requirements.mobilityNotes ?? "",
        }
      : undefined,
    searchPriorities: ["activities", "dining"],
    hotelCriteria: {
      priceRange: { min: 50, max: 200 },
      starRating: [3],
      amenities: [],
      neighborhoods: [],
    },
    activityCriteria: {
      categories: interests,
      pacePreference: "moderate",
      mustSee: [],
      interests,
    },
    diningCriteria: {
      cuisineTypes: interests,
      priceRange:
        brief.budget === "luxury"
          ? "upscale"
          : brief.budget === "budget"
            ? "budget"
            : "moderate",
      dietaryNeeds: brief.dietaryRestrictions ?? [],
      mealPriorities: ["breakfast", "lunch", "dinner"],
    },
    vibeInterpretation: {
      vibes: brief.vibes,
      searchKeywords: interests,
      avoidKeywords: (brief.children ?? 0) > 0 ? ["nightlife"] : [],
    },
  };
  return { plan, activities, dining, budget };
}

export function gradeDays(
  plan: SearchPlan,
  days: import("../../../apps/web/lib/search/types").SuggestedDay[],
  activities: ActivityResult[],
  dining: DiningResult[],
  budget: number,
): ItineraryGrade {
  const city = tripCity(plan.destination);
  const brief: GradeBrief = {
    destinations: [city],
    start: plan.dates.start,
    end: plan.dates.end,
    budget,
    preferences: plan.activityCriteria.interests ?? [],
    avoid: plan.vibeInterpretation?.avoidKeywords ?? [],
    hazards: hazardTokens(plan),
    children: plan.children ?? 0,
    requireStepFree: accessRequested(plan),
    month: tripMonth(plan.dates.start),
    inventory: [...activities, ...dining].map((item) => ({
      id: item.id,
      name: item.name,
    })),
    trustedEvidenceHosts: [],
  };
  const graded: GradeDay[] = days.map((day) => {
    const stops: GradeStop[] = [];
    const durations: number[] = [];
    const proposal = day.timingProposal?.fitsPolicy
      ? day.timingProposal
      : undefined;
    const slots = ["morning", "afternoon", "evening"] as const;
    for (const slot of slots) {
      const block = day[slot];
      const ordered =
        slot === "morning"
          ? [
              ...(block.meal
                ? [{ kind: "meal" as const, item: block.meal }]
                : []),
              ...block.activities.map((item) => ({
                kind: "activity" as const,
                item,
              })),
            ]
          : slot === "afternoon"
            ? [
                ...(block.meal
                  ? [{ kind: "meal" as const, item: block.meal }]
                  : []),
                ...block.activities.map((item) => ({
                  kind: "activity" as const,
                  item,
                })),
              ]
            : [
                ...block.activities.map((item) => ({
                  kind: "activity" as const,
                  item,
                })),
                ...(block.meal
                  ? [{ kind: "meal" as const, item: block.meal }]
                  : []),
              ];
      for (const entry of ordered) {
        const eventId =
          entry.kind === "activity"
            ? `activity:${entry.item.id}`
            : `meal:${slot}:${entry.item.id}`;
        const event = proposal?.events.find((item) => item.id === eventId);
        const minutes =
          entry.kind === "meal"
            ? slot === "morning"
              ? 45
              : 60
            : Math.max(
                30,
                Math.round((entry.item as ActivityResult).duration || 60),
              );
        const affiliate = bookableAffiliate(entry.item);
        const text = `${entry.item.name} ${entry.item.description ?? ""}`;
        const stop: GradeStop = {
          id: entry.item.id,
          name: entry.item.name,
          description: entry.item.description ?? "",
          kind: entry.kind,
          destination: city,
          lat: entry.item.location?.lat,
          lng: entry.item.location?.lng,
          startMinute: event?.startMinute,
          endMinute: event?.endMinute,
          price: scheduledStopPrice(entry.item),
          tags: scheduledStopTags(entry.item),
          seasons: seasonMonths(entry.item.name, entry.item.description ?? ""),
          stepFree: STAIRS.test(text) ? false : undefined,
          kidSuitable: ALCOHOL.test(text) ? false : undefined,
        };
        if (affiliate) {
          stop.bookable = true;
          stop.productId = affiliate.productId;
          stop.affiliatePartner = affiliate.partner;
          stop.affiliateUrl = affiliate.url;
          try {
            const parsed = new URL(affiliate.url);
            const value =
              affiliate.partner === "viator"
                ? (parsed.searchParams.get("pid") ?? "")
                : (parsed.searchParams.get("partner_id") ?? "");
            if (value) stop.expectedPartnerId = value;
          } catch {
            /* The rubric records the bad link separately. */
          }
        } else if ("affiliateUrl" in entry.item && entry.item.affiliateUrl) {
          stop.bookable = false;
          stop.affiliatePartner = entry.item.affiliatePartner;
          stop.affiliateUrl = entry.item.affiliateUrl;
          stop.productId = entry.item.id;
        }
        if (!event) {
          stop.startMinute = undefined;
          stop.endMinute = undefined;
        }
        durations.push(minutes);
        stops.push(stop);
      }
    }
    if (stops.some((stop) => stop.startMinute === undefined)) {
      let cursor = 540;
      for (let index = 0; index < stops.length; index += 1) {
        const span = durations[index] ?? 60;
        const timed = stops[index];
        if (!timed) continue;
        timed.startMinute = cursor;
        timed.endMinute = cursor + span;
        cursor = timed.endMinute + 15;
      }
    }
    return {
      date: day.date,
      destination: city,
      supplierSearch: stops.length === 0 ? "empty" : "ok",
      stops,
    };
  });
  return gradeItinerary(brief, graded);
}

function worst(grades: ItineraryGrade[]): GeneratedPathScore {
  const dimensions = {} as DimensionScores;
  for (const key of DIMENSIONS) {
    dimensions[key] =
      grades.length === 0
        ? 1
        : Math.min(...grades.map((grade) => grade.scores[key]));
  }
  const affiliate = {} as AffiliateScores;
  for (const key of Object.keys(grades[0]?.affiliate ?? {}) as Array<
    keyof AffiliateScores
  >) {
    affiliate[key] =
      grades.length === 0
        ? 1
        : Math.min(...grades.map((grade) => grade.affiliate[key]));
  }
  return { dimensions, affiliate };
}

function modelDays(catalog: Catalog) {
  const dates = calendarDates(catalog.plan.dates.start, catalog.plan.dates.end);
  return dates.map((date, index) => ({
    dayNumber: index + 1,
    date,
    title: `Day ${index + 1}`,
    summary: `Supplier results for ${tripCity(catalog.plan.destination)}.`,
    morning: {
      activityIds:
        index === 0
          ? [...catalog.activities.map((item) => item.id), "not-in-inventory"]
          : [],
      mealId:
        index === 0
          ? catalog.dining.find((item) => item.mealTypes.includes("breakfast"))
              ?.id
          : null,
    },
    afternoon: {
      activityIds: [] as string[],
      mealId: null as string | null,
    },
    evening: { activityIds: [] as string[], mealId: null as string | null },
    tips: [] as string[],
  }));
}

function passing(grade: ItineraryGrade): boolean {
  return (
    Object.values(grade.scores).every((score) => score >= 4) &&
    Object.values(grade.affiliate).every((score) => score >= 4)
  );
}

export function runGeneratedItineraryEval(
  briefs: readonly UatBrief[] = DEVELOPMENT_BRIEFS,
): GeneratedItineraryReport {
  const compilerBefore: ItineraryGrade[] = [];
  const compilerAfter: ItineraryGrade[] = [];
  const modelBefore: ItineraryGrade[] = [];
  const modelAfter: ItineraryGrade[] = [];
  const failures: string[] = [];
  for (const brief of briefs) {
    const catalog = catalogForBrief(brief);
    let compiled: ReturnType<typeof compileSchedule>;
    try {
      compiled = compileSchedule(
        catalog.plan,
        catalog.activities,
        catalog.dining,
      );
    } catch (error) {
      failures.push(
        `${brief.id}:compiler:${error instanceof Error ? error.message : "failed"}`,
      );
      continue;
    }
    const compiledGrade = gradeDays(
      catalog.plan,
      compiled.days,
      catalog.activities,
      catalog.dining,
      catalog.budget,
    );
    compilerBefore.push(compiledGrade);
    const repairedCompiler = enforceReleaseItinerary(
      catalog.plan,
      compiled.days,
      catalog.activities,
      catalog.dining,
      { activityBudget: catalog.budget },
    );
    const repairedCompilerGrade = gradeDays(
      catalog.plan,
      repairedCompiler.days,
      catalog.activities,
      catalog.dining,
      catalog.budget,
    );
    compilerAfter.push(repairedCompilerGrade);
    if (!passing(repairedCompilerGrade))
      failures.push(
        `${brief.id}:compiler:${repairedCompilerGrade.failures.join(",")}`,
      );

    const mapped = mapAggregatorResult(
      { days: modelDays(catalog) },
      catalog.plan.dates.start,
      [],
      catalog.activities,
      catalog.dining,
    );
    const mappedGrade = gradeDays(
      catalog.plan,
      mapped.days,
      catalog.activities,
      catalog.dining,
      catalog.budget,
    );
    modelBefore.push(mappedGrade);
    const repairedModel = enforceReleaseItinerary(
      catalog.plan,
      mapped.days,
      catalog.activities,
      catalog.dining,
      { activityBudget: catalog.budget },
    );
    const repairedModelGrade = gradeDays(
      catalog.plan,
      repairedModel.days,
      catalog.activities,
      catalog.dining,
      catalog.budget,
    );
    modelAfter.push(repairedModelGrade);
    if (!passing(repairedModelGrade))
      failures.push(
        `${brief.id}:model:${repairedModelGrade.failures.join(",")}`,
      );
  }

  const sample = catalogForBrief(briefs[0] ?? DEVELOPMENT_BRIEFS[0]);
  const emptyCompiled = compileSchedule(sample.plan, [], []);
  const emptyRepaired = enforceReleaseItinerary(
    sample.plan,
    emptyCompiled.days,
    [],
    [],
    { activityBudget: sample.budget },
  );
  const emptyGrade = gradeDays(
    sample.plan,
    emptyRepaired.days,
    [],
    [],
    sample.budget,
  );
  const emptyStops = emptyRepaired.days.reduce(
    (sum, day) =>
      sum +
      day.morning.activities.length +
      day.afternoon.activities.length +
      day.evening.activities.length +
      (day.morning.meal ? 1 : 0) +
      (day.afternoon.meal ? 1 : 0) +
      (day.evening.meal ? 1 : 0),
    0,
  );
  const honest = emptyStops === 0 && emptyGrade.scores.grounding === 5;
  if (!honest) failures.push("empty_search");
  const ready =
    compilerAfter.length === briefs.length &&
    modelAfter.length === briefs.length &&
    compilerAfter.every(passing) &&
    modelAfter.every(passing) &&
    honest;
  return {
    briefs: briefs.length,
    holdout_used: false,
    before: {
      compiler: worst(compilerBefore),
      model: worst(modelBefore),
    },
    after: {
      compiler: worst(compilerAfter),
      model: worst(modelAfter),
    },
    empty_search: {
      grounding: emptyGrade.scores.grounding,
      stops: emptyStops,
      honest,
    },
    failures_after: failures,
    accepted: ready,
  };
}
