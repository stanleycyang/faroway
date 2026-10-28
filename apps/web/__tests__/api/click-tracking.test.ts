import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  user: { id: "user-123", email: "test@example.com" },
  from: vi.fn(),
  insert: vi.fn(),
  optionalAuth: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: vi.fn(() => ({
    from: mocks.from,
  })),
}));

vi.mock("@/lib/auth", () => ({
  optionalAuth: mocks.optionalAuth,
}));

import { POST } from "@/app/api/track/click/route";

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

describe("POST /api/track/click", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.optionalAuth.mockResolvedValue(mocks.user);
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.insert.mockReturnValue({ error: null });
  });

  it("accepts client-generated click IDs for non-blocking mobile checkout", async () => {
    const response = await POST(
      makeRequest({
        clickId: "click_mobile_123",
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
    expect(body.clickId).toBe("click_mobile_123");
    expect(body.redirectUrl).toContain("click_id=click_mobile_123");
    expect(mocks.from).toHaveBeenCalledWith("affiliate_clicks");
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "click_mobile_123",
        user_id: "user-123",
        item_type: "transport",
        trip_id: "00000000-0000-4000-8000-000000000001",
      }),
    );
  });

  it("tracks OpenTable restaurant reservation links", async () => {
    const response = await POST(
      makeRequest({
        clickId: "click_restaurant_123",
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
    expect(body.redirectUrl).toContain("click_id=click_restaurant_123");
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "click_restaurant_123",
        item_type: "restaurant",
        affiliate_partner: "opentable",
        price: null,
        currency: null,
      }),
    );
  });

  it("cannot forge a server-verified checkout handoff through public analytics", async () => {
    const response = await POST(
      makeRequest({
        clickId: "checkout-00000000-0000-4000-8000-000000000002",
        itemType: "activity",
        itemId: "activity_v_123P1@2099-06-01",
        itemName: "Invented tour",
        affiliatePartner: "viator",
        affiliateUrl: "https://www.viator.com/tours/invented",
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
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
        clickId: "click_negative_price",
        itemType: "hotel",
        itemId: "hotel-1",
        itemName: "Hotel One",
        affiliatePartner: "retired-provider",
        affiliateUrl: "https://retired-supplier.example/hotel/1",
        price: -10,
        source: "itinerary",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
