import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  user: { id: "user-123", email: "test@example.com" },
  from: vi.fn(),
  insert: vi.fn(),
  optionalAuth: vi.fn(),
  checkRateLimitAsync: vi.fn(),
  getClientIp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: vi.fn(() => ({
    from: mocks.from,
  })),
}));

vi.mock("@/lib/auth", () => ({
  optionalAuth: mocks.optionalAuth,
}));

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
  getClientIp: mocks.getClientIp,
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
    mocks.getClientIp.mockReturnValue("127.0.0.1");
    mocks.checkRateLimitAsync.mockResolvedValue({
      allowed: true,
      remaining: 29,
      resetIn: 60_000,
    });
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
    expect(body.redirectUrl).toContain("sub_id=click_restaurant_123");
    expect(body.trackingUrl).toBe(body.redirectUrl);
    expect(body.partner).toBe("opentable");
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

  it.each([
    {
      partner: "viator",
      url: "https://www.viator.com/tours/Tokyo/Food-Tour/d334-123P1?pid=P001&mcid=42383&medium=api",
      expectedParam: "campaign=click_p1",
    },
    {
      partner: "getyourguide",
      url: "https://www.getyourguide.com/activity-t12345/?partner_id=GYG1",
      expectedParam: "cmp=click_p1",
    },
    {
      partner: "travelpayouts",
      url: "https://tp.media/r?marker=12345&p=4110&u=https%3A%2F%2Fwww.klook.com",
      expectedParam: "sub_id=click_p1",
    },
    {
      partner: "stay22",
      url: "https://www.stay22.com/allez/roam?aid=stay22aid&address=Tokyo",
      expectedParam: "campaign=click_p1",
    },
    {
      partner: "booking",
      url: "https://www.booking.com/searchresults.html?ss=Tokyo&aid=123456",
      expectedParam: "label=click_p1",
    },
    {
      partner: "expedia",
      url: "https://www.expedia.com/Hotel-Search?destination=Tokyo",
      expectedParam: "affcid=click_p1",
    },
    {
      partner: "safetywing",
      url: "https://safetywing.com/nomad-insurance/?referenceID=sw123",
      expectedParam: "click_id=click_p1",
    },
    {
      partner: "airalo",
      url: "https://www.airalo.com/japan-esim?ref=air123",
      expectedParam: "sub_id=click_p1",
    },
    {
      partner: "klook",
      url: "https://www.klook.com/search/result/?query=Tokyo&aid=klook123",
      expectedParam: "sub_id=click_p1",
    },
    {
      partner: "discovercars",
      url: "https://www.discovercars.com/?a_aid=dc123",
      expectedParam: "sub_id=click_p1",
    },
    {
      partner: "hostelworld",
      url: "https://www.hostelworld.com/s?q=Tokyo&source=hw123",
      expectedParam: "sub_id=click_p1",
    },
    {
      partner: "duffel",
      url: "https://links.duffel.com/session_abc",
      expectedParam: "click_id=click_p1",
    },
    {
      partner: "tripadvisor",
      url: "https://www.tripadvisor.com/Restaurant_Review-g298184-d123.html",
      expectedParam: "sub_id=click_p1",
    },
    {
      partner: "opentable",
      url: "https://www.opentable.com/s?term=Sushi",
      expectedParam: "sub_id=click_p1",
    },
    {
      partner: "skyscanner",
      url: "https://www.skyscanner.com/flights",
      expectedParam: "sub_id=click_p1",
    },
    {
      partner: "ivisa",
      url: "https://www.ivisa.com/apply-online?destination=Japan&affid=iv123",
      expectedParam: "sub_id=click_p1",
    },
    {
      partner: "wise",
      url: "https://wise.com/us/travel-money/?irclickid=w123",
      expectedParam: "sub_id=click_p1",
    },
  ])(
    "emits partner-native subID and preserves partner params for $partner",
    async ({ partner, url, expectedParam }) => {
      const response = await POST(
        makeRequest({
          clickId: "click_p1",
          itemType: "activity",
          itemId: "item-1",
          itemName: "Test Item",
          affiliatePartner: partner,
          affiliateUrl: url,
          source: "booking_checklist",
          placement: "checklist_card",
          campaign: "m2_launch",
        }),
      );

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.partner).toBe(partner);
      expect(body.trackingUrl).toBe(body.redirectUrl);
      expect(body.trackingUrl).toContain(expectedParam);
      if (partner === "viator") {
        expect(body.trackingUrl).toContain("pid=P001");
        expect(body.trackingUrl).toContain("mcid=42383");
      }
      if (partner === "safetywing") {
        expect(body.trackingUrl).toContain("referenceID=sw123");
      }
      if (partner === "booking" || partner === "stay22") {
        expect(body.trackingUrl).toContain("aid=");
      }
    },
  );

  it("normalizes partner aliases and applies host-partner precedence for Travelpayouts", async () => {
    const aliasRes = await POST(
      makeRequest({
        itemType: "activity",
        itemId: "act-1",
        itemName: "Alias Tour",
        affiliatePartner: "gyg",
        affiliateUrl:
          "https://www.getyourguide.com/activity-t99/?partner_id=P1",
        source: "shared_trip",
      }),
    );
    expect(aliasRes.status).toBe(200);
    const aliasBody = await aliasRes.json();
    expect(aliasBody.partner).toBe("getyourguide");
    expect(aliasBody.clickId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    const tpRes = await POST(
      makeRequest({
        clickId: "click_tp_1",
        itemType: "activity",
        itemId: "klook-1",
        itemName: "Klook via TP",
        affiliatePartner: "klook",
        affiliateUrl:
          "https://tp.media/r?marker=999&p=4110&u=https%3A%2F%2Fwww.klook.com",
        source: "on_trip",
      }),
    );
    expect(tpRes.status).toBe(200);
    const tpBody = await tpRes.json();
    expect(tpBody.partner).toBe("travelpayouts");
    expect(tpBody.trackingUrl).toContain("sub_id=click_tp_1");
    expect(tpBody.trackingUrl).toContain("marker=999");
  });

  it.each([
    "http://www.viator.com/tours/Tokyo",
    "https://user:pass@www.viator.com/tours/Tokyo",
    "https://www.viator.com:8443/tours/Tokyo",
    "https://evil.example.com/tours/Tokyo",
    "https://viator.com.evil.com/tours/Tokyo",
  ])("rejects unsafe or disallowed URL: %s", async (badUrl) => {
    const response = await POST(
      makeRequest({
        itemType: "activity",
        itemId: "act-1",
        itemName: "Bad URL",
        affiliatePartner: "viator",
        affiliateUrl: badUrl,
        source: "tool",
      }),
    );
    expect(response.status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns 429 Too many requests when fail-closed rate limit denies", async () => {
    mocks.checkRateLimitAsync.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetIn: 30_000,
    });

    const response = await POST(
      makeRequest({
        itemType: "activity",
        itemId: "act-rl",
        itemName: "Rate Limited Tour",
        affiliatePartner: "viator",
        affiliateUrl: "https://www.viator.com/tours/Tokyo/t1",
      }),
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "Too many requests" });
    expect(mocks.checkRateLimitAsync).toHaveBeenCalledWith(
      "affiliate-click:127.0.0.1",
      { maxRequests: 30, windowMs: 60_000, failClosed: true },
    );
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("records anonymous clicks (user: null) and omits partial price without currency", async () => {
    mocks.optionalAuth.mockResolvedValueOnce(null);

    const response = await POST(
      makeRequest({
        itemType: "hotel",
        itemId: "hotel-anon",
        itemName: "Anonymous Hotel",
        affiliatePartner: "booking",
        affiliateUrl:
          "https://www.booking.com/searchresults.html?ss=Tokyo&aid=123",
        price: 220,
        source: "tool",
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.partner).toBe("booking");
    expect(body.trackingUrl).toContain(`label=${body.clickId}`);
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: null,
        price: null,
        currency: null,
        source: "tool",
      }),
    );
  });

  it("fails open 200 with generated clickId and trackingUrl when affiliate_clicks.insert errors", async () => {
    mocks.insert.mockReturnValueOnce({
      error: { message: "supabase insert timeout" },
    });

    const response = await POST(
      makeRequest({
        itemType: "activity",
        itemId: "act-failopen",
        itemName: "Fail Open Tour",
        affiliatePartner: "getyourguide",
        affiliateUrl:
          "https://www.getyourguide.com/tokyo-l193/tour-t1/?partner_id=GYG1",
        source: "itinerary",
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.clickId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(body.trackingUrl).toContain(`cmp=${body.clickId}`);
  });

  it("rejects non-UUID tripId with 400 and enforces canonical host-partner precedence on cross-partner URLs", async () => {
    const badTrip = await POST(
      makeRequest({
        itemType: "activity",
        itemId: "act-bad-trip",
        itemName: "Bad Trip ID",
        affiliatePartner: "viator",
        affiliateUrl: "https://www.viator.com/tours/Tokyo/t1",
        tripId: "not-a-valid-uuid",
      }),
    );
    expect(badTrip.status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();

    const crossPartner = await POST(
      makeRequest({
        clickId: "clk_cross_1",
        itemType: "hotel",
        itemId: "hotel-cross",
        itemName: "Cross Partner Hotel",
        affiliatePartner: "viator",
        affiliateUrl:
          "https://www.booking.com/searchresults.html?ss=Paris&aid=999",
        source: "itinerary",
      }),
    );
    expect(crossPartner.status).toBe(200);
    const body = await crossPartner.json();
    expect(body.partner).toBe("booking");
    expect(body.trackingUrl).toContain("label=clk_cross_1");
    expect(body.trackingUrl).not.toContain("campaign=");
  });
});
