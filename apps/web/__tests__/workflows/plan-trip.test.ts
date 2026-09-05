import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runOrchestratorAgent: vi.fn(),
  runHotelsAgent: vi.fn(),
  runActivitiesAgent: vi.fn(),
  runDiningAgent: vi.fn(),
  runTransportAgent: vi.fn(),
  runAggregatorAgent: vi.fn(),
  runSearchEnrichment: vi.fn(),
  mapSearchResultsToItinerary: vi.fn(),
  buildJsonRenderSpec: vi.fn(),
}));

vi.mock("@/lib/search/agents/orchestrator", () => ({
  runOrchestratorAgent: mocks.runOrchestratorAgent,
}));

vi.mock("@/lib/search/agents/hotels", () => ({
  runHotelsAgent: mocks.runHotelsAgent,
}));

vi.mock("@/lib/search/agents/activities", () => ({
  runActivitiesAgent: mocks.runActivitiesAgent,
}));

vi.mock("@/lib/search/agents/dining", () => ({
  runDiningAgent: mocks.runDiningAgent,
}));

vi.mock("@/lib/search/agents/transport", () => ({
  runTransportAgent: mocks.runTransportAgent,
}));

vi.mock("@/lib/search/agents/aggregator", () => ({
  runAggregatorAgent: mocks.runAggregatorAgent,
}));

vi.mock("@/lib/search/enrichment", () => ({
  runSearchEnrichment: mocks.runSearchEnrichment,
}));

vi.mock("@/lib/search/bridge", () => ({
  mapSearchResultsToItinerary: mocks.mapSearchResultsToItinerary,
}));

vi.mock("@/lib/json-render/build-spec", () => ({
  buildJsonRenderSpec: mocks.buildJsonRenderSpec,
}));

type ChainState = {
  table: string;
  insert?: unknown;
  update?: unknown;
};

function createChain(table: string) {
  const state: ChainState = { table };
  const chain = {
    select: vi.fn(() => chain),
    insert: vi.fn((value: unknown) => {
      state.insert = value;
      return chain;
    }),
    update: vi.fn((value: unknown) => {
      state.update = value;
      return chain;
    }),
    upsert: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    order: vi.fn(() => chain),
    single: vi.fn(async () => {
      if (state.table === "itineraries" && state.insert) {
        return { data: { id: "itinerary-1" }, error: null };
      }
      return { data: null, error: null };
    }),
  };
  return chain;
}

const supabaseMock = {
  from: vi.fn((table: string) => createChain(table)),
  rpc: vi.fn<
    (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: boolean; error: null }>
  >(async () => ({
    data: true,
    error: null,
  })),
};

vi.mock("@/lib/workflow/runtime", () => ({
  createFatalWorkflowError: (message: string) => new Error(message),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: vi.fn(() => supabaseMock),
}));

import { planTripWorkflow } from "@/workflows/plan-trip";

const searchPlan = {
  destination: "Tokyo",
  dates: {
    start: "2026-06-01",
    end: "2026-06-05",
    nights: 4,
  },
  vibeInterpretation: {
    vibes: ["foodie"],
    keywords: ["food"],
    priorities: ["dining"],
  },
  hotelCriteria: {},
  activityCriteria: {},
  diningCriteria: {},
  transportCriteria: {
    originAirport: "SFO",
    destinationAirport: "NRT",
  },
  budgetAllocation: {
    hotels: 1000,
    activities: 400,
    dining: 500,
    transport: 1200,
  },
};

const workflowInput = {
  searchId: "search-1",
  tripId: "trip-1",
  destination: "Tokyo",
  startDate: "2026-06-01",
  endDate: "2026-06-05",
  travelers: 2,
  travelerType: "couple" as const,
  vibes: ["foodie"],
  budget: "moderate",
  originCity: "San Francisco",
  originAirport: "SFO",
  userId: "user-1",
};

const hotel = {
  id: "hotel-1",
  name: "Hotel One",
  userRating: 4.6,
  reviewCount: 120,
  pricePerNight: 240,
  currency: "USD",
  amenities: [],
  description: "Central hotel",
  affiliateUrl: "https://example.com/hotel",
  affiliatePartner: "booking",
  images: [],
  starRating: 4,
};

const dining = {
  id: "dining-1",
  name: "Soba House",
  description: "Local soba",
  cuisineTypes: ["japanese"],
  priceLevel: 2,
  dietaryOptions: [],
  mealTypes: ["lunch"],
  location: { name: "Tokyo", address: "", lat: 35.6, lng: 139.7 },
  images: [],
  reservationUrl: "https://example.com/dining",
  affiliatePartner: undefined,
  vibeScore: 80,
  vibeMatch: ["foodie"],
  rating: 4.5,
  reviewCount: 80,
};

const activity = {
  id: "activity-1",
  name: "Market Tour",
  description: "Food market walk",
  category: "food",
  duration: 120,
  price: 80,
  currency: "USD",
  rating: 4.8,
  reviewCount: 200,
  location: { name: "Tokyo", address: "", lat: 35.6, lng: 139.7 },
  images: [],
  affiliateUrl: "https://example.com/activity",
  affiliatePartner: "viator",
  bestTimeOfDay: "morning",
  vibeScore: 90,
  vibeMatch: ["foodie"],
  bookingRequired: true,
};

const transport = {
  id: "transport-1",
  provider: "Duffel",
  type: "flight",
  departure: {
    airport: "SFO",
    airportCode: "SFO",
    time: "2026-06-01T10:00:00Z",
  },
  arrival: {
    airport: "NRT",
    airportCode: "NRT",
    time: "2026-06-02T14:00:00Z",
  },
  duration: 660,
  stops: 0,
  price: 900,
  currency: "USD",
  affiliateUrl: "https://example.com/flight",
  affiliatePartner: "duffel",
};

