import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  user: { id: "user-123", email: "test@example.com" },
  from: vi.fn(),
  insert: vi.fn(),
  optionalAuth: vi.fn(),
  ownedTrip: true,
  ownedSearch: true,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: vi.fn(() => ({
    from: mocks.from,
  })),
}));

vi.mock("@/lib/auth", () => ({
  optionalAuth: mocks.optionalAuth,
}));

import { GET, POST } from "@/app/api/track/click/route";

function makeRequest(body: object): NextRequest {
  return new NextRequest(new URL("/api/track/click", "http://localhost:3000"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer token",
    },
    body: JSON.stringify(body),
  });
}

function makeRawRequest(body: string): NextRequest {
  return new NextRequest(new URL("/api/track/click", "http://localhost:3000"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer token",
    },
    body,
  });
}

function makeGetRequest(body: Record<string, string>): NextRequest {
  const url = new URL("/api/track/click", "http://localhost:3000");
  Object.entries(body).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  );
  return new NextRequest(url, {
    headers: { Authorization: "Bearer token" },
  });
}

describe("POST /api/track/click", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ownedTrip = true;
    mocks.ownedSearch = true;
    mocks.optionalAuth.mockResolvedValue(mocks.user);
    mocks.from.mockImplementation((table: string) => {
      if (table === "affiliate_clicks") return { insert: mocks.insert };

      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn(() => chain);
      chain.maybeSingle = vi.fn(async () => ({
        data:
          table === "trips"
            ? mocks.ownedTrip
              ? { id: "00000000-0000-4000-8000-000000000001" }
              : null
            : mocks.ownedSearch
              ? { id: "00000000-0000-4000-8000-000000000002" }
              : null,
        error: null,
      }));
      return chain;
    });
    mocks.insert.mockReturnValue({ error: null });
  });

  it("generates durable click IDs on the server", async () => {
    const response = await POST(
      makeRequest({
        itemType: "transport",
        itemId: "flight-1",
        itemName: "SFO to HND",
        affiliatePartner: "duffel",
        affiliateUrl: "https://book.duffel.com/offers/offer-1",
        tripId: "00000000-0000-4000-8000-000000000001",
        source: "itinerary",
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.clickId).toMatch(/^click-[0-9a-f-]{36}$/);
    expect(body.redirectUrl).toContain(`click_id=${body.clickId}`);
    expect(mocks.from).toHaveBeenCalledWith("affiliate_clicks");
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: body.clickId,
        user_id: "user-123",
        item_type: "transport",
        trip_id: "00000000-0000-4000-8000-000000000001",
      }),
    );
  });

  it("returns the same Viator attribution contract to mobile POST clients", async () => {
    const response = await POST(
      makeRequest({
        itemType: "activity",
        itemId: "tour-1",
        itemName: "City Tour",
        affiliatePartner: "viator",
        affiliateUrl:
          "https://www.viator.com/tours/City/Tour/d1-123?pid=P12345678&mcid=42383&medium=api&api_version=2.0",
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    const url = new URL(body.redirectUrl);
    expect(url.searchParams.get("pid")).toBe("P12345678");
    expect(url.searchParams.get("mcid")).toBe("42383");
    expect(url.searchParams.get("medium")).toBe("api");
    expect(url.searchParams.get("api_version")).toBe("2.0");
    expect(url.searchParams.get("campaign")).toBe(body.clickId);
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ id: body.clickId }),
    );
  });

  it.each([GET, POST])(
    "rejects malformed legacy Viator attribution before recording or redirecting",
    async (handler) => {
      const payload = {
        itemType: "activity",
        itemId: "tour-1",
        itemName: "City Tour",
        affiliatePartner: "viator",
        affiliateUrl:
          "https://www.viator.com/tours/123?pid=faroway&mcid=click_old-id&medium=api",
      };
      const response = await handler(
        handler === GET ? makeGetRequest(payload) : makeRequest(payload),
      );
      expect(response.status).toBe(400);
      expect(response.headers.get("location")).toBeNull();
      expect(mocks.insert).not.toHaveBeenCalled();
    },
  );

  it("tracks OpenTable restaurant reservation links", async () => {
    const response = await POST(
      makeRequest({
        itemType: "restaurant",
        itemId: "restaurant-1",
        itemName: "Local Bistro",
        affiliatePartner: "opentable",
        affiliateUrl: "https://www.opentable.com/r/local-bistro",
        tripId: "00000000-0000-4000-8000-000000000001",
        source: "itinerary",
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.redirectUrl).toContain(`click_id=${body.clickId}`);
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: body.clickId,
        item_type: "restaurant",
        affiliate_partner: "opentable",
      }),
    );
  });

  it("strips trip attribution when the trip is not owned by the user", async () => {
    mocks.ownedTrip = false;

    const response = await POST(
      makeRequest({
        itemType: "hotel",
        itemId: "hotel-1",
        itemName: "Hotel One",
        affiliatePartner: "booking",
        affiliateUrl: "https://www.booking.com/hotel/1",
        tripId: "00000000-0000-4000-8000-000000000001",
        source: "itinerary",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ trip_id: null }),
    );
  });

  it("does not accept trip attribution from anonymous requests", async () => {
    mocks.optionalAuth.mockResolvedValueOnce(null);

    const response = await POST(
      makeRequest({
        itemType: "hotel",
        itemId: "hotel-1",
        itemName: "Hotel One",
        affiliatePartner: "booking",
        affiliateUrl: "https://www.booking.com/hotel/1",
        tripId: "00000000-0000-4000-8000-000000000001",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: null, trip_id: null }),
    );
  });

  it("rejects a URL whose domain does not match the selected partner", async () => {
    const response = await POST(
      makeRequest({
        itemType: "hotel",
        itemId: "hotel-1",
        itemName: "Hotel One",
        affiliatePartner: "booking",
        affiliateUrl: "https://www.viator.com/tours/123",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("records a browser click before redirecting with durable Viator attribution", async () => {
    const response = await GET(
      makeGetRequest({
        itemType: "activity",
        itemId: "tour-1",
        itemName: "City Tour",
        affiliatePartner: "viator",
        affiliateUrl:
          "https://www.viator.com/tours/City/Tour/d1-123?pid=P12345678&mcid=42383&medium=api&api_version=2.0",
        source: "itinerary",
      }),
    );

    const location = response.headers.get("location");
    const insertedClick = mocks.insert.mock.calls[0][0];

    expect(response.status).toBe(307);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(location).toContain(`click_id=${insertedClick.id}`);
    const redirected = new URL(location!);
    expect(redirected.searchParams.get("mcid")).toBe("42383");
    expect(redirected.searchParams.get("pid")).toBe("P12345678");
    expect(redirected.searchParams.get("medium")).toBe("api");
    expect(redirected.searchParams.get("api_version")).toBe("2.0");
    expect(redirected.searchParams.get("campaign")).toBe(insertedClick.id);
    expect(insertedClick.affiliate_partner).toBe("viator");
  });

  it("returns the tracked URL even when analytics persistence fails", async () => {
    mocks.insert.mockReturnValueOnce({ error: { message: "database down" } });

    const response = await POST(
      makeRequest({
        itemType: "hotel",
        itemId: "hotel-1",
        itemName: "Hotel One",
        affiliatePartner: "booking",
        affiliateUrl: "https://www.booking.com/hotel/1",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.tracked).toBe(false);
    expect(body.redirectUrl).toContain(`click_id=${body.clickId}`);
  });

  it("rejects malformed JSON as a client error", async () => {
    const response = await POST(makeRawRequest("{not-json"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid JSON body");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects negative prices", async () => {
    const response = await POST(
      makeRequest({
        itemType: "hotel",
        itemId: "hotel-1",
        itemName: "Hotel One",
        affiliatePartner: "booking",
        affiliateUrl: "https://booking.com/hotel/1",
        price: -10,
        source: "itinerary",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
