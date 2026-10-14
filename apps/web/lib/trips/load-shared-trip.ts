import "server-only";

import { filterViatorDisplay } from "@/lib/affiliates/viator-policy";

import { cache } from "react";
import type { TripDay } from "@faroway/types";
import { getSupabase } from "@/lib/supabase/server";
import { readSavedItinerary } from "@/lib/trips/read-itinerary";

export interface SharedItineraryData {
  days: TripDay[];
  overview: string | null;
  total_cost: { amount: number; currency: string } | null;
  packing_list: string[] | null;
  general_tips: string[] | null;
  generated_at: string | null;
}

export interface SharedTripData {
  destination: string;
  start_date: string;
  end_date: string;
  travelers: number;
  preferences: Record<string, unknown> | null;
  vibes: string[] | null;
  budget_tier: string | null;
  itineraries: SharedItineraryData[] | SharedItineraryData | null;
}

async function loadSharedTripUncached(
  token: string,
): Promise<SharedTripData | null> {
  if (!/^[a-zA-Z0-9_-]+$/.test(token)) return null;

  const supabase = getSupabase();
  const { data: trip, error } = await supabase
    .from("trips")
    .select(
      `
      destination, start_date, end_date, travelers, preferences, vibes, budget_tier,
      itineraries(days, overview, total_cost, packing_list, general_tips, generated_at)
    `,
    )
    .eq("share_token", token)
    .eq("is_shared", true)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(
      "The shared trip could not be loaded. Please try again shortly.",
    );
  }
  if (!trip) return null;
  const shared = filterViatorDisplay(trip as SharedTripData);
  const itineraries = Array.isArray(shared.itineraries)
    ? shared.itineraries
    : shared.itineraries
      ? [shared.itineraries]
      : [];
  for (const itinerary of itineraries) {
    readSavedItinerary({
      days: itinerary.days,
      overview: itinerary.overview,
      packingList: itinerary.packing_list,
      generalTips: itinerary.general_tips,
    });
  }
  return shared;
}

export const loadSharedTrip = cache(loadSharedTripUncached);
