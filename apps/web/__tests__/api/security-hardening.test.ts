import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  getClientIp: vi.fn(() => "203.0.113.10"),
  supabaseFrom: vi.fn(),
  supabaseRpc: vi.fn(),
  authUser: vi.fn(),
  createSocialImage: vi.fn(),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimitAsync: mocks.rateLimit,
  getClientIp: mocks.getClientIp,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => ({
    from: mocks.supabaseFrom,
    rpc: mocks.supabaseRpc,
  }),
  createClientFromRequest: async () => ({
    auth: { getUser: mocks.authUser },
  }),
}));

vi.mock("@/lib/social-image", () => ({
  createSocialImage: mocks.createSocialImage,
}));

import { GET as cronCleanupGet } from "@/app/api/cron/cleanup/route";
import { POST as conversionPost } from "@/app/api/track/conversion/route";
import { POST as reactionsPost } from "@/app/api/trips/shared/[token]/reactions/route";
import { POST as blogViewsPost } from "@/app/api/blog/views/route";
import {
  GET as tripStreamGet,
  POST as tripStreamPost,
} from "@/app/api/trips/[id]/stream/route";
import { GET as ogGet } from "@/app/api/og/route";

describe("API security hardening regressions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rateLimit.mockResolvedValue({
      allowed: true,
      remaining: 10,
      resetIn: 60_000,
    });
    mocks.authUser.mockResolvedValue({
      data: { user: { id: "user-sec-1" } },
      error: null,
    });
    mocks.supabaseRpc.mockResolvedValue({ data: 0, error: null });
    mocks.createSocialImage.mockResolvedValue(
      new Response("png", { headers: { "Content-Type": "image/png" } }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("GET /api/cron/cleanup", () => {
    it("authorizes with constant-time secret comparison and rejects invalid/missing tokens", async () => {
      vi.stubEnv("CRON_SECRET", "super-secret-cron-token");

      const unauth = await cronCleanupGet(
        new NextRequest("https://app.test/api/cron/cleanup"),
      );
      expect(unauth.status).toBe(401);

      const wrongLen = await cronCleanupGet(
        new NextRequest("https://app.test/api/cron/cleanup", {
          headers: { authorization: "Bearer short" },
        }),
      );
      expect(wrongLen.status).toBe(401);

      const valid = await cronCleanupGet(
        new NextRequest("https://app.test/api/cron/cleanup", {
          headers: { authorization: "Bearer super-secret-cron-token" },
        }),
      );
      expect(valid.status).toBe(200);
    });
  });

  describe("POST /api/track/conversion", () => {
    it("rejects payloads larger than 16 KB with 413", async () => {
      const oversized = JSON.stringify({
        click_id: "click-1",
        partner: "viator",
        booking_value: 100,
        commission_value: 10,
        pad: "x".repeat(20_000),
      });
      const res = await conversionPost(
        new NextRequest("https://app.test/api/track/conversion", {
          method: "POST",
          headers: { "x-webhook-signature": "a".repeat(64) },
          body: oversized,
        }),
      );
      expect(res.status).toBe(413);
      expect(mocks.supabaseFrom).not.toHaveBeenCalled();
    });

    it("ignores stale confirmed replay when conversion is already cancelled", async () => {
      vi.stubEnv("VIATOR_WEBHOOK_SECRET", "test-secret");
      const upsert = vi.fn();
      const clickUpdate = vi.fn();
      mocks.supabaseFrom.mockImplementation((table: string) => {
        if (table === "affiliate_clicks") {
          return {
            select: () => ({
              eq: () => ({
                single: async () => ({
                  data: { id: "click-1", user_id: "u1" },
                  error: null,
                }),
              }),
            }),
            update: clickUpdate,
          };
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                limit: async () => ({
                  data: [{ status: "cancelled" }],
                  error: null,
                }),
              }),
            }),
          }),
          upsert,
        };
      });

      const payload = JSON.stringify({
        click_id: "click-1",
        partner: "viator",
        order_id: "order-1",
        booking_value: 100,
        commission_value: 10,
        status: "confirmed",
      });
      const sig = crypto
        .createHmac("sha256", "test-secret")
        .update(payload)
        .digest("hex");

      const res = await conversionPost(
        new NextRequest("https://app.test/api/track/conversion", {
          method: "POST",
          headers: { "x-webhook-signature": sig },
          body: payload,
        }),
      );
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.ignored).toBe(true);
      expect(upsert).not.toHaveBeenCalled();
      expect(clickUpdate).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/trips/shared/[token]/reactions", () => {
    it("fails closed in production when dedicated secret and IP_HASH_SALT are unset", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("SHARED_REACTIONS_SECRET", "");
      vi.stubEnv("IP_HASH_SALT", "");
      vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "should-never-be-used-for-hmac");
      vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-anon-key");

      mocks.supabaseFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: { id: "trip-1", itineraries: { days: [] } },
                error: null,
              }),
            }),
          }),
        }),
      });

      const res = await reactionsPost(
        new NextRequest(
          "https://app.test/api/trips/shared/abcd1234/reactions",
          {
            method: "POST",
            body: JSON.stringify({
              stopKey: "d1-morning-a-0-museum",
              reaction: "heart",
              action: "add",
            }),
          },
        ),
        { params: Promise.resolve({ token: "abcd1234" }) },
      );

      expect(res.status).toBe(503);
    });
  });

  describe("POST /api/blog/views", () => {
    it("truncates oversized user-agent and referer headers and requires IP_HASH_SALT in production", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("IP_HASH_SALT", "");
      const missingSaltRes = await blogViewsPost(
        new NextRequest("https://app.test/api/blog/views", {
          method: "POST",
          body: JSON.stringify({ slug: "tokyo-guide" }),
        }),
      );
      expect(missingSaltRes.status).toBe(503);

      vi.stubEnv("IP_HASH_SALT", "prod-salt-value");
      const insert = vi.fn(async () => ({ error: null }));
      mocks.supabaseFrom.mockReturnValue({ insert });

      const res = await blogViewsPost(
        new NextRequest("https://app.test/api/blog/views", {
          method: "POST",
          headers: {
            "user-agent": "U".repeat(2000),
            referer: `https://example.com/${"r".repeat(2000)}`,
          },
          body: JSON.stringify({ slug: "tokyo-guide" }),
        }),
      );
      expect(res.status).toBe(200);
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_agent: "U".repeat(512),
          referrer: `https://example.com/${"r".repeat(2000)}`.slice(0, 512),
        }),
      );
    });
  });

  describe("GET/POST /api/trips/[id]/stream", () => {
    it("rejects non-UUID trip IDs before DB access and enforces stream rate limit", async () => {
      const badPost = await tripStreamPost(
        new NextRequest("https://app.test/api/trips/not-a-uuid/stream", {
          method: "POST",
        }),
        { params: Promise.resolve({ id: "not-a-uuid" }) },
      );
      expect(badPost.status).toBe(400);

      const badGet = await tripStreamGet(
        new NextRequest("https://app.test/api/trips/not-a-uuid/stream", {
          method: "GET",
        }),
        { params: Promise.resolve({ id: "not-a-uuid" }) },
      );
      expect(badGet.status).toBe(400);
      expect(mocks.supabaseFrom).not.toHaveBeenCalled();

      mocks.rateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetIn: 30_000,
      });
      const limited = await tripStreamGet(
        new NextRequest(
          "https://app.test/api/trips/00000000-0000-4000-8000-000000000001/stream",
          { method: "GET" },
        ),
        {
          params: Promise.resolve({
            id: "00000000-0000-4000-8000-000000000001",
          }),
        },
      );
      expect(limited.status).toBe(429);
      expect(mocks.rateLimit).toHaveBeenCalledWith("trip-stream:user-sec-1", {
        maxRequests: 10,
        windowMs: 60_000,
        failClosed: true,
      });
    });
  });

  describe("GET /api/og", () => {
    it("attaches Cache-Control headers and respects rate limits", async () => {
      const ok = await ogGet(
        new NextRequest("https://app.test/api/og?title=Hello"),
      );
      expect(ok.status).toBe(200);
      expect(ok.headers.get("cache-control")).toContain("s-maxage=86400");

      mocks.rateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetIn: 15_000,
      });
      const limited = await ogGet(
        new NextRequest("https://app.test/api/og?title=Hello"),
      );
      expect(limited.status).toBe(429);
    });
  });
});
