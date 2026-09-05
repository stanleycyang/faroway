import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  orchestrate: vi.fn(),
  rateLimit: vi.fn(),
}));
vi.mock("@/lib/workflow/runtime", () => ({
  startWorkflow: mocks.start,
  createFatalWorkflowError: (message: string) => new Error(message),
}));
vi.mock("@/lib/security/rate-limit", () => ({
  getRateLimitBucketKey: () => "a".repeat(64),
}));
vi.mock("@/lib/search/agents/orchestrator", () => ({
  runOrchestratorAgent: mocks.orchestrate,
}));
vi.mock("@/lib/search/agents/hotels", () => ({
  runHotelsAgent: async () => [],
}));
vi.mock("@/lib/search/agents/activities", () => ({
  runActivitiesAgent: async () => [],
}));
vi.mock("@/lib/search/agents/dining", () => ({
  runDiningAgent: async () => [],
}));
vi.mock("@/lib/search/agents/transport", () => ({
  runTransportAgent: async () => [],
}));
vi.mock("@/lib/search/enrichment", () => ({
  runSearchEnrichment: async () => ({ activities: [], dining: [], notes: [] }),
}));
vi.mock("@/lib/search/agents/aggregator", () => ({
  runAggregatorAgent: async () => ({ days: [] }),
}));
vi.mock("@/lib/search/bridge", () => ({
  mapSearchResultsToItinerary: () => ({
    hotels: [],
    activities: [],
    dining: [],
    transport: [],
    days: [],
    currency: "USD",
    totalEstimatedCost: 0,
  }),
}));
vi.mock("@/lib/json-render/build-spec", () => ({
  buildJsonRenderSpec: () => ({}),
}));

type Row = Record<string, unknown>;
let tables: Record<string, Row[]>;
let userId: string | null;
let failedWrite: string | undefined;
const tripId = "11111111-1111-4111-8111-111111111111";

