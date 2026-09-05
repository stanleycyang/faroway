/**
 * GET /api/search/[searchId]
 * Get search status and results
 */

import { NextRequest, NextResponse } from "next/server";
import { createClientFromRequest, getSupabase } from "@/lib/supabase/server";
import {
  SearchStatusResponse,
  HotelResult,
  ActivityResult,
  DiningResult,
  TransportResult,
  SuggestedDay,
} from "@/lib/search/types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ searchId: string }> },
) {
  const { searchId } = await params;

  try {
    const requestClient = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await requestClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get search record with results and itinerary in a single joined query
    const { data: search, error: searchError } = await getSupabase()
      .from("searches")
      .select(
        "id, user_id, status, progress, created_at, completed_at, error_message, json_render_spec, search_results(id, category, data, vibe_score), search_itineraries(day_number, date, title, summary, morning_activities, afternoon_activities, evening_activities, meals, estimated_cost, cost_currency, tips, hotel_id)",
      )
      .eq("id", searchId)
      .eq("user_id", user.id)
      .single();

    if (searchError || !search || search.user_id !== user.id) {
      return NextResponse.json({ error: "Search not found" }, { status: 404 });
    }

    // Base response
    const response: SearchStatusResponse = {
      searchId: search.id,
      status: search.status,
      progress: search.progress,
      createdAt: search.created_at,
      completedAt: search.completed_at || undefined,
    };

    // If completed, include results
    if (search.status === "completed") {
      interface SearchResultRow {
        id: string;
        category: string;
        data: Record<string, unknown>;
        vibe_score: number | null;
      }
      interface ItineraryRow {
        day_number: number;
        date: string;
        title: string;
        summary: string;
        morning_activities: string[] | null;
        afternoon_activities: string[] | null;
        evening_activities: string[] | null;
        meals: string[] | null;
        estimated_cost: number;
        cost_currency: string;
        tips: string[];
        hotel_id: string | null;
      }

      const searchWithRelations = search as typeof search & {
        search_results?: SearchResultRow[];
        search_itineraries?: ItineraryRow[];
      };

      const resultsData = (searchWithRelations.search_results || []).sort(
        (a: SearchResultRow, b: SearchResultRow) =>
          (b.vibe_score ?? 0) - (a.vibe_score ?? 0),
      );
      const itineraryData = (searchWithRelations.search_itineraries || []).sort(
        (a: ItineraryRow, b: ItineraryRow) => a.day_number - b.day_number,
      );

      if (resultsData) {
        // Parse results by category
        const hotels: HotelResult[] = resultsData
          .filter((r: SearchResultRow) => r.category === "hotel")
          .map(
            (r: SearchResultRow) =>
              ({
                ...r.data,
                id: typeof r.data.id === "string" ? r.data.id : r.id,
              }) as unknown as HotelResult,
          );

        const activities: ActivityResult[] = resultsData
          .filter((r: SearchResultRow) => r.category === "activity")
          .map(
            (r: SearchResultRow) =>
              ({
                ...r.data,
                id: typeof r.data.id === "string" ? r.data.id : r.id,
              }) as unknown as ActivityResult,
          );

        const dining: DiningResult[] = resultsData
          .filter((r: SearchResultRow) => r.category === "dining")
          .map(
            (r: SearchResultRow) =>
              ({
                ...r.data,
                id: typeof r.data.id === "string" ? r.data.id : r.id,
              }) as unknown as DiningResult,
          );

        const transport: TransportResult[] = resultsData
          .filter((r: SearchResultRow) => r.category === "transport")
          .map(
            (r: SearchResultRow) =>
              ({
                ...r.data,
                id: typeof r.data.id === "string" ? r.data.id : r.id,
              }) as unknown as TransportResult,
          );

        // Build itinerary from stored data
        const itinerary: SuggestedDay[] = (itineraryData || []).map(
          (day: ItineraryRow) => ({
            dayNumber: day.day_number,
            date: day.date,
            title: day.title,
            summary: day.summary,
            hotel: hotels[0], // Top hotel for all days
            morning: {
              activities: activities.filter((a) =>
                (day.morning_activities || []).includes(a.id),
              ),
              meal: dining.find(
                (d) =>
                  (day.meals || []).includes(d.id) &&
                  d.mealTypes?.includes("breakfast"),
              ),
            },
            afternoon: {
              activities: activities.filter((a) =>
                (day.afternoon_activities || []).includes(a.id),
              ),
              meal: dining.find(
                (d) =>
                  (day.meals || []).includes(d.id) &&
                  d.mealTypes?.includes("lunch"),
              ),
            },
            evening: {
              activities: activities.filter((a) =>
                (day.evening_activities || []).includes(a.id),
              ),
              meal: dining.find(
                (d) =>
                  (day.meals || []).includes(d.id) &&
                  d.mealTypes?.includes("dinner"),
              ),
            },
            estimatedCost: day.estimated_cost,
            currency: day.cost_currency,
            tips: day.tips || [],
          }),
        );

        response.results = {
          searchId,
          hotels,
          activities,
          dining,
          transport,
          itinerary,
        };
      }

      // Include the json-render spec if available
      if (search.json_render_spec) {
        response.jsonRenderSpec = search.json_render_spec;
      }
    }

    // Stored provider and workflow errors may contain implementation details.
    if (search.status === "error") {
      response.error = "Search failed. Please try again.";
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Search Status] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
