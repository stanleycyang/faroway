import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock Supabase ──────────────────────────────────────────────────────────────

const mockUser = { id: "user-123", email: "test@example.com" };

const mockTrip = {
  id: "trip-1",
  user_id: "user-123",
  destination: "Tokyo",
  start_date: "2026-04-01",
  end_date: "2026-04-07",
  travelers: 2,
  status: "draft",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const mockItinerary = {
  days: [{ dayNumber: 1, date: "2026-04-01", title: "Day 1" }],
  overview: "A week in Tokyo",
  total_cost: 3000,
  packing_list: ["Passport"],
  general_tips: ["Learn basic Japanese phrases"],
  generated_at: "2026-01-02T00:00:00Z",
};

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
const mockItineraryReturn: QueryResult = { data: null, error: null };

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
    "maybeSingle",
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

const tripsChain = createQueryChain(() => mockTripReturn);
const itinerariesChain = createQueryChain(() => mockItineraryReturn);

let mockRpcResult: QueryResult | null = null;
const mockRpc = vi.fn(() =>
  createQueryChain(() => mockRpcResult ?? mockTripReturn),
);
const mockSupabase = {
  rpc: mockRpc,
  auth: {
    getUser: vi.fn(() => mockAuthReturn),
  },
  from: vi.fn((table: string) => {
    if (table === "itineraries") return itinerariesChain;
    return tripsChain;
  }),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => mockSupabase),
  createClientFromRequest: vi.fn(async () => mockSupabase),
  getSupabase: vi.fn(() => mockSupabase),
}));

// ── Import route handlers after mocking ────────────────────────────────────────

import { GET as getTrips, POST } from "@/app/api/trips/route";
import { GET as getTrip, PATCH, DELETE } from "@/app/api/trips/[id]/route";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRequest(method: string, url: string, body?: object): NextRequest {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(
    new URL(url, "http://localhost:3000"),
    init as Record<string, unknown>,
  );
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("GET /api/trips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthReturn = { data: { user: mockUser }, error: null };
  });

  it("returns user trips array", async () => {
    mockTripReturn = { data: [mockTrip], error: null };
    const req = makeRequest("GET", "/api/trips");
    const res = await getTrips(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.trips).toHaveLength(1);
    expect(json.trips[0].destination).toBe("Tokyo");
  });

  it("returns 401 when not authenticated", async () => {
    mockAuthReturn = { data: { user: null }, error: { message: "No session" } };
    const req = makeRequest("GET", "/api/trips");
    const res = await getTrips(req);

    expect(res.status).toBe(401);
  });
});

