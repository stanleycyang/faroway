import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { checkRateLimitAsync, getClientIp } from "@/lib/security/rate-limit";
import { z } from "zod";

const MAX_HEADER_LENGTH = 512;

const ViewSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
});

async function hashIP(ip: string): Promise<string | null> {
  const salt =
    process.env.IP_HASH_SALT ||
    (process.env.NODE_ENV === "production" ? null : "faroway-blog");
  if (!salt) return null;
  const encoder = new TextEncoder();
  const data = encoder.encode(`${ip}:${salt}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: NextRequest) {
  // Rate limit: 30 req/min per IP (distributed)
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(`blog-views:${ip}`, {
    maxRequests: 30,
    windowMs: 60_000,
    failClosed: true,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }
    const parseResult = ViewSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { slug } = parseResult.data;
    const viewerIpHash = await hashIP(ip);
    if (!viewerIpHash) {
      return NextResponse.json(
        { error: "View tracking unavailable" },
        { status: 503 },
      );
    }
    const rawUserAgent = request.headers.get("user-agent");
    const rawReferrer = request.headers.get("referer");
    const userAgent = rawUserAgent
      ? rawUserAgent.slice(0, MAX_HEADER_LENGTH)
      : null;
    const referrer = rawReferrer
      ? rawReferrer.slice(0, MAX_HEADER_LENGTH)
      : null;

    const supabase = getSupabase();

    // Insert view record
    const { error: viewError } = await supabase.from("blog_post_views").insert({
      post_slug: slug,
      viewer_ip_hash: viewerIpHash,
      user_agent: userAgent,
      referrer: referrer,
    });

    if (viewError) {
      console.error("[Blog Views] Insert error:", viewError);
    }

    // Increment view count on blog_posts
    const { error: rpcError } = await supabase.rpc(
      "increment_blog_view_count",
      {
        p_slug: slug,
      },
    );

    if (rpcError) {
      console.error("[Blog Views] RPC error:", rpcError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Blog Views] Error:", error);
    return NextResponse.json(
      { error: "Failed to track view" },
      { status: 500 },
    );
  }
}