function mappedItinerary(overrides: Record<string, unknown> = {}) {
  return {
    searchId: "search-1",
    hotels: [hotel],
    activities: [activity],
    dining: [dining],
    transport: [transport],
    days: [],
    topHotel: hotel,
    totalEstimatedCost: 2500,
    currency: "USD",
    ...overrides,
  };
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs = 100,
): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error("Timed out waiting for condition");
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
}

describe("planTripWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabaseMock.rpc.mockResolvedValue({ data: true, error: null });
    mocks.runOrchestratorAgent.mockResolvedValue(searchPlan);
    mocks.runHotelsAgent.mockResolvedValue([hotel]);
    mocks.runActivitiesAgent.mockResolvedValue([activity]);
    mocks.runDiningAgent.mockResolvedValue([dining]);
    mocks.runTransportAgent.mockResolvedValue([transport]);
    mocks.runSearchEnrichment.mockResolvedValue({
      activities: [],
      dining: [],
      notes: [],
    });
    mocks.runAggregatorAgent.mockResolvedValue({ days: [], topHotel: hotel });
    mocks.mapSearchResultsToItinerary.mockImplementation((results) =>
      mappedItinerary({
        hotels: results.hotels,
        activities: results.activities,
        dining: results.dining,
        transport: results.transport,
      }),
    );
    mocks.buildJsonRenderSpec.mockReturnValue([
      { type: "TripSummary", props: { destination: "Tokyo" } },
    ]);
  });

  it("starts provider and enrichment work concurrently", async () => {
    const started: string[] = [];
    let releaseFanout!: () => void;
    const fanoutGate = new Promise<void>((resolve) => {
      releaseFanout = resolve;
    });
    const makeGatedResult =
      <T>(stage: string, value: T) =>
      async (): Promise<T> => {
        started.push(stage);
        await fanoutGate;
        return value;
      };

    mocks.runHotelsAgent.mockImplementation(makeGatedResult("hotels", [hotel]));
    mocks.runActivitiesAgent.mockImplementation(
      makeGatedResult("activities", [activity]),
    );
    mocks.runDiningAgent.mockImplementation(
      makeGatedResult("dining", [dining]),
    );
    mocks.runTransportAgent.mockImplementation(
      makeGatedResult("transport", [transport]),
    );
    mocks.runSearchEnrichment.mockImplementation(
      makeGatedResult("enrichment", {
        activities: [],
        dining: [],
        notes: [],
      }),
    );

    const workflow = planTripWorkflow(workflowInput);

    await waitFor(() => started.length === 5);
    expect(started.sort()).toEqual([
      "activities",
      "dining",
      "enrichment",
      "hotels",
      "transport",
    ]);

    releaseFanout();
    const result = await workflow;

    expect(result.status).toBe("completed");
    expect(mocks.runOrchestratorAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        originCity: "San Francisco",
        originAirport: "SFO",
        travelerType: "couple",
      }),
    );
    expect(mocks.runAggregatorAgent).toHaveBeenCalledTimes(1);
  });

  it("continues to aggregation when a provider fails", async () => {
    mocks.runActivitiesAgent.mockRejectedValue(new Error("activities failed"));

    const result = await planTripWorkflow(workflowInput);

    expect(result.status).toBe("completed");
    expect(mocks.runAggregatorAgent).toHaveBeenCalledWith(
      searchPlan,
      [hotel],
      [],
      [dining],
      [transport],
    );
  });

  it("passes JSONB values to intermediate merge RPC without stringifying", async () => {
    await planTripWorkflow(workflowInput);

    const rpcCalls = supabaseMock.rpc.mock.calls as unknown as Array<
      [string, Record<string, unknown>]
    >;
    const mergeCalls = rpcCalls.filter(
      ([fn]) => fn === "merge_intermediate_results",
    );
    const daysArgs = mergeCalls.find(([, args]) => args.p_key === "days")?.[1];
    const hotelsArgs = mergeCalls.find(
      ([, args]) => args.p_key === "hotels",
    )?.[1];

    expect(Array.isArray(daysArgs?.p_value)).toBe(true);
    expect(Array.isArray(hotelsArgs?.p_value)).toBe(true);
    expect(typeof daysArgs?.p_value).not.toBe("string");
    expect(typeof hotelsArgs?.p_value).not.toBe("string");
  });

  it("stops a fenced-out worker before making provider or AI calls", async () => {
    supabaseMock.rpc.mockResolvedValueOnce({ data: false, error: null });
    const result = await planTripWorkflow(workflowInput);
    expect(result.status).toBe("error");
    expect(mocks.runOrchestratorAgent).not.toHaveBeenCalled();
    expect(mocks.runHotelsAgent).not.toHaveBeenCalled();
    expect(mocks.runAggregatorAgent).not.toHaveBeenCalled();
    expect(supabaseMock.rpc).toHaveBeenLastCalledWith("fail_trip_generation", {
      p_trip_id: "trip-1",
      p_search_id: workflowInput.searchId,
    });
  });

  it("persists all trip results through the fenced completion transaction", async () => {
    await planTripWorkflow(workflowInput);
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      "complete_trip_generation",
      expect.objectContaining({
        p_trip_id: "trip-1",
        p_search_id: workflowInput.searchId,
        p_results: expect.any(Array),
        p_days: expect.any(Array),
        p_spec: expect.any(Array),
        p_itinerary: expect.objectContaining({ trip_id: "trip-1" }),
      }),
    );
    expect(supabaseMock.from).not.toHaveBeenCalledWith("trips");
    expect(supabaseMock.from).not.toHaveBeenCalledWith("itineraries");
    expect(supabaseMock.from).not.toHaveBeenCalledWith("notifications");
  });
});
