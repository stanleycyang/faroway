import {
  PLANNING_MODEL,
  PLANNING_PROVIDER_OPTIONS,
} from "@/lib/ai/planning-disclosure";
/**
 * Activities Agent
 * Searches for tours, attractions, and experiences
 * Uses real activity vendors + AI for matching and ranking
 */

import { supplierDurationCeilingMinutes } from "../supplier-duration";
import { rankActivityInventory } from "../candidate-rank";
import { screenGeneratedActivityCopy } from "../generated-activity-copy";
import { activitySourceContext } from "../activity-source-context";
import { compiledScheduleExperimentEnabled } from "../schedule-experiment-gate";
import { gateway as defaultGateway, createGateway } from "@/lib/ai/sdk";
import {
  generatePlanningObject,
  logPlanningFallback,
  planningModel,
} from "@/lib/ai/planning-step";
import { z } from "zod";
import {
  canProcessViatorContent,
  isViatorContentEnabled,
} from "@/lib/affiliates/viator-policy";
import { readPrice } from "@faroway/constants";
import { SearchPlan, ActivityResult } from "../types";
import { VIBE_KEYWORDS } from "@faroway/constants";
import {
  searchViatorProducts,
  generateViatorAffiliateUrl,
  mapViatorCategoryToVibe,
  isViatorConfigured,
} from "@/lib/affiliates/viator";
import {
  searchGYGActivities,
  generateGYGAffiliateUrl,
  mapGYGCategoryToVibe,
  isGYGConfigured,
} from "@/lib/affiliates/getyourguide";
import {
  enrichWithTripAdvisor,
  isTripAdvisorConfigured,
} from "@/lib/affiliates/tripadvisor";
import {
  AI_AGENT_TIMEOUT_MS,
  allBounded,
  isOperationTimeoutError,
} from "@/lib/search/runtime";

const aiGateway = process.env.AI_GATEWAY_API_KEY
  ? createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })
  : defaultGateway;

const MODEL = PLANNING_MODEL;

const ActivitySchema = z.object({
  proposedVisitType: z
    .enum([
      "ordinary_entry",
      "exterior_walk",
      "guided_tour",
      "event",
      "unknown",
    ])
    .describe(
      "The proposed experience, not evidence that access or a booking is available.",
    ),
  name: z.string(),
  description: z.string(),
  category: z.string(),
  duration: z
    .number()
    .int()
    .min(1)
    .max(1440)
    .describe(
      "Estimated visit duration in whole MINUTES, never hours. Example: a 2.5-hour visit is 150.",
    ),
  price: z.number().optional(),
  currency: z.string().optional(),
  rating: z.number().min(0).max(5),
  reviewCount: z.number(),
  location: z.object({
    name: z.string(),
    address: z.string(),
    lat: z.number(),
    lng: z.number(),
    neighborhood: z.string().optional(),
  }),
  images: z.array(z.string()).default([]),
  affiliateUrl: z.string().optional(),
  affiliatePartner: z.string().optional(),
  bestTimeOfDay: z.enum(["morning", "afternoon", "evening", "any"]),
  vibeScore: z.number().min(0).max(100),
  vibeMatch: z.array(z.string()),
  bookingRequired: z.boolean(),
});

const ActivityListSchema = z.object({
  activities: z.array(ActivitySchema),
});

type GeneratedActivity = Omit<ActivityResult, "id" | "currency" | "price"> & {
  price?: number;
  currency?: string;
};

interface ActivityListResult {
  activities: GeneratedActivity[];
}

