import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { stampPlanItems, planItems } from "@/lib/trips/plan-edits";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  trip: vi.fn(),
  history: vi.fn(),
  eq: vi.fn(),
}));
vi.mock("@/lib/auth/middleware", () => ({
  requireUserIdFromRequest: mocks.auth,
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));
import { GET, POST } from "@/app/api/trips/[id]/plan/route";
const id = "00000000-0000-4000-8000-000000000001";
const version = "2026-10-03T00:00:00.000Z";
const days = [
  {
    date: "2099-06-01",
    morning: { activities: [{ name: "Walk" }] },
    afternoon: { activities: [{ name: "Museum" }] },
  },
];
const items = planItems(stampPlanItems(id, days), []);
const input = {
  requestId: "00000000-0000-4000-8000-000000000002",
  expectedUpdatedAt: version,
  expectedPlanRevision: null,
  action: "swap",
  itemId: items[0].id,
  otherItemId: items[1].id,
};
const context = { params: Promise.resolve({ id }) };
const request = (body = input) =>
  new NextRequest(`http://localhost/api/trips/${id}/plan`, {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("FAROWAY_PLAN_EDITING_ENABLED", "true");
  mocks.auth.mockResolvedValue({ userId: "owner" });
  mocks.trip.mockResolvedValue({
    data: {
      id,
      status: "planned",
      updated_at: version,
      plan_revision_id: null,
      preferences: {},
      itineraries: { days },
    },
    error: null,
  });
  mocks.history.mockResolvedValue({ data: [], error: null });
  mocks.rpc.mockResolvedValue({ data: { state: "applied" }, error: null });
  const chain = {
    select: vi.fn(),
    eq: mocks.eq,
    order: vi.fn(),
    limit: mocks.history,
    single: mocks.trip,
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  mocks.from.mockReturnValue(chain);
});
afterEach(() => vi.unstubAllEnvs());
describe("owned revision-safe plan editing", () => {
  it("stays unavailable until the migration rollout is explicitly enabled", async () => {
    vi.stubEnv("FAROWAY_PLAN_EDITING_ENABLED", "false");
    expect((await POST(request(), context)).status).toBe(503);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("scopes reads to the owner and publishes only a server-computed change", async () => {
    expect((await POST(request(), context)).status).toBe(200);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(mocks.rpc).toHaveBeenCalledWith(
      "edit_trip_plan",
      expect.objectContaining({
        p_trip_id: id,
        p_user_id: "owner",
        p_command: input,
      }),
    );
    const args = mocks.rpc.mock.calls[0][1];
    expect(args.p_days[0].morning.activities[0].name).toBe("Museum");
  });
  it("requires authentication and rejects a missing/foreign trip", async () => {
    mocks.auth.mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    expect((await POST(request(), context)).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
    mocks.trip.mockResolvedValue({ data: null, error: null });
    expect((await POST(request(), context)).status).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("rejects edits after another device or generation changed the observed trip", async () => {
    expect(
      (
        await POST(
          request({ ...input, expectedUpdatedAt: "2026-10-02T00:00:00.000Z" }),
          context,
        )
      ).status,
    ).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.trip.mockResolvedValue({
      data: {
        status: "generating",
        updated_at: version,
        itineraries: { days },
      },
      error: null,
    });
    expect((await POST(request(), context)).status).toBe(409);
  });
  it("does not persist a new history copy of unavailable provider content", async () => {
    vi.stubEnv("VIATOR_CONTENT_ENABLED", "false");
    const providerDays = structuredClone(days);
    Object.assign(providerDays[0].afternoon.activities[0], {
      source: "viator",
    });
    mocks.trip.mockResolvedValue({
      data: {
        status: "planned",
        updated_at: version,
        plan_revision_id: null,
        itineraries: { days: providerDays },
      },
      error: null,
    });
    expect((await POST(request(), context)).status).toBe(409);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect((await (await GET(request(), context)).json()).editable).toBe(false);
  });
  it("reports a publication race instead of overwriting a newer plan", async () => {
    mocks.rpc.mockResolvedValue({ data: { state: "conflict" }, error: null });
    expect((await POST(request(), context)).status).toBe(409);
  });
  it("sends an interrupted exact replay to the database for identity verification", async () => {
    mocks.history.mockResolvedValue({
      data: [{ request_id: input.requestId }],
      error: null,
    });
    mocks.trip.mockResolvedValue({
      data: {
        status: "planned",
        updated_at: "2026-10-04T00:00:00Z",
        itineraries: { days },
      },
      error: null,
    });
    mocks.rpc.mockResolvedValue({ data: { state: "replayed" }, error: null });
    expect((await POST(request(), context)).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it("fails closed when history or persistence is unavailable", async () => {
    mocks.history.mockResolvedValueOnce({
      data: null,
      error: { message: "Unavailable" },
    });
    expect((await GET(request(), context)).status).toBe(503);
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "lost reply" },
    });
    expect((await POST(request(), context)).status).toBe(503);
  });
});
