import { validBriefComposition } from "@/lib/trips/brief";
import { hotelSearchEnabled } from "@/lib/trips/hotel-quotes";
import { NextRequest, NextResponse } from "next/server";
import { createClientFromRequest, getSupabase } from "@/lib/supabase/server";
import { CreateTripSchema } from "@/lib/trips/create-trip-command";
import { createHash } from "node:crypto";
import {
  readTripCursor,
  writeTripCursor,
  TRIP_PAGE_SIZE,
} from "@/lib/trips/list-cursor";

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

    // Fetch trips for the verified account.
    const cursorValue = request.nextUrl.searchParams.get("cursor");
    const cursor = cursorValue === null ? null : readTripCursor(cursorValue);
    if (cursorValue !== null && !cursor)
      return NextResponse.json(
        { error: "Invalid trip list cursor" },
        { status: 400 },
      );
    let query = supabase
      .from("trips")
      .select(
        "id, user_id, destination, start_date, end_date, status, travelers, budget, vibes, budget_tier, preferences, search_id, created_at, updated_at",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(TRIP_PAGE_SIZE + 1);
    if (cursor)
      query = query.or(
        `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
      );
    const { data: trips, error } = await query;

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch trips" },
        { status: 500 },
      );
    }

    const page = (trips || []).slice(0, TRIP_PAGE_SIZE);
    const nextCursor =
      trips && trips.length > TRIP_PAGE_SIZE
        ? writeTripCursor(page[page.length - 1])
        : null;
    // Private trip data must be reauthorized after account changes.
    return NextResponse.json(
      { trips: page, nextCursor },
      {
        headers: {
          "Cache-Control": "private, no-store",
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
      requestId,
      destination,
      start_date,
      end_date,
      travelers,
      budget,
      preferences,
    } = parseResult.data;

    if (preferences?.hotelSearch != null && !hotelSearchEnabled())
      return NextResponse.json(
        { error: "Hotel preferences are temporarily unavailable" },
        { status: 503 },
      );
    if (!validBriefComposition(travelers ?? 1, preferences ?? {}))
      return NextResponse.json(
        { error: "Adults and children must add up to the traveler count" },
        { status: 400 },
      );

    // Resolve budget: top-level field takes priority, then preferences.budget
    const budgetTier =
      budget ||
      (preferences?.budget as "budget" | "moderate" | "luxury") ||
      "moderate";

    const requestHash = createHash("sha256")
      .update(JSON.stringify({ ...parseResult.data, requestId: undefined }))
      .digest("hex");

    const input = {
      ...(requestId ? { id: requestId } : {}),
      user_id: user.id,
      destination,
      start_date,
      end_date,
      travelers: travelers || 1,
      budget_tier: budgetTier,
      vibes: preferences?.vibes,
      preferences: {
        ...(requestId ? { creationRequestHash: requestHash } : {}),
        travelerType: preferences?.travelerType,
        originCity: preferences?.originCity,
        originAirport: preferences?.originAirport,
        adults: preferences?.adults,
        children: preferences?.children,
        interests: preferences?.interests,
        hotelSearch: preferences?.hotelSearch,
      },
      status: "draft",
    };
    if (requestId) {
      // A private durable identity survives trip deletion. Missing schema must
      // fail closed instead of falling back to an insert that could duplicate work.
      const { data, error } = await getSupabase().rpc("create_trip_once", {
        p_user_id: user.id,
        p_request_key: requestId,
        p_input: input,
      });
      if (error?.code === "23505")
        return NextResponse.json(
          {
            error:
              "This creation identity is unavailable. Open your saved trips.",
          },
          { status: 409 },
        );
      if (error || !data)
        return NextResponse.json(
          {
            error:
              "Trip creation could not be confirmed. Keep this request and retry.",
            code: "CREATION_UNCONFIRMED",
          },
          { status: 503 },
        );
      if (data.outcome === "gone")
        return NextResponse.json(
          {
            error:
              "This trip was deleted. Start a new trip explicitly to plan again.",
            code: "CREATION_DELETED",
          },
          { status: 410 },
        );
      if (data.outcome === "key_conflict")
        return NextResponse.json(
          {
            error:
              "This request cannot be reused for a different trip. Open your saved trips to continue.",
          },
          { status: 409 },
        );
      if (!["created", "replayed"].includes(data.outcome) || !data.trip)
        return NextResponse.json(
          { error: "Trip creation could not be confirmed." },
          { status: 503 },
        );
      return NextResponse.json(
        { trip: data.trip },
        {
          status: data.outcome === "created" ? 201 : 200,
          headers: { "Cache-Control": "no-store" },
        },
      );
    }
    // Legacy unkeyed clients retain the user-scoped RLS insert path.
    const { data: trip, error } = await supabase
      .from("trips")
      .insert(input)
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
