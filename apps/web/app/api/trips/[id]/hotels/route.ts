import { NextRequest, NextResponse } from "next/server";
import { validateHotelSearchDetails } from "@faroway/constants";
import { requireUserIdFromRequest } from "@/lib/auth/middleware";
import { loadTripForUserUncached } from "@/lib/trips/load-trip";
import {
  isLiteApiConfigured,
  searchLiteApiHotels,
} from "@/lib/affiliates/liteapi";
import { normalizeLiteApiQuotes } from "@/lib/affiliates/liteapi-quotes";
import { checkRateLimitAsync } from "@/lib/security/rate-limit";
import type { HotelQuoteResult } from "@faroway/types";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireUserIdFromRequest(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const loaded = await loadTripForUserUncached(id, auth.userId);
  const trip = loaded?.trip;
  if (!trip)
    return NextResponse.json({ error: "Trip not found" }, { status: 404 });
  if (process.env.VERCEL_ENV !== "preview" || !isLiteApiConfigured())
    return NextResponse.json(
      { error: "Hotel search is not enabled" },
      { status: 503 },
    );
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid hotel request" },
      { status: 400 },
    );
  }
  if (
    !body ||
    typeof body !== "object" ||
    !("expectedUpdatedAt" in body) ||
    body.expectedUpdatedAt !== trip.updated_at
  )
    return NextResponse.json(
      { error: "Your trip changed. Reload before searching hotels." },
      { status: 409 },
    );
  const details = trip.preferences?.hotelSearch;
  if (trip.end_date <= trip.start_date)
    return NextResponse.json(
      { error: "Hotel search requires at least one overnight stay." },
      { status: 400 },
    );
  if (!validateHotelSearchDetails(details, trip.travelers))
    return NextResponse.json(
      {
        error:
          "Save complete hotel room details and consent in your trip brief first.",
      },
      { status: 400 },
    );
  const limit = await checkRateLimitAsync(`liteapi-trip:${auth.userId}`, {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Hotel search limit reached" },
      { status: 429 },
    );
  try {
    const rates = await searchLiteApiHotels({
      cityName: trip.destination,
      countryCode: details.countryCode,
      guestNationality: details.guestNationality,
      occupancies: details.rooms,
      currency: "USD",
      checkin: trip.start_date,
      checkout: trip.end_date,
      limit: 3,
    });
    const current = await loadTripForUserUncached(id, auth.userId);
    if (!current || current.trip.updated_at !== trip.updated_at)
      return NextResponse.json(
        {
          error: "Your trip changed during hotel search. Reload and try again.",
        },
        { status: 409 },
      );
    const result: HotelQuoteResult = {
      tripId: id,
      tripUpdatedAt: trip.updated_at,
      observedAt: new Date().toISOString(),
      sandbox: rates.sandbox,
      hotels: normalizeLiteApiQuotes(rates, "USD", details.rooms.length),
    };
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Hotel supplier is temporarily unavailable" },
      { status: 502 },
    );
  }
}
