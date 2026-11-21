import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase/server";
import { checkRateLimitAsync, getClientIp } from "@/lib/security/rate-limit";
import { filterViatorDisplay } from "@/lib/affiliates/viator-policy";

const TOKEN_PATTERN = /^[a-zA-Z0-9_-]{4,128}$/;
const VOTER_COOKIE_NAME = "faroway_voter";
const MAX_BODY_BYTES = 2_048;

const ReactionPayloadSchema = z.object({
  stopKey: z
    .string()
    .trim()
    .min(1, "Stop key is required")
    .max(160, "Stop key is too long")
    .regex(/^[a-zA-Z0-9:_-]+$/, "Invalid stop key format"),
  reaction: z.enum(["thumbs_up", "heart"]),
  action: z.enum(["add", "remove"]).default("add"),
});

export type ReactionType = "thumbs_up" | "heart";
export type ReactionCountsMap = Record<
  string,
  { thumbs_up: number; heart: number }
>;

function getTrustedClientIp(request: NextRequest): string {
  const vercelIp = request.headers
    .get("x-vercel-forwarded-for")
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .pop();
  if (vercelIp) return vercelIp;
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .pop();
  return forwarded || getClientIp(request);
}

function getVoterCookieSecret(): string | null {
  const dedicated = process.env.SHARED_REACTIONS_SECRET?.trim();
  if (dedicated) return dedicated;

  const ipSalt = process.env.IP_HASH_SALT?.trim();
  if (ipSalt) {
    return createHmac("sha256", ipSalt)
      .update("faroway:shared-reactions-voter-cookie:v1")
      .digest("hex");
  }

  if (process.env.NODE_ENV !== "production") {
    return "faroway-local-voter-secret";
  }

  return null;
}

function signVoterId(rawId: string, secret: string): string {
  const sig = createHmac("sha256", secret).update(rawId).digest("base64url");
  return `${rawId}.${sig}`;
}

function verifyVoterCookie(
  cookieValue: string | undefined,
  secret: string,
): string | null {
  if (!cookieValue) return null;
  const dotIdx = cookieValue.indexOf(".");
  if (dotIdx <= 0) return null;
  const rawId = cookieValue.slice(0, dotIdx);
  const sig = cookieValue.slice(dotIdx + 1);
  if (!/^[a-zA-Z0-9_-]{16,64}$/.test(rawId) || !sig) return null;
  const expected = createHmac("sha256", secret)
    .update(rawId)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return rawId;
}

function resolveVoterId(
  request: NextRequest,
  secret: string,
): {
  voterId: string;
  cookieToSet: string | null;
} {
  const existing = verifyVoterCookie(
    request.cookies.get(VOTER_COOKIE_NAME)?.value,
    secret,
  );
  if (existing) {
    return { voterId: existing, cookieToSet: null };
  }
  const freshId = `v_${randomBytes(16).toString("base64url")}`;
  return { voterId: freshId, cookieToSet: signVoterId(freshId, secret) };
}

