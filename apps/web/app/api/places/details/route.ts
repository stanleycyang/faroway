import { NextRequest, NextResponse } from "next/server";

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get("placeId");

  if (!placeId) {
    return NextResponse.json({ error: "placeId required" }, { status: 400 });
  }

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
