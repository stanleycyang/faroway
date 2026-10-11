import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const { configured, auth, limit, search } = vi.hoisted(() => ({
  configured: vi.fn(),
  auth: vi.fn(),
  limit: vi.fn(),
  search: vi.fn(),
}));
vi.mock("@/lib/auth/middleware", () => ({ requireUserIdFromRequest: auth }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimitAsync: limit }));
vi.mock("@/lib/affiliates/liteapi", async (original) => ({
  ...(await original<typeof import("@/lib/affiliates/liteapi")>()),
  isLiteApiConfigured: configured,
  searchLiteApiHotels: search,
}));
import { POST } from "@/app/api/hotels/liteapi/route";
const input = {
  cityName: "Paris",
  countryCode: "FR",
  checkin: "2026-11-08",
  checkout: "2026-11-10",
  guestNationality: "US",
  currency: "USD",
  occupancies: [{ adults: 2 }],
};
const request = (body: unknown = input) =>
  new NextRequest("https://fixture.test/api/hotels/liteapi", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL_ENV", "preview");
  configured.mockReturnValue(true);
  auth.mockResolvedValue({ userId: "fixture-user" });
  limit.mockResolvedValue({ allowed: true });
  search.mockResolvedValue({ sandbox: true, data: [] });
});
afterEach(() => vi.unstubAllEnvs());
it("never enables this sandbox endpoint in production", async () => {
  vi.stubEnv("VERCEL_ENV", "production");
  expect((await POST(request())).status).toBe(503);
  expect(search).not.toHaveBeenCalled();
});
it("requires authentication before supplier calls", async () => {
  auth.mockResolvedValue(
    NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  );
  expect((await POST(request())).status).toBe(401);
  expect(search).not.toHaveBeenCalled();
});
it("rate limits authenticated supplier searches", async () => {
  limit.mockResolvedValue({ allowed: false });
  expect((await POST(request())).status).toBe(429);
  expect(search).not.toHaveBeenCalled();
});
it("rejects incomplete occupancy/nationality", async () => {
  expect(
    (await POST(request({ ...input, guestNationality: undefined }))).status,
  ).toBe(400);
  expect(search).not.toHaveBeenCalled();
});
it("returns uncached sandbox results with explicit occupancy", async () => {
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(search).toHaveBeenCalledWith(
    expect.objectContaining({
      guestNationality: "US",
      occupancies: [{ adults: 2, children: [] }],
    }),
  );
});
it("does not expose supplier errors", async () => {
  search.mockRejectedValue(new Error("private supplier body"));
  const response = await POST(request());
  expect(response.status).toBe(502);
  expect(await response.text()).not.toContain("private supplier body");
});
