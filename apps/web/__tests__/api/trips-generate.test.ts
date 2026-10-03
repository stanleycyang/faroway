import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const startMock = vi.fn();

vi.mock("@/lib/workflow/runtime", () => ({
  startWorkflow: (...args: unknown[]) => startMock(...args),
}));

vi.mock("@/workflows/plan-trip", () => ({
  planTripWorkflow: vi.fn(async () => ({})),
}));

let tripStatus = "draft";
let activeSearch: string | null = null;
let searchCount = 0;
let claimFails = false;
let claimReplyLost = false;
const deletedSearches: string[] = [];
const rpcMock = vi.fn(async () => ({ data: null, error: null }));
vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimitAsync: vi.fn(async () => ({ allowed: true })),
}));

function createTableChain(table: string) {
  let operation = "select";
  let values: Record<string, unknown> = {};
  const filters: Record<string, unknown> = {};
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.insert = vi.fn((input) => {
    operation = "insert";
    values = input;
    return chain;
  });
  chain.update = vi.fn((input) => {
    operation = "update";
    values = input;
    return chain;
  });
  chain.delete = vi.fn(() => {
    operation = "delete";
    return chain;
  });
  chain.eq = chain.is = vi.fn((key, value) => {
    filters[key] = value;
    return chain;
  });
  const execute = () => {
    if (table === "trips" && operation === "select")
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
          search_id: activeSearch,
        },
        error: null,
      };
    if (table === "trips" && operation === "update") {
      if (claimFails)
        return { data: null, error: { message: "database unavailable" } };
      if (
        filters.status !== tripStatus ||
        filters.search_id !== activeSearch ||
        filters.user_id !== "user-1"
      )
        return { data: null, error: null };
      tripStatus = String(values.status);
      activeSearch = String(values.search_id);
      if (claimReplyLost)
        return { data: null, error: { message: "reply lost after commit" } };
      return { data: { id: "trip-1" }, error: null };
    }
    if (table === "searches" && operation === "insert")
      return { data: { id: `search-${++searchCount}` }, error: null };
    if (table === "searches" && operation === "delete")
      deletedSearches.push(String(filters.id));
    return { data: null, error: null };
  };
  chain.single = chain.maybeSingle = vi.fn(async () => execute());
  chain.then = vi.fn((resolve: (value: unknown) => unknown) =>
    Promise.resolve(execute()).then(resolve),
  );
  return chain;
}

const supabaseMock = {
  auth: {
    getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
  },
  from: vi.fn((table: string) => createTableChain(table)),
  rpc: rpcMock,
};

const createClientFromRequestMock = vi.fn(async (request: unknown) => {
  void request;
  return supabaseMock;
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => supabaseMock),
  createClientFromRequest: (request: unknown) =>
    createClientFromRequestMock(request),
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
    activeSearch = null;
    searchCount = 0;
    claimFails = false;
    claimReplyLost = false;
    deletedSearches.length = 0;
    tripStatus = "draft";
    startMock.mockResolvedValue({ runId: "run-1" });
  });

  it("routes auth through createClientFromRequest so bearer-token mobile clients work", async () => {
    // Regression guard: this route must invoke createClientFromRequest(request)
    // so the Authorization header from mobile is honored. Cookie-only
    // createClient() would silently reject the mobile app with a 401.
    const req = new NextRequest(
      "http://localhost:3000/api/trips/trip-1/generate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer mobile-token",
        },
        body: JSON.stringify({}),
      },
    );
    await POST(req, { params: Promise.resolve({ id: "trip-1" }) });

    // Don't assert on response status — the workflow-runtime require() path
    // isn't mockable from here. The only thing this test guards is that the
    // request was forwarded to createClientFromRequest at all.
    expect(createClientFromRequestMock).toHaveBeenCalledWith(req);
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

  it("starts only one workflow when concurrent requests read the same draft", async () => {
    const responses = await Promise.all([
      POST(makeReq(), { params: Promise.resolve({ id: "trip-1" }) }),
      POST(makeReq(), { params: Promise.resolve({ id: "trip-1" }) }),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(deletedSearches).toHaveLength(1);
  });
  it("does not dispatch when claiming the trip fails", async () => {
    claimFails = true;
    expect(
      (await POST(makeReq(), { params: Promise.resolve({ id: "trip-1" }) }))
        .status,
    ).toBe(503);
    expect(startMock).not.toHaveBeenCalled();
    expect(deletedSearches).toEqual([]);
  });
  it("reads back a committed claim after a lost DB reply without deleting or dispatching twice", async () => {
    claimReplyLost = true;
    expect(
      (await POST(makeReq(), { params: Promise.resolve({ id: "trip-1" }) }))
        .status,
    ).toBe(200);
    expect(activeSearch).toBe("search-1");
    expect(deletedSearches).toEqual([]);
    expect(
      (await POST(makeReq(), { params: Promise.resolve({ id: "trip-1" }) }))
        .status,
    ).toBe(409);
    expect(startMock).toHaveBeenCalledTimes(1);
  });
  it("cannot race a retired legacy request into a second workflow", async () => {
    const { POST: legacyPost } =
      await import("@/app/api/workflows/generate-itinerary/route");
    const responses = await Promise.all([
      POST(makeReq(), { params: Promise.resolve({ id: "trip-1" }) }),
      legacyPost(
        new NextRequest("http://localhost/api/workflows/generate-itinerary", {
          method: "POST",
          body: JSON.stringify({
            tripId: "00000000-0000-4000-8000-000000000001",
          }),
        }),
      ),
    ]);
    expect(responses.map((r) => r.status)).toEqual([200, 410]);
    expect(startMock).toHaveBeenCalledTimes(1);
  });
  it("preserves an ambiguous startup claim instead of launching twice", async () => {
    startMock.mockRejectedValueOnce(new Error("reply lost"));
    expect(
      (await POST(makeReq(), { params: Promise.resolve({ id: "trip-1" }) }))
        .status,
    ).toBe(500);
    expect(tripStatus).toBe("generating");
    expect(
      (await POST(makeReq(), { params: Promise.resolve({ id: "trip-1" }) }))
        .status,
    ).toBe(409);
    expect(startMock).toHaveBeenCalledTimes(1);
  });
  it("reuses an already completed trip rather than regenerating on replay", async () => {
    tripStatus = "planned";
    expect(
      (await POST(makeReq(), { params: Promise.resolve({ id: "trip-1" }) }))
        .status,
    ).toBe(200);
    expect(startMock).not.toHaveBeenCalled();
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
