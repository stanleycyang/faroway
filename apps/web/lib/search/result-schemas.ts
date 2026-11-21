import { z } from "zod";
import type {
  ActivityResult,
  AgentStatus,
  DiningResult,
  HotelResult,
  SearchProgress,
  SearchStatus,
  TransportResult,
  TripDay,
  TripDayTransport,
} from "@faroway/types";
import type { ActivityInput, HotelInput } from "@/lib/json-render/build-spec";

export const searchStatusSchema = z.enum([
  "pending",
  "searching",
  "completed",
  "error",
]) satisfies z.ZodType<SearchStatus>;

export const agentStatusSchema = z.enum([
  "pending",
  "searching",
  "done",
  "error",
]) satisfies z.ZodType<AgentStatus>;

export const locationInfoSchema = z
  .object({
    name: z.string().optional(),
    address: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    neighborhood: z.string().optional(),
  })
  .passthrough();

export const hotelDataSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    starRating: z.number().optional(),
    userRating: z.number().optional(),
    reviewCount: z.number().optional(),
    pricePerNight: z.number().optional(),
    totalPrice: z.number().optional(),
    currency: z.string().optional(),
    amenities: z.array(z.string()).optional(),
    location: locationInfoSchema.optional(),
    images: z.array(z.string()).optional(),
    affiliateUrl: z.string().optional(),
    affiliatePartner: z.string().optional(),
    vibeScore: z.number().optional(),
    vibeMatch: z.array(z.string()).optional(),
    priceStatus: z.enum(["unknown", "estimate"]).optional(),
    dataSource: z.enum(["provider", "ai"]).optional(),
    tripadvisorRating: z.number().optional(),
    tripadvisorReviewCount: z.number().optional(),
    tripadvisorUrl: z.string().optional(),
    tripadvisorRankingString: z.string().optional(),
  })
  .passthrough();

export const activityDataSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    duration: z.number().optional(),
    price: z.number().optional(),
    currency: z.string().optional(),
    rating: z.number().optional(),
    reviewCount: z.number().optional(),
    location: locationInfoSchema.optional(),
    images: z.array(z.string()).optional(),
    affiliateUrl: z.string().optional(),
    affiliatePartner: z.string().optional(),
    bestTimeOfDay: z
      .enum(["morning", "afternoon", "evening", "any"])
      .optional(),
    vibeScore: z.number().optional(),
    vibeMatch: z.array(z.string()).optional(),
    bookingRequired: z.boolean().optional(),
    priceStatus: z.enum(["unknown", "estimate"]).optional(),
    planningIdea: z.literal(true).optional(),
    supplierCatalogOnly: z.literal(true).optional(),
    tripadvisorRating: z.number().optional(),
    tripadvisorReviewCount: z.number().optional(),
    tripadvisorUrl: z.string().optional(),
  })
  .passthrough();

export const diningDataSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    description: z.string().optional(),
    cuisineTypes: z.array(z.string()).optional(),
    priceLevel: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
      .optional(),
    rating: z.number().optional(),
    reviewCount: z.number().optional(),
    location: locationInfoSchema.optional(),
    images: z.array(z.string()).optional(),
    reservationUrl: z.string().optional(),
    affiliatePartner: z.string().optional(),
    mealTypes: z.array(z.enum(["breakfast", "lunch", "dinner"])).optional(),
    vibeScore: z.number().optional(),
    vibeMatch: z.array(z.string()).optional(),
    dietaryOptions: z.array(z.string()).optional(),
    priceStatus: z.enum(["unknown", "estimate"]).optional(),
    planningIdea: z.literal(true).optional(),
    tripadvisorRating: z.number().optional(),
    tripadvisorReviewCount: z.number().optional(),
    tripadvisorUrl: z.string().optional(),
  })
  .passthrough();

const transportEndpointSchema = z
  .object({
    airport: z.string(),
    city: z.string(),
    dateTime: z.string(),
    terminal: z.string().optional(),
  })
  .passthrough();

const transportSegmentSchema = z
  .object({
    carrier: z.string(),
    flightNumber: z.string().optional(),
    departure: z
      .object({
        airport: z.string(),
        dateTime: z.string(),
      })
      .passthrough(),
    arrival: z
      .object({
        airport: z.string(),
        dateTime: z.string(),
      })
      .passthrough(),
    duration: z.number(),
    cabinClass: z.string().optional(),
  })
  .passthrough();

export const transportDataSchema = z
  .object({
    expiresAt: z.string().optional(),
    id: z.string().optional(),
    type: z.enum(["flight", "train", "bus", "ferry"]).optional(),
    provider: z.string().optional(),
    departure: transportEndpointSchema.optional(),
    arrival: transportEndpointSchema.optional(),
    duration: z.number().optional(),
    stops: z.number().optional(),
    price: z.number().optional(),
    currency: z.string().optional(),
    cabinClass: z
      .enum(["economy", "premium_economy", "business", "first"])
      .optional(),
    airlines: z.array(z.string()).optional(),
    segments: z.array(transportSegmentSchema).optional(),
    affiliateUrl: z.string().optional(),
    affiliatePartner: z.string().optional(),
    source: z.enum(["duffel", "liteapi"]).optional(),
    vibeScore: z.number().optional(),
    vibeMatch: z.array(z.string()).optional(),
  })
  .passthrough();