const SYSTEM_PROMPT = `You are a travel activities expert. Suggest real activities and attractions for the destination. Suggestions are not verified bookings; never invent an attraction, tour or event to fill the requested count.

Your role is to suggest independently visitable places and self-guided stops. Supplier APIs provide organized tours, workshops and ticketed events separately. No supplier inventory is supplied in this prompt: do not invent named food tours, bar crawls, classes, performances or other organized experiences. Prefer ordinary_entry or exterior_walk; return fewer suggestions rather than manufacture a bookable product.

Each description must say what the traveler does and name the area, in one or two concrete sentences. Do not use filler such as "Dining idea", "neighborhood spot", "hidden gem", "must-see" or "unforgettable". If you cannot name a real place, omit it.

Prefer ordinary, enduring places and experiences. Without supplied date-specific organizer evidence, omit recurring weekday events, temporary exhibitions, performances and special late openings. Do not turn an ordinary daytime venue into an evening event to satisfy the traveler's schedule. Return fewer options if necessary.

For each activity, provide:
1. Real attraction/tour names that exist at the destination
2. Describe the experience without inventing wheelchair accessibility, lifts, ramps, step-free routes, accessible toilets or boarding assistance. Do not infer level interiors, flat or smooth paths, easy movement between floors or an accessible alternative route from a venue's name or reputation. If you mention an obstacle, do not imply that a different route solves it without evidence. Do not put unverified access promises in names or vibe labels. Access requirements must be confirmed with the venue. Do not state opening/closing hours, last admission or daily/late opening: no operating-hours evidence is supplied to you. Keep descriptions focused on the experience, not unverified operating schedules.
3. Leave price unspecified unless supplied by a provider
4. Duration in whole MINUTES, never hours (30-minute stop = 30; 2-hour museum visit = 120; 2.5-hour tour = 150)
5. Best time of day to visit
6. How well it matches the traveler's vibes
7. proposedVisitType: ordinary_entry for general admission/interior visits, exterior_walk for an outdoor walk without interior access, guided_tour for an organized guided visit, event for a specific performance or event, unknown when unclear. This describes intent only; never change an interior visit to an exterior walk merely to fit evening availability. A guided tour's availability cannot be inferred from building opening hours.

Generate diverse options across categories like:
- Sightseeing & landmarks
- Self-guided neighborhood walks & scenic routes
- Museums & cultural sites
- Outdoor activities & parks
- Unique independently visitable local spots

Do NOT generate fake affiliate URLs. Leave affiliateUrl and affiliatePartner empty — only real API-sourced activities should have booking links.

IMPORTANT: For the "images" field, return an EMPTY array []. Do NOT generate or guess image URLs — only real API-sourced activities have valid image URLs.`;

