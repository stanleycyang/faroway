import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  limit: vi.fn(),
  rpc: vi.fn(),
  result: vi.fn(),
}));
vi.mock("@/lib/auth/middleware", () => ({
  requireUserIdFromRequest: mocks.auth,
}));
vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimitAsync: mocks.limit,
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => ({ rpc: mocks.rpc }),
}));
import { GET, POST } from "@/app/api/trips/[id]/venue-evidence/route";
const revision = "2026-10-28T00:00:00Z";
const input = {
  evidenceRevision: "a".repeat(64),
  venueId: "venue",
  requirement: "allergy",
  status: "confirmed",
  note: "Spoke with the chef",
};
const row = {
  trip_id: "trip",
  user_id: "owner",
  venue_id: "venue",
  requirement: "allergy",
  status: "confirmed",
  note: input.note,
  observed_at: revision,
  evidence_revision: "a".repeat(64),
};
const post = (body: unknown) =>
  POST(
    new NextRequest("http://localhost/api/trips/trip/venue-evidence", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "trip" }) },
  );
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ userId: "owner" });
  mocks.limit.mockResolvedValue({ allowed: true });
  mocks.rpc.mockReturnValue({ maybeSingle: mocks.result });
  mocks.result.mockResolvedValue({ data: row, error: null });
});
it("uses authenticated ownership and the exact plan context", async () => {
  const response = await post(input);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(mocks.rpc).toHaveBeenCalledWith(
    "save_trip_venue_evidence_v2",
    expect.objectContaining({
      p_user_id: "owner",
      p_evidence_revision: "a".repeat(64),
    }),
  );
  expect((await response.json()).evidence.user_id).toBeUndefined();
});
it.each([
  { ...input, note: " " },
  { ...input, userId: "other" },
  { ...input, status: "verified" },
])("rejects invalid confirmations (%j)", async (body) => {
  expect((await post(body)).status).toBe(400);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it.each([
  ["40001", 409],
  ["22023", 400],
])("returns database conflict %s", async (code, status) => {
  mocks.result.mockResolvedValue({ data: null, error: { code } });
  expect((await post(input)).status).toBe(status);
});
it.each([
  { user_id: "other" },
  { evidence_revision: "b".repeat(64) },
  { venue_id: "other" },
  { status: "unknown" },
])("never acknowledges a mismatched save (%j)", async (patch) => {
  mocks.result.mockResolvedValue({ data: { ...row, ...patch }, error: null });
  expect((await post(input)).status).toBe(503);
});
it("requires authentication before any write", async () => {
  mocks.auth.mockResolvedValue(NextResponse.json({}, { status: 401 }));
  expect((await post(input)).status).toBe(401);
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("fails closed when rate limited", async () => {
  mocks.limit.mockResolvedValue({ allowed: false });
  expect((await post(input)).status).toBe(429);
  expect(mocks.rpc).not.toHaveBeenCalled();
});

it.each(["2026-10-28T01:00:00Z", "2026-10-28T02:00:00Z"])(
  "reads reports across sharing-only trip versions %s",
  async (tripRevision) => {
    const { trip_id: _trip, user_id: _owner, ...evidence } = row;
    void _trip;
    void _owner;
    mocks.rpc.mockResolvedValue({
      data: {
        tripRevision,
        evidenceRevision: "a".repeat(64),
        evidence: [evidence],
      },
      error: null,
    });
    const response = await GET(
      new NextRequest("http://localhost/api/trips/trip/venue-evidence"),
      { params: Promise.resolve({ id: "trip" }) },
    );
    expect(response.status).toBe(200);
    expect((await response.json()).evidence).toEqual([evidence]);
    expect(mocks.rpc).toHaveBeenCalledWith("read_trip_venue_evidence", {
      p_trip_id: "trip",
      p_user_id: "owner",
      p_expected_trip_revision: null,
    });
  },
);
it("rejects a mixed-context read", async () => {
  mocks.rpc.mockResolvedValue({
    data: {
      tripRevision: revision,
      evidenceRevision: "b".repeat(64),
      evidence: [row],
    },
    error: null,
  });
  const response = await GET(
    new NextRequest("http://localhost/api/trips/trip/venue-evidence"),
    { params: Promise.resolve({ id: "trip" }) },
  );
  expect(response.status).toBe(503);
});

it("checks the displayed trip revision atomically before returning reports", async () => {
  mocks.rpc.mockResolvedValue({ data: null, error: { code: "40001" } });
  const response = await GET(
    new NextRequest(
      `http://localhost/api/trips/trip/venue-evidence?tripRevision=${encodeURIComponent(revision)}`,
    ),
    { params: Promise.resolve({ id: "trip" }) },
  );
  expect(response.status).toBe(409);
  expect(mocks.rpc).toHaveBeenCalledWith("read_trip_venue_evidence", {
    p_trip_id: "trip",
    p_user_id: "owner",
    p_expected_trip_revision: revision,
  });
});
