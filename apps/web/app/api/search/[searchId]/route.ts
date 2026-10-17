import { filterViatorDisplay } from "@/lib/affiliates/viator-policy";
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
        "id, user_id, status, progress, created_at, completed_at, error_message, json_render_spec, intermediate_results, search_results(id, category, data, vibe_score), search_itineraries(day_number, date, title, summary, morning_activities, afternoon_activities, evening_activities, meals, estimated_cost, cost_currency, tips, hotel_id)",
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
        estimated_cost: number | null;
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

        // hotel_id references search_results.id, not the provider's data.id.
        const hotelsByResultId = new Map(
          resultsData
            .filter((row) => row.category === "hotel")
            .map((row) => [
              row.id,
              {
                ...row.data,
                id: typeof row.data.id === "string" ? row.data.id : row.id,
              } as unknown as HotelResult,
            ]),
        );

        const resultMap = <T>(category: string) =>
          new Map(
            resultsData
              .filter((row) => row.category === category)
              .map((row) => [
                row.id,
                {
                  ...row.data,
                  id: typeof row.data.id === "string" ? row.data.id : row.id,
                } as T,
              ]),
          );
        const activitiesByResultId = resultMap<ActivityResult>("activity");
        const diningByResultId = resultMap<DiningResult>("dining");
        const resolveReferences = <T>(
          ids: string[] | null,
          rows: Map<string, T>,
        ): T[] =>
          (ids ?? []).map((id) => {
            const result = rows.get(id);
            if (!result)
              throw new Error(
                "Saved itinerary references an unavailable search result",
              );
            return result;
          });

        const mealsForDay = (day: ItineraryRow) => {
          const meals = resolveReferences(day.meals, diningByResultId);
          const slots = ["morning", "afternoon", "evening"] as const;
          const output: Partial<Record<(typeof slots)[number], DiningResult>> =
            {};
          const savedDays: unknown = search.intermediate_results?.days;
          const schedules = Array.isArray(savedDays)
            ? savedDays.filter(
                (saved) =>
                  saved?.dayNumber === day.day_number &&
                  saved?.date === day.date,
              )
            : [];
          if (schedules.length > 1)
            throw new Error("Saved meal schedule is ambiguous");
          const selected: DiningResult[] = [];
          for (const [index, slot] of slots.entries()) {
            let candidates: DiningResult[];
            if (schedules.length === 1) {
              const scheduled: unknown = schedules[0][slot]?.meals;
              if (!Array.isArray(scheduled) || scheduled.length > 1)
                throw new Error("Saved meal schedule cannot be reconstructed");
              candidates = scheduled.length
                ? [
                    ...new Set(
                      meals.filter((meal) => meal.id === scheduled[0]?.id),
                    ),
                  ]
                : [];
              if (candidates.length !== scheduled.length)
                throw new Error("Saved meal reference is missing or ambiguous");
            } else {
              // Legacy rows have no slot metadata: accept only unambiguous placement.
              candidates = meals.filter((meal) =>
                meal.mealTypes?.includes(
                  (["breakfast", "lunch", "dinner"] as const)[index],
                ),
              );
            }
            if (candidates.length > 1)
              throw new Error("Saved meal schedule is ambiguous");
            if (candidates[0]) {
              output[slot] = candidates[0];
              selected.push(candidates[0]);
            }
          }
          if (
            meals.length !== selected.length ||
            meals.some(
              (meal) =>
                meals.filter((item) => item === meal).length !==
                selected.filter((item) => item === meal).length,
            )
          )
            throw new Error("Saved meals cannot be reconstructed without loss");
          return output;
        };

        const transportForDay = (day: ItineraryRow) => {
          const savedDays: unknown = search.intermediate_results?.days;
          const schedules = Array.isArray(savedDays)
            ? savedDays.filter(
                (saved) =>
                  saved?.dayNumber === day.day_number &&
                  saved?.date === day.date,
              )
            : [];
          if (schedules.length > 1)
            throw new Error("Saved transport schedule is ambiguous");
          const selected = schedules[0]?.transport;
          if (selected == null) return undefined;
          // The persisted TripDay projection has no provider ID. Match all of
          // its fields against this owned search's results, never rank/order.
          const matches = transport.filter(
            (candidate) =>
              (
                [
                  "type",
                  "provider",
                  "duration",
                  "stops",
                  "price",
                  "currency",
                ] as const
              ).every((key) => candidate[key] === selected[key]) &&
              (["departure", "arrival"] as const).every((endpoint) =>
                (["airport", "city", "dateTime"] as const).every(
                  (key) =>
                    candidate[endpoint]?.[key] === selected[endpoint]?.[key],
                ),
              ) &&
              (["affiliateUrl", "affiliatePartner"] as const).every(
                (key) =>
                  (candidate[key] || undefined) ===
                  (selected[key] || undefined),
              ),
          );
          if (matches.length !== 1)
            throw new Error(
              "Saved transport reference is missing or ambiguous",
            );
          return matches[0];
        };

        // Build itinerary from stored data
        const itinerary: SuggestedDay[] = (itineraryData || []).map(
          (day: ItineraryRow) => {
            const meals = mealsForDay(day);
            return {
              dayNumber: day.day_number,
              date: day.date,
              title: day.title,
              summary: day.summary,
              hotel: day.hotel_id
                ? hotelsByResultId.get(day.hotel_id)
                : undefined,
              morning: {
                activities: resolveReferences(
                  day.morning_activities,
                  activitiesByResultId,
                ),
                meal: meals.morning,
              },
              afternoon: {
                activities: resolveReferences(
                  day.afternoon_activities,
                  activitiesByResultId,
                ),
                meal: meals.afternoon,
              },
              evening: {
                activities: resolveReferences(
                  day.evening_activities,
                  activitiesByResultId,
                ),
                meal: meals.evening,
              },
              transport: transportForDay(day),
              estimatedCost: day.estimated_cost ?? undefined,
              currency: day.cost_currency,
              tips: day.tips || [],
            };
          },
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

    // If error, include error message
    if (search.status === "error") {
      response.error = search.error_message || "An error occurred";
    }

    return NextResponse.json(filterViatorDisplay(response));
  } catch (error) {
    console.error("[Search Status] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
