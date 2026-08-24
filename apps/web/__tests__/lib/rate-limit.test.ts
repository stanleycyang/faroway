import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock @faroway/constants before importing modules that depend on it
vi.mock("@faroway/constants", () => ({
  VIBE_KEYWORDS: {
    adventure: ["hiking", "trekking", "outdoor", "extreme"],
    cultural: ["museum", "temple", "history", "art"],
    foodie: ["food", "restaurant", "cuisine", "cooking"],
  },
}));

// ─── Rate Limiter ────────────────────────────────────────────────────────────

describe("checkRateLimit", () => {
  // Dynamic import so the module-level setInterval runs inside the test context
  let checkRateLimit: typeof import("@/lib/security/rate-limit").checkRateLimit;

  beforeEach(async () => {
    vi.useFakeTimers();
    // Re-import to get a fresh module (and a fresh rateLimitMap) each time
    vi.resetModules();
    const mod = await import("@/lib/security/rate-limit");
    checkRateLimit = mod.checkRateLimit;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows the first request with correct remaining count", () => {
    const result = checkRateLimit("user-1", {
      maxRequests: 5,
      windowMs: 10_000,
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.resetIn).toBe(10_000);
  });

  it("allows multiple requests within the limit", () => {
    const config = { maxRequests: 3, windowMs: 10_000 };

    const r1 = checkRateLimit("user-2", config);
    const r2 = checkRateLimit("user-2", config);
    const r3 = checkRateLimit("user-2", config);

    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);
  });

  it("rejects the request that exceeds the limit", () => {
    const config = { maxRequests: 2, windowMs: 10_000 };

    checkRateLimit("user-3", config); // 1
    checkRateLimit("user-3", config); // 2
    const r3 = checkRateLimit("user-3", config); // 3 — over limit

    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it("tracks different identifiers separately", () => {
    const config = { maxRequests: 1, windowMs: 10_000 };

    checkRateLimit("alpha", config);
    const alphaOver = checkRateLimit("alpha", config);

    const betaFirst = checkRateLimit("beta", config);

    expect(alphaOver.allowed).toBe(false);
    expect(betaFirst.allowed).toBe(true);
    expect(betaFirst.remaining).toBe(0);
  });

  it("resets the window after it expires", () => {
    const config = { maxRequests: 1, windowMs: 5_000 };

    checkRateLimit("user-4", config); // uses the single allowed request
    const blocked = checkRateLimit("user-4", config);
    expect(blocked.allowed).toBe(false);

    // Advance past the window
    vi.advanceTimersByTime(5_001);

    const afterReset = checkRateLimit("user-4", config);
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(0); // maxRequests(1) - 1
  });
});

describe("checkRateLimitAsync", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("uses the shared Supabase backend without storing the raw identifier", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.stubEnv("IP_HASH_SALT", "a-production-length-rate-limit-salt");
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void input;
        void init;
        return {
          ok: true,
          json: async () => [
            { allowed: true, remaining: 4, reset_in_ms: 59_000 },
          ],
        };
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.resetModules();

    const { checkRateLimitAsync } = await import("@/lib/security/rate-limit");
    const result = await checkRateLimitAsync("search:203.0.113.50", {
      maxRequests: 5,
      windowMs: 60_000,
      failClosed: true,
    });

    expect(result).toEqual({
      allowed: true,
      remaining: 4,
      resetIn: 59_000,
    });
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      "https://example.supabase.co/rest/v1/rpc/consume_rate_limit",
    );
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.p_key).toMatch(/^[a-f0-9]{64}$/);
    expect(body.p_key).not.toContain("203.0.113.50");
    expect(body.p_max_requests).toBe(5);
    expect(body.p_window_ms).toBe(60_000);
  });

  it("fails closed when the distributed backend is unavailable", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    vi.stubEnv("IP_HASH_SALT", "a-production-length-rate-limit-salt");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503 })),
    );
    vi.resetModules();

    const { checkRateLimitAsync } = await import("@/lib/security/rate-limit");
    const result = await checkRateLimitAsync("itinerary:203.0.113.50", {
      maxRequests: 5,
      windowMs: 60_000,
      failClosed: true,
    });

    expect(result).toEqual({
      allowed: false,
      remaining: 0,
      resetIn: 60_000,
    });
  });
});

// ─── getClientIp ─────────────────────────────────────────────────────────────

