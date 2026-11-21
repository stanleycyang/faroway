import { z } from "zod";
import type {
  ActivityResult,
  AgentStatus,
  DiningResult,
  HotelResult,
  ItineraryActivity,
  Restaurant,
  SearchProgress,
  SearchStatus,
  TransportResult,
  TripDay,
  TripDayTransport,
} from "@faroway/types";
import type { ActivityInput, HotelInput } from "@/lib/json-render/build-spec";

const nullToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  schema.nullish().transform((v) => v ?? undefined);

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
    name: nullToUndefined(z.string()),
    address: nullToUndefined(z.string()),
    lat: nullToUndefined(z.number()),
    lng: nullToUndefined(z.number()),
    neighborhood: nullToUndefined(z.string()),
  })
  .passthrough();

export const hotelDataSchema = z
  .object({
    id: nullToUndefined(z.string()),
    name: nullToUndefined(z.string()),
    description: nullToUndefined(z.string()),
    starRating: nullToUndefined(z.number()),
    userRating: nullToUndefined(z.number()),
    reviewCount: nullToUndefined(z.number()),
    pricePerNight: nullToUndefined(z.number()),
    totalPrice: nullToUndefined(z.number()),
    currency: nullToUndefined(z.string()),
    amenities: nullToUndefined(z.array(z.string())),
    location: nullToUndefined(locationInfoSchema),
    images: nullToUndefined(z.array(z.string())),
    affiliateUrl: nullToUndefined(z.string()),
    affiliatePartner: nullToUndefined(z.string()),
    vibeScore: nullToUndefined(z.number()),
    vibeMatch: nullToUndefined(z.array(z.string())),
    priceStatus: nullToUndefined(z.enum(["unknown", "estimate"])),
    dataSource: nullToUndefined(z.enum(["provider", "ai"])),
    tripadvisorRating: nullToUndefined(z.number()),
    tripadvisorReviewCount: nullToUndefined(z.number()),
    tripadvisorUrl: nullToUndefined(z.string()),
    tripadvisorRankingString: nullToUndefined(z.string()),
  })
  .passthrough();

export const activityDataSchema = z
  .object({
    id: nullToUndefined(z.string()),
    name: nullToUndefined(z.string()),
    description: nullToUndefined(z.string()),
    category: nullToUndefined(z.string()),
    duration: nullToUndefined(z.number()),
    price: nullToUndefined(z.number()),
    currency: nullToUndefined(z.string()),
    rating: nullToUndefined(z.number()),
    reviewCount: nullToUndefined(z.number()),
    location: nullToUndefined(locationInfoSchema),
    images: nullToUndefined(z.array(z.string())),
    affiliateUrl: nullToUndefined(z.string()),
    affiliatePartner: nullToUndefined(z.string()),
    bestTimeOfDay: nullToUndefined(
      z.enum(["morning", "afternoon", "evening", "any"]),
    ),
    vibeScore: nullToUndefined(z.number()),
    vibeMatch: nullToUndefined(z.array(z.string())),
    bookingRequired: nullToUndefined(z.boolean()),
    priceStatus: nullToUndefined(z.enum(["unknown", "estimate"])),
    planningIdea: nullToUndefined(z.literal(true)),
    supplierCatalogOnly: nullToUndefined(z.literal(true)),
    tripadvisorRating: nullToUndefined(z.number()),
    tripadvisorReviewCount: nullToUndefined(z.number()),
    tripadvisorUrl: nullToUndefined(z.string()),
  })
  .passthrough();

export const diningDataSchema = z
  .object({
    id: nullToUndefined(z.string()),
    name: nullToUndefined(z.string()),
    description: nullToUndefined(z.string()),
    cuisineTypes: nullToUndefined(z.array(z.string())),
    priceLevel: nullToUndefined(
      z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
    ),
    rating: nullToUndefined(z.number()),
    reviewCount: nullToUndefined(z.number()),
    location: nullToUndefined(locationInfoSchema),
    images: nullToUndefined(z.array(z.string())),
    reservationUrl: nullToUndefined(z.string()),
    affiliatePartner: nullToUndefined(z.string()),
    mealTypes: nullToUndefined(
      z.array(z.enum(["breakfast", "lunch", "dinner"])),
    ),
    vibeScore: nullToUndefined(z.number()),
    vibeMatch: nullToUndefined(z.array(z.string())),
    dietaryOptions: nullToUndefined(z.array(z.string())),
    priceStatus: nullToUndefined(z.enum(["unknown", "estimate"])),
    planningIdea: nullToUndefined(z.literal(true)),
    tripadvisorRating: nullToUndefined(z.number()),
    tripadvisorReviewCount: nullToUndefined(z.number()),
    tripadvisorUrl: nullToUndefined(z.string()),
  })
  .passthrough();

const transportEndpointSchema = z
  .object({
    airport: z.string(),
    city: z.string(),
    dateTime: z.string(),
    terminal: nullToUndefined(z.string()),
  })
  .passthrough();

const transportSegmentSchema = z
  .object({
    carrier: z.string(),
    flightNumber: nullToUndefined(z.string()),
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
    cabinClass: nullToUndefined(z.string()),
  })
  .passthrough();