function attachVoterCookie(
  response: NextResponse,
  signedCookie: string | null,
): NextResponse {
  if (signedCookie) {
    response.cookies.set(VOTER_COOKIE_NAME, signedCookie, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return response;
}

function slugifyKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function extractValidStopKeys(days: unknown): Set<string> {
  const keys = new Set<string>();
  if (!Array.isArray(days)) return keys;
  const slots = ["morning", "afternoon", "evening"] as const;

  for (const rawDay of days) {
    if (!rawDay || typeof rawDay !== "object") continue;
    const day = rawDay as Record<string, unknown>;
    const dayNumber = day.dayNumber;
    if (typeof dayNumber !== "number" && typeof dayNumber !== "string") {
      continue;
    }

    for (const slot of slots) {
      const block = day[slot] as Record<string, unknown> | undefined;
      if (!block || typeof block !== "object") continue;

      const activities = Array.isArray(block.activities)
        ? block.activities
        : [];
      activities.forEach((rawAct, idx) => {
        if (!rawAct || typeof rawAct !== "object") return;
        const act = rawAct as Record<string, unknown>;
        if (typeof act.name !== "string") return;
        const idSlug =
          slugifyKey(
            (typeof act.id === "string" && act.id) || act.name || String(idx),
          ) || String(idx);
        keys.add(`d${dayNumber}-${slot}-a-${idx}-${idSlug}`);
      });

      const meals = Array.isArray(block.meals)
        ? block.meals
        : block.meal && typeof block.meal === "object"
          ? [block.meal]
          : [];
      meals.forEach((rawMeal, idx) => {
        if (!rawMeal || typeof rawMeal !== "object") return;
        const meal = rawMeal as Record<string, unknown>;
        if (typeof meal.name !== "string") return;
        const idSlug =
          slugifyKey(
            (typeof meal.id === "string" && meal.id) ||
              meal.name ||
              String(idx),
          ) || String(idx);
        keys.add(`d${dayNumber}-${slot}-m-${idx}-${idSlug}`);
      });
    }
  }
  return keys;
}

function aggregateRpcCounts(
  rows:
    | Array<{ stop_key?: unknown; reaction?: unknown; count?: unknown }>
    | null
    | undefined,
): ReactionCountsMap {
  const counts: ReactionCountsMap = {};
  if (!Array.isArray(rows)) return counts;

  for (const row of rows) {
    const stopKey = typeof row.stop_key === "string" ? row.stop_key : "";
    const reaction = row.reaction;
    if (!stopKey || (reaction !== "thumbs_up" && reaction !== "heart")) {
      continue;
    }
    const rawCount =
      typeof row.count === "number"
        ? row.count
        : typeof row.count === "string"
          ? Number.parseInt(row.count, 10)
          : 1;
    const increment = Number.isFinite(rawCount) && rawCount > 0 ? rawCount : 0;
    if (increment === 0) continue;
    if (!counts[stopKey]) {
      counts[stopKey] = { thumbs_up: 0, heart: 0 };
    }
    counts[stopKey][reaction] += increment;
  }
  return counts;
}

async function verifySharedTrip(token: string): Promise<{
  tripId: string | null;
  validStopKeys: Set<string>;
  error?: string;
}> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("trips")
    .select("id, itineraries(days)")
    .eq("share_token", token)
    .eq("is_shared", true)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") {
      return { tripId: null, validStopKeys: new Set() };
    }
    return {
      tripId: null,
      validStopKeys: new Set(),
      error: "Unable to verify shared trip",
    };
  }
  if (!data?.id) {
    return { tripId: null, validStopKeys: new Set() };
  }

  const joined = (
    data as {
      id: string;
      itineraries?: { days?: unknown } | Array<{ days?: unknown }> | null;
    }
  ).itineraries;
  const itinerary = Array.isArray(joined) ? joined[0] : joined;
  const filteredItinerary = filterViatorDisplay(itinerary);
  return {
    tripId: data.id,
    validStopKeys: extractValidStopKeys(filteredItinerary?.days),
  };
}

