import { NextRequest, NextResponse } from "next/server";
import { checkRateLimitAsync, getClientIp } from "@/lib/security/rate-limit";
import { fetchWithTimeout } from "@/lib/search/runtime";

export async function GET(request: NextRequest) {
  const destination = request.nextUrl.searchParams.get("destination")?.trim();
  const country = request.nextUrl.searchParams.get("country")?.trim() || "";

  if (!destination || destination.length > 120 || country.length > 120) {
    return NextResponse.json({ error: "Invalid destination" }, { status: 400 });
  }

  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(`places-static-map:${ip}`, {
    maxRequests: 120,
    windowMs: 60_000,
    failClosed: true,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Not configured" }, { status: 501 });
  }

  try {
    const center = encodeURIComponent(
      `${destination}${country ? `, ${country}` : ""}`,
    );
    const url =
      `https://maps.googleapis.com/maps/api/staticmap?center=${center}` +
      "&zoom=11&size=600x300&scale=2&maptype=roadmap" +
      `&markers=color:0x6366f1|${center}` +
      "&style=feature:all|element:geometry|color:0x242f3e" +
      "&style=feature:all|element:labels.text.stroke|color:0x242f3e" +
      "&style=feature:all|element:labels.text.fill|color:0x746855" +
      "&style=feature:water|element:geometry|color:0x17263c" +
      "&style=feature:road|element:geometry|color:0x38414e" +
      "&style=feature:road|element:geometry.stroke|color:0x212a37" +
      "&style=feature:poi|element:geometry|color:0x283d6a" +
      `&key=${encodeURIComponent(apiKey)}`;

    const upstream = await fetchWithTimeout(url);
    const contentType = upstream.headers.get("content-type") || "";
    if (!upstream.ok || !contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "Failed to fetch map" },
        { status: 502 },
      );
    }

    return new Response(await upstream.arrayBuffer(), {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=300",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch map" }, { status: 502 });
  }
}
