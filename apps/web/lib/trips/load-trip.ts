import "server-only";

import { filterViatorDisplay } from "@/lib/affiliates/viator-policy";

import { cache } from "react";
import type { GeneratedItinerary } from "@/lib/ai/types";
import { getSupabase } from "@/lib/supabase/server";

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
  status:
    | "draft"
    | "generating"
    | "planned"
    | "generated"
    | "completed"
    | "failed";
  search_id?: string;
  is_shared?: boolean;
  share_token?: string | null;
  created_at: string;
  updated_at: string;
}

export interface TripResponse {
  trip: Trip;
  itinerary: GeneratedItinerary | null;
}

interface ItineraryJoin {
  days: unknown;
  overview: string | null;
  total_cost: number | null;
  packing_list: string[] | null;
  general_tips: string[] | null;
  generated_at: string | null;
}

export async function loadTripForUserUncached(
  id: string,
  userId: string,
): Promise<TripResponse | null> {
  const db = getSupabase();
  const { data: trip, error } = await db
    .from("trips")
    .select(
      "id, destination, start_date, end_date, status, travelers, budget, preferences, vibes, interests, dietary_restrictions, mobility_needs, budget_tier, user_id, search_id, is_shared, share_token, created_at, updated_at, itineraries(days, overview, total_cost, packing_list, general_tips, generated_at)",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error("Your trip could not be loaded. Please try again shortly.");
  }
  if (!trip) return null;

  const { itineraries, ...tripData } = trip as typeof trip & {
    itineraries: ItineraryJoin[] | ItineraryJoin | null;
  };
  const rawItinerary = Array.isArray(itineraries)
    ? itineraries[0] || null
    : itineraries || null;

  const itinerary = rawItinerary
    ? ({
        days: rawItinerary.days,
        overview: rawItinerary.overview,
        totalEstimatedCost: rawItinerary.total_cost,
        packingList: rawItinerary.packing_list,
        generalTips: rawItinerary.general_tips,
        generatedAt: rawItinerary.generated_at,
      } as GeneratedItinerary)
    : null;

  // The current trip search is the only source of the global recommendation.
  // Do not substitute a day hotel or a newer search owned by somebody else.
  if (itinerary && tripData.search_id) {
    const { data: search, error: searchError } = await db
      .from("searches")
      .select("status, intermediate_results")
      .eq("id", tripData.search_id)
      .eq("user_id", userId)
      .maybeSingle();
    // Only a successful lookup can establish that no recommendation exists.
    // Fail the read on outages so clients retain their last usable trip.
    if (searchError) {
      throw new Error(
        "Your trip could not be loaded. Please try again shortly.",
      );
    }
    const topHotel = search?.intermediate_results?.topHotel;
    itinerary.topHotel =
      search?.status === "completed" &&
      topHotel &&
      typeof topHotel === "object" &&
      typeof topHotel.name === "string"
        ? topHotel
        : null;
  }

  return {
    trip: tripData as Trip,
    itinerary: filterViatorDisplay(itinerary),
  };
}

export const loadTripForUser = cache(loadTripForUserUncached);
