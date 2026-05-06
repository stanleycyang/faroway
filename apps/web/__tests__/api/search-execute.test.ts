import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const agentMocks = vi.hoisted(() => ({
  runOrchestratorAgent: vi.fn(),
  runHotelsAgent: vi.fn(),
  runActivitiesAgent: vi.fn(),
  runDiningAgent: vi.fn(),
  runTransportAgent: vi.fn(),
  runAggregatorAgent: vi.fn(),
}));

vi.mock("@/lib/search/agents", () => agentMocks);

const enrichmentMock = vi.hoisted(() => ({
  runSearchEnrichment: vi.fn(),
}));

vi.mock("@/lib/search/enrichment", () => enrichmentMock);

const inserts: Record<string, unknown[][]> = {};
const updates: Record<string, unknown[]> = {};

function createTableChain(table: string) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.single = vi.fn(async () => ({
    data: table === "searches" ? { progress: {} } : null,
    error: null,
  }));
  chain.update = vi.fn((payload) => {
    updates[table] ||= [];
    updates[table].push(payload);
    return chain;
  });
  chain.insert = vi.fn((payload) => {
    inserts[table] ||= [];
    inserts[table].push(Array.isArray(payload) ? payload : [payload]);
    return Promise.resolve({ data: payload, error: null });
  });
  return chain;
}

const supabaseMock = {
  from: vi.fn((table: string) => createTableChain(table)),
};

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: vi.fn(() => supabaseMock),
}));

import { POST } from "@/app/api/search/[searchId]/execute/route";

function makeReq() {
  return new NextRequest("http://localhost:3000/api/search/search-1/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      destination: "Tokyo",
      startDate: "2026-06-01",
      endDate: "2026-06-05",
      travelers: 2,
      vibes: ["foodie"],
      budget: "moderate",
    }),
  });
}

const plan = {
  destination: "Tokyo",
  country: "Japan",
  dates: { start: "2026-06-01", end: "2026-06-05", nights: 4 },
  searchPriorities: ["hotels", "activities", "dining", "transport"],
  hotelCriteria: {
    priceRange: { min: 100, max: 300 },
    starRating: [4],
    amenities: [],
    neighborhoods: [],
  },
  activityCriteria: {
    categories: [],
    pacePreference: "moderate",
    mustSee: [],
    interests: [],
  },
  diningCriteria: {
    cuisineTypes: [],
    priceRange: "moderate",
    dietaryNeeds: [],
    mealPriorities: ["lunch", "dinner"],
  },
  vibeInterpretation: {
    vibes: ["foodie"],
    searchKeywords: [],
    avoidKeywords: [],
  },
  transportCriteria: {
    originAirport: "SFO",
    destinationAirport: "NRT",
  },
};

const transport = {
  id: "transport-1",
  type: "flight",
  provider: "Test Air",
  departure: {
    airport: "SFO",
    city: "San Francisco",
    dateTime: "2026-06-01T09:00:00",
  },
  arrival: {
    airport: "NRT",
    city: "Tokyo",
    dateTime: "2026-06-02T14:00:00",
  },
  duration: 660,
  stops: 0,
  price: 900,
  currency: "USD",
  airlines: ["Test Air"],
  segments: [],
  affiliateUrl: "https://flights.test",
  affiliatePartner: "amadeus",
  source: "amadeus",
  vibeScore: 0,
  vibeMatch: [],
};

describe("POST /api/search/[searchId]/execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(inserts)) delete inserts[key];
    for (const key of Object.keys(updates)) delete updates[key];
    agentMocks.runOrchestratorAgent.mockResolvedValue(plan);
    agentMocks.runHotelsAgent.mockResolvedValue([]);
    agentMocks.runActivitiesAgent.mockRejectedValue(new Error("vendor down"));
    agentMocks.runDiningAgent.mockResolvedValue([]);
    agentMocks.runTransportAgent.mockResolvedValue([transport]);
    agentMocks.runAggregatorAgent.mockResolvedValue({ days: [] });
    enrichmentMock.runSearchEnrichment.mockResolvedValue({
      activities: [],
      dining: [],
      notes: [],
    });
  });

  it("continues with transport and aggregation when one agent fails", async () => {
    const res = await POST(makeReq(), {
      params: Promise.resolve({ searchId: "search-1" }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.results.transport).toHaveLength(1);
    expect(agentMocks.runTransportAgent).toHaveBeenCalledWith(plan, 2, 5);
    expect(agentMocks.runAggregatorAgent).toHaveBeenCalledWith(
      plan,
      [],
      [],
      [],
      [transport],
    );
    expect(updates.searches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          progress: expect.objectContaining({
            hotels: "done",
            activities: "error",
            dining: "done",
            transport: "done",
            enrichment: "done",
          }),
        }),
      ]),
    );
    expect(inserts.search_results?.[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "transport",
          name: "Test Air",
          affiliate_url: "https://flights.test",
        }),
      ]),
    );
  });

  it("returns 400 for malformed JSON without running agents", async () => {
    const res = await POST(
      new NextRequest("http://localhost:3000/api/search/search-1/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{not-json",
      }),
      {
        params: Promise.resolve({ searchId: "search-1" }),
      },
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid request body");
    expect(agentMocks.runOrchestratorAgent).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid search input without running agents", async () => {
    const res = await POST(
      new NextRequest("http://localhost:3000/api/search/search-1/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: "",
          startDate: "tomorrow",
          endDate: "2026-06-05",
        }),
      }),
      {
        params: Promise.resolve({ searchId: "search-1" }),
      },
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid request body");
    expect(json.details.length).toBeGreaterThan(0);
    expect(agentMocks.runOrchestratorAgent).not.toHaveBeenCalled();
  });

  it("adds enrichment candidates before aggregation", async () => {
    agentMocks.runActivitiesAgent.mockResolvedValue([
      { id: "activity-1", name: "Vendor activity", description: "Vendor" },
    ]);
    agentMocks.runDiningAgent.mockResolvedValue([
      { id: "dining-1", name: "Vendor dining", description: "Vendor" },
    ]);
    agentMocks.runTransportAgent.mockResolvedValue([]);
    enrichmentMock.runSearchEnrichment.mockResolvedValue({
      activities: [
        {
          id: "local-activity-1",
          name: "Local activity",
          description: "Local",
        },
      ],
      dining: [{ id: "local-dining-1", name: "Local dining" }],
      notes: ["local enrichment"],
    });

    const res = await POST(makeReq(), {
      params: Promise.resolve({ searchId: "search-1" }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.results.activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "activity-1" }),
        expect.objectContaining({ id: "local-activity-1" }),
      ]),
    );
    expect(json.results.dining).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "dining-1" }),
        expect.objectContaining({ id: "local-dining-1" }),
      ]),
    );
    expect(agentMocks.runAggregatorAgent).toHaveBeenCalledWith(
      plan,
      [],
      expect.arrayContaining([
        expect.objectContaining({ name: "Local activity" }),
      ]),
      expect.arrayContaining([
        expect.objectContaining({ name: "Local dining" }),
      ]),
      [],
    );
  });
});
