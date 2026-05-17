import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const startMock = vi.fn(async () => ({ runId: "run-e2e-1" }));

vi.mock("@/lib/workflow/runtime", () => ({
  startWorkflow: (...args: unknown[]) =>
    startMock(...(args as Parameters<typeof startMock>)),
}));

vi.mock("@/workflows/plan-trip", () => ({
  planTripWorkflow: vi.fn(async () => ({})),
}));

type SearchRecord = {
  id: string;
  status: string;
  progress: Record<string, string>;
  error_message: string | null;
  intermediate_results: Record<string, unknown>;
  json_render_spec: Array<{
    type: string;
    props: Record<string, unknown>;
  }> | null;
  created_at: string;
  completed_at: string | null;
};

const dbState = {
  trip: {
    id: "trip-e2e-1",
    user_id: "user-1",
    status: "draft",
    destination: "Tokyo",
    start_date: "2026-05-10",
    end_date: "2026-05-14",
    travelers: 2,
    budget_tier: "moderate",
    vibes: ["foodie"],
    preferences: {},
    search_id: null as string | null,
    itinerary_id: null as string | null,
    updated_at: "2026-05-01T00:00:00.000Z",
  },
  search: null as SearchRecord | null,
  rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
  searchSelectCount: 0,
  missingIntermediateResultsColumn: false,
};

function parseSse(raw: string): Array<{ event: string; data: unknown }> {
  return raw
    .split("\n\n")
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const eventLine = block
        .split("\n")
        .find((line) => line.startsWith("event: "));
      const dataLine = block
        .split("\n")
        .find((line) => line.startsWith("data: "));
      const event = eventLine ? eventLine.slice(7).trim() : "message";
      const data = dataLine ? JSON.parse(dataLine.slice(6)) : {};
      return { event, data };
    });
}

function createChain(table: string) {
  type ChainResult = { data: unknown; error: unknown };
  type ChainFn = (...args: unknown[]) => Chain | Promise<ChainResult>;
  type Chain = Record<string, ChainFn>;
  const query: Record<string, unknown> = {};
  const chain: Chain = {
    select: (...args: unknown[]) => {
      query.select = args[0];
      return chain;
    },
    insert: (...args: unknown[]) => {
      query.insert = args[0];
      return chain;
    },
    update: (...args: unknown[]) => {
      query.update = args[0];
      return chain;
    },
    eq: (...args: unknown[]) => {
      query[`eq_${String(args[0])}`] = args[1];
      if (
        table === "trips" &&
        query.update &&
        args[0] === "id" &&
        args[1] === dbState.trip.id
      ) {
        dbState.trip = {
          ...dbState.trip,
          ...(query.update as Record<string, unknown>),
        };
      }
      if (
        table === "searches" &&
        query.update &&
        dbState.search &&
        args[0] === "id" &&
        args[1] === dbState.search.id
      ) {
        dbState.search = {
          ...dbState.search,
          ...(query.update as Record<string, unknown>),
        };
      }
      return chain;
    },
    is: (...args: unknown[]) => {
      query[`is_${String(args[0])}`] = args[1];
      return chain;
    },
    order: () => chain,
    limit: () => chain,
    upsert: (...args: unknown[]) => {
      query.upsert = args[0];
      return chain;
    },
    single: async () => {
      if (table === "trips") {
        return { data: dbState.trip, error: null };
      }

      if (table === "searches") {
        if (query.insert) {
          dbState.search = {
            id: "search-e2e-1",
            status: "pending",
            progress: {
              orchestrator: "pending",
              hotels: "pending",
              activities: "pending",
              dining: "pending",
              transport: "pending",
              enrichment: "pending",
              aggregator: "pending",
            },
            error_message: null,
            intermediate_results: {},
            json_render_spec: null,
            created_at: "2026-05-01T00:00:00.000Z",
            completed_at: null,
          };
          return { data: { id: dbState.search.id }, error: null };
        }
        dbState.searchSelectCount += 1;
        if (
          dbState.missingIntermediateResultsColumn &&
          String(query.select).includes("intermediate_results")
        ) {
          return {
            data: null,
            error: {
              code: "42703",
              message: "column searches.intermediate_results does not exist",
            },
          };
        }
        return { data: dbState.search, error: null };
      }

      if (table === "workflow_progress") {
        return { data: null, error: null };
      }

      return { data: null, error: null };
    },
  };
  return chain;
}