export async function runActivitiesAgent(
  plan: SearchPlan,
  count: number = 15,
): Promise<ActivityResult[]> {
  const { destination, dates, activityCriteria, vibeInterpretation } = plan;
  const vibes = vibeInterpretation.vibes;
  // Broad "popular in Tokyo" inventory can consist entirely of 10-hour regional
  // excursions. Request manageable city experiences unless a day trip fits the
  // brief; the planner still decides whether any returned product is suitable.
  const maxDurationMinutes = supplierDurationCeilingMinutes(plan);

  const prompt = `Suggest up to ${count} independently visitable places and self-guided stops for ${destination}. Organized bookable experiences come from supplier inventory separately.

**Trip Details:**
- Travel dates (inclusive, destination local calendar): ${dates.start} to ${dates.end}
- Duration: ${dates.nights} nights
- Pace: ${activityCriteria.pacePreference}
- Must-see: ${activityCriteria.mustSee.join(", ") || "popular attractions"}
- Interests: ${activityCriteria.interests.join(", ")}
- Mobility needs: ${plan.mobilityNeeds || "none specified"}
- Structured requirements: ${JSON.stringify(plan.requirements ?? {})}
- Accessibility is unverified unless supported by reliable evidence; do not claim it is confirmed.

**Vibes to match:** ${vibes.join(", ")}
**Keywords to incorporate:** ${vibeInterpretation.searchKeywords.slice(0, 10).join(", ")}
**Avoid:** ${vibeInterpretation.avoidKeywords.join(", ") || "nothing specific"}

Generate a diverse mix across categories. Spread suggestions across neighborhoods instead of repeating one area. Keep durations realistic for the pace: a relaxed day should not be a chain of long tours.
${compiledScheduleExperimentEnabled() ? activitySourceContext(plan) : ""}
Score each activity 0-100 on how well it matches the traveler's vibes. Do not raise the score to fill the list.`;

  const aiPromise = (abortSignal: AbortSignal) =>
    generatePlanningObject<ActivityListResult>("activities", {
      model: aiGateway(planningModel("activities", MODEL)),
      providerOptions: PLANNING_PROVIDER_OPTIONS,
      system: SYSTEM_PROMPT,
      prompt,
      schema: ActivityListSchema,
      timeout: AI_AGENT_TIMEOUT_MS,
      abortSignal,
      maxRetries: 0,
    }).then(({ object: result }) =>
      result.activities
        .filter(
          (activity) =>
            activity.proposedVisitType !== "guided_tour" &&
            activity.proposedVisitType !== "event",
        )
        .map((activity, index) => ({
          ...screenGeneratedActivityCopy(activity),
          // Compare suggestions and supplier inventory on the same scale. A model's
          // self-assigned score must not crowd real products out of the shortlist.
          vibeScore: calculateVibeScore(
            screenGeneratedActivityCopy(activity),
            vibes,
          ).score,
          id: `activity_${Date.now()}_${index}`,
          price: 0,
          currency: "",
          priceStatus: "unknown" as const,
          affiliateUrl: undefined,
          affiliatePartner: undefined,
          rating: 0,
          reviewCount: 0,
        })),
    );

  const [viatorSettled, gygSettled, aiSettled] = await allBounded(
    [
      {
        label: "Viator",
        timeoutMs: 60000,
        run: async (signal) => {
          if (!isViatorContentEnabled() || !isViatorConfigured()) return [];
          try {
            return await searchViatorProducts({
              destination,
              startDate: dates.start,
              endDate: dates.end,
              limit: 15,
              maxDurationMinutes,
              signal,
            });
          } catch (error) {
            console.error("[Activities Agent] Viator search error:", error);
            return [];
          }
        },
      },
      {
        label: "GetYourGuide",
        timeoutMs: 30000,
        run: async (signal) => {
          if (!isGYGConfigured()) return [];
          try {
            return await searchGYGActivities({
              destination,
              startDate: dates.start,
              endDate: dates.end,
              limit: 15,
              signal,
            });
          } catch (error) {
            console.error(
              "[Activities Agent] GetYourGuide search error:",
              error,
            );
            return [];
          }
        },
      },
      {
        label: "activities AI",
        timeoutMs: AI_AGENT_TIMEOUT_MS,
        run: (signal) => aiPromise(signal),
      },
    ],
    { concurrency: 3 },
  );
  const viatorProducts =
    viatorSettled.status === "fulfilled" ? viatorSettled.value : [];
  const gygActivities =
    gygSettled.status === "fulfilled" ? gygSettled.value : [];
  const aiActivities = aiSettled.status === "fulfilled" ? aiSettled.value : [];
  if (aiSettled.status === "rejected") {
    const timedOut = isOperationTimeoutError(aiSettled.reason);
    const detail =
      aiSettled.reason instanceof Error
        ? aiSettled.reason.message
        : String(aiSettled.reason);
    if (timedOut) {
      console.warn(
        "[Activities Agent] AI timed out, using vendor/fallback results:",
        detail,
      );
    } else {
      console.error(
        "[Activities Agent] AI generation error:",
        aiSettled.reason,
      );
    }
    logPlanningFallback(
      "activities",
      timedOut ? "timeout" : "error",
      "empty",
      detail,
    );
  }

  const trackingId = `tg_${Date.now()}`;
  const viatorActivities: ActivityResult[] = viatorProducts.map((product) => {
    const durationMinutes =
      product.duration.fixedDurationInMinutes ||
      product.duration.variableDurationFromMinutes ||
      180;
    const categoryVibes =
      product.categories.length > 0
        ? mapViatorCategoryToVibe(product.categories[0])
        : [];
    const { score, matchedVibes } = calculateVibeScore(
      {
        name: product.title,
        description: product.description,
        category: product.categories[0] || "",
      },
      vibes,
    );

    return {
      id: `activity_v_${product.productCode}`,
      supplierCatalogOnly: product.catalogOnly,
      name: product.title,
      description: product.description,
      viatorContentVersion: 1,
      category: product.categories[0] || "sightseeing",
      duration: durationMinutes,
      price: product.price.amount,
      currency: product.price.currencyCode,
      priceStatus: readPrice(product.price.amount, product.price.currencyCode)
        ? undefined
        : "unknown",
      rating: product.rating,
      reviewCount: product.reviewCount,
      location: {
        name: product.location.city || destination,
        address: product.location.address || "",
        lat: product.location.coordinates?.latitude || 0,
        lng: product.location.coordinates?.longitude || 0,
      },
      images: product.images
        .slice(0, 3)
        .map((img: { url: string; caption?: string }) => img.url),
      affiliateUrl: generateViatorAffiliateUrl(
        product.productCode,
        trackingId,
        {
          date: dates.start,
          productUrl: product.productUrl,
        },
      ),
      affiliatePartner: "viator",
      bestTimeOfDay: "any",
      vibeScore: score || matchedVibes.length * 25,
      vibeMatch:
        matchedVibes.length > 0
          ? matchedVibes
          : categoryVibes.filter((v) =>
              vibes.some((req) => req.toLowerCase() === v.toLowerCase()),
            ),
      bookingRequired: true,
    };
  });

  const getYourGuideActivities: ActivityResult[] = gygActivities.map(
    (activity) => {
      const durationMinutes =
        activity.duration.fixedDurationInMinutes ||
        activity.duration.variableDurationFromMinutes ||
        180;
      const category = activity.categories[0] || "tour";
      const categoryVibes = mapGYGCategoryToVibe(category);
      const { score, matchedVibes } = calculateVibeScore(
        {
          name: activity.title,
          description: activity.description,
          category,
        },
        vibes,
      );
      const affiliateUrl = generateGYGAffiliateUrl(
        activity.activityId,
        trackingId,
        { date: dates.start },
      );

      return {
        id: `activity_gyg_${activity.activityId}`,
        name: activity.title,
        description:
          activity.shortDescription || activity.description.substring(0, 200),
        category,
        duration: durationMinutes,
        price: activity.price.amount,
        currency: activity.price.currencyCode,
        priceStatus: readPrice(
          activity.price.amount,
          activity.price.currencyCode,
        )
          ? undefined
          : "unknown",
        rating: activity.rating,
        reviewCount: activity.reviewCount,
        location: {
          name: activity.location.city || destination,
          address: activity.location.address || "",
          lat: activity.location.coordinates?.latitude || 0,
          lng: activity.location.coordinates?.longitude || 0,
        },
        images: activity.images
          .slice(0, 3)
          .map((img: { url: string; caption?: string }) => img.url)
          .filter((url): url is string => Boolean(url)),
        affiliateUrl: affiliateUrl || undefined,
        affiliatePartner: affiliateUrl ? "getyourguide" : undefined,
        bestTimeOfDay: "any",
        vibeScore: score || matchedVibes.length * 25,
        vibeMatch:
          matchedVibes.length > 0
            ? matchedVibes
            : categoryVibes.filter((v) =>
                vibes.some((req) => req.toLowerCase() === v.toLowerCase()),
              ),
        bookingRequired: Boolean(affiliateUrl),
      };
    },
  );

  const realActivities = [...viatorActivities, ...getYourGuideActivities];

  let allActivities = rankActivityInventory(
    deduplicateActivities(
      [...realActivities, ...aiActivities],
      new Set(realActivities.map((activity) => activity.id)),
    ),
    count,
  );

  // Enrich with TripAdvisor ratings and reviews
  if (isTripAdvisorConfigured() && allActivities.length > 0) {
    try {
      const eligible = allActivities.filter(canProcessViatorContent);
      const enriched = await enrichWithTripAdvisor(eligible, "attractions");
      const byId = new Map(enriched.map((item) => [item.id, item]));
      allActivities = allActivities.map((item) => byId.get(item.id) || item);
    } catch (e) {
      console.error("[Activities Agent] TripAdvisor enrichment error:", e);
    }
  }

  return allActivities;
}

