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

const selectedTransport = {
  id: "selected-outbound",
  type: "flight" as const,
  provider: "Fixture Air",
  departure: {
    airport: "SFO",
    city: "San Francisco",
    dateTime: "2026-06-01T10:00:00Z",
  },
  arrival: { airport: "NRT", city: "Tokyo", dateTime: "2026-06-02T14:00:00Z" },
  duration: 660,
  stops: 0,
  price: 900,
  currency: "USD",
  affiliateUrl: "https://example.com/selected",
  affiliatePartner: "duffel",
  airlines: ["Fixture Air"],
  segments: [],
  source: "duffel" as const,
  vibeScore: 1,
  vibeMatch: [],
};

function transportReloadFixture() {
  const alternative = {
    ...selectedTransport,
    id: "alternative",
    price: 1200,
    vibeScore: 100,
  };
  const slot = { activities: [] };
  const itinerary = [1, 2].map((dayNumber) => ({
    dayNumber,
    date: `2026-06-0${dayNumber}`,
    title: "Travel",
    summary: "Fixture",
    morning: slot,
    afternoon: slot,
    evening: slot,
    transport: dayNumber === 1 ? selectedTransport : undefined,
    currency: "USD",
    tips: [],
  }));
  const mapped = mapSearchResultsToItinerary(
    {
      searchId: "search-1",
      hotels: [],
      activities: [],
      dining: [],
      transport: [alternative, selectedTransport],
      itinerary,
    },
    null,
  );
  // Actual persisted projection has no provider ID, and JSONB key order is not stable.
  const savedDays = JSON.parse(JSON.stringify(mapped.days));
  savedDays[0].transport = Object.fromEntries(
    Object.entries(savedDays[0].transport).reverse(),
  );
  searchRecord = {
    id: "search-1",
    user_id: "user-1",
    status: "completed",
    search_results: [alternative, selectedTransport].map((data, i) => ({
      id: `result-${i}`,
      category: "transport",
      data,
      vibe_score: data.vibeScore,
    })),
    search_itineraries: itinerary.map((day) => ({
      day_number: day.dayNumber,
      date: day.date,
      title: day.title,
      summary: day.summary,
      morning_activities: [],
      afternoon_activities: [],
      evening_activities: [],
      meals: [],
      estimated_cost: null,
      cost_currency: "USD",
      tips: [],
      hotel_id: null,
    })),
    intermediate_results: { days: savedDays.reverse() },
  };
  return savedDays;
}

it("restores selected per-day transport through search-only reload and bridge, not the top candidate", async () => {
  transportReloadFixture();
  const response = await GET(makeReq(), makeParams());
  expect(response.status).toBe(200);
  const { results } = await response.json();
  expect(results.itinerary[0].transport).toEqual(selectedTransport);
  expect(results.itinerary[1]).not.toHaveProperty("transport");
  expect(results.itinerary[0]).not.toHaveProperty("estimatedCost");
  const mapped = mapSearchResultsToItinerary(results, null);
  expect(mapped.days[0].transport).toMatchObject({
    price: 900,
    departure: selectedTransport.departure,
    affiliateUrl: selectedTransport.affiliateUrl,
  });
  expect(mapped.days[1].transport).toBeUndefined();
  const chain = adminClient.from.mock.results.at(-1)!.value;
  expect(chain.eq).toHaveBeenCalledWith("id", "search-1");
  expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
});

it.each(["legacy", "different date", "unassigned"])(
  "does not invent transport for %s metadata",
  async (scenario) => {
    const saved = transportReloadFixture();
    if (scenario === "legacy") delete searchRecord!.intermediate_results;
    if (scenario === "different date") saved[1].date = "2026-07-01";
    if (scenario === "unassigned") delete saved[1].transport;
    const response = await GET(makeReq(), makeParams());
    expect(response.status).toBe(200);
    const { results } = await response.json();
    expect(
      results.itinerary.every((day: { transport?: unknown }) => !day.transport),
    ).toBe(true);
  },
);

it.each(["missing", "ambiguous", "wrong category", "duplicate day"])(
  "fails explicitly for %s selected transport instead of guessing",
  async (scenario) => {
    const saved = transportReloadFixture();
    if (scenario === "duplicate day") saved.push({ ...saved[1] });
    const rows = searchRecord!.search_results as {
      category: string;
      data: typeof selectedTransport;
    }[];
    if (scenario === "missing") rows.pop();
    if (scenario === "ambiguous")
      rows.push({
        ...rows[1],
        data: { ...selectedTransport, id: "duplicate" },
      });
    if (scenario === "wrong category") rows[1].category = "hotel";
    const response = await GET(makeReq(), makeParams());
    expect(response.status).toBe(500);
  },
);

it("uses the saved transport UUID despite identical projections and stale metadata", async () => {
  transportReloadFixture();
  const rows = searchRecord!.search_results as {
    id: string;
    category: string;
    data: typeof selectedTransport;
  }[];
  rows.push({
    ...rows[1],
    id: "replay-row",
    data: { ...selectedTransport, id: "other-offer" },
  });
  const days = searchRecord!.search_itineraries as { transport_id?: string }[];
  days[0].transport_id = "result-1";
  delete searchRecord!.intermediate_results;
  const response = await GET(makeReq(), makeParams());
  expect(response.status).toBe(200);
  expect((await response.json()).results.itinerary[0].transport).toEqual(
    selectedTransport,
  );
  const chain = adminClient.from.mock.results.at(-1)!.value;
  expect(chain.select.mock.calls[0][0]).toContain("transport_id");
});

it.each(["missing", "wrong category"])(
  "rejects a %s saved transport UUID without falling back",
  async (scenario) => {
    transportReloadFixture();
    const days = searchRecord!.search_itineraries as {
      transport_id?: string;
    }[];
    days[0].transport_id =
      scenario === "missing" ? "another-search-row" : "result-0";
    if (scenario === "wrong category")
      (searchRecord!.search_results as { category: string }[])[0].category =
        "hotel";
    expect((await GET(makeReq(), makeParams())).status).toBe(500);
  },
);
