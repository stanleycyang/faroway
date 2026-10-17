import { NextRequest } from "next/server";
import { GET as readSearch } from "@/app/api/search/[searchId]/route";
import type {
  HotelResult,
  ActivityResult,
  DiningResult,
  TransportResult,
} from "@faroway/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: () => ({ workflowRunId: "run-fixture-1" }),
}));

const mocks = vi.hoisted(() => ({
  generateObject: vi.fn(),
  tripRead: undefined as Record<string, unknown> | undefined,
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

vi.mock("@/lib/ai/sdk", () => ({
  generateObject: mocks.generateObject,
  gateway: (model: string) => ({ model }),
  createGateway: () => (model: string) => ({ model }),
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

type ResultRow = { id: string; category: string; data: unknown };
let insertedResults: ResultRow[] | null = null;
let persistedResults: ResultRow[] = [];
let persistedDays: Record<string, unknown>[] = [];
let readSearchRecord: Record<string, unknown> | null = null;
const uuid = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function executeInsert(state: ChainState) {
  if (state.table === insertFailure)
    return { data: null, error: { message: "fixture failure" } };
  if (state.table === "search_results" && Array.isArray(state.insert)) {
    persistedResults =
      insertedResults ??
      state.insert
        .map((row, index) => ({ ...row, id: uuid(index + 1) }))
        .reverse();
    return { data: persistedResults, error: null };
  }
  if (state.table === "search_itineraries" && Array.isArray(state.insert)) {
    for (const row of state.insert) {
      const refs = [
        row.hotel_id,
        ...row.morning_activities,
        ...row.afternoon_activities,
        ...row.evening_activities,
        ...row.meals,
      ].filter((id) => id != null);
      if (refs.some((id) => typeof id !== "string" || !uuidPattern.test(id)))
        return {
          data: null,
          error: {
            code: "22P02",
            message: "invalid input syntax for type uuid",
          },
        };
      if (
        row.hotel_id &&
        !persistedResults.some((item) => item.id === row.hotel_id)
      )
        return {
          data: null,
          error: { code: "23503", message: "hotel foreign key violation" },
        };
    }
    persistedDays = state.insert;
  }
  return { data: null, error: null };
}
let insertFailure: string | null = null;
function createChain(table: string) {
  const state: ChainState = { table };
  const chain = {
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve(executeInsert(state)).then(resolve),
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
      if (state.table === "searches" && readSearchRecord)
        return { data: readSearchRecord, error: null };
      if (state.table === "trips") return { data: mocks.tripRead, error: null };
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
  createClientFromRequest: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
    },
  }),
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
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
    insertedResults = null;
    persistedResults = [];
    persistedDays = [];
    readSearchRecord = null;
    insertFailure = null;
    mocks.tripRead = undefined;
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

  it.each(["hotel", "activity", "dining"])(
    "rejects missing and ambiguous %s references without a partial itinerary",
    async (category) => {
      const slot = { activities: [], meals: [] };
      const assigned =
        category === "hotel"
          ? { hotel }
          : category === "activity"
            ? { morning: { ...slot, activities: [{ id: "logical" }] } }
            : { morning: { ...slot, meals: [{ id: "logical" }] } };
      const item = category === "hotel" ? hotel : { id: "logical" };
      for (const returned of [
        [],
        [
          { id: uuid(1), category, data: item },
          { id: uuid(2), category, data: item },
        ],
      ]) {
        supabaseMock.from.mockClear();
        insertedResults = returned;
        await expect(
          saveSearchResults(
            "search-1",
            mappedItinerary({
              days: [
                {
                  dayNumber: 1,
                  morning: slot,
                  afternoon: slot,
                  evening: slot,
                  ...assigned,
                },
              ],
            }),
          ),
        ).rejects.toThrow("missing or ambiguous");
        expect(supabaseMock.from).not.toHaveBeenCalledWith(
          "search_itineraries",
        );
        expect(persistedDays).toEqual([]);
      }
    },
  );

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

  it("round-trips logical activity and meal IDs through UUID columns without changing scheduled order", async () => {
    vi.stubEnv("VIATOR_CONTENT_ENABLED", "true");
    vi.stubEnv("VIATOR_CONTENT_APPROVAL_REF", "offline-fixture");
    const { mapSearchResultsToItinerary } = await vi.importActual<
      typeof import("@/lib/search/bridge")
    >("@/lib/search/bridge");
    const activities = ["activity_1", "activity_v_2", "activity_gyg_3"].map(
      (id) => ({
        ...activity,
        id,
        affiliatePartner: "fixture",
        viatorContentVersion: 1,
      }),
    );
    const meals = ["breakfast", "lunch", "dinner"].map((_mealType, index) => ({
      ...dining,
      id: `dining_${index}`,
      mealTypes: ["breakfast", "lunch", "dinner"] as (
        | "breakfast"
        | "lunch"
        | "dinner"
      )[],
    }));
    const results = {
      searchId: "search-1",
      hotels: [hotel],
      activities,
      dining: meals,
      transport: [transport],
      itinerary: [
        {
          dayNumber: 1,
          date: "2026-06-01",
          title: "Fixture",
          summary: "Fixture",
          hotel,
          transport,
          morning: {
            activities: [activities[2], activities[0]],
            meal: meals[0],
          },
          afternoon: { activities: [activities[1]], meal: meals[1] },
          evening: { activities: [], meal: meals[2] },
          estimatedCost: 0,
          currency: "USD",
          tips: [],
        },
      ],
    };
    const mapped = mapSearchResultsToItinerary(results, hotel);
    await saveSearchResults("search-1", mapped);
    expect(persistedDays).toHaveLength(1);
    expect(persistedDays[0].morning_activities).toEqual([uuid(4), uuid(2)]);
    expect(persistedDays[0].meals).toEqual([uuid(5), uuid(6), uuid(7)]);
    readSearchRecord = {
      id: "search-1",
      user_id: "user-1",
      status: "completed",
      search_results: persistedResults,
      search_itineraries: persistedDays,
      intermediate_results: { days: mapped.days },
    };
    const response = await readSearch(
      new NextRequest("http://localhost/api/search/search-1"),
      { params: Promise.resolve({ searchId: "search-1" }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.results.itinerary[0].transport).toEqual(transport);
    expect(
      body.results.itinerary[0].morning.activities.map(
        (item: { id: string }) => item.id,
      ),
    ).toEqual(["activity_gyg_3", "activity_1"]);
    expect(body.results.itinerary[0].afternoon.activities[0].id).toBe(
      "activity_v_2",
    );
    expect(
      ["morning", "afternoon", "evening"].map(
        (slot) => body.results.itinerary[0][slot].meal.id,
      ),
    ).toEqual(["dining_0", "dining_1", "dining_2"]);
    const searchChain = supabaseMock.from.mock.results.at(-1)!.value;
    expect(searchChain.eq).toHaveBeenCalledWith("id", "search-1");
    expect(searchChain.eq).toHaveBeenCalledWith("user_id", "user-1");
    // The UUID contract must not stop generation before the owned-trip bridge.
    readSearchRecord = null;
    mocks.mapSearchResultsToItinerary.mockReturnValue(mapped);
    for (const tripId of [undefined, "trip-1"]) {
      expect(
        (await planTripWorkflow({ ...workflowInput, tripId })).status,
      ).toBe("completed");
    }
    expect(supabaseMock.rpc).toHaveBeenCalledWith(
      "apply_trip_generation_update",
      expect.objectContaining({
        p_trip_id: "trip-1",
        p_search_id: "search-1",
        p_state: "planned",
        p_payload: expect.objectContaining({
          days: expect.arrayContaining([
            expect.objectContaining({
              morning: expect.objectContaining({
                activities: expect.arrayContaining([
                  expect.objectContaining({ id: "activity_gyg_3" }),
                  expect.objectContaining({ id: "activity_1" }),
                ]),
              }),
            }),
          ]),
        }),
      }),
    );
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

  describe.each(["successful", "recovered", "fallback"])(
    "%s normalized itinerary",
    (responsePath) => {
      it.each([0, 4])(
        "preserves outbound transport and unavailable costs through aggregation, bridge, persistence and read for %s nights",
        async (nights) => {
          const { runAggregatorAgent } = await vi.importActual<
            typeof import("@/lib/search/agents/aggregator")
          >("@/lib/search/agents/aggregator");
          const { mapSearchResultsToItinerary } = await vi.importActual<
            typeof import("@/lib/search/bridge")
          >("@/lib/search/bridge");
          const { loadTripForUserUncached } =
            await import("@/lib/trips/load-trip");
          const { buildTripExportText } = await import("@/lib/trips/export");
          mocks.runAggregatorAgent.mockImplementation(runAggregatorAgent);
          mocks.mapSearchResultsToItinerary.mockImplementation(
            mapSearchResultsToItinerary,
          );
          mocks.runHotelsAgent.mockResolvedValue([]);
          const nightActivity = {
            ...activity,
            id: "local-night",
            affiliatePartner: undefined,
            bestTimeOfDay: "evening",
          };
          mocks.runActivitiesAgent.mockResolvedValue([nightActivity]);
          mocks.runDiningAgent.mockResolvedValue([]);
          mocks.runTransportAgent.mockResolvedValue([
            transport,
            { ...transport, id: "outbound-alternative" },
          ]);
          const end = `2026-06-0${nights + 1}`;
          mocks.runOrchestratorAgent.mockResolvedValue({
            ...searchPlan,
            dates: { ...searchPlan.dates, end, nights },
          });
          const days = Array.from({ length: nights + 1 }, (_, i) => ({
            dayNumber: i + 1,
            date: `2026-06-0${i + 1}`,
            title: `Day ${i + 1}`,
            summary: "Explore Tokyo",
            morning: { activityIds: [nightActivity.id] },
            afternoon: { activityIds: [] },
            evening: { activityIds: [nightActivity.id] },
            transportId: i === 0 ? transport.id : "outbound-alternative",
            estimatedCost: 980,
            currency: "USD",
            tips: [],
          }));
          if (responsePath === "successful")
            mocks.generateObject.mockResolvedValue({ object: { days } });
          else
            mocks.generateObject.mockRejectedValue(
              Object.assign(
                new Error("Offline fixture"),
                responsePath === "recovered"
                  ? { text: JSON.stringify({ days: JSON.stringify(days) }) }
                  : {},
              ),
            );

          expect(
            (await planTripWorkflow({ ...workflowInput, endDate: end })).status,
          ).toBe("completed");
          const rpcCalls = supabaseMock.rpc.mock.calls as unknown as [
            string,
            Record<string, unknown>,
          ][];
          const payload = rpcCalls.find(
            ([fn, args]) =>
              fn === "apply_trip_generation_update" &&
              args.p_state === "planned",
          )![1].p_payload as { days: import("@faroway/types").TripDay[] };
          // Exercise the JSON serialization used by the database client.
          const saved = JSON.parse(JSON.stringify(payload)) as typeof payload;
          expect(saved.days).toHaveLength(nights + 1);
          expect(saved.days[0].transport).toEqual(
            expect.objectContaining({
              departure: transport.departure,
              arrival: transport.arrival,
              price: 900,
              currency: "USD",
              affiliateUrl: transport.affiliateUrl,
            }),
          );
          expect(saved.days.slice(1).every((day) => !day.transport)).toBe(true);
          expect(saved.days[0].morning.activities).toEqual([]);
          expect(saved.days[0].evening.activities.map((a) => a.id)).toEqual([
            nightActivity.id,
          ]);
          expect(
            saved.days.every(
              (day) => !Object.hasOwn(day, "totalEstimatedCost"),
            ),
          ).toBe(true);
          const rowCallIndex = supabaseMock.from.mock.calls.findIndex(
            ([table]) => table === "search_itineraries",
          );
          const rows = supabaseMock.from.mock.results[rowCallIndex].value.insert
            .mock.calls[0][0] as Record<string, unknown>[];
          expect(rows.map((row) => row.estimated_cost)).toEqual(
            Array(nights + 1).fill(null),
          );
          expect(
            mocks.buildJsonRenderSpec.mock.lastCall![0].days.every(
              (day: { estimatedCost?: number }) =>
                day.estimatedCost === undefined,
            ),
          ).toBe(true);
          mocks.tripRead = {
            id: "trip-1",
            user_id: "user-1",
            itineraries: saved,
          };
          const loaded = await loadTripForUserUncached("trip-1", "user-1");
          expect(loaded?.itinerary?.days).toEqual(saved.days);
          const exported = buildTripExportText(
            {
              destination: "Tokyo",
              start_date: workflowInput.startDate,
              end_date: end,
              travelers: 2,
              status: "planned",
            },
            loaded!.itinerary,
          );
          expect(exported.match(/Transport:/g)).toHaveLength(1);
          expect(exported).not.toContain("Day estimate:");
        },
      );
    },
  );
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
