import { NextRequest, NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";
import { nanoid } from "nanoid";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

// POST /api/trips/[id]/share - Enable sharing
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    if (!/^[a-zA-Z0-9-]+$/.test(id)) {
      return NextResponse.json({ error: "Invalid trip ID" }, { status: 400 });
    }

    const supabase = await createClientFromRequest(request);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch current trip to check ownership and existing token
    const { data: trip, error: fetchError } = await supabase
      .from("trips")
      .select("id, share_token, is_shared, user_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const shareToken = trip.share_token || nanoid(12);
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("trips")
      .update({
        share_token: shareToken,
        is_shared: true,
        shared_at: trip.share_token ? undefined : now,
        updated_at: now,
      })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Error enabling sharing:", updateError);
      return NextResponse.json(
        { error: "Failed to enable sharing" },
        { status: 500 },
      );
    }

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL || "https://www.faroway.ai";
    const shareUrl = `${baseUrl}/s/${shareToken}`;

    return NextResponse.json({ shareUrl, shareToken });
  } catch (error) {
    console.error("Error in share POST:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/trips/[id]/share - Disable sharing
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    if (!/^[a-zA-Z0-9-]+$/.test(id)) {
      return NextResponse.json({ error: "Invalid trip ID" }, { status: 400 });
    }

    const supabase = await createClientFromRequest(request);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { count, error: updateError } = await supabase
      .from("trips")
      .update(
        {
          is_shared: false,
          updated_at: new Date().toISOString(),
        },
        { count: "exact" },
      )
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Error disabling sharing:", updateError);
      return NextResponse.json(
        { error: "Failed to disable sharing" },
        { status: 500 },
      );
    }

    if (count === 0) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in share DELETE:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
