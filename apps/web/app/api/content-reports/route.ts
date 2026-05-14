/**
 * Content reporting API for shared itinerary moderation.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { getSupabase } from "@/lib/supabase/server";
import { parseJsonRequest } from "@/lib/api/json";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

const ContentReportSchema = z.object({
  contentType: z.literal("shared_trip"),
  token: z.string().regex(/^[A-Za-z0-9_-]{8,128}$/),
  reason: z.enum([
    "offensive",
    "harassment",
    "unsafe",
    "spam",
    "privacy",
    "other",
  ]),
  details: z.string().trim().max(1000).optional(),
  reporterEmail: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.union([z.string().email().max(254), z.literal("")]).optional(),
  ),
});

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`content-report:${ip}`, {
    maxRequests: 5,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await parseJsonRequest(request);
    if (!body.ok) return body.response;

    const parseResult = ContentReportSchema.safeParse(body.data);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const data = parseResult.data;
    const supabase = getSupabase();

    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, user_id")
      .eq("share_token", data.token)
      .eq("is_shared", true)
      .single();

    if (tripError || !trip) {
      return NextResponse.json(
        { error: "Shared itinerary not found" },
        { status: 404 },
      );
    }

    const { error } = await supabase.from("content_reports").insert({
      content_type: data.contentType,
      content_token: data.token,
      content_url: `/s/${data.token}`,
      reported_trip_id: trip.id,
      reported_user_id: trip.user_id,
      reason: data.reason,
      details: data.details || null,
      reporter_email: data.reporterEmail || null,
      status: "open",
    });

    if (error) {
      logger.error("[Content Report] Database error:", error);
      return NextResponse.json(
        { error: "Failed to submit report" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[Content Report] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
