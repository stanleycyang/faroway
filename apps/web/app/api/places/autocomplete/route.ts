import { NextRequest, NextResponse } from "next/server";
import { checkRateLimitAsync, getClientIp } from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get("input");

  if (!input || input.length < 2) {
    return NextResponse.json({ predictions: [] });
  }

  if (input.length > 120) {
    return NextResponse.json({ error: "Input too long" }, { status: 400 });
  }

  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(`places-autocomplete:${ip}`, {
    maxRequests: 120,
    windowMs: 60_000,
    failClosed: true,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
  if (!API_KEY) {
    return NextResponse.json({ predictions: [] }, { status: 501 });
  }

  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(input)}` +
      `&types=(cities)` +
      `&key=${encodeURIComponent(API_KEY)}`;

    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    if (data.status === "OK" && data.predictions) {
      return NextResponse.json({
        predictions: data.predictions.map(
          (p: {
            place_id: string;
            description: string;
            structured_formatting?: {
              main_text?: string;
              secondary_text?: string;
            };
          }) => ({
            placeId: p.place_id,
            mainText: p.structured_formatting?.main_text ?? p.description,
            secondaryText: p.structured_formatting?.secondary_text ?? "",
          }),
        ),
      });
    }

    return NextResponse.json({ predictions: [] });
  } catch {
    return NextResponse.json({ predictions: [] }, { status: 500 });
  }
}
