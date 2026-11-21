import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase/server";
import { checkRateLimitAsync, getClientIp } from "@/lib/security/rate-limit";

const TOKEN_PATTERN = /^[a-zA-Z0-9_-]{4,128}$/;

const ReactionPayloadSchema = z.object({
  stopKey: z
    .string()
    .trim()
    .min(1, "Stop key is required")
    .max(160, "Stop key is too long")
    .regex(/^[a-zA-Z0-9:_-]+$/, "Invalid stop key format"),
  reaction: z.enum(["thumbs_up", "heart"]),
  action: z.enum(["add", "remove"]).default("add"),
  voterId: z
    .string()
    .trim()
    .min(4)
    .max(80)
    .regex(/^[a-zA-Z0-9_-]+$/)
    .optional(),
});

export type ReactionType = "thumbs_up" | "heart";
export type ReactionCountsMap = Record<
  string,
  { thumbs_up: number; heart: number }
>;

interface FallbackTokenEntry {
  // Maps `${stopKey}::${reaction}` -> Set of voterIds
  votes: Map<string, Set<string>>;
  updatedAt: number;
}

const MAX_FALLBACK_TOKENS = 500;
const fallbackStore = new Map<string, FallbackTokenEntry>();

function isMissingTableError(
  error: {
    code?: string;
    message?: string;
  } | null,
): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  const msg = error.message || "";
  return /relation .* does not exist|schema cache|could not find the table/i.test(
    msg,
  );
}

function getFallbackCounts(token: string): ReactionCountsMap {
  const entry = fallbackStore.get(token);
  if (!entry) return {};
  const counts: ReactionCountsMap = {};
  for (const [compoundKey, voters] of entry.votes) {
    if (voters.size === 0) continue;
    const sepIndex = compoundKey.lastIndexOf("::");
    if (sepIndex <= 0) continue;
    const stopKey = compoundKey.slice(0, sepIndex);
    const reaction = compoundKey.slice(sepIndex + 2) as ReactionType;
    if (reaction !== "thumbs_up" && reaction !== "heart") continue;
    if (!counts[stopKey]) {
      counts[stopKey] = { thumbs_up: 0, heart: 0 };
    }
    counts[stopKey][reaction] = voters.size;
  }
  return counts;
}

function applyFallbackVote(
  token: string,
  stopKey: string,
  reaction: ReactionType,
  action: "add" | "remove",
  voterId: string,
): ReactionCountsMap {
  if (!fallbackStore.has(token) && fallbackStore.size >= MAX_FALLBACK_TOKENS) {
    // Evict oldest entry to keep fallback store bounded.
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, value] of fallbackStore) {
      if (value.updatedAt < oldestTime) {
        oldestTime = value.updatedAt;
        oldestKey = key;
      }
    }
    if (oldestKey) fallbackStore.delete(oldestKey);
  }

  let entry = fallbackStore.get(token);
  if (!entry) {
    entry = { votes: new Map(), updatedAt: Date.now() };
    fallbackStore.set(token, entry);
  }
  entry.updatedAt = Date.now();

  const compoundKey = `${stopKey}::${reaction}`;
  let voters = entry.votes.get(compoundKey);
  if (!voters) {
    voters = new Set();
    entry.votes.set(compoundKey, voters);
  }

  if (action === "add") {
    voters.add(voterId);
  } else {
    voters.delete(voterId);
  }

  return getFallbackCounts(token);
}

function aggregateRows(
  rows: Array<{ stop_key?: unknown; reaction?: unknown }> | null | undefined,
): ReactionCountsMap {
  const counts: ReactionCountsMap = {};
  if (!Array.isArray(rows)) return counts;

  for (const row of rows) {
    const stopKey = typeof row.stop_key === "string" ? row.stop_key : "";
    const reaction = row.reaction;
    if (!stopKey || (reaction !== "thumbs_up" && reaction !== "heart")) {
      continue;
    }
    if (!counts[stopKey]) {
      counts[stopKey] = { thumbs_up: 0, heart: 0 };
    }
    counts[stopKey][reaction] += 1;
  }
  return counts;
}

