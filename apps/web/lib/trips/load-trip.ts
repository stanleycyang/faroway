import "server-only";

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
  preferences?: Record<string, unknown>;
  vibes?: string[];
  status:
    "draft" | "generating" | "planned" | "generated" | "completed" | "failed";
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
      "id, destination, start_date, end_date, status, travelers, budget, preferences, vibes, interests, budget_tier, user_id, search_id, is_shared, share_token, created_at, updated_at, itineraries(days, overview, total_cost, packing_list, general_tips, generated_at)",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    console.error("Failed to load trip:", error.message);
    throw new Error("Unable to load this trip right now");
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

  return {
    trip: tripData as Trip,
    itinerary,
  };
}

export const loadTripForUser = cache(loadTripForUserUncached);
