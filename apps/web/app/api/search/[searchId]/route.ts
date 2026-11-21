import { readPrice } from "@faroway/constants";
import { matchesTransportProjection } from "@/lib/search/transport-reference";
import { filterViatorDisplay } from "@/lib/affiliates/viator-policy";
import {
  parseActivityResult,
  parseDiningResult,
  parseHotelResult,
  parseSearchProgress,
  parseTransportResult,
  searchRecordRowSchema,
  tripDayTransportSchema,
  type ValidatedItineraryRow,
} from "@/lib/search/result-schemas";
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
import { z } from "zod";

const scheduledMealIdSchema = z
  .object({
    id: z.string().optional(),
  })
  .passthrough();

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
    const { data: rawSearch, error: searchError } = await getSupabase()
      .from("searches")
      .select(
        "id, user_id, status, progress, created_at, completed_at, error_message, json_render_spec, intermediate_results, search_results(id, category, data, vibe_score), search_itineraries(day_number, date, title, summary, morning_activities, afternoon_activities, evening_activities, meals, estimated_cost, cost_currency, tips, hotel_id, transport_id)",
      )
      .eq("id", searchId)
      .eq("user_id", user.id)
      .single();

    if (searchError || !rawSearch) {
      return NextResponse.json({ error: "Search not found" }, { status: 404 });
    }

    const parsedSearch = searchRecordRowSchema.safeParse(rawSearch);
    if (!parsedSearch.success) {
      console.error(
        "[Search Status] Invalid search row:",
        parsedSearch.error.issues,
      );
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    const search = parsedSearch.data;
    if (search.user_id !== user.id) {
      return NextResponse.json({ error: "Search not found" }, { status: 404 });
    }

    // Base response
    const response: SearchStatusResponse = {
      searchId: search.id,
      status: search.status,
      progress: parseSearchProgress(search.progress),
      createdAt: search.created_at,
      completedAt: search.completed_at || undefined,
    };

    // If completed, include results
    if (search.status === "completed") {
      const resultsData = [...search.search_results].sort(
        (a, b) => (b.vibe_score ?? 0) - (a.vibe_score ?? 0),
      );
      const itineraryData = [...search.search_itineraries].sort(
        (a, b) => a.day_number - b.day_number,
      );

      // Parse results by category using runtime schemas
      const hotelsByResultId = new Map<string, HotelResult>();
      const activitiesByResultId = new Map<string, ActivityResult>();
      const diningByResultId = new Map<string, DiningResult>();
      const transportByResultId = new Map<string, TransportResult>();

      const hotels: HotelResult[] = [];
      const activities: ActivityResult[] = [];
      const dining: DiningResult[] = [];
      const transport: TransportResult[] = [];

      for (const row of resultsData) {
        if (row.category === "hotel") {
          const parsed = parseHotelResult(row.data, row.id);
          hotels.push(parsed);
          hotelsByResultId.set(row.id, parsed);
        } else if (row.category === "activity") {
          const parsed = parseActivityResult(row.data, row.id);
          activities.push(parsed);
          activitiesByResultId.set(row.id, parsed);
        } else if (row.category === "dining") {
          const parsed = parseDiningResult(row.data, row.id);
          dining.push(parsed);
          diningByResultId.set(row.id, parsed);
        } else if (row.category === "transport") {
          const parsed = parseTransportResult(row.data, row.id);
          transport.push(parsed);
          transportByResultId.set(row.id, parsed);
        }
      }

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

      const savedDays = search.intermediate_results?.days ?? [];

      const mealsForDay = (day: ValidatedItineraryRow) => {
        const meals = resolveReferences(day.meals, diningByResultId);
        const slots = ["morning", "afternoon", "evening"] as const;
        const output: Partial<Record<(typeof slots)[number], DiningResult>> =
          {};
        const schedules = savedDays.filter(
          (saved) =>
            saved.dayNumber === day.day_number && saved.date === day.date,
        );
        if (schedules.length > 1)
          throw new Error("Saved meal schedule is ambiguous");
        const selected: DiningResult[] = [];
        for (const [index, slot] of slots.entries()) {
          let candidates: DiningResult[];
          if (schedules.length === 1) {
            const scheduled = schedules[0][slot]?.meals;
            if (!Array.isArray(scheduled) || scheduled.length > 1)
              throw new Error("Saved meal schedule cannot be reconstructed");
            const scheduledItem = scheduled.length
              ? scheduledMealIdSchema.safeParse(scheduled[0])
              : null;
            const scheduledId = scheduledItem?.success
              ? scheduledItem.data.id
              : undefined;
            candidates = scheduled.length
              ? [...new Set(meals.filter((meal) => meal.id === scheduledId))]
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

      const transportForDay = (day: ValidatedItineraryRow) => {
        if (day.transport_id != null)
          return resolveReferences([day.transport_id], transportByResultId)[0];
        // Legacy rows predate persisted transport UUIDs. Keep the conservative
        // projection fallback only for those rows.
        const schedules = savedDays.filter(
          (saved) =>
            saved.dayNumber === day.day_number && saved.date === day.date,
        );
        if (schedules.length > 1)
          throw new Error("Saved transport schedule is ambiguous");
        const selected = schedules[0]?.transport;
        if (selected == null) return undefined;
        const parsedSelected = tripDayTransportSchema.safeParse(selected);
        if (!parsedSelected.success)
          throw new Error("Saved transport reference is missing or ambiguous");
        // The persisted TripDay projection has no provider ID. Match all of
        // its fields against this owned search's results, never rank/order.
        const matches = transport.filter((candidate) =>
          matchesTransportProjection(candidate, parsedSelected.data),
        );
        if (matches.length !== 1)
          throw new Error("Saved transport reference is missing or ambiguous");
        return matches[0];
      };

      // Build itinerary from stored data
      const itinerary: SuggestedDay[] = itineraryData.map((day) => {
        const meals = mealsForDay(day);
        return {
          dayNumber: day.day_number,
          date: day.date,
          title: day.title,
          summary: day.summary,
          hotel: day.hotel_id ? hotelsByResultId.get(day.hotel_id) : undefined,
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
          estimatedCost: readPrice(day.estimated_cost, day.cost_currency)
            ?.amount,
          currency: readPrice(day.estimated_cost, day.cost_currency)?.currency,
          tips: day.tips,
        };
      });

      response.results = {
        searchId,
        hotels,
        activities,
        dining,
        transport,
        itinerary,
      };

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
