import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const startMock = vi.fn();

vi.mock("workflow/api", () => ({
  start: (...args: unknown[]) => startMock(...args),
}));

vi.mock("@/workflows/plan-trip", () => ({
  planTripWorkflow: vi.fn(async () => ({})),
}));

type QueryMode = "trip_select" | "search_insert" | "trip_update";

let mode: QueryMode | null = null;
let tripStatus: "draft" | "generating" = "draft";
const rpcMock = vi.fn(async () => ({ data: null, error: null }));

function createTableChain(table: string) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => {
    if (table === "trips") mode = "trip_select";
    return chain;
  });
  chain.insert = vi.fn(() => {
    if (table === "searches") mode = "search_insert";
    return chain;
  });
  chain.update = vi.fn(() => {
    if (table === "trips") mode = "trip_update";
    return chain;
  });
  chain.eq = vi.fn(() => chain);
  chain.is = vi.fn(() => chain);
  chain.single = vi.fn(async () => {
    if (mode === "trip_select") {
      return {
        data: {
          id: "trip-1",
          destination: "Tokyo",
          start_date: "2026-05-01",
          end_date: "2026-05-05",
          status: tripStatus,
          travelers: 2,
          budget_tier: "moderate",
          vibes: ["foodie"],
          preferences: {
            travelerType: "family",
            originCity: "San Francisco",
            originAirport: "SFO",
          },
          user_id: "user-1",
          search_id: null,
        },
        error: null,
      };
    }
    if (mode === "search_insert") {
      return { data: { id: "search-1" }, error: null };
    }
    return { data: null, error: null };
  });
  return chain;
}

const supabaseMock = {
  auth: {
    getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
  },
  from: vi.fn((table: string) => createTableChain(table)),
  rpc: rpcMock,
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => supabaseMock),
  createClientFromRequest: vi.fn(async () => supabaseMock),
  getSupabase: vi.fn(() => supabaseMock),
}));

import { POST } from "@/app/api/trips/[id]/generate/route";

function makeReq(body: Record<string, unknown> = {}) {
  return new NextRequest("http://localhost:3000/api/trips/trip-1/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/trips/[id]/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mode = null;
    tripStatus = "draft";
    startMock.mockResolvedValue({ runId: "run-1" });
  });

  it("starts durable workflow and seeds preview results", async () => {
    const res = await POST(makeReq(), {
      params: Promise.resolve({ id: "trip-1" }),
    });
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(startMock).toHaveBeenCalledWith(expect.any(Function), [
      expect.objectContaining({
        travelerType: "family",
        originCity: "San Francisco",
        originAirport: "SFO",
        vibes: ["foodie"],
      }),
    ]);
    expect(rpcMock).toHaveBeenCalledWith(
      "merge_intermediate_results",
      expect.objectContaining({ p_search_id: "search-1", p_key: "days" }),
    );
    expect(rpcMock).toHaveBeenCalledWith(
      "merge_intermediate_results",
      expect.objectContaining({
        p_search_id: "search-1",
        p_key: "previewReady",
      }),
    );
    const rpcCalls = rpcMock.mock.calls as unknown as Array<
      [string, Record<string, unknown>]
    >;
    const daysRpcArgs = rpcCalls.find(
      ([fn, args]) =>
        fn === "merge_intermediate_results" && args.p_key === "days",
    )?.[1];
    const previewReadyRpcArgs = rpcCalls.find(
      ([fn, args]) =>
        fn === "merge_intermediate_results" && args.p_key === "previewReady",
    )?.[1];
    expect(Array.isArray(daysRpcArgs?.p_value)).toBe(true);
    expect(previewReadyRpcArgs?.p_value).toBe(true);
  });

  it("returns conflict when generation already running", async () => {
    tripStatus = "generating";
    const res = await POST(makeReq(), {
      params: Promise.resolve({ id: "trip-1" }),
    });
    expect(res.status).toBe(409);
    expect(startMock).not.toHaveBeenCalled();
  });
});
