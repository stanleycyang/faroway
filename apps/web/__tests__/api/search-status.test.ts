import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

let searchRecord: Record<string, unknown> | null;

const requestClient = {
  auth: {
    getUser: vi.fn(async () => ({
      data: { user: { id: "user-1" } },
      error: null,
    })),
  },
};

function createSearchChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.single = vi.fn(async () => ({
    data: searchRecord,
    error: searchRecord ? null : { message: "not found" },
  }));
  return chain;
}

const adminClient = {
  from: vi.fn(() => createSearchChain()),
};

const createClientFromRequestMock = vi.fn(async (request: unknown) => {
  void request;
  return requestClient;
});

vi.mock("@/lib/supabase/server", () => ({
  createClientFromRequest: (request: unknown) =>
    createClientFromRequestMock(request),
  getSupabase: vi.fn(() => adminClient),
}));

import { GET } from "@/app/api/search/[searchId]/route";
import { mapSearchResultsToItinerary } from "@/lib/search/bridge";

function makeReq() {
  return new NextRequest("http://localhost:3000/api/search/search-1", {
    headers: { Authorization: "Bearer mobile-token" },
  });
}

function makeParams(searchId = "search-1") {
  return { params: Promise.resolve({ searchId }) };
}

describe("GET /api/search/[searchId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchRecord = {
      id: "search-1",
      user_id: "user-1",
      status: "searching",
      progress: {},
      created_at: "2026-05-01T00:00:00.000Z",
      completed_at: null,
      error_message: null,
      json_render_spec: null,
      search_results: [],
      search_itineraries: [],
    };
  });

  it("uses request-derived auth and returns owned search status", async () => {
    const req = makeReq();
    const res = await GET(req, makeParams());
    const json = await res.json();

    expect(createClientFromRequestMock).toHaveBeenCalledWith(req);
    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      searchId: "search-1",
      status: "searching",
    });
  });

  it("hides searches owned by a different user", async () => {
    searchRecord = { ...searchRecord, user_id: "user-2" };

    const res = await GET(makeReq(), makeParams());
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Search not found");
  });

  it("keeps null day costs unavailable across the search read and bridge while preserving known zero and estimates", async () => {
    searchRecord = {
      ...searchRecord,
      status: "completed",
      search_itineraries: [null, 0, 125].map((estimated_cost, i) => ({
        day_number: i + 1,
        date: `2026-06-0${i + 1}`,
        title: "Explore Tokyo",
        summary: "A day in Tokyo",
        morning_activities: [],
        afternoon_activities: [],
        evening_activities: [],
        meals: [],
        estimated_cost,
        cost_currency: "USD",
        tips: [],
        hotel_id: null,
      })),
    };
    const res = await GET(makeReq(), makeParams());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.results.itinerary[0]).not.toHaveProperty("estimatedCost");
    expect(
      json.results.itinerary
        .slice(1)
        .map((day: { estimatedCost: number }) => day.estimatedCost),
    ).toEqual([0, 125]);
    const mapped = mapSearchResultsToItinerary(json.results, null);
    expect(mapped.days.map((day) => day.totalEstimatedCost)).toEqual([
      undefined,
      { amount: 0, currency: "USD" },
      { amount: 125, currency: "USD" },
    ]);
  });
});

it("reload resolves per-day hotels by result-row UUID, never provider ID or order", async () => {
  searchRecord = {
    id: "search-1",
    user_id: "user-1",
    status: "completed",
    search_results: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        category: "hotel",
        data: { id: "provider-b", name: "B" },
        vibe_score: 100,
      },
      {
        id: "11111111-1111-4111-8111-111111111111",
        category: "hotel",
        data: { id: "provider-a", name: "A" },
        vibe_score: 1,
      },
    ],
    search_itineraries: [
      { day_number: 1, hotel_id: "11111111-1111-4111-8111-111111111111" },
      { day_number: 2, hotel_id: "22222222-2222-4222-8222-222222222222" },
      { day_number: 3, hotel_id: null },
      { day_number: 4, hotel_id: "provider-a" },
    ],
  };
  const response = await GET(makeReq(), makeParams());
  const body = await response.json();
  expect(
    body.results.itinerary.map(
      (day: { hotel?: { id: string } }) => day.hotel?.id,
    ),
  ).toEqual(["provider-a", "provider-b", undefined, undefined]);
});

it.each([
  "missing activity",
  "wrong-category activity",
  "missing meal",
  "ambiguous meals",
])(
  "fails explicitly for %s instead of silently losing scheduled content",
  async (scenario) => {
    const id = "11111111-1111-4111-8111-111111111111";
    const id2 = "22222222-2222-4222-8222-222222222222";
    searchRecord = {
      id: "search-1",
      user_id: "user-1",
      status: "completed",
      search_results:
        scenario === "ambiguous meals"
          ? [
              {
                id,
                category: "dining",
                data: { id: "dining_1", mealTypes: ["lunch"] },
              },
              {
                id: id2,
                category: "dining",
                data: { id: "dining_2", mealTypes: ["lunch"] },
              },
            ]
          : scenario === "wrong-category activity"
            ? [{ id, category: "hotel", data: { id: "activity_1" } }]
            : [],
      search_itineraries: [
        {
          day_number: 1,
          morning_activities: scenario.includes("activity") ? [id] : [],
          meals:
            scenario === "ambiguous meals"
              ? [id, id2]
              : scenario === "missing meal"
                ? [id]
                : [],
        },
      ],
    };
    const response = await GET(makeReq(), makeParams());
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
  },
);
it("restores legacy UUID meals only when slot placement is unambiguous", async () => {
  const id = "11111111-1111-4111-8111-111111111111";
  searchRecord = {
    id: "search-1",
    user_id: "user-1",
    status: "completed",
    search_results: [
      {
        id,
        category: "dining",
        data: { id: "dining_1", name: "Lunch", mealTypes: ["lunch"] },
      },
    ],
    search_itineraries: [{ day_number: 1, meals: [id] }],
  };
  const response = await GET(makeReq(), makeParams());
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.results.itinerary[0].afternoon.meal.id).toBe("dining_1");
  expect(body.results.itinerary[0].morning.meal).toBeUndefined();
});