const supabaseMock = {
  auth: {
    getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
  },
  from: vi.fn((table: string) => createChain(table)),
  rpc: vi.fn(async (fn: string, args: Record<string, unknown>) => {
    dbState.rpcCalls.push({ fn, args });
    if (fn === "merge_intermediate_results" && dbState.search) {
      const key = String(args.p_key);
      const value =
        typeof args.p_value === "string"
          ? JSON.parse(args.p_value)
          : args.p_value;
      dbState.search.intermediate_results = {
        ...dbState.search.intermediate_results,
        [key]: value,
      };
    }
    return { data: null, error: null };
  }),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => supabaseMock),
  createClientFromRequest: vi.fn(async () => supabaseMock),
  getSupabase: vi.fn(() => supabaseMock),
}));

import { POST as postGenerate } from "@/app/api/trips/[id]/generate/route";
import { POST as postStream } from "@/app/api/trips/[id]/stream/route";

describe("Itinerary workflow API e2e", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbState.trip = {
      id: "trip-e2e-1",
      user_id: "user-1",
      status: "draft",
      destination: "Tokyo",
      start_date: "2026-05-10",
      end_date: "2026-05-14",
      travelers: 2,
      budget_tier: "moderate",
      vibes: ["foodie"],
      preferences: {},
      search_id: null,
      itinerary_id: null,
      updated_at: "2026-05-01T00:00:00.000Z",
    };
    dbState.search = null;
    dbState.rpcCalls = [];
    dbState.searchSelectCount = 0;
    dbState.missingIntermediateResultsColumn = false;
  });

  it("runs generate kickoff and exposes progress + spec events over stream", async () => {
    const generateReq = new NextRequest(
      "http://localhost/api/trips/trip-e2e-1/generate",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
    );
    const generateRes = await postGenerate(generateReq, {
      params: Promise.resolve({ id: "trip-e2e-1" }),
    });
    expect(generateRes.status).toBe(200);
    expect(dbState.trip.search_id).toBe("search-e2e-1");
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(dbState.search?.intermediate_results.days).toBeDefined();
    expect(Array.isArray(dbState.search?.intermediate_results.days)).toBe(true);
    expect(
      dbState.rpcCalls.find(
        (call) =>
          call.fn === "merge_intermediate_results" &&
          call.args.p_key === "days",
      )?.args.p_value,
    ).toEqual(dbState.search?.intermediate_results.days);

    dbState.search = {
      ...(dbState.search as SearchRecord),
      status: "completed",
      progress: {
        orchestrator: "done",
        hotels: "done",
        activities: "done",
        dining: "done",
        transport: "done",
        enrichment: "done",
        aggregator: "done",
      },
      intermediate_results: {
        ...(dbState.search as SearchRecord).intermediate_results,
        hotels: [{ id: "h1", name: "Hotel One" }],
        topHotel: { id: "h1", name: "Hotel One" },
        activitiesCount: 6,
        diningCount: 5,
        transportCount: 2,
        days: [{ dayNumber: 1, title: "Day 1", date: "2026-05-10" }],
      },
      json_render_spec: [
        { type: "TripSummary", props: { destination: "Tokyo" } },
        { type: "Section", props: { title: "Your Stay" } },
      ],
      completed_at: "2026-05-01T00:01:00.000Z",
    };

    const streamReq = new NextRequest(
      "http://localhost/api/trips/trip-e2e-1/stream",
      {
        method: "POST",
      },
    );
    const streamRes = await postStream(streamReq, {
      params: Promise.resolve({ id: "trip-e2e-1" }),
    });
    expect(streamRes.status).toBe(200);
    const text = await streamRes.text();
    const events = parseSse(text);
    const eventNames = events.map((e) => e.event);

    expect(eventNames).toContain("spec-block");
    expect(eventNames).toContain("hotels");
    expect(eventNames).toContain("activities");
    expect(eventNames).toContain("dining");
    expect(eventNames).toContain("transport");
    expect(eventNames).toContain("itinerary");
    expect(eventNames).toContain("spec-complete");
    expect(eventNames).toContain("complete");
    expect(
      events.find((event) => event.event === "spec-complete")?.data,
    ).toEqual({
      spec: [
        { type: "TripSummary", props: { destination: "Tokyo" } },
        { type: "Section", props: { title: "Your Stay" } },
      ],
    });
  });

  it("stops polling cleanly when the client disconnects before the first poll", async () => {
    dbState.trip = {
      ...dbState.trip,
      status: "generating",
      search_id: "search-e2e-1",
    };
    dbState.search = {
      id: "search-e2e-1",
      status: "searching",
      progress: {
        orchestrator: "done",
        hotels: "searching",
        activities: "pending",
        dining: "pending",
        transport: "pending",
        enrichment: "pending",
        aggregator: "pending",
      },
      error_message: null,
      intermediate_results: {},
      json_render_spec: null,
      created_at: "2026-05-01T00:00:00.000Z",
      completed_at: null,
    };

    const abortController = new AbortController();
    abortController.abort();
    const streamReq = new NextRequest(
      "http://localhost/api/trips/trip-e2e-1/stream",
      {
        method: "POST",
        signal: abortController.signal,
      },
    );
    const streamRes = await postStream(streamReq, {
      params: Promise.resolve({ id: "trip-e2e-1" }),
    });
    const events = parseSse(await streamRes.text());

    expect(streamRes.status).toBe(200);
    expect(events.map((event) => event.event)).toContain("spec-block");
    expect(events.map((event) => event.event)).not.toContain("complete");
    expect(events.map((event) => event.event)).not.toContain("error");
    expect(dbState.searchSelectCount).toBe(0);
  });

  it("streams an error event when upstream generation fails mid-stream", async () => {
    dbState.trip = {
      ...dbState.trip,
      status: "generating",
      search_id: "search-e2e-1",
    };
    dbState.search = {
      id: "search-e2e-1",
      status: "error",
      progress: {
        orchestrator: "done",
        hotels: "done",
        activities: "searching",
        dining: "pending",
        transport: "pending",
        enrichment: "pending",
        aggregator: "pending",
      },
      error_message: "activities vendor failed",
      intermediate_results: {},
      json_render_spec: null,
      created_at: "2026-05-01T00:00:00.000Z",
      completed_at: null,
    };

    const streamRes = await postStream(
      new NextRequest("http://localhost/api/trips/trip-e2e-1/stream", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "trip-e2e-1" }) },
    );
    const events = parseSse(await streamRes.text());

    expect(events).toContainEqual({
      event: "error",
      data: { message: "activities vendor failed" },
    });
    expect(events.map((event) => event.event)).not.toContain("complete");
  });

  it("streams an error event for malformed partial itinerary output", async () => {
    dbState.trip = {
      ...dbState.trip,
      status: "generating",
      search_id: "search-e2e-1",
    };
    dbState.search = {
      id: "search-e2e-1",
      status: "searching",
      progress: {
        orchestrator: "done",
        hotels: "done",
        activities: "done",
        dining: "done",
        transport: "done",
        enrichment: "done",
        aggregator: "searching",
      },
      error_message: null,
      intermediate_results: {
        days: "not-an-array",
      },
      json_render_spec: null,
      created_at: "2026-05-01T00:00:00.000Z",
      completed_at: null,
    };

    const streamRes = await postStream(
      new NextRequest("http://localhost/api/trips/trip-e2e-1/stream", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "trip-e2e-1" }) },
    );
    const events = parseSse(await streamRes.text());

    expect(events).toContainEqual({
      event: "error",
      data: { message: "Malformed itinerary partial output" },
    });
    expect(events.map((event) => event.event)).not.toContain("complete");
  });

  it("normalizes legacy JSON-stringified itinerary partial output", async () => {
    dbState.trip = {
      ...dbState.trip,
      status: "generated",
      search_id: "search-e2e-1",
    };
    dbState.search = {
      id: "search-e2e-1",
      status: "completed",
      progress: {
        orchestrator: "done",
        hotels: "done",
        activities: "done",
        dining: "done",
        transport: "done",
        enrichment: "done",
        aggregator: "done",
      },
      error_message: null,
      intermediate_results: {
        days: JSON.stringify([
          { dayNumber: 1, title: "Day 1", date: "2026-05-10" },
        ]),
      },
      json_render_spec: [],
      created_at: "2026-05-01T00:00:00.000Z",
      completed_at: "2026-05-01T00:01:00.000Z",
    };

    const streamRes = await postStream(
      new NextRequest("http://localhost/api/trips/trip-e2e-1/stream", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "trip-e2e-1" }) },
    );
    const events = parseSse(await streamRes.text());

    expect(events.find((event) => event.event === "itinerary")?.data).toEqual({
      days: [{ dayNumber: 1, title: "Day 1", date: "2026-05-10" }],
      topHotel: null,
    });
    expect(events.map((event) => event.event)).toContain("complete");
    expect(events.map((event) => event.event)).not.toContain("error");
  });

  it("streams cached spec when reconnecting after a trip is already generated", async () => {
    dbState.trip = {
      ...dbState.trip,
      status: "generated",
      search_id: "search-e2e-1",
    };
    dbState.search = {
      id: "search-e2e-1",
      status: "completed",
      progress: {
        orchestrator: "done",
        hotels: "done",
        activities: "done",
        dining: "done",
        transport: "done",
        enrichment: "done",
        aggregator: "done",
      },
      error_message: null,
      intermediate_results: {
        days: [{ dayNumber: 1, title: "Day 1", date: "2026-05-10" }],
      },
      json_render_spec: [
        { type: "TripSummary", props: { destination: "Tokyo" } },
      ],
      created_at: "2026-05-01T00:00:00.000Z",
      completed_at: "2026-05-01T00:01:00.000Z",
    };

    const streamReq = new NextRequest(
      "http://localhost/api/trips/trip-e2e-1/stream",
      {
        method: "POST",
      },
    );
    const streamRes = await postStream(streamReq, {
      params: Promise.resolve({ id: "trip-e2e-1" }),
    });
    const events = parseSse(await streamRes.text());
    const eventNames = events.map((e) => e.event);

    expect(streamRes.status).toBe(200);
    expect(eventNames).toContain("spec-complete");
    expect(eventNames).toContain("complete");
    expect(
      events.find((event) => event.event === "spec-complete")?.data,
    ).toEqual({
      spec: [{ type: "TripSummary", props: { destination: "Tokyo" } }],
    });
  });

  it("falls back to progress and final spec when intermediate results column is unavailable", async () => {
    dbState.missingIntermediateResultsColumn = true;
    dbState.trip = {
      ...dbState.trip,
      status: "generated",
      search_id: "search-e2e-1",
    };
    dbState.search = {
      id: "search-e2e-1",
      status: "completed",
      progress: {
        orchestrator: "done",
        hotels: "done",
        activities: "done",
        dining: "done",
        transport: "done",
        enrichment: "done",
        aggregator: "done",
      },
      error_message: null,
      intermediate_results: {},
      json_render_spec: [
        { type: "TripSummary", props: { destination: "Tokyo" } },
      ],
      created_at: "2026-05-01T00:00:00.000Z",
      completed_at: "2026-05-01T00:01:00.000Z",
    };

    const streamRes = await postStream(
      new NextRequest("http://localhost/api/trips/trip-e2e-1/stream", {
        method: "POST",
      }),
      { params: Promise.resolve({ id: "trip-e2e-1" }) },
    );
    const events = parseSse(await streamRes.text());
    const eventNames = events.map((event) => event.event);

    expect(streamRes.status).toBe(200);
    expect(eventNames).toContain("progress");
    expect(eventNames).toContain("spec-complete");
    expect(eventNames).toContain("complete");
    expect(eventNames).not.toContain("error");
    expect(dbState.searchSelectCount).toBeGreaterThanOrEqual(2);
  });
});
