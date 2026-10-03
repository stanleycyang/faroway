/**
 * Activities Agent
 * Searches for tours, attractions, and experiences
 * Uses real activity vendors + AI for matching and ranking
 */

import {
  generateObject,
  gateway as defaultGateway,
  createGateway,
} from "@/lib/ai/sdk";
import { z } from "zod";
import {
  canProcessViatorContent,
  isViatorContentEnabled,
} from "@/lib/affiliates/viator-policy";
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
  isOperationTimeoutError,
  withAbortTimeout,
} from "@/lib/search/runtime";

const aiGateway = process.env.AI_GATEWAY_API_KEY
  ? createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })
  : defaultGateway;

const MODEL = "google/gemini-3-flash";

const ActivitySchema = z.object({
  name: z.string(),
  description: z.string(),
  category: z.string(),
  duration: z.number(), // minutes
  price: z.number(),
  currency: z.string().default("USD"),
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

type GeneratedActivity = Omit<ActivityResult, "id">;

interface ActivityListResult {
  activities: GeneratedActivity[];
}

const SYSTEM_PROMPT = `You are a travel activities expert. Generate realistic, bookable activities and attractions for the destination.

When real Viator data is provided as context, use those activity names and prices. Only generate synthetic data for categories not covered by the real results.

For each activity, provide:
1. Real attraction/tour names that exist at the destination
2. Accurate descriptions of what visitors will experience
3. Realistic pricing (use Viator as reference)
4. Appropriate duration estimates
5. Best time of day to visit
6. How well it matches the traveler's vibes

Generate diverse options across categories like:
- Sightseeing & landmarks
- Tours (walking, food, history)
- Museums & cultural sites
- Outdoor activities
- Unique local experiences

Do NOT generate fake affiliate URLs. Leave affiliateUrl and affiliatePartner empty — only real API-sourced activities should have booking links.

IMPORTANT: For the "images" field, return an EMPTY array []. Do NOT generate or guess image URLs — only real API-sourced activities have valid image URLs.`;

export async function runActivitiesAgent(
  plan: SearchPlan,
  count: number = 15,
): Promise<ActivityResult[]> {
  const { destination, dates, activityCriteria, vibeInterpretation } = plan;
  const vibes = vibeInterpretation.vibes;

  const viatorPromise =
    isViatorContentEnabled() && isViatorConfigured()
      ? searchViatorProducts({
          destination,
          startDate: dates.start,
          limit: 15,
        }).catch((error) => {
          console.error("[Activities Agent] Viator search error:", error);
          return [];
        })
      : Promise.resolve([]);

  const gygPromise = isGYGConfigured()
    ? searchGYGActivities({
        destination,
        startDate: dates.start,
        endDate: dates.end,
        limit: 15,
      }).catch((error) => {
        console.error("[Activities Agent] GetYourGuide search error:", error);
        return [];
      })
    : Promise.resolve([]);

  const prompt = `Generate ${count} bookable activities and attractions for ${destination}.

**Trip Details:**
- Duration: ${dates.nights} nights
- Pace: ${activityCriteria.pacePreference}
- Must-see: ${activityCriteria.mustSee.join(", ") || "popular attractions"}
- Interests: ${activityCriteria.interests.join(", ")}

**Vibes to match:** ${vibes.join(", ")}
**Keywords to incorporate:** ${vibeInterpretation.searchKeywords.slice(0, 10).join(", ")}
**Avoid:** ${vibeInterpretation.avoidKeywords.join(", ") || "nothing specific"}

Generate a diverse mix across categories.
Score each activity 0-100 on how well it matches the traveler's vibes.`;

  const aiPromise = withAbortTimeout(
    (abortSignal) =>
      generateObject<ActivityListResult>({
        model: aiGateway(MODEL),
        system: SYSTEM_PROMPT,
        prompt,
        schema: ActivityListSchema,
        timeout: AI_AGENT_TIMEOUT_MS,
        abortSignal,
        maxRetries: 0,
      }),
    AI_AGENT_TIMEOUT_MS,
    "activities AI",
  )
    .then(({ object: result }) =>
      result.activities.map((activity, index) => ({
        ...activity,
        id: `activity_${Date.now()}_${index}`,
        affiliateUrl: undefined,
        affiliatePartner: undefined,
        rating: 0,
        reviewCount: 0,
      })),
    )
    .catch((error) => {
      if (isOperationTimeoutError(error)) {
        console.warn(
          "[Activities Agent] AI timed out, using vendor/fallback results:",
          error.message,
        );
      } else {
        console.error("[Activities Agent] AI generation error:", error);
      }
      return [] as ActivityResult[];
    });

  const [viatorProducts, gygActivities, aiActivities] = await Promise.all([
    viatorPromise,
    gygPromise,
    aiPromise,
  ]);

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
      name: product.title,
      description: product.description,
      viatorContentVersion: 1,
      category: product.categories[0] || "sightseeing",
      duration: durationMinutes,
      price: product.price.amount,
      currency: product.price.currencyCode,
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
          : categoryVibes.filter((v) => vibes.includes(v)),
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

      return {
        id: `activity_gyg_${activity.activityId}`,
        name: activity.title,
        description:
          activity.shortDescription || activity.description.substring(0, 200),
        category,
        duration: durationMinutes,
        price: activity.price.amount,
        currency: activity.price.currencyCode,
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
        affiliateUrl: generateGYGAffiliateUrl(activity.activityId, trackingId, {
          date: dates.start,
        }),
        affiliatePartner: "getyourguide",
        bestTimeOfDay: "any",
        vibeScore: score || matchedVibes.length * 25,
        vibeMatch:
          matchedVibes.length > 0
            ? matchedVibes
            : categoryVibes.filter((v) => vibes.includes(v)),
        bookingRequired: true,
      };
    },
  );

  const realActivities = [...viatorActivities, ...getYourGuideActivities];

  let allActivities = deduplicateActivities([
    ...realActivities,
    ...aiActivities,
  ])
    .sort((a, b) => b.vibeScore - a.vibeScore)
    .slice(0, count);

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

function deduplicateActivities(activities: ActivityResult[]): ActivityResult[] {
  const seen = new Map<string, ActivityResult>();

  for (const activity of activities) {
    const key = activity.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const existing = seen.get(key);
    if (!existing || activity.vibeScore > existing.vibeScore) {
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
  let score = 0;

  for (const vibe of vibes) {
    const keywords = VIBE_KEYWORDS[vibe.toLowerCase()] || [];
    const matches = keywords.filter((keyword) =>
      text.includes(keyword.toLowerCase()),
    );

    if (matches.length > 0) {
      matchedVibes.push(vibe);
      score += matches.length * 15; // 15 points per keyword match
    }
  }

  return {
    score: Math.min(100, score),
    matchedVibes,
  };
}
