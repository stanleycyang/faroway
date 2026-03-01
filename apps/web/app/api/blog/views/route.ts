import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { z } from "zod";

const ViewSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
});

async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(
    ip + (process.env.IP_HASH_SALT || "faroway-blog"),
  );
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: NextRequest) {
  // Rate limit: 30 req/min per IP
  const ip = getClientIp(request);
  const rl = checkRateLimit(`blog-views:${ip}`, {
    maxRequests: 30,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parseResult = ViewSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { slug } = parseResult.data;
    const viewerIpHash = await hashIP(ip);
    const userAgent = request.headers.get("user-agent") || null;
    const referrer = request.headers.get("referer") || null;

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
