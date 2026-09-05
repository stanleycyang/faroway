import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  auth: vi.fn(),
  authenticate: vi.fn(),
}));
vi.mock("@/lib/workflow/runtime", () => ({ startWorkflow: mocks.start }));
vi.mock("@/workflows/plan-trip", () => ({ planTripWorkflow: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClientFromRequest: mocks.authenticate,
  getSupabase: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));
import { POST } from "@/app/api/trips/[id]/generate/route";

const trip = {
  id: "trip-1",
  user_id: "user-1",
  destination: "Tokyo",
  start_date: "2026-12-01",
  end_date: "2026-12-03",
  status: "draft",
  travelers: 2,
  budget_tier: "moderate",
  vibes: ["foodie"],
  search_id: null,
  updated_at: "2026-09-04T10:00:00Z",
  preferences: {
    travelerType: "family",
    originCity: "San Francisco",
    originAirport: "SFO",
  },
};
function request(body: unknown = {}, key?: string) {
  return new NextRequest("http://localhost/api/trips/trip-1/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer mobile-token",
      ...(key ? { "Idempotency-Key": key } : {}),
    },
    body: JSON.stringify(body),
  });
}
const call = (req = request()) =>
  POST(req, { params: Promise.resolve({ id: "trip-1" }) });

describe("POST trip generation transaction contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.start.mockResolvedValue({ runId: "runtime-1" });
    mocks.authenticate.mockResolvedValue({ auth: { getUser: mocks.auth } });
    mocks.auth.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const chain = {
      select: () => chain,
      eq: () => chain,
      single: async () => ({ data: trip, error: null }),
    };
    mocks.from.mockReturnValue(chain);
    mocks.rpc.mockImplementation(async (name) => ({
      data:
        name === "begin_trip_generation"
          ? { outcome: "created", searchId: "search-1", status: "pending" }
          : true,
      error: null,
    }));
  });

  it("preserves bearer/cookie request authentication and server-owned input", async () => {
    const req = request(
      { destination: "Untrusted destination" },
      "stable-request",
    );
    const response = await call(req);
    expect(response.status).toBe(200);
    expect(mocks.authenticate).toHaveBeenCalledWith(req);
    expect(mocks.start).toHaveBeenCalledWith(expect.any(Function), [
      expect.objectContaining({
        destination: "Tokyo",
        travelerType: "family",
        originCity: "San Francisco",
        originAirport: "SFO",
        vibes: ["foodie"],
        searchId: "search-1",
        userId: "user-1",
      }),
    ]);
  });

  it("commits preview, ownership, request identity and version through one RPC", async () => {
    const response = await call(request({}, "stable-request"));
    expect(await response.json()).toMatchObject({
      workflowId: "search-1",
      searchId: "search-1",
      statusUrl: "/api/workflows/search-1/status",
      streamUrl: "/api/trips/trip-1/stream",
    });
    expect(mocks.rpc).toHaveBeenCalledOnce();
    expect(mocks.rpc).toHaveBeenCalledWith(
      "begin_trip_generation",
      expect.objectContaining({
        p_trip_id: "trip-1",
        p_user_id: "user-1",
        p_request_key: "stable-request",
        p_expected_updated_at: trip.updated_at,
        p_preview: expect.any(Array),
        p_rate_limit_key: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });

  it.each(["pending", "completed", "error"])(
    "does not restart a replayed %s attempt",
    async (status) => {
      mocks.rpc.mockResolvedValueOnce({
        data: { outcome: "replayed", searchId: "original-search", status },
        error: null,
      });
      const response = await call(request({}, "stable-request"));
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        searchId: "original-search",
        replayed: true,
        status,
      });
      expect(mocks.start).not.toHaveBeenCalled();
    },
  );

  it.each([
    [{ outcome: "in_progress", searchId: "running-search" }, 409],
    [{ outcome: "key_conflict" }, 409],
    [{ outcome: "trip_changed" }, 409],
    [{ outcome: "not_found" }, 404],
    [{ outcome: "rate_limited", retryAfter: 120 }, 429],
  ])("does not dispatch rejected claims: %j", async (claim, status) => {
    mocks.rpc.mockResolvedValueOnce({ data: claim, error: null });
    const response = await call();
    expect(response.status).toBe(status);
    if (status === 429) expect(response.headers.get("Retry-After")).toBe("120");
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("does not start untracked work when the transaction fails", async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "database unavailable" },
    });
    expect((await call()).status).toBe(500);
    expect(mocks.start).not.toHaveBeenCalled();
  });

  it("fences a failed or ambiguous dispatch without losing the public run identity", async () => {
    mocks.start.mockRejectedValueOnce(new Error("runtime unavailable"));
    const response = await call();
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      tripId: "trip-1",
      searchId: "search-1",
      workflowId: "search-1",
    });
    expect(mocks.rpc).toHaveBeenLastCalledWith("fail_trip_generation", {
      p_trip_id: "trip-1",
      p_search_id: "search-1",
    });
  });

  it.each([null, [], { preferences: [] }])(
    "rejects malformed request envelopes",
    async (body) => {
      expect((await call(request(body))).status).toBe(400);
      expect(mocks.start).not.toHaveBeenCalled();
    },
  );

  it("rejects an invalid idempotency key before claiming a generation", async () => {
    expect((await call(request({}, "invalid key"))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
