import { NextRequest, NextResponse } from "next/server";
import { fetchWithTimeout } from "@/lib/search/runtime";
import { checkRateLimitAsync, getClientIp } from "@/lib/security/rate-limit";
import { normalizePlaceDisplay } from "@/lib/places/display";

// This route serves a user-triggered, transient display only. No cache, database,
// model calls, photos, reviews or enterprise-tier rating/opening-hours fields.
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim();
  const placeId = request.nextUrl.searchParams.get("placeId");
  const reply = (body: unknown, status = 200) =>
    NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  if (
    !!query === !!placeId ||
    (query && (query.length < 2 || query.length > 120)) ||
    (placeId && !/^[A-Za-z0-9_-]{1,256}$/.test(placeId))
  ) {
    return reply({ error: "Provide a search query or a valid place ID" }, 400);
  }
  const limit = await checkRateLimitAsync(
    `places-venues:${getClientIp(request)}`,
    { maxRequests: 30, windowMs: 60_000, failClosed: true },
  );
  if (!limit.allowed)
    return reply({ error: "Please wait before looking up more places." }, 429);
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key)
    return reply(
      {
        error:
          "Live place lookup is unavailable. Your plan is still available.",
      },
      501,
    );
  try {
    const fields = [
      "id",
      "displayName",
      "formattedAddress",
      "googleMapsUri",
      "attributions",
    ];
    if (placeId) fields.push("businessStatus");
    const res = await fetchWithTimeout(
      placeId
        ? `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`
        : "https://places.googleapis.com/v1/places:searchText",
      {
        method: placeId ? "GET" : "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": fields
            .map((f) => (placeId ? f : `places.${f}`))
            .join(","),
        },
        ...(query
          ? { body: JSON.stringify({ textQuery: query, pageSize: 3 }) }
          : {}),
      },
    );
    if (!res.ok)
      return reply(
        { error: "Live place lookup is unavailable. Try again shortly." },
        res.status === 404 ? 404 : 502,
      );
    const data = await res.json();
    if (placeId) {
      const place = normalizePlaceDisplay(data);
      return place
        ? reply({ place })
        : reply({ error: "Place not found." }, 404);
    }
    const places = Array.isArray(data.places)
      ? data.places.slice(0, 3).map(normalizePlaceDisplay).filter(Boolean)
      : [];
    return reply({ places });
  } catch {
    return reply(
      { error: "Live place lookup timed out or is unavailable. Try again." },
      502,
    );
  }
}