export const searchResultRowSchema = z
  .object({
    id: z.string(),
    category: z.string(),
    data: z.record(z.string(), z.unknown()),
    vibe_score: z.number().nullable().optional().default(null),
  })
  .passthrough();

export type ValidatedSearchResultRow = z.infer<typeof searchResultRowSchema>;

export const itineraryRowSchema = z
  .object({
    day_number: z.number(),
    date: z
      .string()
      .nullish()
      .transform((v) => v ?? ""),
    title: z
      .string()
      .nullish()
      .transform((v) => v ?? ""),
    summary: z
      .string()
      .nullish()
      .transform((v) => v ?? ""),
    morning_activities: z.array(z.string()).nullable().optional().default(null),
    afternoon_activities: z
      .array(z.string())
      .nullable()
      .optional()
      .default(null),
    evening_activities: z.array(z.string()).nullable().optional().default(null),
    meals: z.array(z.string()).nullable().optional().default(null),
    estimated_cost: z.number().nullable().optional().default(null),
    cost_currency: z.string().nullable().optional().default(null),
    tips: z
      .array(z.string())
      .nullish()
      .transform((v) => v ?? []),
    hotel_id: z.string().nullable().optional().default(null),
    transport_id: z.string().nullable().optional().default(null),
  })
  .passthrough();

export type ValidatedItineraryRow = z.infer<typeof itineraryRowSchema>;

const savedSlotSchema = z
  .object({
    activities: z.unknown().optional(),
    meals: z.unknown().optional(),
  })
  .passthrough();

export const savedDayScheduleSchema = z
  .object({
    dayNumber: z.number().optional(),
    date: z.string().optional(),
    morning: savedSlotSchema.optional(),
    afternoon: savedSlotSchema.optional(),
    evening: savedSlotSchema.optional(),
    transport: z.unknown().optional(),
  })
  .passthrough();

export const intermediateResultsSchema = z
  .object({
    days: z.array(savedDayScheduleSchema).optional(),
    topHotel: z.unknown().optional(),
  })
  .passthrough();

export const searchRecordRowSchema = z
  .object({
    id: z.string(),
    user_id: z.string().nullable(),
    status: searchStatusSchema,
    progress: z
      .record(z.string(), agentStatusSchema)
      .nullish()
      .transform((v) => v ?? {}),
    created_at: z
      .string()
      .nullish()
      .transform((v) => v ?? ""),
    completed_at: z.string().nullable().optional().default(null),
    error_message: z.string().nullable().optional().default(null),
    json_render_spec: z.unknown().optional(),
    intermediate_results: intermediateResultsSchema.nullable().optional(),
    search_results: z
      .array(searchResultRowSchema)
      .nullish()
      .transform((v) => v ?? []),
    search_itineraries: z
      .array(itineraryRowSchema)
      .nullish()
      .transform((v) => v ?? []),
  })
  .passthrough();

export function parseSearchProgress(raw: unknown): SearchProgress {
  const parsed = z
    .record(z.string(), agentStatusSchema)
    .optional()
    .default({})
    .parse(raw ?? {});
  return {
    orchestrator: parsed.orchestrator ?? "pending",
    hotels: parsed.hotels ?? "pending",
    activities: parsed.activities ?? "pending",
    dining: parsed.dining ?? "pending",
    transport: parsed.transport ?? "pending",
    ...(parsed.enrichment !== undefined
      ? { enrichment: parsed.enrichment }
      : {}),
    aggregator: parsed.aggregator ?? "pending",
  };
}

function normalizeLocation(
  raw: z.infer<typeof locationInfoSchema> | undefined,
): HotelResult["location"] {
  if (!raw) {
    return { name: "", address: "", lat: 0, lng: 0 };
  }
  return {
    ...raw,
    name: raw.name ?? "",
    address: raw.address ?? "",
    lat: raw.lat ?? 0,
    lng: raw.lng ?? 0,
  };
}

export function parseHotelResult(
  raw: Record<string, unknown>,
  fallbackId: string,
): HotelResult {
  const parsed = hotelDataSchema.parse(raw);
  return {
    ...parsed,
    id: parsed.id ?? fallbackId,
    name: parsed.name ?? "",
    description: parsed.description ?? "",
    amenities: parsed.amenities ?? [],
    location: normalizeLocation(parsed.location),
    images: parsed.images ?? [],
    vibeScore: parsed.vibeScore ?? 0,
    vibeMatch: parsed.vibeMatch ?? [],
  };
}

