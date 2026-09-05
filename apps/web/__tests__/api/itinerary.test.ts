import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const executeTravelSearchMock = vi.fn();

vi.mock("@/lib/search/workflow", () => ({
  executeTravelSearch: (...args: unknown[]) => executeTravelSearchMock(...args),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  checkRateLimitAsync: vi.fn(async () => ({
    allowed: true,
    remaining: 9,
    resetIn: 60_000,
  })),
}));

const tableInserts: Record<string, unknown[]> = {};
let tripInsertResult: {
  data: { id: string } | null;
  error: { message: string } | null;
};

function createTableChain(table: string) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.insert = vi.fn((payload: unknown) => {
    tableInserts[table] ||= [];
    tableInserts[table].push(payload);
    return chain;
  });
  chain.select = vi.fn(() => chain);
  chain.single = vi.fn(async () =>
    table === "trips"
      ? tripInsertResult
      : { data: { id: "itinerary-1" }, error: null },
  );
  chain.update = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  return chain;
}

const supabaseMock = {
  auth: {
    getUser: vi.fn(async () => ({
      data: { user: null as { id: string } | null },
      error: null,
    })),
  },
  from: vi.fn((table: string) => createTableChain(table)),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => supabaseMock),
}));

import { POST } from "@/app/api/itinerary/route";

function makeReq(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/itinerary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeRawReq(body: string) {
  return new NextRequest("http://localhost:3000/api/itinerary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("POST /api/itinerary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const table of Object.keys(tableInserts)) delete tableInserts[table];
    tripInsertResult = { data: { id: "saved-trip-1" }, error: null };
    supabaseMock.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    executeTravelSearchMock.mockResolvedValue({
      searchId: "itinerary-1",
      status: "completed",
      results: {
        searchId: "itinerary-1",
        hotels: [],
        activities: [],
        dining: [],
        transport: [],
        itinerary: [
          {
            dayNumber: 1,
            date: "2026-06-01",
            title: "Tokyo arrival",
            summary: "A relaxed first day in Tokyo.",
            morning: { activities: [] },
            afternoon: { activities: [] },
            evening: { activities: [] },
            estimatedCost: 0,
            currency: "USD",
            tips: [],
          },
        ],
      },
    });
  });

  it("uses the parallel search workflow for non-streaming generation", async () => {
    const res = await POST(
      makeReq({
        destination: "Tokyo",
        startDate: "2026-06-01",
        endDate: "2026-06-05",
        travelers: { adults: 2, children: 1 },
        travelerType: "family",
        originCity: "San Francisco",
        originAirport: "SFO",
        vibes: ["foodie"],
        budget: "moderate",
        save: false,
      }),
    );

    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.destination).toBe("Tokyo");
    expect(json.days).toHaveLength(1);
    expect(executeTravelSearchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^itinerary_/),
      expect.objectContaining({
        destination: "Tokyo",
        startDate: "2026-06-01",
        endDate: "2026-06-05",
        travelers: 3,
        travelerType: "family",
        originCity: "San Francisco",
        originAirport: "SFO",
        vibes: ["foodie"],
        budget: "moderate",
      }),
    );
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await POST(makeRawReq("{"));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid request body");
    expect(executeTravelSearchMock).not.toHaveBeenCalled();
  });

  it("returns 400 when endDate is before startDate", async () => {
    const res = await POST(
      makeReq({
        destination: "Tokyo",
        startDate: "2026-06-05",
        endDate: "2026-06-01",
        travelers: 2,
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid request body");
    expect(executeTravelSearchMock).not.toHaveBeenCalled();
  });

  it("returns 400 when a traveler group exceeds the total limit", async () => {
    const res = await POST(
      makeReq({
        destination: "Tokyo",
        startDate: "2026-06-01",
        endDate: "2026-06-05",
        travelers: { adults: 50, children: 49 },
      }),
    );

    expect(res.status).toBe(400);
    expect(executeTravelSearchMock).not.toHaveBeenCalled();
  });

  it("does not expose generation provider errors", async () => {
    executeTravelSearchMock.mockRejectedValueOnce(
      new Error("secret vendor response"),
    );

    const res = await POST(
      makeReq({
        destination: "Tokyo",
        startDate: "2026-06-01",
        endDate: "2026-06-05",
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Generation failed");
  });

  it("persists authenticated results in normalized trip tables", async () => {
    supabaseMock.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "user-1" } },
      error: null,
    });

    const res = await POST(
      makeReq({
        destination: "Tokyo",
        startDate: "2026-06-01",
        endDate: "2026-06-05",
        travelers: 2,
        vibes: ["foodie"],
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.tripId).toBe("saved-trip-1");
    expect(tableInserts.trips).toEqual([
      expect.objectContaining({
        user_id: "user-1",
        destination: "Tokyo",
        budget_tier: "moderate",
      }),
    ]);
    expect(tableInserts.itineraries).toEqual([
      expect.objectContaining({
        trip_id: "saved-trip-1",
        user_id: "user-1",
        days: expect.any(Array),
      }),
    ]);
  });
});