function deduplicateActivities(
  activities: ActivityResult[],
  supplierIds: ReadonlySet<string>,
): ActivityResult[] {
  const seen = new Map<string, ActivityResult>();

  for (const activity of activities) {
    const name = activity.name
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]/gu, "");
    const key = name ? `name:${name}` : `id:${activity.id}`;
    const existing = seen.get(key);
    // Provenance comes from the actual supplier responses, not generated labels.
    // A generated score must not erase a supplier's price, media or booking link.
    const supplied = supplierIds.has(activity.id);
    const existingSupplied = existing && supplierIds.has(existing.id);
    if (
      !existing ||
      (supplied && !existingSupplied) ||
      (supplied === existingSupplied && activity.vibeScore > existing.vibeScore)
    ) {
      seen.set(key, activity);
    }
  }

  return Array.from(seen.values());
}

/**
 * Deprecated compatibility helper: Google venue ingestion is disabled.
 */
export async function searchGooglePlacesActivities(
  _destination: string,
  _types: string[],
): Promise<Record<string, unknown>[]> {
  void _destination;
  void _types;
  // Places content must not enter the persisted, AI-processed recommendation
  // pipeline. A future transient, attributed display needs a separate design.
  return [];
}

/**
 * Calculate vibe match score for an activity
 */
export function calculateVibeScore(
  activity: { name: string; description: string; category: string },
  vibes: string[],
): { score: number; matchedVibes: string[] } {
  const text =
    `${activity.name} ${activity.description} ${activity.category}`.toLowerCase();
  const matchedVibes: string[] = [];
  const requestedVibes = [...new Set(vibes.map((vibe) => vibe.toLowerCase()))];

  for (const vibe of requestedVibes) {
    const keywords = VIBE_KEYWORDS[vibe] || [];
    const matches = keywords.some((keyword) => {
      const escaped = keyword
        .toLowerCase()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      // "art" in "party" is not a cultural match. Supplier and generated
      // descriptions use the same evidence-independent relevance screen.
      return new RegExp(
        `(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`,
        "u",
      ).test(text);
    });

    if (matches) {
      matchedVibes.push(vibe);
    }
  }

  return {
    // Measure coverage of requested interests, not keyword density. A verbose
    // generated description must not outrank concise supplier copy merely by
    // listing more synonyms for the same interest.
    score: requestedVibes.length
      ? Math.round((matchedVibes.length / requestedVibes.length) * 100)
      : 0,
    matchedVibes,
  };
}
