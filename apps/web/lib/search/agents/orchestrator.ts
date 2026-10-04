import {
  PLANNING_MODEL,
  PLANNING_PROVIDER_OPTIONS,
} from "@/lib/ai/planning-disclosure";
/**
 * Orchestrator Agent
 * Analyzes user input and creates a search plan for other agents
 */

import {
  generateObject,
  gateway as defaultGateway,
  createGateway,
} from "@/lib/ai/sdk";
import { z } from "zod";
import { SearchInput, SearchPlan } from "../types";
import { VIBE_KEYWORDS, BUDGET_RANGES } from "@faroway/constants";
import {
  ORCHESTRATOR_TIMEOUT_MS,
  isOperationTimeoutError,
  withAbortTimeout,
} from "@/lib/search/runtime";

const aiGateway = process.env.AI_GATEWAY_API_KEY
  ? createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })
  : defaultGateway;

const MODEL = PLANNING_MODEL;

const SearchPlanSchema = z.object({
  destination: z.string(),
  country: z.string(),
  dates: z.object({
    start: z.string(),
    end: z.string(),
    nights: z.number(),
  }),
  searchPriorities: z.array(
    z.enum(["hotels", "activities", "dining", "transport"]),
  ),
  hotelCriteria: z.object({
    priceRange: z.object({ min: z.number(), max: z.number() }),
    starRating: z.array(z.number()),
    amenities: z.array(z.string()),
    neighborhoods: z.array(z.string()),
  }),
  activityCriteria: z.object({
    categories: z.array(z.string()),
    pacePreference: z.enum(["relaxed", "moderate", "packed"]),
    mustSee: z.array(z.string()),
    interests: z.array(z.string()),
  }),
  diningCriteria: z.object({
    cuisineTypes: z.array(z.string()),
    priceRange: z.enum(["budget", "moderate", "upscale"]),
    dietaryNeeds: z.array(z.string()),
    mealPriorities: z.array(z.enum(["breakfast", "lunch", "dinner"])),
  }),
  vibeInterpretation: z.object({
    vibes: z.array(z.string()),
    searchKeywords: z.array(z.string()),
    avoidKeywords: z.array(z.string()),
  }),
  transportCriteria: z
    .object({
      originCity: z.string().optional(),
      originAirport: z.string().optional(),
      destinationAirport: z.string().optional(),
      cabinClass: z.enum(["economy", "premium_economy", "business", "first"]),
      maxStops: z.number(),
      maxPrice: z.number().optional(),
      preferredAirlines: z.array(z.string()).optional(),
    })
    .optional(),
});

const SYSTEM_PROMPT = `You are a travel planning expert. Your job is to analyze user travel preferences and create a detailed search plan that will be used by specialized agents to find hotels, activities, dining options, and transport.

Consider:
1. The destination and what it's known for
2. Travel dates and trip duration
3. Who is traveling (solo, couple, family, etc.)
4. Their selected "vibes" (adventure, relaxation, cultural, etc.)
5. Budget constraints
6. Whether the trip requires flights or other transport (if an origin city/airport is provided, include transportCriteria)

Output a comprehensive search plan with specific criteria for hotels, activities, dining, and optionally transport.

For transportCriteria:
- Only include if the user provided an origin city/airport, or the trip clearly requires a flight (international or long-distance)
- Use IATA airport codes when possible (e.g., JFK, LHR, NRT)
- Set cabinClass based on budget: budget→economy, moderate→economy, luxury→business
- Set maxStops based on budget: budget→2, moderate→1, luxury→0
- If no origin is provided, omit transportCriteria entirely`;

const DESTINATION_IATA_CODES: Record<string, string> = {
  amsterdam: "AMS",
  athens: "ATH",
  bali: "DPS",
  bangkok: "BKK",
  barcelona: "BCN",
  berlin: "BER",
  "buenos aires": "EZE",
  cancun: "CUN",
  "cape town": "CPT",
  chicago: "ORD",
  copenhagen: "CPH",
  dubai: "DXB",
  dublin: "DUB",
  "hong kong": "HKG",
  istanbul: "IST",
  kyoto: "KIX",
  "las vegas": "LAS",
  lisbon: "LIS",
  london: "LON",
  "los angeles": "LAX",
  madrid: "MAD",
  melbourne: "MEL",
  "mexico city": "MEX",
  miami: "MIA",
  milan: "MIL",
  montreal: "YUL",
  "new york": "NYC",
  orlando: "MCO",
  osaka: "KIX",
  paris: "PAR",
  prague: "PRG",
  reykjavik: "KEF",
  rome: "ROM",
  "san francisco": "SFO",
  seoul: "ICN",
  singapore: "SIN",
  sydney: "SYD",
  taipei: "TPE",
  tokyo: "TYO",
  toronto: "YYZ",
  vancouver: "YVR",
  venice: "VCE",
  vienna: "VIE",
};