export function parseActivityResult(
  raw: Record<string, unknown>,
  fallbackId: string,
): ActivityResult {
  const parsed = activityDataSchema.parse(raw);
  return {
    ...parsed,
    id: parsed.id ?? fallbackId,
    name: parsed.name ?? "",
    description: parsed.description ?? "",
    category: parsed.category ?? "",
    duration: parsed.duration ?? 0,
    price: parsed.price ?? 0,
    currency: parsed.currency ?? "",
    rating: parsed.rating ?? 0,
    reviewCount: parsed.reviewCount ?? 0,
    location: normalizeLocation(parsed.location),
    images: parsed.images ?? [],
    bestTimeOfDay: parsed.bestTimeOfDay ?? "any",
    vibeScore: parsed.vibeScore ?? 0,
    vibeMatch: parsed.vibeMatch ?? [],
    bookingRequired: parsed.bookingRequired ?? false,
  };
}

export function parseDiningResult(
  raw: Record<string, unknown>,
  fallbackId: string,
): DiningResult {
  const parsed = diningDataSchema.parse(raw);
  return {
    ...parsed,
    id: parsed.id ?? fallbackId,
    name: parsed.name ?? "",
    description: parsed.description ?? "",
    cuisineTypes: parsed.cuisineTypes ?? [],
    location: parsed.location
      ? {
          ...parsed.location,
          name: parsed.location.name ?? "",
          address: parsed.location.address ?? "",
        }
      : { name: "", address: "" },
    images: parsed.images ?? [],
    mealTypes: parsed.mealTypes ?? [],
    vibeScore: parsed.vibeScore ?? 0,
    vibeMatch: parsed.vibeMatch ?? [],
    dietaryOptions: parsed.dietaryOptions ?? [],
  };
}

export function parseTransportResult(
  raw: Record<string, unknown>,
  fallbackId: string,
): TransportResult {
  const parsed = transportDataSchema.parse(raw);
  const emptyEndpoint = { airport: "", city: "", dateTime: "" };
  return {
    ...parsed,
    id: parsed.id ?? fallbackId,
    type: parsed.type ?? "flight",
    provider: parsed.provider ?? "",
    departure: parsed.departure ?? emptyEndpoint,
    arrival: parsed.arrival ?? emptyEndpoint,
    duration: parsed.duration ?? 0,
    stops: parsed.stops ?? 0,
    price: parsed.price ?? 0,
    currency: parsed.currency ?? "USD",
    airlines: parsed.airlines ?? [],
    segments: parsed.segments ?? [],
    affiliateUrl: parsed.affiliateUrl ?? "",
    affiliatePartner: parsed.affiliatePartner ?? "",
    source: parsed.source ?? "duffel",
    vibeScore: parsed.vibeScore ?? 0,
    vibeMatch: parsed.vibeMatch ?? [],
  };
}

export const hotelInputSchema = z
  .object({
    id: z.string().optional(),
    name: z.string(),
    rating: z.number().optional(),
    reviewCount: z.number().optional(),
    pricePerNight: z.number().optional(),
    currency: z.string().optional(),
    amenities: z.array(z.string()).optional(),
    description: z.string().optional(),
    affiliateUrl: z.string().optional(),
    affiliatePartner: z.string().optional(),
    images: z.array(z.string()).optional(),
    starRating: z.number().optional(),
  })
  .passthrough() satisfies z.ZodType<HotelInput>;

export const activityInputSchema = z
  .object({
    id: z.string().optional(),
    name: z.string(),
    description: z.string().optional(),
    duration: z.number().optional(),
    price: z.number().optional(),
    currency: z.string().optional(),
    rating: z.number().optional(),
    reviewCount: z.number().optional(),
    category: z.string().optional(),
    bestTimeOfDay: z.string().optional(),
    bookingRequired: z.boolean().optional(),
    affiliateUrl: z.string().optional(),
    affiliatePartner: z.string().optional(),
    images: z.array(z.string()).optional(),
    priceStatus: z.enum(["unknown", "estimate"]).optional(),
  })
  .passthrough() satisfies z.ZodType<ActivityInput>;

const tripDaySlotSchema = z
  .object({
    activities: z.array(z.unknown()).default([]),
    meals: z.array(z.unknown()).default([]),
  })
  .passthrough();

const tripDayObjectSchema = z
  .object({
    dayNumber: z.number(),
    date: z.string(),
    title: z.string(),
    summary: z.string(),
    morning: tripDaySlotSchema,
    afternoon: tripDaySlotSchema,
    evening: tripDaySlotSchema,
    tips: z.array(z.string()).default([]),
  })
  .passthrough();

export const tripDayTransportSchema = z
  .object({
    expiresAt: z.string().optional(),
    type: z.enum(["flight", "train", "bus", "ferry"]),
    provider: z.string(),
    departure: z
      .object({
        airport: z.string(),
        city: z.string(),
        dateTime: z.string(),
      })
      .passthrough(),
    arrival: z
      .object({
        airport: z.string(),
        city: z.string(),
        dateTime: z.string(),
      })
      .passthrough(),
    duration: z.number(),
    stops: z.number(),
    price: z.number(),
    currency: z.string(),
    affiliateUrl: z.string().optional(),
    affiliatePartner: z.string().optional(),
  })
  .passthrough() satisfies z.ZodType<TripDayTransport>;

export const tripDayPassthroughSchema = z.custom<TripDay>(
  (val) => tripDayObjectSchema.safeParse(val).success,
  { message: "Invalid TripDay shape" },
);
