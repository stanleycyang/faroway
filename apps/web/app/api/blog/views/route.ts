import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { getSupabase } from "@/lib/supabase/server";
import { checkRateLimitAsync, getClientIp } from "@/lib/security/rate-limit";
import { z } from "zod";

const ViewSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/),
});

async function hashIP(ip: string): Promise<string> {
  const salt = process.env.IP_HASH_SALT;
  if (!salt && process.env.NODE_ENV === "production") {
    throw new Error("IP_HASH_SALT is required in production");
  }
  return createHmac("sha256", salt || "faroway-blog-development")
    .update(ip)
    .digest("hex");
}

export async function POST(request: NextRequest) {
  // Rate limit: 30 req/min per IP
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
    const userAgent = request.headers.get("user-agent")?.slice(0, 1024) || null;
    const referrer = request.headers.get("referer")?.slice(0, 2048) || null;

    const supabase = getSupabase();

    const { error: rpcError } = await supabase.rpc("record_blog_view", {
      p_slug: slug,
      p_viewer_ip_hash: viewerIpHash,
      p_user_agent: userAgent,
      p_referrer: referrer,
    });

    if (rpcError) {
      console.error("[Blog Views] RPC error:", rpcError);
      return NextResponse.json(
        { error: "Failed to track view" },
        { status: 500 },
      );
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
