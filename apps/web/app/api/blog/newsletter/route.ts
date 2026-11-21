import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { checkRateLimitAsync, getClientIp } from "@/lib/security/rate-limit";
import { z } from "zod";

const NewsletterSchema = z.object({
  email: z.string().email().max(254),
  source: z.enum(["blog", "footer", "popup", "landing"]).default("blog"),
});

export async function POST(request: NextRequest) {
  // Rate limit: 3 req/min per IP (distributed, fail-closed)
  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(`newsletter:${ip}`, {
    maxRequests: 3,
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
    const parseResult = NewsletterSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const { email, source } = parseResult.data;

    // Never overwrite an existing subscriber row (which would silently reactivate
    // an unsubscribed address without owner confirmation).
    const { error } = await getSupabase().from("newsletter_subscribers").upsert(
      {
        email: email.trim().toLowerCase(),
        source,
        status: "active",
        subscribed_at: new Date().toISOString(),
      },
      { onConflict: "email", ignoreDuplicates: true },
    );

    if (error) {
      console.error("[Newsletter] Database error:", error);
      return NextResponse.json(
        { error: "Failed to subscribe" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Newsletter] Error:", error);
    return NextResponse.json({ error: "Failed to subscribe" }, { status: 500 });
  }
}
