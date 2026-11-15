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
const request = () =>
  new NextRequest("https://qa.test/api/qa/suppliers", { method: "POST" });
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
