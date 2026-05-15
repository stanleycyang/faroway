import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import crypto from "crypto";

// Set env vars before module load so WEBHOOK_SECRETS captures them
const WEBHOOK_SECRET = "test-webhook-secret-123";
vi.hoisted(() => {
  process.env.VIATOR_WEBHOOK_SECRET = "test-webhook-secret-123";
});

// ── Mock Supabase (Share route) ─────────────────────────────────────────────

const mockUser = { id: "user-123", email: "test@example.com" };

interface QueryResult {
  data: unknown;
  error: unknown;
  count?: unknown;
}

interface QueryChain {
  [key: string]: ReturnType<typeof vi.fn>;
}

let mockAuthReturn: { data: { user: unknown }; error: unknown };
let mockTripReturn: QueryResult;
let mockUpdateReturn: QueryResult;

// Universal query chain: every method returns the chain itself.
// The chain has data/error/count getters so `await chain` + destructuring works.
function createQueryChain(getResult: () => QueryResult | undefined) {
  const chain: QueryChain = {} as QueryChain;
  const methods = [
    "select",
    "eq",
    "or",
    "is",
    "insert",
    "update",
    "delete",
    "upsert",
    "match",
    "limit",
    "order",
    "single",
  ];
  methods.forEach((m) => {
    chain[m] = vi.fn(() => chain);
  });
  Object.defineProperty(chain, "data", {
    get: () => getResult()?.data,
    configurable: true,
    enumerable: true,
  });
  Object.defineProperty(chain, "error", {
    get: () => getResult()?.error,
    configurable: true,
    enumerable: true,
  });
  Object.defineProperty(chain, "count", {
    get: () => getResult()?.count,
    configurable: true,
    enumerable: true,
  });
  return chain;
}

// ── Share route mocks ───────────────────────────────────────────────────────

const tripsChain = createQueryChain(() => mockTripReturn);

const mockSupabase = {
  auth: {
    getUser: vi.fn(() => mockAuthReturn),
  },
  from: vi.fn(() => {
    // The share route calls .from('trips').select() for fetch, and .from('trips').update() for update.
    // We use a single chain but swap the result based on which operation is being called.
    // The chain's .single() call indicates a select (fetch), while .update() indicates an update.
    return tripsChain;
  }),
};

const createClientFromRequestMock = vi.fn(async (request: unknown) => {
  void request;
  return mockSupabase;
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabase),
  createClientFromRequest: (request: unknown) =>
    createClientFromRequestMock(request),
  getSupabase: vi.fn(() => mockConversionSupabase),
}));

vi.mock("nanoid", () => ({
  nanoid: vi.fn(() => "test-token-12"),
}));

// ── Conversion route mocks ──────────────────────────────────────────────────

let mockClickReturn: QueryResult;
let mockInsertReturn: QueryResult;
let mockClickUpdateReturn: QueryResult;

const clicksChain = createQueryChain(() => mockClickReturn);
const conversionsChain = createQueryChain(() => mockInsertReturn);

const mockConversionSupabase = {
  from: vi.fn((table: string) => {
    if (table === "affiliate_clicks") {
      // Differentiate between select (find click) and update (mark converted)
      // The chain handles both via the same object; the result is driven by mockClickReturn
      return clicksChain;
    }
    if (table === "affiliate_conversions") return conversionsChain;
    return createQueryChain(() => ({ data: null, error: null }));
  }),
};

// ── Import route handlers after mocking ─────────────────────────────────────