export const transportDataSchema = z
  .object({
    expiresAt: nullToUndefined(z.string()),
    id: nullToUndefined(z.string()),
    type: nullToUndefined(z.enum(["flight", "train", "bus", "ferry"])),
    provider: nullToUndefined(z.string()),
    departure: nullToUndefined(transportEndpointSchema),
    arrival: nullToUndefined(transportEndpointSchema),
    duration: nullToUndefined(z.number()),
    stops: nullToUndefined(z.number()),
    price: nullToUndefined(z.number()),
    currency: nullToUndefined(z.string()),
    cabinClass: nullToUndefined(
      z.enum(["economy", "premium_economy", "business", "first"]),
    ),
    airlines: nullToUndefined(z.array(z.string())),
    segments: nullToUndefined(z.array(transportSegmentSchema)),
    affiliateUrl: nullToUndefined(z.string()),
    affiliatePartner: nullToUndefined(z.string()),
    source: nullToUndefined(z.enum(["duffel", "liteapi"])),
    vibeScore: nullToUndefined(z.number()),
    vibeMatch: nullToUndefined(z.array(z.string())),
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
    dayNumber: nullToUndefined(z.number()),
    date: nullToUndefined(z.string()),
    morning: nullToUndefined(savedSlotSchema),
    afternoon: nullToUndefined(savedSlotSchema),
    evening: nullToUndefined(savedSlotSchema),
    transport: z.unknown().optional(),
  })
  .passthrough();

export const intermediateResultsSchema = z
  .object({
    days: nullToUndefined(z.array(savedDayScheduleSchema)),
    topHotel: z.unknown().optional(),
  })
  .passthrough();

export const searchProgressSchema = z
  .record(z.string(), agentStatusSchema.nullish())
  .nullish()
  .transform((record) => {
    if (!record) return {};
    const normalized: Record<string, AgentStatus> = {};
    for (const [key, val] of Object.entries(record)) {
      if (val != null) {
        normalized[key] = val;
      }
    }
    return normalized;
  });

export const searchRecordRowSchema = z
  .object({
    id: z.string(),
    user_id: z.string().nullable(),
    status: searchStatusSchema,
    progress: searchProgressSchema,
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
  const parsed = searchProgressSchema.parse(raw ?? {});
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
    id: nullToUndefined(z.string()),
    name: z.string(),
    rating: nullToUndefined(z.number()),
    reviewCount: nullToUndefined(z.number()),
    pricePerNight: nullToUndefined(z.number()),
    currency: nullToUndefined(z.string()),
    amenities: nullToUndefined(z.array(z.string())),
    description: nullToUndefined(z.string()),
    affiliateUrl: nullToUndefined(z.string()),
    affiliatePartner: nullToUndefined(z.string()),
    images: nullToUndefined(z.array(z.string())),
    starRating: nullToUndefined(z.number()),
  })
  .passthrough() satisfies z.ZodType<HotelInput>;

export const activityInputSchema = z
  .object({
    id: nullToUndefined(z.string()),
    name: z.string(),
    description: nullToUndefined(z.string()),
    duration: nullToUndefined(z.number()),
    price: nullToUndefined(z.number()),
    currency: nullToUndefined(z.string()),
    rating: nullToUndefined(z.number()),
    reviewCount: nullToUndefined(z.number()),
    category: nullToUndefined(z.string()),
    bestTimeOfDay: nullToUndefined(z.string()),
    bookingRequired: nullToUndefined(z.boolean()),
    affiliateUrl: nullToUndefined(z.string()),
    affiliatePartner: nullToUndefined(z.string()),
    images: nullToUndefined(z.array(z.string())),
    priceStatus: nullToUndefined(z.enum(["unknown", "estimate"])),
  })
  .passthrough() satisfies z.ZodType<ActivityInput>;

const itineraryActivityPassSchema = z.custom<ItineraryActivity>(
  (val) => Boolean(val && typeof val === "object" && !Array.isArray(val)),
  { message: "Invalid itinerary activity" },
);

const restaurantPassSchema = z.custom<Restaurant>(
  (val) => Boolean(val && typeof val === "object" && !Array.isArray(val)),
  { message: "Invalid restaurant" },
);

const tripDaySlotSchema = z
  .object({
    activities: z
      .array(itineraryActivityPassSchema)
      .nullish()
      .transform((v) => v ?? []),
    meals: z
      .array(restaurantPassSchema)
      .nullish()
      .transform((v) => v ?? []),
  })
  .passthrough();

const emptyTripDaySlot = (): TripDay["morning"] => ({
  activities: [],
  meals: [],
});

const tripDayObjectSchema = z
  .object({
    dayNumber: z.number().finite().optional(),
    date: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
    morning: tripDaySlotSchema.nullish(),
    afternoon: tripDaySlotSchema.nullish(),
    evening: tripDaySlotSchema.nullish(),
    tips: z
      .array(z.string())
      .nullish()
      .transform((v) => v ?? []),
  })
  .passthrough();

export const tripDayTransportSchema = z
  .object({
    expiresAt: nullToUndefined(z.string()),
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
    affiliateUrl: nullToUndefined(z.string()),
    affiliatePartner: nullToUndefined(z.string()),
  })
  .passthrough() satisfies z.ZodType<TripDayTransport>;

export const tripDayPassthroughSchema: z.ZodType<TripDay> =
  tripDayObjectSchema.transform((day) => ({
    ...day,
    dayNumber: day.dayNumber ?? 1,
    date: day.date ?? "",
    title: day.title ?? "",
    summary: day.summary ?? "",
    morning: day.morning ?? emptyTripDaySlot(),
    afternoon: day.afternoon ?? emptyTripDaySlot(),
    evening: day.evening ?? emptyTripDaySlot(),
    tips: day.tips,
  }));
