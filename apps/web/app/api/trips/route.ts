import { NextRequest, NextResponse } from "next/server";
import { createClientFromRequest, getSupabase } from "@/lib/supabase/server";
import { z } from "zod";

const CreateTripSchema = z.object({
  destination: z.string().min(1).max(200).trim(),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  travelers: z.number().int().min(1).max(50).optional(),
  budget: z.enum(["budget", "moderate", "luxury"]).optional(),
  preferences: z
    .object({
      travelerType: z
        .enum(["solo", "couple", "family", "friends", "business"])
        .optional(),
      originCity: z.string().max(200).optional(),
      originAirport: z.string().max(10).optional(),
      vibes: z.array(z.string().max(50)).max(10).optional(),
      budget: z.string().max(50).optional(),
      adults: z.number().int().min(1).max(50).optional(),
      children: z.number().int().min(0).max(50).optional(),
      interests: z.array(z.string().max(50)).max(20).optional(),
    })
    .optional(),
});

// GET /api/trips - Fetch all trips for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch user's trips from database (with caching headers for performance)
    const { data: trips, error } = await supabase
      .from("trips")
      .select(
        "id, destination, start_date, end_date, status, travelers, budget, vibes, budget_tier, preferences, search_id, created_at, updated_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch trips" },
        { status: 500 },
      );
    }

    // Return with cache headers for better performance
    return NextResponse.json(
      { trips: trips || [] },
      {
        headers: {
          "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
        },
      },
    );
  } catch (error) {
    console.error("Error fetching trips:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/trips - Create a new trip (authentication required)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = CreateTripSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.issues },
        { status: 400 },
      );
    }

    const {
      destination,
      start_date,
      end_date,
      travelers,
      budget,
      preferences,
    } = parseResult.data;

    // Resolve budget: top-level field takes priority, then preferences.budget
    const budgetTier =
      budget ||
      (preferences?.budget as "budget" | "moderate" | "luxury") ||
      "moderate";

    // Service client is fine here because we explicitly scope user_id from the
    // verified Supabase session — RLS would also enforce, but this keeps the
    // insert consistent with the rest of the trip lifecycle (generate/stream).
    const db = getSupabase();

    const { data: trip, error } = await db
      .from("trips")
      .insert({
        user_id: user.id,
        destination,
        start_date,
        end_date,
        travelers: travelers || 1,
        budget_tier: budgetTier,
        vibes: preferences?.vibes,
        preferences: {
          travelerType: preferences?.travelerType,
          originCity: preferences?.originCity,
          originAirport: preferences?.originAirport,
        },
        status: "draft",
      })
      .select()
      .single();

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to create trip" },
        { status: 500 },
      );
    }

    return NextResponse.json({ trip }, { status: 201 });
  } catch (error) {
    console.error("Error creating trip:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
