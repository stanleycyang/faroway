import { NextRequest, NextResponse } from "next/server";
import { createClientFromRequest, getSupabase } from "@/lib/supabase/server";
import { requireUserIdFromRequest } from "@/lib/auth/middleware";
import { isValidDateOnly, isValidDateRange } from "@/lib/api/date-range";
import { loadTripForUserUncached } from "@/lib/trips/load-trip";
import { z } from "zod";

const DateOnlySchema = z
  .string()
  .refine(isValidDateOnly, "Must be a valid YYYY-MM-DD date");

const UpdateTripSchema = z
  .object({
    destination: z.string().min(1).max(200).trim().optional(),
    start_date: DateOnlySchema.optional(),
    end_date: DateOnlySchema.optional(),
    travelers: z.number().int().min(1).max(50).optional(),
    // User-initiated retries may return a failed trip to draft. Internal
    // generation routes own every other lifecycle transition.
    status: z.literal("draft").optional(),
    preferences: z.record(z.unknown()).optional(),
    vibes: z.array(z.string().max(50)).max(10).optional(),
    budget_tier: z.enum(["budget", "moderate", "luxury"]).optional(),
  })
  .strict()
  .refine(
    (data) =>
      !data.start_date ||
      !data.end_date ||
      isValidDateRange(data.start_date, data.end_date),
    {
      message: "End date must be on or after start date",
      path: ["end_date"],
    },
  );

type Params = {
  params: Promise<{
    id: string;
  }>;
};

// GET /api/trips/[id] - Fetch a specific trip with itinerary data
export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    // Validate ID format
    if (!/^[a-zA-Z0-9-]+$/.test(id)) {
      return NextResponse.json({ error: "Invalid trip ID" }, { status: 400 });
    }

    const auth = await requireUserIdFromRequest(request);
    if (auth instanceof NextResponse) return auth;
    const result = await loadTripForUserUncached(id, auth.userId);
    if (!result) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error fetching trip:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// PATCH /api/trips/[id] - Update a specific trip
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const auth = await requireUserIdFromRequest(request);
    if (auth instanceof NextResponse) return auth;
    const db = getSupabase();

    const body = await request.json();
    const parseResult = UpdateTripSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    if (
      parseResult.data.start_date ||
      parseResult.data.end_date ||
      parseResult.data.preferences !== undefined
    ) {
      const { data: existingTrip, error: existingTripError } = await db
        .from("trips")
        .select("start_date, end_date, preferences")
        .eq("id", id)
        .eq("user_id", auth.userId)
        .single();
      if (existingTripError || !existingTrip) {
        return NextResponse.json({ error: "Trip not found" }, { status: 404 });
      }
      const nextStart = parseResult.data.start_date ?? existingTrip.start_date;
      const nextEnd = parseResult.data.end_date ?? existingTrip.end_date;
      if (
        (parseResult.data.start_date || parseResult.data.end_date) &&
        !isValidDateRange(nextStart, nextEnd)
      ) {
        return NextResponse.json(
          { error: "End date must be on or after start date" },
          { status: 400 },
        );
      }
      if (parseResult.data.preferences !== undefined) {
        parseResult.data.preferences = {
          ...existingTrip.preferences,
          ...parseResult.data.preferences,
        };
      }
    }

    const { data: trip, error } = await db
      .from("trips")
      .update({ ...parseResult.data, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", auth.userId)
      .select()
      .single();

    if (error || !trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    return NextResponse.json({ trip });
  } catch (error) {
    console.error("Error updating trip:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/trips/[id] - Delete a specific trip (requires authentication)
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const supabase = await createClientFromRequest(request);

    // Delete requires authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error, count } = await supabase
      .from("trips")
      .delete({ count: "exact" })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Error deleting trip:", error);
      return NextResponse.json(
        { error: "Failed to delete trip" },
        { status: 500 },
      );
    }

    if (count === 0) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error("Error deleting trip:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