describe("getClientIp", () => {
  let getClientIp: typeof import("@/lib/security/rate-limit").getClientIp;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/lib/security/rate-limit");
    getClientIp = mod.getClientIp;
  });

  it("returns the single IP from x-forwarded-for", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.50" },
    });

    expect(getClientIp(request)).toBe("203.0.113.50");
  });

  it("returns the first IP when x-forwarded-for contains multiple IPs", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "203.0.113.50, 70.41.3.18, 150.172.238.178",
      },
    });

    expect(getClientIp(request)).toBe("203.0.113.50");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const request = new Request("http://localhost", {
      headers: { "x-real-ip": "198.51.100.14" },
    });

    expect(getClientIp(request)).toBe("198.51.100.14");
  });

  it('returns "unknown" when no identifying headers are present', () => {
    const request = new Request("http://localhost");

    expect(getClientIp(request)).toBe("unknown");
  });
});

// ─── Viator Helpers ──────────────────────────────────────────────────────────

describe("generateViatorAffiliateUrl", () => {
  let generateViatorAffiliateUrl: typeof import("@/lib/affiliates/viator").generateViatorAffiliateUrl;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/lib/affiliates/viator");
    generateViatorAffiliateUrl = mod.generateViatorAffiliateUrl;
  });

  it("generates a URL with the required params", () => {
    const url = generateViatorAffiliateUrl("PROD-123", "track-abc");
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe(
      "https://www.viator.com/tours/PROD-123",
    );
    expect(parsed.searchParams.get("mcid")).toBe("track-abc");
    expect(parsed.searchParams.get("medium")).toBe("api");
    // pid falls back to 'faroway' when env var is unset
    expect(parsed.searchParams.get("pid")).toBe("faroway");
  });

  it("includes optional date and travelers when provided", () => {
    const url = generateViatorAffiliateUrl("PROD-456", "track-xyz", {
      date: "2026-03-15",
      travelers: 4,
    });
    const parsed = new URL(url);

    expect(parsed.searchParams.get("date")).toBe("2026-03-15");
    expect(parsed.searchParams.get("travelers")).toBe("4");
  });

  it("omits date and travelers when options are not provided", () => {
    const url = generateViatorAffiliateUrl("PROD-789", "track-000");
    const parsed = new URL(url);

    expect(parsed.searchParams.has("date")).toBe(false);
    expect(parsed.searchParams.has("travelers")).toBe(false);
  });
});

describe("mapViatorCategoryToVibe", () => {
  let mapViatorCategoryToVibe: typeof import("@/lib/affiliates/viator").mapViatorCategoryToVibe;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/lib/affiliates/viator");
    mapViatorCategoryToVibe = mod.mapViatorCategoryToVibe;
  });

  it('maps "Food & Drink" to Foodie and Cultural', () => {
    expect(mapViatorCategoryToVibe("Food & Drink")).toEqual([
      "Foodie",
      "Cultural",
    ]);
  });

  it('maps "Outdoor Activities" to Adventure and Nature', () => {
    expect(mapViatorCategoryToVibe("Outdoor Activities")).toEqual([
      "Adventure",
      "Nature",
    ]);
  });

  it('maps "Tours & Sightseeing" to Cultural and Explorer', () => {
    expect(mapViatorCategoryToVibe("Tours & Sightseeing")).toEqual([
      "Cultural",
      "Explorer",
    ]);
  });

  it('returns ["Explorer"] for an unknown category', () => {
    expect(mapViatorCategoryToVibe("Something Completely Unknown")).toEqual([
      "Explorer",
    ]);
  });
});

// ─── calculateVibeScore ──────────────────────────────────────────────────────

describe("calculateVibeScore", () => {
  let calculateVibeScore: typeof import("@/lib/search/agents/activities").calculateVibeScore;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/lib/search/agents/activities");
    calculateVibeScore = mod.calculateVibeScore;
  });

  it("scores positively when an activity matches requested vibes", () => {
    const activity = {
      name: "Mountain Hiking Trail",
      description: "An outdoor trekking experience through extreme terrain",
      category: "Adventure",
    };

    const result = calculateVibeScore(activity, ["adventure"]);

    expect(result.score).toBeGreaterThan(0);
    expect(result.matchedVibes).toContain("adventure");
  });

  it("returns score 0 and no matched vibes when nothing matches", () => {
    const activity = {
      name: "City Bus Ride",
      description: "A regular commuter shuttle",
      category: "Transport",
    };

    const result = calculateVibeScore(activity, ["adventure", "cultural"]);

    expect(result.score).toBe(0);
    expect(result.matchedVibes).toEqual([]);
  });

  it("caps the score at 100 even with many keyword matches", () => {
    // The mock has 4 adventure keywords: hiking, trekking, outdoor, extreme
    // and 4 cultural keywords: museum, temple, history, art
    // 8 total matches * 15 = 120, which should be capped at 100
    const activity = {
      name: "Hiking trekking outdoor extreme museum temple history art",
      description: "",
      category: "",
    };

    const result = calculateVibeScore(activity, ["adventure", "cultural"]);

    expect(result.score).toBe(100);
    expect(result.matchedVibes).toContain("adventure");
    expect(result.matchedVibes).toContain("cultural");
  });
});
