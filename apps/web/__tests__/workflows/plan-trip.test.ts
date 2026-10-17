import type {
  HotelResult,
  ActivityResult,
  DiningResult,
  TransportResult,
} from "@faroway/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: () => ({ workflowRunId: "run-fixture-1" }),
}));

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
  dispatchItineraryReady: vi.fn(),
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

vi.mock("@/lib/notifications/itinerary-dispatch", () => ({
  dispatchItineraryReady: mocks.dispatchItineraryReady,
}));

vi.mock("@/lib/json-render/build-spec", () => ({
  buildJsonRenderSpec: mocks.buildJsonRenderSpec,
}));

type ChainState = {
  table: string;
  insert?: unknown;
  update?: unknown;
};

let insertedResults: { id: string; category: string; data: unknown }[] = [];
let insertFailure: string | null = null;
function createChain(table: string) {
  const state: ChainState = { table };
  const chain = {
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({
        data: state.table === "search_results" ? insertedResults : null,
        error:
          state.table === insertFailure ? { message: "fixture failure" } : null,
      }).then(resolve),
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
  rpc: vi.fn(async () => ({ data: true, error: null })),
};

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: vi.fn(() => supabaseMock),
}));

import { planTripWorkflow, saveSearchResults } from "@/workflows/plan-trip";

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

