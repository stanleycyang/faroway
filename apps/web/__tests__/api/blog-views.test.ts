import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  checkRateLimitAsync: vi.fn(),
  getClientIp: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
  getClientIp: mocks.getClientIp,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => ({ rpc: mocks.rpc }),
}));

import { POST } from "@/app/api/blog/views/route";

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost:3000/api/blog/views", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "test-agent",
      referer: "https://example.com/article",
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/blog/views", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.IP_HASH_SALT = "a-secure-test-salt-at-least-32-chars";
    mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true });
    mocks.getClientIp.mockReturnValue("203.0.113.10");
    mocks.rpc.mockResolvedValue({ error: null });
  });

  it("records a view through the atomic database operation", async () => {
    const res = await POST(makeRequest({ slug: "tokyo-guide" }));

    expect(res.status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith(
      "record_blog_view",
      expect.objectContaining({
        p_slug: "tokyo-guide",
        p_user_agent: "test-agent",
        p_referrer: "https://example.com/article",
      }),
    );
  });

  it("does not report success when persistence fails", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { message: "database offline" } });

    const res = await POST(makeRequest({ slug: "tokyo-guide" }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({
      error: "Failed to track view",
    });
  });

  it("rate limits before parsing or writing", async () => {
    mocks.checkRateLimitAsync.mockResolvedValueOnce({ allowed: false });

    const res = await POST(makeRequest({ slug: "tokyo-guide" }));

    expect(res.status).toBe(429);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