function normalizeDestinationKey(destination: string): string {
  return destination
    .toLowerCase()
    .split(",")[0]
    .replace(/\b(city|japan|france|italy|spain|uk|usa|united states)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveDestinationIata(destination: string): string | undefined {
  const key = normalizeDestinationKey(destination);
  return DESTINATION_IATA_CODES[key];
}

function buildTransportCriteriaFromInput(
  input: SearchInput,
): NonNullable<SearchPlan["transportCriteria"]> | undefined {
  const originAirport =
    input.originAirport ||
    (input.originCity ? resolveDestinationIata(input.originCity) : undefined);
  if (!originAirport) return undefined;

  return {
    originCity: input.originCity,
    originAirport,
    destinationAirport: resolveDestinationIata(input.destination),
    cabinClass: input.budget === "luxury" ? "business" : "economy",
    maxStops: input.budget === "luxury" ? 0 : input.budget === "budget" ? 2 : 1,
  };
}

export async function runOrchestratorAgent(
  input: SearchInput,
): Promise<SearchPlan> {
  const nights = Math.ceil(
    (new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  const budgetInfo = BUDGET_RANGES[input.budget || "moderate"];
  const vibes = input.vibes || [];

  // Collect keywords from selected vibes
  const vibeKeywords = vibes.flatMap(
    (vibe: string) => VIBE_KEYWORDS[vibe.toLowerCase()] || [],
  );

  const originInfo = input.originAirport
    ? `\n**Origin:** ${input.originCity || ""} (${input.originAirport})`
    : input.originCity
      ? `\n**Origin:** ${input.originCity}`
      : "";

  const prompt = `Create a search plan for this trip:

**Destination:** ${input.destination}
**Dates:** ${input.startDate} to ${input.endDate} (${nights} nights)
**Travelers:** ${input.travelers} people, ${input.travelerType || "general"} travel
**Party composition:** ${input.adults == null ? "Not specified" : `${input.adults} adults and ${input.children ?? 0} children`}
**Interests:** ${(input.interests ?? []).join(", ") || "Not specified"}
**Vibes:** ${vibes.join(", ")}
**Budget:** ${input.budget || "moderate"}${originInfo}

Budget guidelines:
- Hotel: $${budgetInfo.hotel.min} - $${budgetInfo.hotel.max} per night
- Daily activities/food: ~$${budgetInfo.daily} per person

Keywords associated with their vibes: ${vibeKeywords.join(", ")}

Create a detailed search plan with:
1. Best neighborhoods to stay in ${input.destination}
2. Hotel amenities that match their vibes
3. Activity categories and must-see attractions
4. Cuisine types and dining style preferences
5. Keywords to search for and avoid based on their preferences
6. Transport criteria if an origin city/airport is provided (include IATA codes for origin and destination airports)`;

  try {
    const { object: plan } = await withAbortTimeout(
      (abortSignal) =>
        generateObject<SearchPlan>({
          model: aiGateway(MODEL),
          providerOptions: PLANNING_PROVIDER_OPTIONS,
          system: SYSTEM_PROMPT,
          prompt,
          schema: SearchPlanSchema,
          timeout: ORCHESTRATOR_TIMEOUT_MS,
          abortSignal,
          maxRetries: 0,
        }),
      ORCHESTRATOR_TIMEOUT_MS,
      "orchestrator AI",
    );

    // Attach deterministic transport fields if the model omitted any of them.
    const inputTransportCriteria = buildTransportCriteriaFromInput(input);
    if (inputTransportCriteria) {
      plan.transportCriteria = {
        ...inputTransportCriteria,
        ...plan.transportCriteria,
        originCity:
          plan.transportCriteria?.originCity ??
          inputTransportCriteria.originCity,
        originAirport:
          plan.transportCriteria?.originAirport ??
          inputTransportCriteria.originAirport,
        destinationAirport:
          plan.transportCriteria?.destinationAirport ??
          inputTransportCriteria.destinationAirport,
      };
    }

    return plan;
  } catch (error) {
    if (isOperationTimeoutError(error)) {
      console.warn(
        "[Orchestrator Agent] Timed out, using fallback search plan:",
        error instanceof Error ? error.message : String(error),
      );
    } else {
      console.error("[Orchestrator Agent] Error:", error);
    }
    return buildFallbackSearchPlan(input);
  }
}

export function buildFallbackSearchPlan(input: SearchInput): SearchPlan {
  const nights = Math.ceil(
    (new Date(input.endDate).getTime() - new Date(input.startDate).getTime()) /
      (1000 * 60 * 60 * 24),
  );
  const budgetInfo = BUDGET_RANGES[input.budget || "moderate"];
  const vibes = input.vibes || [];
  const vibeKeywords = vibes.flatMap(
    (vibe: string) => VIBE_KEYWORDS[vibe.toLowerCase()] || [],
  );
  const transportCriteria = buildTransportCriteriaFromInput(input);

  return {
    destination: input.destination,
    country: "",
    dates: {
      start: input.startDate,
      end: input.endDate,
      nights,
    },
    searchPriorities: transportCriteria
      ? ["hotels", "activities", "dining", "transport"]
      : ["hotels", "activities", "dining"],
    hotelCriteria: {
      priceRange: budgetInfo.hotel,
      starRating:
        input.budget === "luxury"
          ? [4, 5]
          : input.budget === "budget"
            ? [2, 3]
            : [3, 4],
      amenities: ["wifi", "breakfast"],
      neighborhoods: [],
    },
    activityCriteria: {
      categories: vibes,
      pacePreference: "moderate",
      mustSee: [],
      interests: [...(input.interests ?? []), ...vibeKeywords].slice(0, 20),
    },
    diningCriteria: {
      cuisineTypes: ["local"],
      priceRange:
        input.budget === "luxury"
          ? "upscale"
          : input.budget === "budget"
            ? "budget"
            : "moderate",
      dietaryNeeds: [],
      mealPriorities: ["dinner", "lunch", "breakfast"],
    },
    vibeInterpretation: {
      vibes,
      searchKeywords: vibeKeywords,
      avoidKeywords: [],
    },
    ...(transportCriteria && { transportCriteria }),
  };
}
