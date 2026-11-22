import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  searchRow: null as unknown,
  tripRow: null as unknown,
  userId: "user-1",
  rpcCalls: [] as Array<{ fn: string; params: Record<string, unknown> }>,
  rpcResult: {
    data: {
      state: "applied",
      planRevision: "22222222-2222-4222-8222-222222222222",
      undoRevisionId: "33333333-3333-4333-8333-333333333333",
      revision: "2026-05-02T12:05:00Z",
    },
    error: null as unknown,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClientFromRequest: vi.fn(async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: mocks.userId } },
        error: null,
      }),
    },
  })),
  getSupabase: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: async () =>
              table === "searches"
                ? { data: mocks.searchRow, error: null }
                : { data: mocks.tripRow, error: null },
            maybeSingle: async () =>
              table === "searches"
                ? { data: mocks.searchRow, error: null }
                : { data: null, error: null },
          }),
        }),
      }),
    }),
    rpc: async (fn: string, params: Record<string, unknown>) => {
      mocks.rpcCalls.push({ fn, params });
      return mocks.rpcResult;
    },
  }),
}));

vi.mock("@/lib/auth/middleware", () => ({
  requireUserIdFromRequest: vi.fn(async () => ({ userId: mocks.userId })),
}));

import { GET as getSearchStatus } from "@/app/api/search/[searchId]/route";
import { POST as streamPost } from "@/app/api/trips/[id]/stream/route";
import { POST as copilotPost } from "@/app/api/trips/[id]/copilot/route";
import { loadTripForUserUncached } from "@/lib/trips/load-trip";

