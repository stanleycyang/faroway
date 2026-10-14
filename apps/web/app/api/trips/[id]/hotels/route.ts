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
import {
  HotelQuoteResultSchema,
  hotelSearchEnabled,
} from "@/lib/trips/hotel-quotes";

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireUserIdFromRequest(request);
    if (auth instanceof NextResponse) return auth;
    if (
      !hotelSearchEnabled() ||
      process.env.VERCEL_ENV !== "preview" ||
      !isLiteApiConfigured()
    )
      return json({ error: "Hotel search is temporarily unavailable" }, 503);
    const { id } = await params;
    const loaded = await loadTripForUserUncached(id, auth.userId);
    if (!loaded) return json({ error: "Trip not found" }, 404);
    const trip = loaded.trip;
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid hotel request" }, 400);
    }
    if (
      !body ||
      typeof body !== "object" ||
      !("expectedUpdatedAt" in body) ||
      body.expectedUpdatedAt !== trip.updated_at
    )
      return json(
        { error: "Your trip changed. Load the latest brief before searching." },
        409,
      );
    const details = trip.preferences?.hotelSearch;
    if (
      trip.end_date <= trip.start_date ||
      !validateHotelSearchDetails(details, trip.travelers)
    )
      return json(
        {
          error:
            "Save complete room details and consent for an overnight stay first.",
        },
        400,
      );
    const limit = await checkRateLimitAsync(`liteapi-trip:${auth.userId}`, {
      maxRequests: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!limit.allowed)
      return json({ error: "Hotel search limit reached" }, 429);
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
    const currentAuth = await requireUserIdFromRequest(request);
    if (
      currentAuth instanceof NextResponse ||
      currentAuth.userId !== auth.userId
    )
      return json({ error: "Sign in again before viewing hotel options" }, 401);
    const current = await loadTripForUserUncached(id, auth.userId);
    if (!current || current.trip.updated_at !== trip.updated_at)
      return json(
        {
          error:
            "Your trip changed during hotel search. Load the latest brief.",
        },
        409,
      );
    const result = HotelQuoteResultSchema.safeParse({
      tripId: id,
      tripUpdatedAt: trip.updated_at,
      observedAt: new Date().toISOString(),
      sandbox: rates.sandbox,
      hotels: normalizeLiteApiQuotes(rates, "USD", details.rooms.length),
    });
    if (!result.success)
      return json({ error: "Hotel options could not be verified" }, 502);
    return json(result.data);
  } catch {
    return json(
      { error: "Hotel options are temporarily unavailable. Please retry." },
      503,
    );
  }
}