async function verifySharedTrip(
  token: string,
): Promise<{ exists: boolean; error?: string }> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("trips")
    .select("id")
    .eq("share_token", token)
    .eq("is_shared", true)
    .maybeSingle();

  if (error) {
    if (error.code === "PGRST116") return { exists: false };
    return { exists: false, error: "Unable to verify shared trip" };
  }
  return { exists: Boolean(data) };
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

    const ip = getClientIp(request);
    const limit = await checkRateLimitAsync(
      `shared-reactions-get:${ip}:${token}`,
      { maxRequests: 60, windowMs: 60_000 },
    );
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
    if (!tripCheck.exists) {
      return NextResponse.json(
        { error: "Shared trip not found" },
        { status: 404 },
      );
    }

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("shared_trip_reactions")
      .select("stop_key, reaction")
      .eq("share_token", token);

    if (error) {
      if (isMissingTableError(error)) {
        return NextResponse.json(
          { counts: getFallbackCounts(token), persisted: false },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
      console.error("[Shared Reactions] Failed to load reactions:", error);
      return NextResponse.json(
        { counts: getFallbackCounts(token), persisted: false },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { counts: aggregateRows(data), persisted: true },
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

    const ip = getClientIp(request);
    const limit = await checkRateLimitAsync(
      `shared-reactions-post:${ip}:${token}`,
      { maxRequests: 30, windowMs: 60_000 },
    );
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

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 },
      );
    }

    const parsed = ReactionPayloadSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid reaction payload", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const tripCheck = await verifySharedTrip(token);
    if (tripCheck.error) {
      return NextResponse.json({ error: tripCheck.error }, { status: 503 });
    }
    if (!tripCheck.exists) {
      return NextResponse.json(
        { error: "Shared trip not found" },
        { status: 404 },
      );
    }

    const { stopKey, reaction, action } = parsed.data;
    const voterId =
      parsed.data.voterId ||
      `anon-${ip.replace(/[^a-zA-Z0-9_-]/g, "") || "guest"}`;
    const supabase = getSupabase();

    if (action === "add") {
      const { error: upsertError } = await supabase
        .from("shared_trip_reactions")
        .upsert(
          {
            share_token: token,
            stop_key: stopKey,
            reaction,
            voter_id: voterId,
          },
          { onConflict: "share_token,stop_key,reaction,voter_id" },
        );

      if (upsertError) {
        if (isMissingTableError(upsertError)) {
          const counts = applyFallbackVote(
            token,
            stopKey,
            reaction,
            action,
            voterId,
          );
          return NextResponse.json(
            { counts, persisted: false },
            { headers: { "Cache-Control": "no-store" } },
          );
        }
        console.error("[Shared Reactions] Upsert fallback:", upsertError);
        const counts = applyFallbackVote(
          token,
          stopKey,
          reaction,
          action,
          voterId,
        );
        return NextResponse.json(
          { counts, persisted: false },
          { headers: { "Cache-Control": "no-store" } },
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
        if (isMissingTableError(deleteError)) {
          const counts = applyFallbackVote(
            token,
            stopKey,
            reaction,
            action,
            voterId,
          );
          return NextResponse.json(
            { counts, persisted: false },
            { headers: { "Cache-Control": "no-store" } },
          );
        }
        console.error("[Shared Reactions] Delete fallback:", deleteError);
        const counts = applyFallbackVote(
          token,
          stopKey,
          reaction,
          action,
          voterId,
        );
        return NextResponse.json(
          { counts, persisted: false },
          { headers: { "Cache-Control": "no-store" } },
        );
      }
    }

    const { data, error: fetchError } = await supabase
      .from("shared_trip_reactions")
      .select("stop_key, reaction")
      .eq("share_token", token);

    if (fetchError) {
      const counts = applyFallbackVote(
        token,
        stopKey,
        reaction,
        action,
        voterId,
      );
      return NextResponse.json(
        { counts, persisted: false },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { counts: aggregateRows(data), persisted: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[Shared Reactions] POST error:", error);
    return NextResponse.json(
      { error: "Failed to save reaction" },
      { status: 500 },
    );
  }
}
