import { NextRequest, NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";
import { isValidDateOnly, isValidDateRange } from "@/lib/api/date-range";
import { z } from "zod";

const DateOnlySchema = z
  .string()
  .refine(isValidDateOnly, "Must be a valid YYYY-MM-DD date");
const BudgetTierSchema = z.enum(["budget", "moderate", "luxury"]);

const CreateTripSchema = z
  .object({
    destination: z.string().min(1).max(200).trim(),
    start_date: DateOnlySchema,
    end_date: DateOnlySchema,
    travelers: z.number().int().min(1).max(50).optional(),
    budget: BudgetTierSchema.optional(),
    preferences: z
      .object({
        travelerType: z
          .enum(["solo", "couple", "family", "friends", "business"])
          .optional(),
        originCity: z.string().max(200).optional(),
        originAirport: z.string().max(10).optional(),
        vibes: z.array(z.string().max(50)).max(10).optional(),
        budget: BudgetTierSchema.optional(),
        adults: z.number().int().min(1).max(50).optional(),
        children: z.number().int().min(0).max(50).optional(),
        interests: z.array(z.string().max(50)).max(20).optional(),
      })
      .optional(),
  })
  .refine((data) => isValidDateRange(data.start_date, data.end_date), {
    message: "End date must be on or after start date",
    path: ["end_date"],
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
    const budgetTier = budget || preferences?.budget || "moderate";

    // Use the user-scoped client so RLS is enforced as defense-in-depth.
    // We still explicitly scope user_id from the verified session below, but
    // any future RLS policy on `trips` will also catch us if the auth check
    // here is ever bypassed.
    const { data: trip, error } = await supabase
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
