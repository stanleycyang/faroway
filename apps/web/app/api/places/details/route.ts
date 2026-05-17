import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get("placeId");

  if (!placeId) {
    return NextResponse.json({ error: "placeId required" }, { status: 400 });
  }

  if (placeId.length > 256) {
    return NextResponse.json({ error: "placeId too long" }, { status: 400 });
  }

  const ip = getClientIp(request);
  const rl = checkRateLimit(`places-details:${ip}`, {
    maxRequests: 120,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
  if (!API_KEY) {
    return NextResponse.json({ error: "Not configured" }, { status: 501 });
  }

  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${encodeURIComponent(placeId)}` +
      `&fields=geometry,name` +
      `&key=${encodeURIComponent(API_KEY)}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.status === "OK" && data.result?.geometry?.location) {
      const { lat, lng } = data.result.geometry.location;
      return NextResponse.json({
        name: data.result.name,
        lat,
        lng,
      });
    }

    return NextResponse.json({ error: "Place not found" }, { status: 404 });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch details" },
      { status: 500 },
    );
  }
}
