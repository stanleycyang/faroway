import { NextRequest, NextResponse } from "next/server";
import { createClientFromRequest, getSupabase } from "@/lib/supabase/server";
import { z } from "zod";

const ClaimTripsSchema = z.object({
  tripIds: z.array(z.string().uuid()).min(1).max(20),
});

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parseResult = ClaimTripsSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.issues },
        { status: 400 },
      );
    }

    const { tripIds } = parseResult.data;
    const db = getSupabase();

    // Claim trips: set user_id and clear expires_at (only for unclaimed anonymous trips)
    const { data: claimedTrips, error: claimError } = await db
      .from("trips")
      .update({ user_id: user.id, expires_at: null })
      .is("user_id", null)
      .in("id", tripIds)
      .select("id, search_id");

    if (claimError) {
      console.error("Claim trips error:", claimError);
      return NextResponse.json(
        { error: "Failed to claim trips" },
        { status: 500 },
      );
    }

    // Also update associated searches to link to the new user
    const searchIds = (claimedTrips || [])
      .map((t: { id: string; search_id: string | null }) => t.search_id)
      .filter((id): id is string => !!id);

    if (searchIds.length > 0) {
      await db
        .from("searches")
        .update({ user_id: user.id })
        .is("user_id", null)
        .in("id", searchIds);
    }

    return NextResponse.json({
      claimed: (claimedTrips || []).length,
      tripIds: (claimedTrips || []).map(
        (t: { id: string; search_id: string | null }) => t.id,
      ),
    });
  } catch (error) {
    console.error("Claim trips error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
