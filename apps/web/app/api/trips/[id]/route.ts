import { NextRequest, NextResponse } from "next/server";
import { createClientFromRequest, getSupabase } from "@/lib/supabase/server";
import { requireUserIdFromRequest } from "@/lib/auth/middleware";
import {
  UpdateBriefSchema,
  validBriefComposition,
  isValidDateRange,
} from "@/lib/trips/brief";
import { loadTripForUserUncached } from "@/lib/trips/load-trip";

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
    if (!body?.expectedUpdatedAt)
      return NextResponse.json(
        {
          error:
            "Editing requires a newer app. Update the app or open this trip on the Faroway website to edit safely. Your saved trip is unchanged.",
          webUrl: `${process.env.NEXT_PUBLIC_BASE_URL || "https://www.faroway.ai"}/trips/${encodeURIComponent(id)}`,
          code: "REVISION_REQUIRED",
        },
        { status: 428 },
      );
    const parsed = UpdateBriefSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Invalid trip brief", details: parsed.error.issues },
        { status: 400 },
      );
    const { expectedUpdatedAt, ...changes } = parsed.data;
    const { data: existing, error: readError } = await db
      .from("trips")
      .select("*")
      .eq("id", id)
      .eq("user_id", auth.userId)
      .single();
    if (readError || !existing)
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    if (existing.status === "generating")
      return NextResponse.json(
        {
          error:
            "Your brief is locked while planning. Wait for planning to finish before editing.",
          code: "PLANNING_IN_PROGRESS",
        },
        { status: 409 },
      );
    if (existing.updated_at !== expectedUpdatedAt)
      return NextResponse.json(
        {
          error:
            "This trip changed in another tab or device. Load the latest brief before saving.",
          code: "REVISION_CONFLICT",
        },
        { status: 409 },
      );
    const preferences = { ...existing.preferences, ...changes.preferences };
    if (
      !isValidDateRange(
        changes.start_date ?? existing.start_date,
        changes.end_date ?? existing.end_date,
      ) ||
      !validBriefComposition(
        changes.travelers ?? existing.travelers,
        preferences,
      )
    )
      return NextResponse.json(
        { error: "Check the trip dates and traveler counts" },
        { status: 400 },
      );
    const { data: trip, error } = await db
      .rpc("update_trip_brief", {
        p_trip_id: id,
        p_user_id: auth.userId,
        p_expected_updated_at: expectedUpdatedAt,
        p_changes: { ...changes, preferences },
      })
      .maybeSingle();
    if (error?.code === "40001" || (!error && !trip))
      return NextResponse.json(
        {
          error:
            "Planning started or the brief changed. Refresh before saving.",
          code: "REVISION_CONFLICT",
        },
        { status: 409 },
      );
    if (error)
      return NextResponse.json(
        {
          error:
            "Could not save the brief. Refresh to check whether it was saved before retrying.",
        },
        { status: 503 },
      );

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
