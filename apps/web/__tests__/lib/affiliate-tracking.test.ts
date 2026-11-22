import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  range: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: mocks.createClient,
}));

describe("apps/web/lib/affiliates/tracking.ts", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key-test");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("generates tg_-prefixed tracking IDs and detects device types", async () => {
    const mod = await import("@/lib/affiliates/tracking");
    expect(mod.generateTrackingId()).toMatch(/^tg_[a-z0-9]+_[A-Za-z0-9_-]{8}$/);
    expect(mod.detectDeviceType()).toBe("unknown");
    expect(
      mod.detectDeviceType(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
      ),
    ).toBe("mobile");
    expect(mod.detectDeviceType("Mozilla/5.0 (Linux; Android 14)")).toBe(
      "mobile",
    );
    expect(mod.detectDeviceType("Mozilla/5.0 (Linux; Tablet)")).toBe("tablet");
    expect(
      mod.detectDeviceType("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)"),
    ).toBe("desktop");
  });

  it("trackClick validates HTTPS URL, inserts normalized row, and throws on DB error", async () => {
    mocks.single.mockResolvedValueOnce({
      data: { id: "row-uuid-1" },
      error: null,
    });
    mocks.select.mockReturnValue({ single: mocks.single });
    mocks.insert.mockReturnValue({ select: mocks.select });
    mocks.from.mockReturnValue({ insert: mocks.insert });
    mocks.createClient.mockReturnValue({ from: mocks.from });

    const { trackClick } = await import("@/lib/affiliates/tracking");

    await expect(
      trackClick({
        partner: "viator",
        productId: "prod-1",
        productName: "Louvre Tour",
        clickUrl: "http://www.viator.com/tours/Paris/Louvre",
      }),
    ).rejects.toThrow("Affiliate click requires an https product URL");
    expect(mocks.insert).not.toHaveBeenCalled();

    const result = await trackClick({
      userId: "user-1",
      tripId: "trip-1",
      partner: "viator",
      productId: "prod-1",
      productName: "Louvre Tour",
      clickUrl: "https://www.viator.com/tours/Paris/Louvre",
      userAgent: "Mozilla/5.0 (iPhone)",
    });

    expect(result.trackingId).toMatch(/^tg_/);
    expect(result.click.id).toBe("row-uuid-1");
    expect(result.click.deviceType).toBe("mobile");
    expect(result.click.converted).toBe(false);
    expect(mocks.from).toHaveBeenCalledWith("affiliate_clicks");
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: result.trackingId,
        user_id: "user-1",
        trip_id: "trip-1",
        item_type: "activity",
        item_id: "prod-1",
        item_name: "Louvre Tour",
        affiliate_partner: "viator",
        affiliate_url: "https://www.viator.com/tours/Paris/Louvre",
      }),
    );

    mocks.single.mockResolvedValueOnce({
      data: null,
      error: { message: "insert failed" },
    });
    await expect(
      trackClick({
        partner: "viator",
        productId: "prod-2",
        productName: "Seine Cruise",
        clickUrl: "https://www.viator.com/tours/Paris/Seine",
      }),
    ).rejects.toThrow("Failed to track affiliate click");
  });

  it("recordConversion updates affiliate_clicks and handles errors", async () => {
    mocks.eq
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: "update failed" } });
    mocks.update.mockReturnValue({ eq: mocks.eq });
    mocks.from.mockReturnValue({ update: mocks.update });
    mocks.createClient.mockReturnValue({ from: mocks.from });

    const { recordConversion } = await import("@/lib/affiliates/tracking");

    expect(
      await recordConversion({
        trackingId: "tg_1",
        bookingAmount: 100,
        commissionAmount: 12.5,
      }),
    ).toBe(true);
    expect(mocks.update).toHaveBeenCalledWith({
      converted: true,
      conversion_value: 12.5,
    });
    expect(mocks.eq).toHaveBeenCalledWith("id", "tg_1");

    expect(
      await recordConversion({
        trackingId: "tg_2",
        bookingAmount: 50,
        commissionAmount: 5,
      }),
    ).toBe(false);
  });

  it("getClickByTrackingId and getUserClicks normalize rows and handle errors", async () => {
    const sampleRow = {
      id: "tg_click_1",
      user_id: "user-1",
      trip_id: "trip-1",
      affiliate_partner: "stay22",
      item_id: "htl-1",
      item_name: "Hotel Tokyo",
      affiliate_url: "https://www.stay22.com/allez/roam?aid=1",
      clicked_at: "2026-06-01T10:00:00Z",
      converted: true,
      conversion_value: 18,
    };

    const userClicksQuery = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      range: vi.fn().mockResolvedValueOnce({ data: [sampleRow], error: null }),
    };
    const userClicksErrorQuery = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValueOnce({
        data: null,
        error: { message: "query failed" },
      }),
    };

    mocks.single
      .mockResolvedValueOnce({ data: sampleRow, error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "PGRST116" } });
    mocks.eq.mockReturnValue({ single: mocks.single });
    mocks.select
      .mockReturnValueOnce({ eq: mocks.eq })
      .mockReturnValueOnce({ eq: mocks.eq })
      .mockReturnValueOnce(userClicksQuery)
      .mockReturnValueOnce(userClicksErrorQuery);
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.createClient.mockReturnValue({ from: mocks.from });

    const { getClickByTrackingId, getUserClicks } =
      await import("@/lib/affiliates/tracking");

    const found = await getClickByTrackingId("tg_click_1");
    expect(found).toMatchObject({
      id: "tg_click_1",
      trackingId: "tg_click_1",
      partner: "stay22",
      productId: "htl-1",
      productName: "Hotel Tokyo",
      converted: true,
      commissionAmount: 18,
    });
    expect(await getClickByTrackingId("missing")).toBeNull();

    const list = await getUserClicks("user-1", { limit: 5, offset: 10 });
    expect(list).toHaveLength(1);
    expect(userClicksQuery.limit).toHaveBeenCalledWith(5);
    expect(userClicksQuery.range).toHaveBeenCalledWith(10, 14);

    expect(await getUserClicks("user-1")).toEqual([]);
  });

  it("getAffiliateAnalytics groups by partner, computes rates/totals, filters, and handles empty/error DB", async () => {
    const rows = [
      { affiliate_partner: "viator", converted: true, conversion_value: 20 },
      { affiliate_partner: "viator", converted: false, conversion_value: null },
      { affiliate_partner: "stay22", converted: true, conversion_value: 30 },
      { affiliate_partner: "stay22", converted: true, conversion_value: 10 },
    ];

    const makeAnalyticsQuery = (result: { data: unknown; error: unknown }) => {
      const q: Record<string, unknown> = {};
      q.gte = vi.fn(() => q);
      q.lte = vi.fn(() => q);
      q.eq = vi.fn(() => q);
      q.then = (resolve: (v: unknown) => void) => resolve(result);
      return q;
    };

    const q1 = makeAnalyticsQuery({ data: rows, error: null });
    const q2 = makeAnalyticsQuery({ data: [], error: null });
    const q3 = makeAnalyticsQuery({
      data: null,
      error: { message: "analytics error" },
    });

    mocks.select
      .mockReturnValueOnce(q1)
      .mockReturnValueOnce(q2)
      .mockReturnValueOnce(q3);
    mocks.from.mockReturnValue({ select: mocks.select });
    mocks.createClient.mockReturnValue({ from: mocks.from });

    const { getAffiliateAnalytics } = await import("@/lib/affiliates/tracking");

    const summary = await getAffiliateAnalytics("2026-06-01", "2026-06-30", {
      partner: "viator",
      userId: "user-1",
    });
    expect(q1.eq).toHaveBeenCalledWith("affiliate_partner", "viator");
    expect(q1.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(summary).toEqual({
      totalClicks: 4,
      totalConversions: 3,
      conversionRate: 75,
      totalCommission: 60,
      byPartner: {
        viator: { clicks: 2, conversions: 1, commission: 20 },
        stay22: { clicks: 2, conversions: 2, commission: 40 },
      },
    });

    const empty = await getAffiliateAnalytics("2026-06-01", "2026-06-30");
    expect(empty).toEqual({
      totalClicks: 0,
      totalConversions: 0,
      conversionRate: 0,
      totalCommission: 0,
      byPartner: {},
    });

    const failed = await getAffiliateAnalytics("2026-06-01", "2026-06-30");
    expect(failed.totalClicks).toBe(0);
    expect(failed.byPartner).toEqual({});
  });

  it("throws when Supabase env vars are missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    const { trackClick } = await import("@/lib/affiliates/tracking");
    await expect(
      trackClick({
        partner: "viator",
        productId: "p1",
        productName: "Tour",
        clickUrl: "https://www.viator.com/tours/Paris",
      }),
    ).rejects.toThrow("Supabase not configured for affiliate tracking");
  });
});
