import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

function isAuthorizedCron(
  authHeader: string | null,
  cronSecret: string | undefined,
): boolean {
  if (!cronSecret || !authHeader) return false;
  const expected = `Bearer ${cronSecret}`;
  const providedHash = createHash("sha256").update(authHeader).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedHash, expectedHash);
}

export async function GET(request: NextRequest) {
  // Verify cron secret using constant-time comparison to prevent timing leaks
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!isAuthorizedCron(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getSupabase();

    const [tripsResult, rateLimitsResult, generationResult] = await Promise.all(
      [
        db.rpc("cleanup_expired_anonymous_trips"),
        db.rpc("cleanup_expired_rate_limits"),
        db.rpc("cleanup_stale_generation_state"),
      ],
    );

    if (tripsResult.error || rateLimitsResult.error || generationResult.error) {
      console.error(
        "Cleanup error:",
        tripsResult.error || rateLimitsResult.error || generationResult.error,
      );
      return NextResponse.json({ error: "Cleanup failed" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deletedTrips: tripsResult.data,
      deletedRateLimitBuckets: rateLimitsResult.data,
      repairedGenerationState: generationResult.data,
    });
  } catch (error) {
    console.error("Cron cleanup error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
