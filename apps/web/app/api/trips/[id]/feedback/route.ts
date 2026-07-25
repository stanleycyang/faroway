import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonRequest } from "@/lib/api/json";
import { requireUserIdFromRequest } from "@/lib/auth/middleware";
import { checkRateLimitAsync } from "@/lib/security/rate-limit";
import { getSupabase } from "@/lib/supabase/server";

const FeedbackSchema = z.object({
  score: z.number().int().min(1).max(5),
  wouldUseAgain: z.boolean().optional(),
  issueTags: z
    .array(
      z.enum([
        "great_fit",
        "easy_to_use",
        "incorrect",
        "generic",
        "missing_places",
        "unrealistic_pacing",
        "budget_mismatch",
      ]),
    )
    .max(5)
    .default([]),
  comment: z.string().trim().max(1000).optional(),
  source: z.enum(["web", "mobile"]).default("web"),
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id: tripId } = await params;
  if (!z.string().uuid().safeParse(tripId).success) {
    return NextResponse.json({ error: "Invalid trip ID" }, { status: 400 });
  }

  const auth = await requireUserIdFromRequest(request);
  if (auth instanceof NextResponse) return auth;

  const rateLimit = await checkRateLimitAsync(`trip-feedback:${auth.userId}`, {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000,
    failClosed: true,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many feedback updates" },
      { status: 429 },
    );
  }

  const body = await parseJsonRequest(request);
  if (!body.ok) return body.response;

  const parsed = FeedbackSchema.safeParse(body.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid feedback", details: parsed.error.issues },
      { status: 400 },
    );
  }

  const db = getSupabase();
  const { data: trip, error: tripError } = await db
    .from("trips")
    .select("id, status")
    .eq("id", tripId)
    .eq("user_id", auth.userId)
    .single();

  if (tripError || !trip) {
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  }

  if (!["planned", "generated", "completed"].includes(trip.status)) {
    return NextResponse.json(
      { error: "Feedback is available after itinerary generation" },
      { status: 409 },
    );
  }

  const feedback = parsed.data;
  const { error } = await db.from("trip_feedback").upsert(
    {
      trip_id: tripId,
      user_id: auth.userId,
      score: feedback.score,
      would_use_again: feedback.wouldUseAgain ?? null,
      issue_tags: [...new Set(feedback.issueTags)],
      comment: feedback.comment || null,
      source: feedback.source,
    },
    { onConflict: "trip_id,user_id" },
  );

  if (error) {
    console.error("[Trip Feedback] Database error:", error);
    return NextResponse.json(
      { error: "Failed to save feedback" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
