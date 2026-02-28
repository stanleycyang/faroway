import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getSupabase();

    const { data, error } = await db.rpc("cleanup_expired_anonymous_trips");

    if (error) {
      console.error("Cleanup error:", error);
      return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deletedTrips: data,
    });
  } catch (error) {
    console.error("Cron cleanup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