async function loadCounts(
  token: string,
): Promise<{ counts: ReactionCountsMap; error?: unknown }> {
  const supabase = getSupabase();
  const { data, error } = await supabase.rpc(
    "get_shared_trip_reaction_counts",
    {
      p_share_token: token,
    },
  );
  if (error) return { counts: {}, error };
  return { counts: aggregateRpcCounts(data) };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    if (!TOKEN_PATTERN.test(token)) {
      return NextResponse.json(
        { error: "Invalid share token" },
        { status: 400 },
      );
    }

    const ip = getTrustedClientIp(request);
    const limit = await checkRateLimitAsync(`shared-reactions-get:${ip}`, {
      maxRequests: 60,
      windowMs: 60_000,
      failClosed: true,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil(limit.resetIn / 1000))),
          },
        },
      );
    }

    const tripCheck = await verifySharedTrip(token);
    if (tripCheck.error) {
      return NextResponse.json({ error: tripCheck.error }, { status: 503 });
    }
    if (!tripCheck.tripId) {
      return NextResponse.json(
        { error: "Shared trip not found" },
        { status: 404 },
      );
    }

    const { counts, error } = await loadCounts(token);
    if (error) {
      console.error("[Shared Reactions] Failed to load reactions:", error);
      return NextResponse.json(
        { error: "Reactions are temporarily unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { counts, persisted: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[Shared Reactions] GET error:", error);
    return NextResponse.json(
      { error: "Failed to load reactions" },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await context.params;
    if (!TOKEN_PATTERN.test(token)) {
      return NextResponse.json(
        { error: "Invalid share token" },
        { status: 400 },
      );
    }

    const ip = getTrustedClientIp(request);
    const limit = await checkRateLimitAsync(`shared-reactions-post:${ip}`, {
      maxRequests: 30,
      windowMs: 60_000,
      failClosed: true,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many reaction updates. Please slow down." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil(limit.resetIn / 1000))),
          },
        },
      );
    }

    const rawText = await request.text().catch(() => null);
    if (rawText === null || rawText.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "Invalid or oversized reaction payload" },
        { status: 400 },
      );
    }

    let rawBody: unknown;
    try {
      rawBody = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 },
      );
    }

    const parsed = ReactionPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message || "Invalid reaction payload",
        },
        { status: 400 },
      );
    }

    const tripCheck = await verifySharedTrip(token);
    if (tripCheck.error) {
      return NextResponse.json({ error: tripCheck.error }, { status: 503 });
    }
    if (!tripCheck.tripId) {
      return NextResponse.json(
        { error: "Shared trip not found" },
        { status: 404 },
      );
    }

    const { stopKey, reaction, action } = parsed.data;
    if (
      tripCheck.validStopKeys.size > 0 &&
      !tripCheck.validStopKeys.has(stopKey)
    ) {
      return NextResponse.json(
        { error: "Stop not found on this shared trip" },
        { status: 400 },
      );
    }

    const voterSecret = getVoterCookieSecret();
    if (!voterSecret) {
      return NextResponse.json(
        { error: "Reactions are temporarily unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const { voterId, cookieToSet } = resolveVoterId(request, voterSecret);
    const supabase = getSupabase();

    if (action === "add") {
      const { error: upsertError } = await supabase
        .from("shared_trip_reactions")
        .upsert(
          {
            trip_id: tripCheck.tripId,
            share_token: token,
            stop_key: stopKey,
            reaction,
            voter_id: voterId,
          },
          {
            onConflict: "share_token,stop_key,reaction,voter_id",
            ignoreDuplicates: true,
          },
        );

      if (upsertError) {
        console.error("[Shared Reactions] Upsert failed:", upsertError);
        return NextResponse.json(
          { error: "Could not save reaction right now" },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
    } else {
      const { error: deleteError } = await supabase
        .from("shared_trip_reactions")
        .delete()
        .eq("share_token", token)
        .eq("stop_key", stopKey)
        .eq("reaction", reaction)
        .eq("voter_id", voterId);

      if (deleteError) {
        console.error("[Shared Reactions] Delete failed:", deleteError);
        return NextResponse.json(
          { error: "Could not remove reaction right now" },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
    }

    const { counts, error: fetchError } = await loadCounts(token);
    if (fetchError) {
      console.error("[Shared Reactions] Count reload failed:", fetchError);
      return NextResponse.json(
        { error: "Could not refresh reaction counts" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    const response = NextResponse.json(
      { counts, persisted: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    return attachVoterCookie(response, cookieToSet);
  } catch (error) {
    console.error("[Shared Reactions] POST error:", error);
    return NextResponse.json(
      { error: "Failed to save reaction" },
      { status: 500 },
    );
  }
}
