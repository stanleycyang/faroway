import { NextRequest, NextResponse } from "next/server";
import { checkRateLimitAsync, getClientIp } from "@/lib/security/rate-limit";
import {
  SuggestDestinationsInputSchema,
  suggestDestinations,
} from "@/lib/trips/destination-suggester";

const MAX_BODY_BYTES = 4_096;

export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      getClientIp(request);

    const rl = await checkRateLimitAsync(`suggest-destinations:${ip}`, {
      maxRequests: 40,
      windowMs: 60_000,
      failClosed: true,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment and try again." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil(rl.resetIn / 1000))),
          },
        },
      );
    }

    const rawText = await request.text().catch(() => null);
    if (rawText === null || rawText.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "Request body is invalid or too large." },
        { status: 400 },
      );
    }

    let body: unknown = null;
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 },
      );
    }

    const validated = SuggestDestinationsInputSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        {
          error:
            validated.error.issues[0]?.message ||
            "Please tell us a little about what you're looking for.",
        },
        { status: 400 },
      );
    }

    const suggestions = suggestDestinations(validated.data);
    return NextResponse.json(
      { suggestions },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[suggest-destinations] Unexpected error:", error);
    return NextResponse.json(
      { error: "Could not suggest destinations" },
      { status: 500 },
    );
  }
}
