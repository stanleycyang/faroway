import { describe, expect, it, vi, beforeEach } from "vitest";

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

import { executeTravelSearch } from "@/lib/search/workflow";

const searchInput = {
  destination: "Tokyo",
  startDate: "2026-06-01",
  endDate: "2026-06-05",
  travelers: 2,
  vibes: ["foodie"],
  budget: "moderate" as const,
};

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

describe("executeTravelSearch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    agentMocks.runOrchestratorAgent.mockResolvedValue(searchPlan);
    agentMocks.runAggregatorAgent.mockResolvedValue({ days: [] });
    enrichmentMock.runSearchEnrichment.mockResolvedValue({
      activities: [],
      dining: [],
      notes: [],
    });
  });

  it("preserves the aggregator global hotel independently of the first day", async () => {
    const first = { id: "first", name: "First night" };
    const top = { id: "global", name: "Global recommendation" };
    agentMocks.runHotelsAgent.mockResolvedValue([first, top]);
    agentMocks.runActivitiesAgent.mockResolvedValue([]);
    agentMocks.runDiningAgent.mockResolvedValue([]);
    agentMocks.runTransportAgent.mockResolvedValue([]);
    agentMocks.runAggregatorAgent.mockResolvedValue({
      topHotel: top,
      days: [
        {
          dayNumber: 1,
          date: "2026-06-01",
          hotel: first,
          morning: { activities: [] },
          afternoon: { activities: [] },
          evening: { activities: [] },
        },
      ],
    });
    const onAgentResult = vi.fn(async () => {});
    const result = await executeTravelSearch(
      "search-global-hotel",
      searchInput,
      { onAgentResult },
    );
    expect(result.status).toBe("completed");
    expect(result.topHotel).toEqual(top);
    expect(onAgentResult).toHaveBeenCalledWith(
      "aggregator",
      expect.objectContaining({
        topHotel: top,
        days: [expect.objectContaining({ hotel: first })],
      }),
    );
  });

  it("starts specialized agents in parallel before waiting for results", async () => {
    const started: string[] = [];
    let releaseAgents!: () => void;
    const agentGate = new Promise<void>((resolve) => {
      releaseAgents = resolve;
    });
    const makeAgent = (stage: string) => async (): Promise<unknown[]> => {
      started.push(stage);
      await agentGate;
      return [];
    };

    agentMocks.runHotelsAgent.mockImplementation(makeAgent("hotels"));
    agentMocks.runActivitiesAgent.mockImplementation(makeAgent("activities"));
    agentMocks.runDiningAgent.mockImplementation(makeAgent("dining"));
    agentMocks.runTransportAgent.mockImplementation(makeAgent("transport"));

    const workflow = executeTravelSearch("search-parallel", searchInput);

    await waitFor(() => started.length === 4);
    expect(started.sort()).toEqual([
      "activities",
      "dining",
      "hotels",
      "transport",
    ]);

    releaseAgents();
    const result = await workflow;

    expect(result.status).toBe("completed");
    expect(agentMocks.runAggregatorAgent).toHaveBeenCalledTimes(1);
  });

  it("completes with fallback arrays when one parallel agent fails", async () => {
    agentMocks.runHotelsAgent.mockResolvedValue([{ id: "h1", name: "Hotel" }]);
    agentMocks.runActivitiesAgent.mockRejectedValue(new Error("vendor down"));
    agentMocks.runDiningAgent.mockResolvedValue([{ id: "d1", name: "Diner" }]);
    agentMocks.runTransportAgent.mockResolvedValue([
      { id: "t1", provider: "Duffel" },
    ]);

    const result = await executeTravelSearch("search-fallback", searchInput);

    expect(result.status).toBe("completed");
    expect(agentMocks.runAggregatorAgent).toHaveBeenCalledWith(
      searchPlan,
      [{ id: "h1", name: "Hotel" }],
      [],
      [{ id: "d1", name: "Diner" }],
      [{ id: "t1", provider: "Duffel" }],
    );
  });

  it("merges enrichment into aggregation", async () => {
    agentMocks.runHotelsAgent.mockResolvedValue([]);
    agentMocks.runActivitiesAgent.mockResolvedValue([
      { id: "a1", name: "Vendor activity" },
    ]);
    agentMocks.runDiningAgent.mockResolvedValue([
      { id: "d1", name: "Vendor dining" },
    ]);
    agentMocks.runTransportAgent.mockResolvedValue([]);
    enrichmentMock.runSearchEnrichment.mockResolvedValue({
      activities: [{ id: "ea1", name: "Tavily activity" }],
      dining: [{ id: "ed1", name: "Local dining" }],
      notes: ["enriched"],
    });

    const result = await executeTravelSearch("search-enriched", searchInput);

    expect(result.status).toBe("completed");
    expect(agentMocks.runAggregatorAgent).toHaveBeenCalledWith(
      searchPlan,
      [],
      expect.arrayContaining([
        expect.objectContaining({ id: "a1" }),
        expect.objectContaining({ id: "ea1" }),
      ]),
      expect.arrayContaining([
        expect.objectContaining({ id: "d1" }),
        expect.objectContaining({ id: "ed1" }),
      ]),
      [],
    );
  });
});
