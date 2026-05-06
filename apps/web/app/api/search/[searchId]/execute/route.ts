/**
 * POST /api/search/[searchId]/execute
 * Execute the search workflow (internal endpoint)
 * This runs all agents and saves results to the database
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { z } from "zod";

// Allow up to 60 seconds for AI generation (requires Vercel Pro plan)
// On Hobby plan, this will be capped at 10 seconds
export const maxDuration = 60;
import {
  SearchInput,
  SearchProgress,
  SearchResults,
  HotelResult,
  ActivityResult,
  DiningResult,
  TransportResult,
} from "@/lib/search/types";
import {
  runOrchestratorAgent,
  runHotelsAgent,
  runActivitiesAgent,
  runDiningAgent,
  runTransportAgent,
  runAggregatorAgent,
} from "@/lib/search/agents";
import { runSearchEnrichment } from "@/lib/search/enrichment";

const SearchInputSchema = z.object({
  destination: z.string().min(1).max(200).trim(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  travelers: z.number().int().min(1).max(50).optional(),
  travelerType: z
    .enum(["solo", "couple", "family", "friends", "business"])
    .optional(),
  vibes: z.array(z.string().max(50)).max(10).optional(),
  budget: z.enum(["budget", "moderate", "luxury"]).optional(),
  originCity: z.string().max(200).optional(),
  originAirport: z.string().max(10).optional(),
});

// Helper to update progress
async function updateProgress(
  searchId: string,
  progress: Partial<SearchProgress>,
) {
  const { data: current } = await getSupabase()
    .from("searches")
    .select("progress")
    .eq("id", searchId)
    .single();

  const newProgress = { ...current?.progress, ...progress };

  await getSupabase()
    .from("searches")
    .update({ progress: newProgress })
    .eq("id", searchId);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ searchId: string }> },
) {
  const { searchId } = await params;
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const parseResult = SearchInputSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parseResult.error.issues },
      { status: 400 },
    );
  }

  const input: SearchInput = {
    ...parseResult.data,
    travelers: parseResult.data.travelers || 2,
    vibes: parseResult.data.vibes || [],
    budget: parseResult.data.budget || "moderate",
  };

  try {
    console.log(
      `[Search Execute] Starting search ${searchId} for ${input.destination}`,
    );

    // Step 1: Orchestrator
    await updateProgress(searchId, { orchestrator: "searching" });
    const searchPlan = await runOrchestratorAgent(input);
    await updateProgress(searchId, { orchestrator: "done" });
    console.log(`[Search Execute] Orchestrator complete for ${searchId}`);

    // Step 2: Run agents in parallel
    await updateProgress(searchId, {
      hotels: "searching",
      activities: "searching",
      dining: "searching",
      transport: "searching",
      enrichment: "searching",
    });

    const [
      hotelsResult,
      activitiesResult,
      diningResult,
      transportResult,
      enrichmentResult,
    ] = await Promise.allSettled([
      runHotelsAgent(searchPlan, 10).then(async (results) => {
        console.log(
          `[Search Execute] Hotels complete: ${results.length} results`,
        );
        return results;
      }),
      runActivitiesAgent(searchPlan, 15).then(async (results) => {
        console.log(
          `[Search Execute] Activities complete: ${results.length} results`,
        );
        return results;
      }),
      runDiningAgent(searchPlan, 12).then(async (results) => {
        console.log(
          `[Search Execute] Dining complete: ${results.length} results`,
        );
        return results;
      }),
      runTransportAgent(searchPlan, input.travelers || 1, 5).then(
        async (results) => {
          console.log(
            `[Search Execute] Transport complete: ${results.length} results`,
          );
          return results;
        },
      ),
      runSearchEnrichment(searchPlan, searchId).then(async (results) => {
        console.log(
          `[Search Execute] Enrichment complete: ${results.activities.length} activities, ${results.dining.length} dining`,
        );
        return results;
      }),
    ]);

    const hotels =
      hotelsResult.status === "fulfilled" ? hotelsResult.value : [];
    const baseActivities =
      activitiesResult.status === "fulfilled" ? activitiesResult.value : [];
    const baseDining =
      diningResult.status === "fulfilled" ? diningResult.value : [];
    const transport =
      transportResult.status === "fulfilled" ? transportResult.value : [];
    const enrichment =
      enrichmentResult.status === "fulfilled"
        ? enrichmentResult.value
        : { activities: [], dining: [], notes: [] };
    const activities = [...baseActivities, ...enrichment.activities];
    const dining = [...baseDining, ...enrichment.dining];

    for (const [name, result] of [
      ["hotels", hotelsResult],
      ["activities", activitiesResult],
      ["dining", diningResult],
      ["transport", transportResult],
      ["enrichment", enrichmentResult],
    ] as const) {
      if (result.status === "rejected") {
        console.error(`[Search Execute] ${name} agent failed:`, result.reason);
      }
    }

    await updateProgress(searchId, {
      hotels: hotelsResult.status === "fulfilled" ? "done" : "error",
      activities: activitiesResult.status === "fulfilled" ? "done" : "error",
      dining: diningResult.status === "fulfilled" ? "done" : "error",
      transport: transportResult.status === "fulfilled" ? "done" : "error",
      enrichment: enrichmentResult.status === "fulfilled" ? "done" : "error",
    });

    // Step 3: Aggregator
    await updateProgress(searchId, { aggregator: "searching" });
    const { days } = await runAggregatorAgent(
      searchPlan,
      hotels,
      activities,
      dining,
      transport,
    );
    await updateProgress(searchId, { aggregator: "done" });
    console.log(`[Search Execute] Aggregator complete: ${days.length} days`);

    // Step 4: Save all results to database (batch inserts)
    console.log(`[Search Execute] Saving results for ${searchId}`);

    const toResultRow = (
      category: string,
      item: HotelResult | ActivityResult | DiningResult | TransportResult,
    ) => {
      const hotel = category === "hotel" ? (item as HotelResult) : null;
      const activity =
        category === "activity" ? (item as ActivityResult) : null;
      const dining = category === "dining" ? (item as DiningResult) : null;
      const transport =
        category === "transport" ? (item as TransportResult) : null;

      if (transport) {
        return {
          search_id: searchId,
          category,
          name:
            transport.provider ||
            `${transport.departure.airport} to ${transport.arrival.airport}`,
          description: `${transport.departure.city} to ${transport.arrival.city}`,
          data: item,
          affiliate_url: transport.affiliateUrl,
          affiliate_partner: transport.affiliatePartner,
          price_amount: transport.price,
          price_currency: transport.currency,
          vibe_score: transport.vibeScore,
          rating: null,
          location_name: transport.arrival.city,
          location_address: null,
          location_lat: null,
          location_lng: null,
          image_url: undefined,
          images: [],
        };
      }

      const resultItem = item as HotelResult | ActivityResult | DiningResult;
      return {
        search_id: searchId,
        category,
        name: resultItem.name,
        description: resultItem.description,
        data: item,
        affiliate_url:
          hotel?.affiliateUrl ||
          activity?.affiliateUrl ||
          dining?.reservationUrl,
        affiliate_partner:
          hotel?.affiliatePartner ||
          activity?.affiliatePartner ||
          dining?.affiliatePartner,
        price_amount: hotel?.pricePerNight || activity?.price || null,
        price_currency: hotel?.currency || activity?.currency || "USD",
        vibe_score: resultItem.vibeScore,
        rating: activity?.rating || dining?.rating || hotel?.userRating,
        location_name: resultItem.location?.name,
        location_address: resultItem.location?.address,
        location_lat: resultItem.location?.lat,
        location_lng: resultItem.location?.lng,
        image_url: resultItem.images?.[0],
        images: resultItem.images || [],
      };
    };

    const resultRows = [
      ...hotels.map((h) => toResultRow("hotel", h)),
      ...activities.map((a) => toResultRow("activity", a)),
      ...dining.map((d) => toResultRow("dining", d)),
      ...transport.map((t) => toResultRow("transport", t)),
    ];

    if (resultRows.length > 0) {
      await getSupabase().from("search_results").insert(resultRows);
    }

    // Save itinerary days (batch)
    const itineraryRows = days.map((day) => ({
      search_id: searchId,
      day_number: day.dayNumber,
      date: day.date,
      title: day.title,
      summary: day.summary,
      morning_activities: day.morning.activities.map(
        (a: ActivityResult) => a.id,
      ),
      afternoon_activities: day.afternoon.activities.map(
        (a: ActivityResult) => a.id,
      ),
      evening_activities: day.evening.activities.map(
        (a: ActivityResult) => a.id,
      ),
      meals: [
        day.morning.meal?.id,
        day.afternoon.meal?.id,
        day.evening.meal?.id,
      ].filter(Boolean),
      estimated_cost: day.estimatedCost,
      cost_currency: day.currency,
      tips: day.tips,
    }));

    if (itineraryRows.length > 0) {
      await getSupabase().from("search_itineraries").insert(itineraryRows);
    }

    // Mark search as completed
    await getSupabase()
      .from("searches")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", searchId);

    console.log(`[Search Execute] Search ${searchId} completed successfully`);

    const results: SearchResults = {
      searchId,
      hotels,
      activities,
      dining,
      transport,
      itinerary: days,
    };

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error(`[Search Execute] Error for ${searchId}:`, error);

    // Mark search as failed
    await getSupabase()
      .from("searches")
      .update({
        status: "error",
        error_message: error instanceof Error ? error.message : "Unknown error",
      })
      .eq("id", searchId);

    return NextResponse.json(
      { error: "Search execution failed" },
      { status: 500 },
    );
  }
}
