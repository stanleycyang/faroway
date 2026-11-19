import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const { auth, limit, probe } = vi.hoisted(() => ({
  auth: vi.fn(),
  limit: vi.fn(),
  probe: vi.fn(),
}));
vi.mock("@/lib/auth/middleware", () => ({ requireUserIdFromRequest: auth }));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimitAsync: limit }));
vi.mock("@/lib/affiliates/viator", () => ({ probeViatorSandbox: probe }));
import { POST } from "@/app/api/qa/suppliers/route";
const request = (body: unknown = {}) =>
  new NextRequest("https://qa.test/api/qa/suppliers", {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    "https://omovikloadpvzijoaqus.supabase.co",
  );
  auth.mockResolvedValue({ userId: "qa-user" });
  limit.mockResolvedValue({ allowed: true });
  probe.mockResolvedValue({ status: "available", products: 3 });
});
afterEach(() => vi.unstubAllEnvs());
it.each(["production", "development"])(
  "blocks %s before auth or supplier access",
  async (environment) => {
    vi.stubEnv("VERCEL_ENV", environment);
    expect((await POST(request())).status).toBe(404);
    expect(auth).not.toHaveBeenCalled();
    expect(probe).not.toHaveBeenCalled();
  },
);
it("blocks previews backed by another database", async () => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://other.supabase.co");
  expect((await POST(request())).status).toBe(404);
  expect(probe).not.toHaveBeenCalled();
});
it("requires authentication", async () => {
  auth.mockResolvedValue(NextResponse.json({}, { status: 401 }));
  expect((await POST(request())).status).toBe(401);
  expect(probe).not.toHaveBeenCalled();
});
it("enforces a fail-closed rate limit before supplier access", async () => {
  limit.mockResolvedValue({ allowed: false });
  expect((await POST(request())).status).toBe(429);
  expect(probe).not.toHaveBeenCalled();
  expect(limit).toHaveBeenCalledWith(
    "qa-suppliers:qa-user",
    expect.objectContaining({ failClosed: true, maxRequests: 3 }),
  );
});
it("returns uncached diagnostics", async () => {
  const response = await POST(request());
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toEqual({
    viator: { status: "available", products: 3 },
  });
});

it.each([
  { startDate: "2026-12-07" },
  { startDate: "2026-12-09", endDate: "2026-12-07" },
  { startDate: "2026-02-30", endDate: "2026-03-01" },
  { apiKey: "not-allowed" },
  { maxDurationMinutes: 0 },
  { maxDurationMinutes: 721 },
  { maxDurationMinutes: 60.5 },
  { endDate: "2026-12-09" },
  { transport: "other" },
  { startDate: "2026-12-07", endDate: "2026-12-09", transport: "https" },
])("rejects invalid probe input before supplier calls", async (body) => {
  expect((await POST(request(body))).status).toBe(400);
  expect(probe).not.toHaveBeenCalled();
});
it("can inspect a duration-filtered catalog without model calls", async () => {
  const body = { maxDurationMinutes: 240 };
  expect((await POST(request(body))).status).toBe(200);
  expect(probe).toHaveBeenCalledWith(body);
});
it("can probe the actual dated search without a paid model call", async () => {
  const dates = { startDate: "2026-12-07", endDate: "2026-12-09" };
  expect((await POST(request(dates))).status).toBe(200);
  expect(probe).toHaveBeenCalledWith(dates);
});