describe("P2-3 runtime Zod validation (zero as unknown as)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpcCalls = [];
    mocks.searchRow = null;
    mocks.tripRow = null;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("rejects malformed search row in /api/search/[searchId] with 500 instead of blind cast", async () => {
    mocks.searchRow = {
      id: "search-1",
      user_id: "user-1",
      status: "not-a-valid-status",
      progress: {},
    };

    const res = await getSearchStatus(
      new NextRequest("http://localhost:3000/api/search/search-1"),
      { params: Promise.resolve({ searchId: "search-1" }) },
    );
    expect(res.status).toBe(500);
  });

  it("rejects malformed search_results data payload in /api/search/[searchId]", async () => {
    mocks.searchRow = {
      id: "search-1",
      user_id: "user-1",
      status: "completed",
      progress: {},
      search_results: [
        {
          id: "res-1",
          category: "hotel",
          data: { id: 12345, vibeScore: "invalid-number" },
          vibe_score: 50,
        },
      ],
      search_itineraries: [],
    };

    const res = await getSearchStatus(
      new NextRequest("http://localhost:3000/api/search/search-1"),
      { params: Promise.resolve({ searchId: "search-1" }) },
    );
    expect(res.status).toBe(500);
  });

  it("allows null optional JSONB fields in /api/search/[searchId] without failing with 500", async () => {
    mocks.searchRow = {
      id: "search-1",
      user_id: "user-1",
      status: "completed",
      progress: { orchestrator: "done", hotels: null },
      search_results: [
        {
          id: "res-h1",
          category: "hotel",
          data: {
            id: "h1",
            name: "Hotel Null Fields",
            starRating: null,
            userRating: null,
            amenities: null,
            images: null,
          },
          vibe_score: 80,
        },
      ],
      search_itineraries: [],
    };

    const res = await getSearchStatus(
      new NextRequest("http://localhost:3000/api/search/search-1"),
      { params: Promise.resolve({ searchId: "search-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.progress.hotels).toBe("pending");
    expect(body.results.hotels).toHaveLength(1);
    expect(body.results.hotels[0].name).toBe("Hotel Null Fields");
  });

  it("rejects malformed trip rows in loadTripForUserUncached cleanly", async () => {
    mocks.tripRow = {
      id: 999,
      user_id: "user-1",
    };

    await expect(loadTripForUserUncached("trip-1", "user-1")).rejects.toThrow(
      "Your trip could not be loaded",
    );
  });

  it.each([
    "draft",
    "planning",
    "planned",
    "generating",
    "generated",
    "failed",
    "active",
    "in_progress",
    "booked",
    "paid",
    "completed",
    "canceled",
  ])(
    "accepts valid DB lifecycle status %s in loadTripForUserUncached",
    async (status) => {
      mocks.tripRow = {
        id: "trip-1",
        user_id: "user-1",
        destination: "Tokyo",
        start_date: "2026-07-01",
        end_date: "2026-07-05",
        travelers: 2,
        status,
        budget_tier: "comfort",
        itineraries: { days: [{ hotel: { id: "h1", name: "Hotel A" } }] },
      };

      const loaded = await loadTripForUserUncached("trip-1", "user-1");
      expect(loaded?.trip.status).toBe(status);
      expect(loaded?.trip.budget_tier).toBe("moderate");
      expect(loaded?.itinerary?.days).toHaveLength(1);
    },
  );

  it("rejects non-array itinerary.days in loadTripForUserUncached instead of returning {}", async () => {
    mocks.tripRow = {
      id: "trip-1",
      user_id: "user-1",
      status: "planned",
      itineraries: { days: "not-an-array" },
    };

    await expect(loadTripForUserUncached("trip-1", "user-1")).rejects.toThrow(
      "Your trip could not be loaded",
    );
  });

  it("preserves hotels with null optional fields and null progress stages in /api/trips/[id]/stream", async () => {
    const tripId = "11111111-1111-4111-8111-111111111111";
    mocks.tripRow = {
      id: tripId,
      status: "generating",
      search_id: "search-1",
      destination: "Tokyo",
      start_date: "2026-07-01",
      end_date: "2026-07-03",
      travelers: 2,
      budget_tier: "moderate",
      vibes: [],
      preferences: {},
    };
    mocks.searchRow = {
      id: "search-1",
      status: "completed",
      progress: { orchestrator: "done", hotels: null },
      intermediate_results: {
        topHotel: {
          id: "h1",
          name: "Grand Hotel",
          rating: null,
          amenities: null,
          images: null,
        },
        hotels: [
          {
            id: "h1",
            name: "Grand Hotel",
            rating: null,
            amenities: null,
            images: null,
          },
        ],
        days: [
          {
            dayNumber: 1,
            date: "2026-07-01",
            title: "Arrival",
            summary: "Explore",
            morning: { activities: [], meals: [] },
            afternoon: { activities: [], meals: [] },
            evening: { activities: [], meals: [] },
          },
        ],
      },
    };

    const res = await streamPost(
      new NextRequest(`http://localhost:3000/api/trips/${tripId}/stream`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: tripId }) },
    );
    expect(res.status).toBe(200);
    const sseText = await res.text();
    expect(sseText).toContain("event: hotels");
    expect(sseText).toContain('"count":1');
    expect(sseText).toContain("event: itinerary");
    expect(sseText).not.toContain("event: error");
  });

  it("rejects malformed ir.days in /api/trips/[id]/stream BEFORE emitting event: itinerary", async () => {
    const tripId = "11111111-1111-4111-8111-111111111111";
    mocks.tripRow = {
      id: tripId,
      status: "generating",
      search_id: "search-1",
      destination: "Tokyo",
      start_date: "2026-07-01",
      end_date: "2026-07-03",
      travelers: 2,
      budget_tier: "moderate",
      vibes: [],
      preferences: {},
    };
    mocks.searchRow = {
      id: "search-1",
      status: "completed",
      progress: { orchestrator: "done" },
      intermediate_results: {
        days: [{ dayNumber: 1 }],
      },
    };

    const res = await streamPost(
      new NextRequest(`http://localhost:3000/api/trips/${tripId}/stream`, {
        method: "POST",
      }),
      { params: Promise.resolve({ id: tripId }) },
    );
    const sseText = await res.text();
    expect(sseText).not.toContain("event: itinerary");
    expect(sseText).toContain("event: error");
    expect(sseText).toContain("Malformed itinerary partial output");
  });

  it("accepts older valid saved itineraries in /api/trips/[id]/copilot (omitted summary/date/meals, tips: null) without post-RPC 503", async () => {
    const tripId = "11111111-1111-4111-8111-111111111111";
    mocks.tripRow = {
      id: tripId,
      user_id: "user-1",
      destination: "Paris",
      start_date: "2026-06-10",
      end_date: "2026-06-12",
      status: "planned",
      updated_at: "2026-05-02T12:00:00Z",
      preferences: {},
      plan_revision_id: null,
      search_id: "search-1",
      itineraries: [
        {
          id: "itin-1",
          days: [
            {
              dayNumber: 1,
              morning: {
                activities: [
                  {
                    id: "act-walk",
                    name: "Seine Walk",
                    category: "relaxation",
                    bookingInfo: { requiresReservation: false },
                  },
                  {
                    id: "act-louvre",
                    name: "Louvre Museum",
                    category: "cultural",
                    bookingInfo: { requiresReservation: true },
                  },
                ],
              },
              tips: null,
            },
          ],
          overview: null,
          total_cost: null,
          packing_list: null,
          general_tips: null,
          generated_at: null,
        },
      ],
    };
    mocks.searchRow = {
      id: "search-1",
      user_id: "user-1",
      intermediate_results: {
        topHotel: ["not-an-object-hotel"],
      },
      search_results: [],
    };

    const res = await copilotPost(
      new NextRequest(`http://localhost/api/trips/${tripId}/copilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "relax_day", dayNumber: 1 }),
      }),
      { params: Promise.resolve({ id: tripId }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applied).toBe(true);
    expect(body.updatedItinerary.days[0].tips).toEqual([]);
    expect(mocks.rpcCalls).toHaveLength(1);
  });

  it("rejects invalid nextStampedDays in /api/trips/[id]/copilot BEFORE invoking db.rpc", async () => {
    const tripId = "11111111-1111-4111-8111-111111111111";
    mocks.tripRow = {
      id: tripId,
      user_id: "user-1",
      destination: "Paris",
      start_date: "2026-06-10",
      end_date: "2026-06-12",
      status: "planned",
      updated_at: "2026-05-02T12:00:00Z",
      preferences: {},
      plan_revision_id: null,
      search_id: null,
      itineraries: [
        {
          id: "itin-1",
          days: [
            {
              dayNumber: 1,
              morning: {
                activities: [
                  {
                    id: "act-walk",
                    name: "Seine Walk",
                    category: "relaxation",
                    bookingInfo: { requiresReservation: false },
                  },
                  {
                    id: "act-louvre",
                    name: "Louvre Museum",
                    category: "cultural",
                    bookingInfo: { requiresReservation: true },
                  },
                ],
              },
              afternoon: {
                activities: "not-an-array",
              },
              tips: [],
            },
          ],
          overview: "",
          total_cost: null,
          packing_list: null,
          general_tips: null,
          generated_at: null,
        },
      ],
    };

    const res = await copilotPost(
      new NextRequest(`http://localhost/api/trips/${tripId}/copilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "relax_day", dayNumber: 1 }),
      }),
      { params: Promise.resolve({ id: tripId }) },
    );
    expect(res.status).toBe(409);
    expect(mocks.rpcCalls).toHaveLength(0);
  });
});