// Stateful database boundary: both real routes and the real workflow see the
// same persisted rows. Filters apply before writes, including ownership/id.
function query(table: string) {
  let action = "select";
  let values: Row = {};
  const filters: Array<[string, unknown]> = [];
  let single = false;
  const execute = () => {
    if (`${table}:${action}` === failedWrite)
      return { data: null, error: { message: "storage unavailable" } };
    const rows = (tables[table] ??= []);
    let matched = rows.filter((row) =>
      filters.every(([key, value]) => row[key] === value),
    );
    if (action === "insert") {
      const row = {
        id: `${table}-1`,
        started_at: new Date().toISOString(),
        ...values,
      };
      rows.push(row);
      matched = [row];
    } else if (action === "upsert") {
      const existing = rows.find((row) => row.trip_id === values.trip_id);
      if (existing) Object.assign(existing, values);
      else rows.push({ ...values });
    } else if (action === "update")
      matched.forEach((row) => Object.assign(row, values));
    return { data: single ? (matched[0] ?? null) : matched, error: null };
  };
  const chain = {
    select: () => chain,
    insert: (value: Row) => {
      action = "insert";
      values = value;
      return chain;
    },
    update: (value: Row) => {
      action = "update";
      values = value;
      return chain;
    },
    upsert: (value: Row) => {
      action = "upsert";
      values = value;
      return chain;
    },
    eq: (key: string, value: unknown) => {
      filters.push([key, value]);
      return chain;
    },
    order: () => chain,
    limit: () => chain,
    single: () => {
      single = true;
      return Promise.resolve(execute());
    },
    then: (resolve: (value: ReturnType<typeof execute>) => unknown) =>
      Promise.resolve(execute()).then(resolve),
  };
  return chain;
}
const db = {
  from: query,
  rpc: async (name: string, args: Row) => {
    const trip = tables.trips?.find((row) => row.id === args.p_trip_id);
    const search = tables.searches?.find((row) => row.id === args.p_search_id);
    const run = tables.workflow_runs?.find(
      (row) => row.id === args.p_search_id,
    );
    const active =
      trip?.search_id === args.p_search_id && trip?.status === "generating";
    if (name === "begin_trip_generation") {
      if (trip?.status === "generating")
        return {
          data: { outcome: "in_progress", searchId: trip.search_id ?? null },
          error: null,
        };
      const limit = await mocks.rateLimit();
      if (!limit.allowed)
        return {
          data: {
            outcome: "rate_limited",
            retryAfter: Math.ceil(limit.resetIn / 1000),
          },
          error: null,
        };
      if (failedWrite === "workflow_runs:insert")
        return { data: null, error: { message: "storage unavailable" } };
      const searchId = `searches-${(tables.searches?.length ?? 0) + 1}`;
      (tables.searches ??= []).push({
        id: searchId,
        status: "pending",
        intermediate_results: { days: args.p_preview, previewReady: true },
      });
      (tables.workflow_runs ??= []).push({
        id: searchId,
        trip_id: trip!.id,
        user_id: userId,
        status: "running",
      });
      Object.assign(trip!, { status: "generating", search_id: searchId });
      return {
        data: { outcome: "created", searchId, status: "pending" },
        error: null,
      };
    }
    if (name === "advance_trip_generation") {
      if (
        !active ||
        !search ||
        !["pending", "searching"].includes(String(search.status))
      )
        return { data: false, error: null };
      Object.assign(search, { status: "searching", progress: args.p_progress });
      tables.workflow_progress = [
        {
          trip_id: trip!.id,
          step: args.p_step,
          progress: args.p_percent,
          message: args.p_message,
        },
      ];
      return { data: true, error: null };
    }
    if (name === "fail_trip_generation") {
      if (!search || !["pending", "searching"].includes(String(search.status)))
        return { data: false, error: null };
      Object.assign(search, { status: "error" });
      if (run)
        Object.assign(run, {
          status: "failed",
          error_message: "Generation failed",
          completed_at: new Date().toISOString(),
        });
      if (active) {
        trip!.status = "failed";
        tables.workflow_progress = [
          {
            trip_id: trip!.id,
            step: "error",
            progress: 0,
            message: "Generation failed",
          },
        ];
      }
      return { data: active, error: null };
    }
    if (name === "complete_trip_generation") {
      if (!active) return { data: false, error: null };
      if (failedWrite === "itineraries:insert")
        return { data: null, error: { message: "storage unavailable" } };
      tables.itineraries = [
        {
          id: "itineraries-1",
          trip_id: trip!.id,
          ...(args.p_itinerary as Row),
        },
      ];
      Object.assign(trip!, {
        status: "planned",
        itinerary_id: "itineraries-1",
      });
      Object.assign(search!, {
        status: "completed",
        json_render_spec: args.p_spec,
      });
      Object.assign(run!, {
        status: "completed",
        completed_at: new Date().toISOString(),
      });
      tables.workflow_progress = [
        {
          trip_id: trip!.id,
          step: "complete",
          progress: 100,
          message: "Ready",
        },
      ];
      return { data: true, error: null };
    }
    return { data: null, error: null };
  },
  auth: {
    getUser: async () => ({
      data: { user: userId ? { id: userId } : null },
      error: null,
    }),
  },
};
vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => db,
  createClientFromRequest: async () => db,
}));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => db }));

import { POST } from "@/app/api/workflows/generate-itinerary/route";
import { GET } from "@/app/api/workflows/[workflowId]/status/route";
import { planTripWorkflow } from "@/workflows/plan-trip";

function start() {
  return POST(
    new NextRequest("http://localhost/api/workflows/generate-itinerary", {
      method: "POST",
      body: JSON.stringify({
        tripId,
        destination: "Untrusted client destination",
      }),
    }),
  );
}
async function poll(workflowId: string) {
  return GET(
    new NextRequest(`http://localhost/api/workflows/${workflowId}/status`),
    { params: Promise.resolve({ workflowId }) },
  );
}