import {
  POST as sharePost,
  DELETE as shareDelete,
} from "@/app/api/trips/[id]/share/route";
import { POST as conversionPost } from "@/app/api/track/conversion/route";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(
  method: string,
  url: string,
  body?: string | object,
  headers?: Record<string, string>,
): NextRequest {
  const init: RequestInit = { method };
  if (body) {
    init.body = typeof body === "string" ? body : JSON.stringify(body);
    init.headers = { "Content-Type": "application/json", ...headers };
  } else if (headers) {
    init.headers = headers;
  }
  return new NextRequest(
    new URL(url, "http://localhost:3000"),
    init as Record<string, unknown>,
  );
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ── Share Route Tests ───────────────────────────────────────────────────────

describe("POST /api/trips/[id]/share", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthReturn = { data: { user: mockUser }, error: null };
    mockTripReturn = {
      data: {
        id: "trip-1",
        share_token: null,
        is_shared: false,
        user_id: "user-123",
      },
      error: null,
    };
    mockUpdateReturn = { data: null, error: null };
    // After the select().eq().eq().single() the chain resolves to mockTripReturn.
    // After the update().eq().eq() the chain resolves too, but the route only checks error.
    // Since both use the same tripsChain, we make the chain result dynamic:
    // The first access (select path ending in .single()) uses mockTripReturn,
    // the second access (update path) uses mockUpdateReturn.
    // We handle this by having mockTripReturn serve the full flow since the chain
    // always returns the same result. The route checks .data and .error on the
    // select result, and only .error on the update result.
    // Since both go through the same chain, we need to make the chain switch results.
    let callCount = 0;
    mockSupabase.from = vi.fn(() => {
      callCount++;
      if (callCount === 1) {
        // First call: select (fetch trip)
        return createQueryChain(() => mockTripReturn);
      }
      // Second call: update
      return createQueryChain(() => mockUpdateReturn);
    });
  });

  it("successfully enables sharing and returns shareUrl and token", async () => {
    const req = makeRequest("POST", "/api/trips/trip-1/share");
    const res = await sharePost(req, makeParams("trip-1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.shareToken).toBe("test-token-12");
    expect(json.shareUrl).toContain("/s/test-token-12");
  });

  it("uses request-derived auth so bearer-token mobile clients are accepted", async () => {
    // Regression: share/route.ts used to call createClient() with no args,
    // which only checks cookies. Mobile sends Authorization: Bearer ... so we
    // must route through createClientFromRequest(request) instead.
    const req = makeRequest("POST", "/api/trips/trip-1/share", undefined, {
      Authorization: "Bearer mobile-token",
    });
    const res = await sharePost(req, makeParams("trip-1"));

    expect(createClientFromRequestMock).toHaveBeenCalledWith(req);
    expect(res.status).toBe(200);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuthReturn = { data: { user: null }, error: { message: "No session" } };

    const req = makeRequest("POST", "/api/trips/trip-1/share");
    const res = await sharePost(req, makeParams("trip-1"));

    expect(res.status).toBe(401);
  });

  it("returns 404 when trip not found", async () => {
    mockTripReturn = {
      data: null,
      error: { code: "PGRST116", message: "Not found" },
    };

    const req = makeRequest("POST", "/api/trips/trip-1/share");
    const res = await sharePost(req, makeParams("trip-1"));

    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid trip ID format", async () => {
    const req = makeRequest("POST", "/api/trips/invalid%20id!/share");
    const res = await sharePost(req, makeParams("invalid id!"));

    expect(res.status).toBe(400);
  });

  it("reuses existing share_token if already present", async () => {
    mockTripReturn = {
      data: {
        id: "trip-1",
        share_token: "existing-tok",
        is_shared: true,
        user_id: "user-123",
      },
      error: null,
    };

    const req = makeRequest("POST", "/api/trips/trip-1/share");
    const res = await sharePost(req, makeParams("trip-1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.shareToken).toBe("existing-tok");
    expect(json.shareUrl).toContain("/s/existing-tok");
  });
});

describe("DELETE /api/trips/[id]/share", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthReturn = { data: { user: mockUser }, error: null };
    mockUpdateReturn = { data: null, error: null };
    mockSupabase.from = vi.fn(() => createQueryChain(() => mockUpdateReturn));
  });

  it("successfully disables sharing", async () => {
    const req = makeRequest("DELETE", "/api/trips/trip-1/share");
    const res = await shareDelete(req, makeParams("trip-1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
  });

  it("returns 401 when not authenticated", async () => {
    mockAuthReturn = { data: { user: null }, error: { message: "No session" } };

    const req = makeRequest("DELETE", "/api/trips/trip-1/share");
    const res = await shareDelete(req, makeParams("trip-1"));

    expect(res.status).toBe(401);
  });
});

// ── Conversion Webhook Tests ────────────────────────────────────────────────

describe("POST /api/track/conversion", () => {
  function signPayload(payload: string, secret: string): string {
    return crypto.createHmac("sha256", secret).update(payload).digest("hex");
  }

  const validConversion = {
    click_id: "click-abc",
    partner: "viator",
    booking_value: 150.0,
    commission_value: 12.5,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockClickReturn = {
      data: {
        id: "click-abc",
        user_id: "user-456",
        partner: "viator",
        converted: false,
      },
      error: null,
    };
    mockInsertReturn = { data: null, error: null };
    mockClickUpdateReturn = { data: null, error: null };

    // Reset the conversion supabase mock for each test
    // The conversion route calls getSupabase() multiple times:
    // 1. getSupabase().from('affiliate_clicks').select().eq().single() - find click
    // 2. getSupabase().from('affiliate_conversions').insert() - record conversion
    // 3. getSupabase().from('affiliate_clicks').update().eq() - mark converted
    let clickCallCount = 0;
    mockConversionSupabase.from = vi.fn((table: string) => {
      if (table === "affiliate_conversions") {
        return createQueryChain(() => mockInsertReturn);
      }
      if (table === "affiliate_clicks") {
        clickCallCount++;
        if (clickCallCount === 1) {
          // First call: find original click (select)
          return createQueryChain(() => mockClickReturn);
        }
        // Second call: update click as converted
        return createQueryChain(() => mockClickUpdateReturn);
      }
      return createQueryChain(() => ({ data: null, error: null }));
    });
  });

  it("records a valid conversion with correct signature", async () => {
    const payload = JSON.stringify(validConversion);
    const signature = signPayload(payload, WEBHOOK_SECRET);

    const req = makeRequest("POST", "/api/track/conversion", payload, {
      "x-webhook-signature": signature,
    });
    const res = await conversionPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.clickId).toBe("click-abc");

    // Verify that all three Supabase calls were made
    expect(mockConversionSupabase.from).toHaveBeenCalledWith(
      "affiliate_clicks",
    );
    expect(mockConversionSupabase.from).toHaveBeenCalledWith(
      "affiliate_conversions",
    );
  });

  it("returns 400 for invalid/missing fields", async () => {
    const invalidPayload = JSON.stringify({ click_id: "click-abc" }); // missing required fields
    const signature = signPayload(invalidPayload, WEBHOOK_SECRET);

    const req = makeRequest("POST", "/api/track/conversion", invalidPayload, {
      "x-webhook-signature": signature,
    });
    const res = await conversionPost(req);

    expect(res.status).toBe(400);
  });

  it("returns 401 for invalid signature", async () => {
    const payload = JSON.stringify(validConversion);
    // Use a valid-length hex string (64 chars for SHA-256) but with wrong content
    const wrongSignature = "a".repeat(64);

    const req = makeRequest("POST", "/api/track/conversion", payload, {
      "x-webhook-signature": wrongSignature,
    });
    const res = await conversionPost(req);

    expect(res.status).toBe(401);
  });

  it("returns 401 for missing signature header", async () => {
    const payload = JSON.stringify(validConversion);

    const req = makeRequest("POST", "/api/track/conversion", payload);
    const res = await conversionPost(req);

    expect(res.status).toBe(401);
  });

  it("handles missing click gracefully and still records conversion", async () => {
    mockClickReturn = {
      data: null,
      error: { code: "PGRST116", message: "Not found" },
    };

    const payload = JSON.stringify(validConversion);
    const signature = signPayload(payload, WEBHOOK_SECRET);

    const req = makeRequest("POST", "/api/track/conversion", payload, {
      "x-webhook-signature": signature,
    });
    const res = await conversionPost(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.clickId).toBe("click-abc");

    // Should still insert the conversion
    expect(mockConversionSupabase.from).toHaveBeenCalledWith(
      "affiliate_conversions",
    );
  });
});