describe("POST /api/trips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthReturn = { data: { user: mockUser }, error: null };
  });

  it("creates a trip and returns 201", async () => {
    mockTripReturn = { data: mockTrip, error: null };
    const req = makeRequest("POST", "/api/trips", {
      destination: "Tokyo",
      start_date: "2026-04-01",
      end_date: "2026-04-07",
      travelers: 2,
      preferences: {
        travelerType: "family",
        originCity: "San Francisco",
        originAirport: "SFO",
      },
    });
    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.trip.destination).toBe("Tokyo");
    expect(tripsChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: {
          travelerType: "family",
          originCity: "San Francisco",
          originAirport: "SFO",
        },
      }),
    );
  });

  it("returns 400 for invalid input", async () => {
    const req = makeRequest("POST", "/api/trips", {
      destination: "",
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when end date is before start date", async () => {
    const req = makeRequest("POST", "/api/trips", {
      destination: "Tokyo",
      start_date: "2026-04-07",
      end_date: "2026-04-01",
      travelers: 2,
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 for malformed calendar dates", async () => {
    const req = makeRequest("POST", "/api/trips", {
      destination: "Tokyo",
      start_date: "2026-02-31",
      end_date: "2026-03-02",
      travelers: 2,
    });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });
});

describe("GET /api/trips/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthReturn = { data: { user: mockUser }, error: null };
  });

  it("returns trip with itinerary data", async () => {
    // Route uses a joined query: trips with itineraries(...)
    mockTripReturn = {
      data: { ...mockTrip, itineraries: [mockItinerary] },
      error: null,
    };

    const req = makeRequest("GET", "/api/trips/trip-1");
    const res = await getTrip(req, makeParams("trip-1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.trip.id).toBe("trip-1");
    expect(json.itinerary).toBeDefined();
    expect(json.itinerary.overview).toBe("A week in Tokyo");
  });

  it("returns 404 for nonexistent trip", async () => {
    mockTripReturn = {
      data: null,
      error: { code: "PGRST116", message: "Not found" },
    };

    const req = makeRequest("GET", "/api/trips/nonexistent");
    const res = await getTrip(req, makeParams("nonexistent"));

    expect(res.status).toBe(404);
  });

  it("returns 400 for invalid trip ID", async () => {
    const req = makeRequest("GET", "/api/trips/invalid%20id!");
    const res = await getTrip(req, makeParams("invalid id!"));

    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/trips/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpcResult = null;
    mockTripReturn = { data: mockTrip, error: null };
    mockAuthReturn = { data: { user: mockUser }, error: null };
  });

  it("requires a loaded revision instead of silently overwriting a newer brief", async () => {
    expect(
      (
        await PATCH(
          makeRequest("PATCH", "/api/trips/trip-1", { destination: "Osaka" }),
          makeParams("trip-1"),
        )
      ).status,
    ).toBe(428);
    expect(mockRpc).not.toHaveBeenCalled();
  });
  it.each(["generating", "stale", "lost-race"])(
    "rejects %s saves without overwriting the active brief",
    async (state) => {
      mockTripReturn = {
        data: {
          ...mockTrip,
          status: state === "generating" ? "generating" : "draft",
        },
        error: null,
      };
      if (state === "lost-race") mockRpcResult = { data: null, error: null };
      const response = await PATCH(
        makeRequest("PATCH", "/api/trips/trip-1", {
          destination: "Osaka",
          expectedUpdatedAt:
            state === "stale" ? "2025-01-01T00:00:00Z" : mockTrip.updated_at,
        }),
        makeParams("trip-1"),
      );
      expect(response.status).toBe(409);
      if (state !== "lost-race") expect(mockRpc).not.toHaveBeenCalled();
    },
  );
  it("keeps the creation request hash and unrelated preferences while saving validated fields", async () => {
    mockTripReturn = {
      data: {
        ...mockTrip,
        preferences: { creationRequestHash: "original", originCity: "London" },
      },
      error: null,
    };
    const response = await PATCH(
      makeRequest("PATCH", "/api/trips/trip-1", {
        expectedUpdatedAt: mockTrip.updated_at,
        preferences: { interests: ["art"] },
      }),
      makeParams("trip-1"),
    );
    expect(response.status).toBe(200);
    expect(mockRpc).toHaveBeenCalledWith(
      "update_trip_brief",
      expect.objectContaining({
        p_changes: expect.objectContaining({
          preferences: {
            creationRequestHash: "original",
            originCity: "London",
            interests: ["art"],
          },
        }),
      }),
    );
  });
  it("rejects traveler composition that does not match the party size", async () => {
    expect(
      (
        await PATCH(
          makeRequest("PATCH", "/api/trips/trip-1", {
            expectedUpdatedAt: mockTrip.updated_at,
            travelers: 2,
            preferences: { adults: 2, children: 1 },
          }),
          makeParams("trip-1"),
        )
      ).status,
    ).toBe(400);
    expect(mockRpc).not.toHaveBeenCalled();
  });
  it("updates trip fields", async () => {
    const updatedTrip = { ...mockTrip, destination: "Osaka" };
    mockRpcResult = { data: updatedTrip, error: null };

    const req = makeRequest("PATCH", "/api/trips/trip-1", {
      expectedUpdatedAt: mockTrip.updated_at,
      destination: "Osaka",
    });
    const res = await PATCH(req, makeParams("trip-1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.trip.destination).toBe("Osaka");
  });

  it("returns 400 for invalid input", async () => {
    const req = makeRequest("PATCH", "/api/trips/trip-1", {
      expectedUpdatedAt: mockTrip.updated_at,
      unknown_field: "bad",
    });
    const res = await PATCH(req, makeParams("trip-1"));

    expect(res.status).toBe(400);
  });

  it("rejects client-controlled generation state transitions", async () => {
    const req = makeRequest("PATCH", "/api/trips/trip-1", {
      expectedUpdatedAt: mockTrip.updated_at,
      status: "planned",
    });
    const res = await PATCH(req, makeParams("trip-1"));

    expect(res.status).toBe(400);
  });

  it("validates an end-only update against the stored start date", async () => {
    mockTripReturn = { data: mockTrip, error: null };
    const req = makeRequest("PATCH", "/api/trips/trip-1", {
      expectedUpdatedAt: mockTrip.updated_at,
      end_date: "2026-03-31",
    });
    const res = await PATCH(req, makeParams("trip-1"));

    expect(res.status).toBe(400);
  });

  it("returns 404 when trip not found", async () => {
    mockTripReturn = {
      data: null,
      error: { code: "PGRST116", message: "Not found" },
    };

    const req = makeRequest("PATCH", "/api/trips/trip-1", {
      expectedUpdatedAt: mockTrip.updated_at,
      destination: "Osaka",
    });
    const res = await PATCH(req, makeParams("trip-1"));

    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/trips/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthReturn = { data: { user: mockUser }, error: null };
  });

  it("deletes trip and returns success", async () => {
    mockTripReturn = { data: null, error: null, count: 1 };

    const req = makeRequest("DELETE", "/api/trips/trip-1");
    const res = await DELETE(req, makeParams("trip-1"));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deleted).toBe(true);
  });

  it("returns 404 for nonexistent trip", async () => {
    mockTripReturn = { data: null, error: null, count: 0 };

    const req = makeRequest("DELETE", "/api/trips/nonexistent");
    const res = await DELETE(req, makeParams("nonexistent"));

    expect(res.status).toBe(404);
  });
});
