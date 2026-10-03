import { fetchWithTimeout } from "@/lib/search/runtime";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimitAsync, getClientIp } from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get("placeId");

  if (!placeId) {
    return NextResponse.json({ error: "placeId required" }, { status: 400 });
  }

  if (placeId.length > 256) {
    return NextResponse.json({ error: "placeId too long" }, { status: 400 });
  }

  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(`places-details:${ip}`, {
    maxRequests: 120,
    windowMs: 60_000,
    failClosed: true,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
  if (!API_KEY) {
    return NextResponse.json({ error: "Not configured" }, { status: 501 });
  }

  try {
    const res = await fetchWithTimeout(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          "X-Goog-Api-Key": API_KEY,
          "X-Goog-FieldMask": "displayName,location,attributions",
        },
      },
    );
    if (!res.ok)
      return NextResponse.json(
        { error: "Place unavailable" },
        { status: res.status === 404 ? 404 : 502 },
      );
    const data = await res.json();
    const lat = data.location?.latitude;
    const lng = data.location?.longitude;
    if (
      typeof lat === "number" &&
      Number.isFinite(lat) &&
      Math.abs(lat) <= 90 &&
      typeof lng === "number" &&
      Number.isFinite(lng) &&
      Math.abs(lng) <= 180
    ) {
      return NextResponse.json(
        {
          name: data.displayName?.text,
          lat,
          lng,
          attributions: Array.isArray(data.attributions)
            ? data.attributions
            : [],
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    return NextResponse.json({ error: "Place not found" }, { status: 404 });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch details" },
      { status: 500 },
    );
  }
}
