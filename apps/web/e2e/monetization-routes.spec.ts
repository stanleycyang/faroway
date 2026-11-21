import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";

test.skip(
  process.env.MONETIZATION_ROUTES_E2E !== "true",
  "Requires the isolated loopback Next.js route server (playwright.monetization-routes.config.ts).",
);

const FIXTURE_URL = "http://127.0.0.1:4411";
const OWNER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_USER_ID = "22222222-2222-4222-8222-222222222222";
const TRIP_ID = "33333333-3333-4333-8333-333333333333";

const WEBHOOK_SECRETS = {
  viator: "fixture-viator-webhook-secret",
  getyourguide: "fixture-gyg-webhook-secret",
  klook: "fixture-klook-webhook-secret",
} as const;

function makeJwt(userId: string): string {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: userId, aud: "authenticated", exp })}.fixture-sig`;
}

function signWebhook(secret: string, rawBody: string): string {
  return createHmac("sha256", secret).update(rawBody).digest("hex");
}

function makeTrip(overrides: Record<string, unknown> = {}) {
  return {
    id: TRIP_ID,
    user_id: OWNER_ID,
    destination: "Paris",
    start_date: "2099-06-01",
    end_date: "2099-06-04",
    travelers: 2,
    budget_tier: "moderate",
    status: "planned",
    preferences: {},
    vibes: ["culture"],
    interests: [],
    is_shared: false,
    share_token: null,
    created_at: "2026-10-01T00:00:00.000Z",
    updated_at: "2026-10-03T00:00:00.000Z",
    itineraries: [
      {
        days: [
          {
            dayNumber: 1,
            date: "2099-06-01",
            title: "Paris Classics",
            summary: "Day 1",
            morning: {
              activities: [
                {
                  id: "activity_v_123P1",
                  name: "Louvre Guided Walk",
                  bookingInfo: { affiliateId: "viator" },
                  viatorContentVersion: 1,
                },
                {
                  id: "activity_v_OTHER1",
                  name: "Seine Evening Tour",
                  bookingInfo: { affiliateId: "viator" },
                  viatorContentVersion: 1,
                },
              ],
              meals: [],
            },
            afternoon: { activities: [], meals: [] },
            evening: { activities: [], meals: [] },
          },
        ],
        overview: "Paris trip",
        total_cost: null,
        packing_list: [],
        general_tips: [],
        generated_at: "2026-10-03T00:00:00.000Z",
      },
    ],
    ...overrides,
  };
}

test.beforeEach(async ({ request }) => {
  const res = await request.post(`${FIXTURE_URL}/fixture/reset`);
  expect(res.ok()).toBe(true);
});

test.describe("POST /api/track/click", () => {
  test("logs allowlisted partners and injects tracking parameters", async ({
    request,
  }) => {
    const cases = [
      {
        partner: "viator",
        url: "https://www.viator.com/tours/Paris/Walk/d479-123P1?pid=P12345678",
        itemType: "activity",
      },
      {
        partner: "getyourguide",
        url: "https://www.getyourguide.com/paris-l16/louvre-t12345/",
        itemType: "activity",
      },
      {
        partner: "discovercars",
        url: "https://www.discovercars.com/france/paris",
        itemType: "transport",
      },
      {
        partner: "duffel",
        url: "https://book.duffel.com/flights/SFO-CDG",
        itemType: "flight",
      },
      {
        partner: "opentable",
        url: "https://www.opentable.com/r/septime-paris",
        itemType: "restaurant",
      },
      {
        partner: "hostelworld",
        url: "https://www.hostelworld.com/hostels/Paris",
        itemType: "hotel",
      },
      {
        partner: "tripadvisor",
        url: "https://www.tripadvisor.com/Attraction-g187147-Paris.html",
        itemType: "activity",
      },
    ] as const;

    for (const c of cases) {
      const response = await request.post("/api/track/click", {
        data: {
          itemType: c.itemType,
          itemId: `item-${c.partner}`,
          itemName: `Test ${c.partner}`,
          affiliatePartner: c.partner,
          affiliateUrl: c.url,
          source: "itinerary",
        },
      });
      expect(response.status()).toBe(200);
      const json = (await response.json()) as {
        clickId: string;
        redirectUrl: string;
      };
      expect(json.clickId).toBeTruthy();
      const redirect = new URL(json.redirectUrl);
      expect(redirect.searchParams.get("click_id")).toBe(json.clickId);
      expect(redirect.searchParams.get("utm_source")).toBe("faroway");
    }

    const stateRes = await request.get(`${FIXTURE_URL}/fixture/state`);
    const state = (await stateRes.json()) as {
      affiliateClicks: Array<{ user_id: string | null }>;
    };
    expect(state.affiliateClicks).toHaveLength(cases.length);
    expect(state.affiliateClicks.every((c) => c.user_id === null)).toBe(true);
  });

  test("rejects reserved checkout- clickId prefix, SSRF/lookalike URLs, and malformed JSON with 400", async ({
    request,
  }) => {
    const reserved = await request.post("/api/track/click", {
      data: {
        clickId: "checkout-00000000-0000-4000-8000-000000000001",
        itemType: "activity",
        itemId: "act_1",
        itemName: "Tour",
        affiliatePartner: "viator",
        affiliateUrl: "https://www.viator.com/tours/Paris/Walk/d479-123P1",
      },
    });
    expect(reserved.status()).toBe(400);
    expect((await reserved.json()).error).toBe("Reserved click ID");

    for (const badUrl of [
      "http://127.0.0.1:4411/steal",
      "https://evil.test/tours/123",
      "https://viator.com.evil.test/tours/123",
      "http://www.viator.com/tours/Paris/Walk/d479-123P1",
    ]) {
      const ssrf = await request.post("/api/track/click", {
        data: {
          itemType: "activity",
          itemId: "act_1",
          itemName: "Tour",
          affiliatePartner: "viator",
          affiliateUrl: badUrl,
        },
      });
      expect(ssrf.status()).toBe(400);
    }

    const malformed = await request.post("/api/track/click", {
      headers: { "Content-Type": "application/json" },
      data: "{invalid-json",
    });
    expect(malformed.status()).toBe(400);

    const stateRes = await request.get(`${FIXTURE_URL}/fixture/state`);
    const state = (await stateRes.json()) as { affiliateClicks: unknown[] };
    expect(state.affiliateClicks).toHaveLength(0);
  });

  test("records authenticated user_id when Bearer JWT is provided", async ({
    request,
  }) => {
    const res = await request.post("/api/track/click", {
      headers: { Authorization: `Bearer ${makeJwt(OWNER_ID)}` },
      data: {
        itemType: "activity",
        itemId: "act_auth_1",
        itemName: "Authenticated Tour",
        affiliatePartner: "viator",
        affiliateUrl: "https://www.viator.com/tours/Paris/Walk/d479-123P1",
        source: "trip_view",
      },
    });
    expect(res.status()).toBe(200);
    const state = (await (
      await request.get(`${FIXTURE_URL}/fixture/state`)
    ).json()) as {
      affiliateClicks: Array<{ user_id: string | null; item_id: string }>;
    };
    expect(state.affiliateClicks).toHaveLength(1);
    expect(state.affiliateClicks[0].user_id).toBe(OWNER_ID);
  });

  test("returns 429 when rate limiter rejects /api/track/click", async ({
    request,
  }) => {
    await request.post(`${FIXTURE_URL}/fixture/rate-limit`, {
      data: { allowed: false, remaining: 0, reset_in_ms: 30_000 },
    });

    const limited = await request.post("/api/track/click", {
      data: {
        itemType: "activity",
        itemId: "act_rl_1",
        itemName: "Rate Limited Tour",
        affiliatePartner: "viator",
        affiliateUrl: "https://www.viator.com/tours/Paris/Walk/d479-123P1",
      },
    });
    expect(limited.status()).toBe(429);
    expect((await limited.json()).error).toBe("Too many requests");

    const state = (await (
      await request.get(`${FIXTURE_URL}/fixture/state`)
    ).json()) as { affiliateClicks: unknown[] };
    expect(state.affiliateClicks).toHaveLength(0);
  });
});

test.describe("POST /api/track/conversion", () => {
  test("verifies HMAC-SHA256 for supported partners, enforces idempotency, and updates click status", async ({
    request,
  }) => {
    // Seed a click first
    const clickRes = await request.post("/api/track/click", {
      data: {
        clickId: "clk_conv_1",
        itemType: "activity",
        itemId: "act_1",
        itemName: "Tour",
        affiliatePartner: "viator",
        affiliateUrl: "https://www.viator.com/tours/Paris/Walk/d479-123P1",
      },
    });
    expect(clickRes.status()).toBe(200);

    // Pending webhook
    const pendingRaw = JSON.stringify({
      click_id: "clk_conv_1",
      partner: "viator",
      order_id: "ORD-100",
      booking_value: 150,
      commission_value: 12,
      currency: "USD",
      status: "pending",
    });
    const pendingRes = await request.post("/api/track/conversion", {
      headers: {
        "Content-Type": "application/json",
        "x-webhook-signature": signWebhook(WEBHOOK_SECRETS.viator, pendingRaw),
      },
      data: pendingRaw,
    });
    expect(pendingRes.status()).toBe(200);

    let state = (await (
      await request.get(`${FIXTURE_URL}/fixture/state`)
    ).json()) as {
      affiliateClicks: Array<{
        id: string;
        converted: boolean;
        conversion_value: number | null;
      }>;
      affiliateConversions: Array<{ status: string; order_id: string }>;
    };
    expect(state.affiliateClicks[0].converted).toBe(false);
    expect(state.affiliateConversions).toHaveLength(1);

    // Confirmed webhook (same order_id -> idempotent upsert)
    const confirmedRaw = JSON.stringify({
      click_id: "clk_conv_1",
      partner: "viator",
      order_id: "ORD-100",
      booking_value: 150,
      commission_value: 12,
      currency: "USD",
      status: "confirmed",
    });
    const confirmedRes = await request.post("/api/track/conversion", {
      headers: {
        "Content-Type": "application/json",
        "x-webhook-signature": signWebhook(
          WEBHOOK_SECRETS.viator,
          confirmedRaw,
        ),
      },
      data: confirmedRaw,
    });
    expect(confirmedRes.status()).toBe(200);

    // Duplicate confirmed retry
    const retryRes = await request.post("/api/track/conversion", {
      headers: {
        "Content-Type": "application/json",
        "x-webhook-signature": signWebhook(
          WEBHOOK_SECRETS.viator,
          confirmedRaw,
        ),
      },
      data: confirmedRaw,
    });
    expect(retryRes.status()).toBe(200);

    state = (await (
      await request.get(`${FIXTURE_URL}/fixture/state`)
    ).json()) as typeof state;
    expect(state.affiliateConversions).toHaveLength(1);
    expect(state.affiliateConversions[0].status).toBe("confirmed");
    expect(state.affiliateClicks[0].converted).toBe(true);
    expect(state.affiliateClicks[0].conversion_value).toBe(12);

    // Cancelled webhook resets converted flag
    const cancelledRaw = JSON.stringify({
      click_id: "clk_conv_1",
      partner: "viator",
      order_id: "ORD-100",
      booking_value: 150,
      commission_value: 12,
      currency: "USD",
      status: "cancelled",
    });
    const cancelledRes = await request.post("/api/track/conversion", {
      headers: {
        "Content-Type": "application/json",
        "x-webhook-signature": signWebhook(
          WEBHOOK_SECRETS.viator,
          cancelledRaw,
        ),
      },
      data: cancelledRaw,
    });
    expect(cancelledRes.status()).toBe(200);
    state = (await (
      await request.get(`${FIXTURE_URL}/fixture/state`)
    ).json()) as typeof state;
    expect(state.affiliateClicks[0].converted).toBe(false);
    expect(state.affiliateClicks[0].conversion_value).toBeNull();
  });

  test("accepts getyourguide/klook valid signatures and handles orphan click_id with null click_id", async ({
    request,
  }) => {
    for (const partner of ["getyourguide", "klook"] as const) {
      const raw = JSON.stringify({
        click_id: `orphan_${partner}`,
        partner,
        order_id: `ORD-${partner}`,
        booking_value: 99,
        commission_value: 7.5,
        currency: "EUR",
        status: "confirmed",
      });
      const res = await request.post("/api/track/conversion", {
        headers: {
          "Content-Type": "application/json",
          "x-webhook-signature": signWebhook(WEBHOOK_SECRETS[partner], raw),
        },
        data: raw,
      });
      expect(res.status()).toBe(200);
    }

    const state = (await (
      await request.get(`${FIXTURE_URL}/fixture/state`)
    ).json()) as {
      affiliateConversions: Array<{
        partner: string;
        click_id: string | null;
      }>;
    };
    expect(state.affiliateConversions).toHaveLength(2);
    expect(
      state.affiliateConversions.every((row) => row.click_id === null),
    ).toBe(true);
  });

  test("rejects missing/invalid HMAC with 401 and retired/unknown partner with 400 before DB write", async ({
    request,
  }) => {
    const raw = JSON.stringify({
      click_id: "clk_bad_sig",
      partner: "viator",
      order_id: "ORD-BAD",
      booking_value: 100,
      commission_value: 8,
      currency: "USD",
      status: "confirmed",
    });

    const missingSig = await request.post("/api/track/conversion", {
      headers: { "Content-Type": "application/json" },
      data: raw,
    });
    expect(missingSig.status()).toBe(401);

    const wrongSig = await request.post("/api/track/conversion", {
      headers: {
        "Content-Type": "application/json",
        "x-webhook-signature": "a".repeat(64),
      },
      data: raw,
    });
    expect(wrongSig.status()).toBe(401);

    const retiredRaw = JSON.stringify({
      click_id: "clk_retired",
      partner: "retired-provider",
      order_id: "ORD-RET",
      booking_value: 100,
      commission_value: 8,
    });
    const retiredRes = await request.post("/api/track/conversion", {
      headers: {
        "Content-Type": "application/json",
        "x-webhook-signature": signWebhook(WEBHOOK_SECRETS.viator, retiredRaw),
      },
      data: retiredRaw,
    });
    expect(retiredRes.status()).toBe(400);

    const state = (await (
      await request.get(`${FIXTURE_URL}/fixture/state`)
    ).json()) as { affiliateConversions: unknown[] };
    expect(state.affiliateConversions).toHaveLength(0);
  });

  test("rejects negative booking_value, negative commission_value, lowercase currency, and invalid status with 400", async ({
    request,
  }) => {
    const invalidPayloads = [
      {
        click_id: "clk_neg_booking",
        partner: "viator",
        order_id: "ORD-NEG-1",
        booking_value: -10,
        commission_value: 2,
        currency: "USD",
        status: "confirmed",
      },
      {
        click_id: "clk_neg_comm",
        partner: "viator",
        order_id: "ORD-NEG-2",
        booking_value: 100,
        commission_value: -1,
        currency: "USD",
        status: "confirmed",
      },
      {
        click_id: "clk_bad_curr",
        partner: "viator",
        order_id: "ORD-CURR",
        booking_value: 100,
        commission_value: 8,
        currency: "usd",
        status: "confirmed",
      },
      {
        click_id: "clk_bad_status",
        partner: "viator",
        order_id: "ORD-STATUS",
        booking_value: 100,
        commission_value: 8,
        currency: "USD",
        status: "refunded_unknown",
      },
    ];

    for (const payload of invalidPayloads) {
      const raw = JSON.stringify(payload);
      const res = await request.post("/api/track/conversion", {
        headers: {
          "Content-Type": "application/json",
          "x-webhook-signature": signWebhook(WEBHOOK_SECRETS.viator, raw),
        },
        data: raw,
      });
      expect(res.status()).toBe(400);
    }

    const state = (await (
      await request.get(`${FIXTURE_URL}/fixture/state`)
    ).json()) as { affiliateConversions: unknown[] };
    expect(state.affiliateConversions).toHaveLength(0);
  });
});

test.describe("GET & POST /api/trips/[id]/checkout", () => {
  test("enforces auth (401), ownership (404), strict input (400), and stale/date/plan conflicts (409)", async ({
    request,
  }) => {
    await request.post(`${FIXTURE_URL}/fixture/trip`, { data: makeTrip() });
    const attemptId = "00000000-0000-4000-8000-000000000201";

    // 401 unauthenticated
    expect((await request.get(`/api/trips/${TRIP_ID}/checkout`)).status()).toBe(
      401,
    );
    expect(
      (
        await request.post(`/api/trips/${TRIP_ID}/checkout`, {
          data: {
            activityId: "activity_v_123P1",
            date: "2099-06-01",
            attemptId,
          },
        })
      ).status(),
    ).toBe(401);

    // 404 non-owner
    expect(
      (
        await request.get(`/api/trips/${TRIP_ID}/checkout`, {
          headers: { Authorization: `Bearer ${makeJwt(OTHER_USER_ID)}` },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await request.post(`/api/trips/${TRIP_ID}/checkout`, {
          headers: { Authorization: `Bearer ${makeJwt(OTHER_USER_ID)}` },
          data: {
            activityId: "activity_v_123P1",
            date: "2099-06-01",
            attemptId,
          },
        })
      ).status(),
    ).toBe(404);

    // 400 client-supplied affiliateUrl (.strict() schema)
    const strictReject = await request.post(`/api/trips/${TRIP_ID}/checkout`, {
      headers: { Authorization: `Bearer ${makeJwt(OWNER_ID)}` },
      data: {
        activityId: "activity_v_123P1",
        date: "2099-06-01",
        attemptId,
        affiliateUrl: "https://evil.test/override",
      },
    });
    expect(strictReject.status()).toBe(400);

    // 409 out-of-range date
    const outOfRange = await request.post(`/api/trips/${TRIP_ID}/checkout`, {
      headers: { Authorization: `Bearer ${makeJwt(OWNER_ID)}` },
      data: {
        activityId: "activity_v_123P1",
        date: "2099-06-10",
        attemptId,
      },
    });
    expect(outOfRange.status()).toBe(409);

    // 409 past date (on a trip whose start_date is in the past)
    await request.post(`${FIXTURE_URL}/fixture/trip`, {
      data: makeTrip({
        start_date: "2020-01-01",
        end_date: "2020-01-03",
        itineraries: [
          {
            days: [
              {
                dayNumber: 1,
                date: "2020-01-01",
                morning: {
                  activities: [
                    {
                      id: "activity_v_123P1",
                      name: "Past Walk",
                      bookingInfo: { affiliateId: "viator" },
                      viatorContentVersion: 1,
                    },
                  ],
                  meals: [],
                },
              },
            ],
          },
        ],
      }),
    });
    const pastDate = await request.post(`/api/trips/${TRIP_ID}/checkout`, {
      headers: { Authorization: `Bearer ${makeJwt(OWNER_ID)}` },
      data: {
        activityId: "activity_v_123P1",
        date: "2020-01-01",
        attemptId,
      },
    });
    expect(pastDate.status()).toBe(409);

    // 409 planNeedsRefresh
    await request.post(`${FIXTURE_URL}/fixture/trip`, {
      data: makeTrip({ preferences: { planNeedsRefresh: true } }),
    });
    const stalePost = await request.post(`/api/trips/${TRIP_ID}/checkout`, {
      headers: { Authorization: `Bearer ${makeJwt(OWNER_ID)}` },
      data: {
        activityId: "activity_v_123P1",
        date: "2099-06-01",
        attemptId,
      },
    });
    expect(stalePost.status()).toBe(409);
  });

  test("prepares canonical Viator handoff (200), prevents attemptId reuse (409), handles RPC conflict (409) and unverified Viator URL (503), and omits affiliate_url on GET", async ({
    request,
  }) => {
    await request.post(`${FIXTURE_URL}/fixture/trip`, { data: makeTrip() });
    const attemptId = "00000000-0000-4000-8000-000000000202";
    const headers = { Authorization: `Bearer ${makeJwt(OWNER_ID)}` };

    // 200 canonical Viator handoff
    const postRes = await request.post(`/api/trips/${TRIP_ID}/checkout`, {
      headers,
      data: {
        activityId: "activity_v_123P1",
        date: "2099-06-01",
        attemptId,
      },
    });
    expect(postRes.status()).toBe(200);
    expect(postRes.headers()["cache-control"]).toBe("no-store");
    const postJson = (await postRes.json()) as {
      redirectUrl: string;
      attemptId: string;
      status: string;
    };
    expect(postJson.status).toBe("handoff_prepared");
    expect(postJson.attemptId).toBe(attemptId);
    expect(postJson.redirectUrl).toContain(`campaign=checkout-${attemptId}`);

    // GET returns attempt without affiliate_url or confirmed
    const getRes = await request.get(`/api/trips/${TRIP_ID}/checkout`, {
      headers,
    });
    expect(getRes.status()).toBe(200);
    expect(getRes.headers()["cache-control"]).toBe("no-store");
    const getJson = (await getRes.json()) as {
      enabled: boolean;
      attempts: Array<Record<string, unknown>>;
    };
    expect(getJson.enabled).toBe(true);
    expect(getJson.attempts).toHaveLength(1);
    expect(getJson.attempts[0].canResume).toBe(true);
    expect("affiliate_url" in getJson.attempts[0]).toBe(false);
    expect("confirmed" in getJson.attempts[0]).toBe(false);

    // 409 reused attemptId for different activity
    const reuseRes = await request.post(`/api/trips/${TRIP_ID}/checkout`, {
      headers,
      data: {
        activityId: "activity_v_OTHER1",
        date: "2099-06-01",
        attemptId,
      },
    });
    expect(reuseRes.status()).toBe(409);

    // 409 prepare_trip_handoff returns false (concurrent brief revision change)
    await request.post(`${FIXTURE_URL}/fixture/handoff-override`, {
      data: { value: false },
    });
    const rpcConflict = await request.post(`/api/trips/${TRIP_ID}/checkout`, {
      headers,
      data: {
        activityId: "activity_v_123P1",
        date: "2099-06-01",
        attemptId: "00000000-0000-4000-8000-000000000203",
      },
    });
    expect(rpcConflict.status()).toBe(409);

    // 503 unverified Viator product URL
    await request.post(`${FIXTURE_URL}/fixture/viator`, {
      data: {
        productCode: "123P1",
        status: 200,
        product: {
          productCode: "123P1",
          title: "Evil Spoof",
          productUrl: "https://evil.test/tours/Paris/Walk",
        },
      },
    });
    const unverifiedRes = await request.post(`/api/trips/${TRIP_ID}/checkout`, {
      headers,
      data: {
        activityId: "activity_v_123P1",
        date: "2099-06-01",
        attemptId: "00000000-0000-4000-8000-000000000204",
      },
    });
    expect(unverifiedRes.status()).toBe(503);

    // GET returns canResume=false after trip updated_at changes
    await request.post(`${FIXTURE_URL}/fixture/trip`, {
      data: makeTrip({ updated_at: "2026-10-04T00:00:00.000Z" }),
    });
    const staleAttemptGet = await request.get(
      `/api/trips/${TRIP_ID}/checkout`,
      {
        headers,
      },
    );
    expect(staleAttemptGet.status()).toBe(200);
    const staleAttemptJson = (await staleAttemptGet.json()) as {
      enabled: boolean;
      attempts: Array<{ canResume: boolean }>;
    };
    expect(staleAttemptJson.enabled).toBe(true);
    expect(staleAttemptJson.attempts[0].canResume).toBe(false);

    // GET returns enabled=false under planNeedsRefresh=true
    await request.post(`${FIXTURE_URL}/fixture/trip`, {
      data: makeTrip({ preferences: { planNeedsRefresh: true } }),
    });
    const refreshNeededGet = await request.get(
      `/api/trips/${TRIP_ID}/checkout`,
      { headers },
    );
    expect(refreshNeededGet.status()).toBe(200);
    const refreshNeededJson = (await refreshNeededGet.json()) as {
      enabled: boolean;
    };
    expect(refreshNeededJson.enabled).toBe(false);
  });

  test("returns 429 when rate limiter rejects /api/trips/[id]/checkout", async ({
    request,
  }) => {
    await request.post(`${FIXTURE_URL}/fixture/trip`, { data: makeTrip() });
    await request.post(`${FIXTURE_URL}/fixture/rate-limit`, {
      data: { allowed: false, remaining: 0, reset_in_ms: 30_000 },
    });

    const limited = await request.post(`/api/trips/${TRIP_ID}/checkout`, {
      headers: { Authorization: `Bearer ${makeJwt(OWNER_ID)}` },
      data: {
        activityId: "activity_v_123P1",
        date: "2099-06-01",
        attemptId: "00000000-0000-4000-8000-000000000205",
      },
    });
    expect(limited.status()).toBe(429);
    expect((await limited.json()).error).toBe(
      "Please wait before trying again.",
    );
  });
});