const hotel: HotelResult = {
  id: "hotel-1",
  name: "Hotel One",
  location: { name: "Tokyo", address: "", lat: 0, lng: 0 },
  vibeScore: 0,
  vibeMatch: [],
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

const dining: DiningResult = {
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

const activity: ActivityResult = {
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

const transport: TransportResult = {
  source: "duffel",
  vibeScore: 0,
  vibeMatch: [],
  airlines: [],
  segments: [],
  id: "transport-1",
  provider: "Duffel",
  type: "flight",
  departure: {
    airport: "SFO",
    city: "San Francisco",
    dateTime: "2026-06-01T10:00:00Z",
  },
  arrival: {
    airport: "NRT",
    city: "Tokyo",
    dateTime: "2026-06-02T14:00:00Z",
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
    insertedResults = [];
    insertFailure = null;
    mocks.dispatchItineraryReady.mockResolvedValue("accepted");
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

  it("maps returned hotel UUIDs by provider identity despite reordered insert results", async () => {
    const other = { ...hotel, id: "hotel-2", name: "Hotel Two" };
    const slot = { activities: [], meals: [] };
    const days = [hotel, other, undefined].map((assigned, index) => ({
      dayNumber: index + 1,
      date: `2026-06-0${index + 1}`,
      hotel: assigned,
      morning: slot,
      afternoon: slot,
      evening: slot,
    }));
    insertedResults = [
      {
        id: "22222222-2222-4222-8222-222222222222",
        category: "hotel",
        data: other,
      },
      {
        id: "11111111-1111-4111-8111-111111111111",
        category: "hotel",
        data: hotel,
      },
    ];
    mocks.mapSearchResultsToItinerary.mockReturnValue(
      mappedItinerary({ hotels: [hotel, other], days }),
    );
    expect(
      (await planTripWorkflow({ ...workflowInput, tripId: undefined })).status,
    ).toBe("completed");
    const writes = supabaseMock.from.mock.results
      .map((result) => result.value.insert.mock.calls)
      .flat();
    const itineraryRows = writes.find(
      ([rows]) => Array.isArray(rows) && rows[0]?.day_number,
    )?.[0];
    expect(
      itineraryRows.map((row: { hotel_id: string | null }) => row.hotel_id),
    ).toEqual([insertedResults[1].id, insertedResults[0].id, null]);
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith(
      "apply_trip_generation_update",
      expect.anything(),
    );
  });

  it("does not guess a hotel foreign key when returned identities are missing or ambiguous", async () => {
    const slot = { activities: [], meals: [] };
    insertedResults = [
      { id: "row-a", category: "hotel", data: hotel },
      { id: "row-b", category: "hotel", data: hotel },
    ];
    await saveSearchResults(
      "search-1",
      mappedItinerary({
        days: [hotel, { ...hotel, id: "missing" }].map((assigned, index) => ({
          dayNumber: index + 1,
          hotel: assigned,
          morning: slot,
          afternoon: slot,
          evening: slot,
        })),
      }),
    );
    const writes = supabaseMock.from.mock.results
      .map((result) => result.value.insert.mock.calls)
      .flat();
    const rows = writes.find(
      ([rows]) => Array.isArray(rows) && rows[0]?.day_number,
    )?.[0];
    expect(
      rows.map((row: { hotel_id: string | null }) => row.hotel_id),
    ).toEqual([null, null]);
  });

  it.each(["search_results", "search_itineraries"])(
    "does not report successful persistence after %s insert failure",
    async (table) => {
      insertFailure = table;
      const slot = { activities: [], meals: [] };
      await expect(
        saveSearchResults(
          "search-1",
          mappedItinerary({
            days: [
              {
                dayNumber: 1,
                hotel,
                morning: slot,
                afternoon: slot,
                evening: slot,
              },
            ],
          }),
        ),
      ).rejects.toThrow("could not be saved");
      if (table === "search_results")
        expect(supabaseMock.from).not.toHaveBeenCalledWith(
          "search_itineraries",
        );
    },
  );

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

  it("dispatches only after the completed itinerary is durably saved", async () => {
    mocks.dispatchItineraryReady.mockImplementation(async () => {
      expect(supabaseMock.rpc).toHaveBeenCalledWith(
        "apply_trip_generation_update",
        expect.objectContaining({
          p_state: "planned",
          p_trip_id: "trip-1",
          p_search_id: "search-1",
        }),
      );
      return "accepted";
    });
    expect((await planTripWorkflow(workflowInput)).status).toBe("completed");
    expect(mocks.dispatchItineraryReady).toHaveBeenCalledWith(
      "trip-1",
      "search-1",
    );
  });

  it("preserves day hotel and transport through the real bridge and saved payload", async () => {
    const { mapSearchResultsToItinerary } = await vi.importActual<
      typeof import("@/lib/search/bridge")
    >("@/lib/search/bridge");
    mocks.mapSearchResultsToItinerary.mockImplementation(
      mapSearchResultsToItinerary,
    );
    const firstDay = {
      dayNumber: 1,
      date: workflowInput.startDate,
      title: "Arrival",
      summary: "Arrive in Tokyo",
      hotel,
      transport,
      morning: { activities: [] },
      afternoon: { activities: [] },
      evening: { activities: [] },
      estimatedCost: 0,
      currency: "USD",
      tips: [],
    };
    mocks.runAggregatorAgent.mockResolvedValue({
      days: [
        firstDay,
        {
          ...firstDay,
          dayNumber: 2,
          date: "2026-06-02",
          hotel: undefined,
          transport: undefined,
        },
      ],
      topHotel: hotel,
    });

    const result = await planTripWorkflow(workflowInput);

    expect(result.status).toBe("completed");
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      "apply_trip_generation_update",
      expect.objectContaining({
        p_state: "planned",
        p_payload: expect.objectContaining({
          days: [
            expect.objectContaining({
              hotel,
              transport: expect.objectContaining({
                type: transport.type,
                provider: transport.provider,
                departure: {
                  airport: "SFO",
                  city: "San Francisco",
                  dateTime: transport.departure.dateTime,
                },
                arrival: {
                  airport: "NRT",
                  city: "Tokyo",
                  dateTime: transport.arrival.dateTime,
                },
                duration: transport.duration,
                price: transport.price,
                currency: transport.currency,
                affiliateUrl: transport.affiliateUrl,
              }),
            }),
            expect.objectContaining({ hotel: undefined, transport: undefined }),
          ],
        }),
      }),
    );
  });
  it("keeps a completed plan successful when the notification step fails", async () => {
    mocks.dispatchItineraryReady.mockRejectedValue(
      new Error("notification unavailable"),
    );
    expect((await planTripWorkflow(workflowInput)).status).toBe("completed");
    expect(supabaseMock.rpc).not.toHaveBeenCalledWith(
      "apply_trip_generation_update",
      expect.objectContaining({ p_state: "failed" }),
    );
  });
  it("never dispatches a completion push for a failed planner or an unsaved search", async () => {
    mocks.runAggregatorAgent.mockRejectedValueOnce(
      new Error("planning failed"),
    );
    expect((await planTripWorkflow(workflowInput)).status).toBe("error");
    expect(mocks.dispatchItineraryReady).not.toHaveBeenCalled();
    await planTripWorkflow({ ...workflowInput, tripId: undefined });
    expect(mocks.dispatchItineraryReady).not.toHaveBeenCalled();
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
});
