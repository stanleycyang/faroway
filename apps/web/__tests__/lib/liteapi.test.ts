import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@/lib/search/runtime", () => ({ fetchWithTimeout: request }));
import {
  LiteApiSearchSchema,
  searchLiteApiHotels,
} from "@/lib/affiliates/liteapi";

const input = {
  cityName: "Paris",
  countryCode: "FR",
  checkin: "2026-11-08",
  checkout: "2026-11-10",
  guestNationality: "US",
  currency: "USD",
  occupancies: [{ adults: 2, children: [8] }],
};
const payload = {
  sandbox: true,
  data: [
    {
      hotelId: "lp123",
      roomTypes: [
        {
          offerId: "quote123",
          rates: [
            {
              cancellationPolicies: { refundableTag: "NRFN" },
              retailRate: {
                total: [{ amount: 320, currency: "USD" }],
                suggestedSellingPrice: [{ amount: 350, currency: "USD" }],
                taxesAndFees: [
                  {
                    amount: 20,
                    currency: "USD",
                    included: false,
                    description: "City tax",
                  },
                ],
              },
            },
          ],
        },
      ],
    },
  ],
  hotels: [{ id: "lp123", name: "Fixture Hotel" }],
};
beforeEach(() => {
  request.mockReset();
  vi.stubEnv("LITEAPI_SANDBOX_ENABLED", "true");
  vi.stubEnv("LITEAPI_API_KEY", "sand_fixture_key");
  request.mockResolvedValue({ ok: true, json: async () => payload });
});
afterEach(() => vi.unstubAllEnvs());

describe("LiteAPI sandbox rates", () => {
  it("preserves prices, public selling minimums, taxes and cancellation terms", async () => {
    const result = await searchLiteApiHotels(input);
    expect(result).toEqual(payload);
    const [url, options, timeout] = request.mock.calls[0];
    expect(url).toBe("https://api.liteapi.travel/v3.0/hotels/rates");
    expect(options.cache).toBe("no-store");
    expect(JSON.parse(options.body)).toMatchObject({
      ...input,
      timeout: 6,
      includeHotelData: true,
    });
    expect(timeout).toBe(8000);
  });
  it("makes no request when disabled", async () => {
    vi.stubEnv("LITEAPI_SANDBOX_ENABLED", "false");
    await expect(searchLiteApiHotels(input)).rejects.toThrow("disabled");
    expect(request).not.toHaveBeenCalled();
  });
  it("rejects a production key before any request", async () => {
    vi.stubEnv("LITEAPI_API_KEY", "prod_fixture_key");
    await expect(searchLiteApiHotels(input)).rejects.toThrow("unconfigured");
    expect(request).not.toHaveBeenCalled();
  });
  it.each(["2026-02-30", "2026-11-08", "2026-11-07"])(
    "rejects invalid checkout %s before dispatch",
    async (checkout) => {
      await expect(
        searchLiteApiHotels({ ...input, checkout }),
      ).rejects.toThrow();
      expect(request).not.toHaveBeenCalled();
    },
  );
  it("requires nationality and explicit valid occupancy", () => {
    expect(
      LiteApiSearchSchema.safeParse({ ...input, guestNationality: undefined })
        .success,
    ).toBe(false);
    expect(
      LiteApiSearchSchema.safeParse({ ...input, occupancies: [{ adults: 0 }] })
        .success,
    ).toBe(false);
    expect(
      LiteApiSearchSchema.safeParse({
        ...input,
        occupancies: [{ adults: 2, children: [18] }],
      }).success,
    ).toBe(false);
  });
  it("rejects a live response without exposing its body", async () => {
    request.mockResolvedValue({
      ok: true,
      json: async () => ({ ...payload, sandbox: false }),
    });
    await expect(searchLiteApiHotels(input)).rejects.toThrow("non-sandbox");
  });
  it("fails closed on malformed prices", async () => {
    const broken = structuredClone(payload);
    broken.data[0].roomTypes[0].rates[0].retailRate.total[0].amount = -1;
    request.mockResolvedValue({ ok: true, json: async () => broken });
    await expect(searchLiteApiHotels(input)).rejects.toThrow("invalid");
  });
  it("reports HTTP failures without printing the provider body", async () => {
    request.mockResolvedValue({ ok: false, status: 429, text: vi.fn() });
    await expect(searchLiteApiHotels(input)).rejects.toThrow("429");
  });
});
