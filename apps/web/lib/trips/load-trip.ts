import "server-only";

import { filterViatorDisplay } from "@/lib/affiliates/viator-policy";

import { cache } from "react";
import type { GeneratedItinerary } from "@/lib/ai/types";
import type { HotelResult } from "@faroway/types";
import { getSupabase } from "@/lib/supabase/server";
import { z } from "zod";

export type TripLifecycleStatus =
  | "draft"
  | "planning"
  | "planned"
  | "generating"
  | "generated"
  | "failed"
  | "active"
  | "in_progress"
  | "booked"
  | "paid"
  | "completed"
  | "canceled";

export interface Trip {
  id: string;
  user_id: string;
  destination: string;
  start_date: string;
  end_date: string;
  travelers: number;
  budget_tier?: "budget" | "moderate" | "luxury";
  preferences?: Record<string, unknown>;
  dietary_restrictions?: string[] | null;
  mobility_needs?: string | null;
  vibes?: string[];
  status: TripLifecycleStatus;
  search_id?: string;
  plan_revision_id?: string | null;
  is_shared?: boolean;
  share_token?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripResponse {
  trip: Trip;
  itinerary: GeneratedItinerary | null;
}

const itineraryJoinSchema = z
  .object({
    days: z.array(z.unknown()),
    overview: z.string().nullable().optional(),
    total_cost: z.unknown().nullable().optional(),
    packing_list: z.array(z.string()).nullable().optional(),
    general_tips: z.array(z.string()).nullable().optional(),
    generated_at: z.string().nullable().optional(),
  })
  .passthrough();

const tripStatusSchema = z.enum([
  "draft",
  "planning",
  "planned",
  "generating",
  "generated",
  "failed",
  "active",
  "in_progress",
  "booked",
  "paid",
  "completed",
  "canceled",
]);

const canonicalBudgetTierSchema = z.enum(["budget", "moderate", "luxury"]);

const budgetTierSchema = z.preprocess((val) => {
  if (typeof val !== "string") return val;
  const key = val.trim().toLowerCase();
  if (key === "comfort" || key === "mid_range" || key === "mid-range") {
    return "moderate";
  }
  return key;
}, canonicalBudgetTierSchema);

const tripRowSchema = z
  .object({
    id: z.string(),
    user_id: z.string(),
    destination: z.string().optional(),
    start_date: z.string().optional(),
    end_date: z.string().optional(),
    travelers: z.number().optional(),
    budget_tier: budgetTierSchema.nullable().optional(),
    preferences: z.record(z.string(), z.unknown()).nullable().optional(),
    dietary_restrictions: z.array(z.string()).nullable().optional(),
    mobility_needs: z.string().nullable().optional(),
    vibes: z.array(z.string()).nullable().optional(),
    status: tripStatusSchema.optional(),
    search_id: z.string().nullable().optional(),
    plan_revision_id: z.string().nullable().optional(),
    is_shared: z.boolean().nullable().optional(),
    share_token: z.string().nullable().optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    itineraries: z
      .union([z.array(itineraryJoinSchema), itineraryJoinSchema])
      .nullable()
      .optional(),
  })
  .passthrough();

const topHotelCandidateSchema = z
  .object({
    name: z.string(),
  })
  .passthrough();

const topHotelSchema = z.custom<HotelResult>(
  (val) => topHotelCandidateSchema.safeParse(val).success,
);

const searchTopHotelRowSchema = z
  .object({
    status: z.string().optional(),
    intermediate_results: z
      .object({
        topHotel: z.unknown().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

const generatedItinerarySchema = z.custom<GeneratedItinerary>((val) =>
  Boolean(
    val &&
    typeof val === "object" &&
    !Array.isArray(val) &&
    "days" in val &&
    Array.isArray(val.days),
  ),
);

export async function loadTripForUserUncached(
  id: string,
  userId: string,
): Promise<TripResponse | null> {
  const db = getSupabase();
  const { data: rawTrip, error } = await db
    .from("trips")
    .select(
      "id, destination, start_date, end_date, status, travelers, budget, preferences, vibes, interests, dietary_restrictions, mobility_needs, budget_tier, user_id, search_id, plan_revision_id, is_shared, share_token, created_at, updated_at, itineraries(days, overview, total_cost, packing_list, general_tips, generated_at)",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error("Your trip could not be loaded. Please try again shortly.");
  }
  if (!rawTrip) return null;

  const parsedTrip = tripRowSchema.safeParse(rawTrip);
  if (!parsedTrip.success) {
    throw new Error("Your trip could not be loaded. Please try again shortly.");
  }

  const { itineraries, ...tripFields } = parsedTrip.data;
  const rawItinerary = Array.isArray(itineraries)
    ? itineraries[0] || null
    : itineraries || null;

  const trip: Trip = {
    ...tripFields,
    id: tripFields.id,
    user_id: tripFields.user_id,
    destination: tripFields.destination ?? "",
    start_date: tripFields.start_date ?? "",
    end_date: tripFields.end_date ?? "",
    travelers: tripFields.travelers ?? 1,
    budget_tier: tripFields.budget_tier ?? undefined,
    preferences: tripFields.preferences ?? undefined,
    dietary_restrictions: tripFields.dietary_restrictions ?? null,
    mobility_needs: tripFields.mobility_needs ?? null,
    vibes: tripFields.vibes ?? undefined,
    status: tripFields.status ?? "draft",
    search_id: tripFields.search_id ?? undefined,
    plan_revision_id: tripFields.plan_revision_id ?? null,
    is_shared: tripFields.is_shared ?? undefined,
    share_token: tripFields.share_token ?? null,
    created_at: tripFields.created_at ?? "",
    updated_at: tripFields.updated_at ?? "",
  };

  const itinerary: GeneratedItinerary | null = rawItinerary
    ? generatedItinerarySchema.parse({
        days: rawItinerary.days,
        overview: rawItinerary.overview,
        totalEstimatedCost: rawItinerary.total_cost,
        packingList: rawItinerary.packing_list,
        generalTips: rawItinerary.general_tips,
        generatedAt: rawItinerary.generated_at,
      })
    : null;

  // The current trip search is the only source of the global recommendation.
  // Do not substitute a day hotel or a newer search owned by somebody else.
  if (itinerary && trip.search_id) {
    const { data: rawSearch, error: searchError } = await db
      .from("searches")
      .select("status, intermediate_results")
      .eq("id", trip.search_id)
      .eq("user_id", userId)
      .maybeSingle();
    // Only a successful lookup can establish that no recommendation exists.
    // Fail the read on outages so clients retain their last usable trip.
    if (searchError) {
      throw new Error(
        "Your trip could not be loaded. Please try again shortly.",
      );
    }
    const parsedSearch = searchTopHotelRowSchema.safeParse(rawSearch);
    const rawTopHotel = parsedSearch.success
      ? parsedSearch.data.intermediate_results?.topHotel
      : undefined;
    const validTopHotel =
      parsedSearch.success &&
      parsedSearch.data.status === "completed" &&
      topHotelCandidateSchema.safeParse(rawTopHotel).success
        ? topHotelSchema.parse(rawTopHotel)
        : null;
    itinerary.topHotel = validTopHotel;
  }

  return {
    trip,
    itinerary: filterViatorDisplay(itinerary),
  };
}

export const loadTripForUser = cache(loadTripForUserUncached);