describe("legacy workflow polling across real generation handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userId = "user-1";
    failedWrite = undefined;
    tables = {
      trips: [
        {
          id: tripId,
          user_id: userId,
          destination: "Tokyo",
          start_date: "2026-12-01",
          end_date: "2026-12-03",
          travelers: 2,
          status: "draft",
          preferences: {},
        },
      ],
    };
    mocks.start.mockResolvedValue({ runId: "runtime-1" });
    mocks.rateLimit.mockResolvedValue({ allowed: true });
    mocks.orchestrate.mockResolvedValue({
      destination: "Tokyo",
      dates: { start: "2026-12-01", end: "2026-12-03", nights: 2 },
    });
  });

  it.each(["completed", "failed"])(
    "tracks a single generation from running to %s",
    async (outcome) => {
      const response = await start();
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.workflowId).toEqual(expect.any(String));
      expect(body.statusUrl).toBe(`/api/workflows/${body.workflowId}/status`);
      expect(mocks.start).toHaveBeenCalledOnce();
      expect(tables.workflow_runs).toHaveLength(1);
      expect(await (await poll(body.workflowId)).json()).toMatchObject({
        workflowId: body.workflowId,
        tripId,
        status: "running",
      });
      // An old active row must not be completed by a later generation of the trip.
      tables.workflow_runs.push({
        id: "older-run",
        trip_id: tripId,
        user_id: userId,
        status: "running",
      });
      if (outcome === "failed")
        mocks.orchestrate.mockRejectedValue(
          new Error("Provider secret-token failure"),
        );
      const [workflow, args] = mocks.start.mock.calls[0] as [
        typeof planTripWorkflow,
        Parameters<typeof planTripWorkflow>,
      ];
      expect(args[0].destination).toBe("Tokyo");
      await workflow(...args);
      const result = await (await poll(body.workflowId)).json();
      expect(result).toMatchObject({
        workflowId: body.workflowId,
        tripId,
        status: outcome,
        completedAt: expect.any(String),
      });
      if (outcome === "completed")
        expect(result.result).toEqual({ itineraryId: "itineraries-1" });
      else expect(result.result.error).toEqual(expect.any(String));
      expect(JSON.stringify(result)).not.toContain("secret-token");
      expect(
        tables.workflow_runs.find((row) => row.id === "older-run")?.status,
      ).toBe("running");
      userId = "another-user";
      expect((await poll(body.workflowId)).status).toBe(404);
    },
  );

  it("does not start untrackable work when tracking persistence fails", async () => {
    failedWrite = "workflow_runs:insert";
    expect((await start()).status).toBe(500);
    expect(mocks.start).not.toHaveBeenCalled();
    expect(tables.trips[0].status).toBe("draft");
    expect(tables.searches ?? []).toHaveLength(0);
  });

  it("finishes tracking when workflow startup fails", async () => {
    mocks.start.mockRejectedValue(new Error("runtime unavailable"));
    expect((await start()).status).toBe(500);
    expect(tables.workflow_runs[0]).toMatchObject({
      status: "failed",
      completed_at: expect.any(String),
    });
  });

  it("does not report completion without a persisted itinerary", async () => {
    const body = await (await start()).json();
    failedWrite = "itineraries:insert";
    const [workflow, args] = mocks.start.mock.calls[0] as [
      typeof planTripWorkflow,
      Parameters<typeof planTripWorkflow>,
    ];
    await workflow(...args);
    expect(await (await poll(body.workflowId)).json()).toMatchObject({
      status: "failed",
    });
  });

  it("preserves auth, ownership, rate limits, and conflict responses", async () => {
    userId = null;
    expect((await start()).status).toBe(401);
    userId = "another-user";
    expect((await start()).status).toBe(404);
    userId = "user-1";
    mocks.rateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 1000 });
    const limited = await start();
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("1");
    tables.trips[0].status = "generating";
    expect((await start()).status).toBe(409);
    expect(mocks.start).not.toHaveBeenCalled();
  });
});
