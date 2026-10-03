import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  load: vi.fn(),
  rate: vi.fn(),
  product: vi.fn(),
  configured: vi.fn(),
  from: vi.fn(),
  existing: vi.fn(),
  insert: vi.fn(),
  history: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("@/lib/auth/middleware", () => ({
  requireUserIdFromRequest: mocks.auth,
}));
vi.mock("@/lib/trips/load-trip", () => ({
  loadTripForUserUncached: mocks.load,
}));
vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimitAsync: mocks.rate,
}));
vi.mock("@/lib/affiliates/viator", () => ({
  getViatorProduct: mocks.product,
  isViatorConfigured: mocks.configured,
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => ({ from: mocks.from }),
}));
import { GET, POST } from "@/app/api/trips/[id]/checkout/route";

const tripId = "00000000-0000-4000-8000-000000000001";
const attemptId = "00000000-0000-4000-8000-000000000002";
const input = { activityId: "activity_v_123P1", date: "2099-06-01", attemptId };
const canonical =
  "https://www.viator.com/tours/Paris/Walk/d479-123P1?pid=P12345678&mcid=42383&medium=api";
const context = () => ({ params: Promise.resolve({ id: tripId }) });
const request = (body: unknown = input) =>
  new NextRequest(`http://localhost/api/trips/${tripId}/checkout`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
const existing = () => ({
  id: `checkout-${attemptId}`,
  user_id: "user-1",
  trip_id: tripId,
  item_id: "activity_v_123P1@2099-06-01",
  item_type: "activity",
  affiliate_partner: "viator",
  affiliate_url: canonical,
});
const loaded = () => ({
  trip: {
    id: tripId,
    travelers: 2,
    start_date: "2099-06-01",
    end_date: "2099-06-04",
  },
  itinerary: {
    days: [
      {
        date: input.date,
        morning: {
          activities: [
            {
              id: input.activityId,
              name: "Walk",
              bookingInfo: { affiliateId: "viator" },
            },
          ],
        },
      },
    ],
  },
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("VIATOR_CONTENT_ENABLED", "true");
  vi.stubEnv("VIATOR_CONTENT_APPROVAL_REF", "test-approval");
  vi.stubEnv("VIATOR_HOSTED_CHECKOUT_ENABLED", "true");
  vi.stubEnv("VIATOR_PARTNER_ID", "P12345678");
  vi.stubEnv("VIATOR_SANDBOX", "false");
  mocks.auth.mockResolvedValue({ userId: "user-1" });
  mocks.load.mockResolvedValue(loaded());
  mocks.rate.mockResolvedValue({ allowed: true });
  mocks.configured.mockReturnValue(true);
  mocks.product.mockResolvedValue({
    productCode: "123P1",
    title: "Provider Walk",
    productUrl: canonical,
  });
  mocks.existing.mockResolvedValue({ data: null, error: null });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.history.mockResolvedValue({ data: [], error: null });
  const query = {
    select: vi.fn(),
    eq: mocks.eq,
    like: vi.fn(),
    order: vi.fn(),
    limit: mocks.history,
    maybeSingle: mocks.existing,
    insert: mocks.insert,
  };
  for (const key of ["select", "eq", "like", "order"] as const)
    query[key].mockReturnValue(query);
  mocks.from.mockReturnValue(query);
});
afterEach(() => vi.unstubAllEnvs());

describe("owned-trip Viator hosted handoff", () => {
  it("blocks checkout and history without content approval", async () => {
    vi.stubEnv("VIATOR_CONTENT_APPROVAL_REF", "");
    expect((await POST(request(), context())).status).toBe(503);
    mocks.history.mockResolvedValue({
      data: [{ item_name: "Provider title" }],
      error: null,
    });
    const history = await GET(request(), context());
    expect(await history.json()).toEqual({ enabled: false, attempts: [] });
    expect(mocks.product).not.toHaveBeenCalled();
  });

  it("saves attribution before returning the canonical URL, without claiming a booking", async () => {
    const response = await POST(request(), context());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("handoff_prepared");
    expect(body.redirectUrl).toContain(`campaign=checkout-${attemptId}`);
    expect(body.redirectUrl).toContain("mcid=42383");
    expect(mocks.load).toHaveBeenCalledWith(tripId, "user-1");
    expect(mocks.product).toHaveBeenCalledWith(
      "123P1",
      `checkout-${attemptId}`,
    );
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        trip_id: tripId,
        converted: false,
        item_name: "Provider Walk",
      }),
    );
    expect(body.redirectUrl).not.toContain(tripId);
    expect(body.redirectUrl).not.toContain("user-1");
  });
  it.each(["VIATOR_HOSTED_CHECKOUT_ENABLED", "VIATOR_PARTNER_ID"])(
    "fails closed when %s is missing",
    async (key) => {
      vi.stubEnv(key, "");
      expect((await POST(request(), context())).status).toBe(503);
      expect(mocks.product).not.toHaveBeenCalled();
    },
  );
  it("does not expose test-mode checkout", async () => {
    vi.stubEnv("VIATOR_SANDBOX", "true");
    expect((await POST(request(), context())).status).toBe(503);
  });
  it("requires authentication", async () => {
    mocks.auth.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    expect((await POST(request(), context())).status).toBe(401);
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("does not permit another user's trip", async () => {
    mocks.load.mockResolvedValue(null);
    expect((await POST(request(), context())).status).toBe(404);
    expect(mocks.product).not.toHaveBeenCalled();
  });
  it("rate limits before provider access", async () => {
    mocks.rate.mockResolvedValue({ allowed: false });
    expect((await POST(request(), context())).status).toBe(429);
    expect(mocks.product).not.toHaveBeenCalled();
  });
  it.each([
    { ...input, affiliateUrl: canonical },
    { ...input, activityId: "activity_generated" },
    { ...input, date: "2099-02-30" },
    { ...input, attemptId: "invalid" },
  ])("rejects untrusted or malformed input", async (body) => {
    expect((await POST(request(body), context())).status).toBe(400);
    expect(mocks.product).not.toHaveBeenCalled();
  });
  it("rejects an item removed or moved in the plan", async () => {
    expect(
      (await POST(request({ ...input, date: "2099-06-02" }), context())).status,
    ).toBe(409);
  });
  it("rejects dates in the past", async () => {
    const trip = loaded();
    trip.itinerary.days[0].date = "2000-01-01";
    trip.trip.start_date = "2000-01-01";
    trip.trip.end_date = "2000-01-04";
    mocks.load.mockResolvedValue(trip);
    expect(
      (await POST(request({ ...input, date: "2000-01-01" }), context())).status,
    ).toBe(409);
  });

  it("rejects stale itinerary dates after the trip dates change", async () => {
    const trip = loaded();
    trip.trip.start_date = "2099-07-01";
    trip.trip.end_date = "2099-07-04";
    mocks.load.mockResolvedValue(trip);
    expect((await POST(request(), context())).status).toBe(409);
    expect(mocks.product).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("revalidates a resumed attempt without creating another click", async () => {
    mocks.existing.mockResolvedValue({
      data: {
        ...existing(),
        affiliate_url:
          "https://www.viator.com/tours/poisoned?pid=P1&mcid=1&medium=api",
      },
      error: null,
    });
    const response = await POST(request(), context());
    expect(response.status).toBe(200);
    expect((await response.json()).redirectUrl).not.toContain("poisoned");
    expect(mocks.insert).not.toHaveBeenCalled();
    expect(mocks.product).toHaveBeenCalledTimes(1);
  });
  it("fails closed when the provider cannot revalidate a resumed attempt", async () => {
    mocks.existing.mockResolvedValue({ data: existing(), error: null });
    mocks.product.mockResolvedValue(null);
    const response = await POST(request(), context());
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty("redirectUrl");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it.each(["user_id", "trip_id", "item_id", "item_type", "affiliate_partner"])(
    "rejects reused attempt IDs with different %s",
    async (field) => {
      mocks.existing.mockResolvedValue({
        data: { ...existing(), [field]: "different" },
        error: null,
      });
      expect((await POST(request(), context())).status).toBe(409);
    },
  );
  it("recovers a concurrent duplicate insert", async () => {
    mocks.existing
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: existing(), error: null });
    mocks.insert.mockResolvedValue({ error: { code: "23505" } });
    expect((await POST(request(), context())).status).toBe(200);
  });
  it("does not navigate when persistence fails", async () => {
    mocks.insert.mockResolvedValue({ error: { code: "unavailable" } });
    const response = await POST(request(), context());
    expect(response.status).toBe(503);
    expect(await response.json()).not.toHaveProperty("redirectUrl");
  });
  it.each([
    null,
    { productCode: "wrong", productUrl: canonical },
    { productCode: "123P1", productUrl: "https://evil.test" },
  ])("does not save an unverified provider product", async (product) => {
    mocks.product.mockResolvedValue(product);
    expect((await POST(request(), context())).status).toBe(503);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("loads owner-scoped history without claiming confirmation or leaking redirect URLs", async () => {
    mocks.history.mockResolvedValue({
      data: [
        {
          id: "checkout-1",
          item_id: "activity_v_123P1@2099-06-01",
          item_name: "Walk",
          clicked_at: "2099-01-01",
        },
      ],
      error: null,
    });
    const response = await GET(request(), context());
    const body = await response.json();
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(mocks.eq).toHaveBeenCalledWith("trip_id", tripId);
    expect(body.attempts[0]).not.toHaveProperty("confirmed");
    expect(body.attempts[0]).not.toHaveProperty("affiliate_url");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
