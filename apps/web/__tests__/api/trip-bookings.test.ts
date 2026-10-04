import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { planItems, stampPlanItems } from "@/lib/trips/plan-edits";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  trip: vi.fn(),
  eq: vi.fn(),
  read: vi.fn(),
  save: vi.fn(),
}));
vi.mock("@/lib/auth/middleware", () => ({
  requireUserIdFromRequest: mocks.auth,
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => ({ from: mocks.from, rpc: mocks.rpc }),
}));
import { GET, POST } from "@/app/api/trips/[id]/bookings/route";
const id = "00000000-0000-4000-8000-000000000001";
const generationId = "00000000-0000-4000-8000-000000000003";
const revision = "2026-10-03T00:00:00.000Z";
const days = [
  { date: "2099-06-01", morning: { activities: [{ name: "Walk" }] } },
];
const item = planItems(stampPlanItems(id, days), [])[0];
const trip = {
  id,
  status: "planned",
  updated_at: revision,
  preferences: {},
  itineraries: { id, days, booking_generation_id: generationId },
};
const command = {
  requestId: "00000000-0000-4000-8000-000000000002",
  expectedUpdatedAt: revision,
  generationId,
  itemId: item.id,
  expectedReportId: null,
  status: "traveler_booked",
};
const context = { params: Promise.resolve({ id }) };
const request = (body: unknown = command) =>
  new NextRequest(`http://localhost/api/trips/${id}/bookings`, {
    method: "POST",
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("FAROWAY_BOOKING_CHECKLIST_ENABLED", "true");
  mocks.auth.mockResolvedValue({ userId: "owner" });
  mocks.trip.mockResolvedValue({ data: trip, error: null });
  mocks.read.mockResolvedValue({
    data: { reports: [], receipt: false },
    error: null,
  });
  mocks.save.mockResolvedValue({ data: { state: "applied" }, error: null });
  mocks.rpc.mockImplementation((name, ...args) =>
    name === "read_trip_booking_reports"
      ? mocks.read(...args)
      : mocks.save(...args),
  );
  const chain = { select: vi.fn(), eq: mocks.eq, single: mocks.trip };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  mocks.from.mockReturnValue(chain);
});
afterEach(() => vi.unstubAllEnvs());
describe("persistent booking checklist boundaries", () => {
  it("requires authentication and defaults off", async () => {
    mocks.auth.mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    expect((await POST(request(), context)).status).toBe(401);
    vi.stubEnv("FAROWAY_BOOKING_CHECKLIST_ENABLED", "");
    expect((await GET(request(), context)).status).toBe(503);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("scopes reads and writes to the owner", async () => {
    expect((await POST(request(), context)).status).toBe(200);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "owner");
    expect(mocks.save).toHaveBeenCalledWith({
      p_trip_id: id,
      p_user_id: "owner",
      p_command: command,
    });
    mocks.trip.mockResolvedValue({ data: null, error: null });
    expect((await GET(request(), context)).status).toBe(404);
  });
  it("cannot manufacture provider verification, commissions, or source metadata", async () => {
    for (const body of [
      { ...command, status: "provider_verified" },
      { ...command, converted: true },
      { ...command, itemName: "Spoof" },
    ])
      expect((await POST(request(body), context)).status).toBe(400);
    expect(mocks.save).not.toHaveBeenCalled();
    const data = await (await GET(request(), context)).json();
    expect(data.verificationAvailable).toBe(false);
    expect(data.items[0].status).toBe("needed");
  });
  it("rejects stale versions, generations, unavailable items and unfinished briefs", async () => {
    for (const body of [
      { ...command, expectedUpdatedAt: "2026-10-02T00:00:00Z" },
      { ...command, generationId: id },
      { ...command, itemId: `item_${"0".repeat(32)}` },
    ])
      expect((await POST(request(body), context)).status).toBe(409);
    mocks.trip.mockResolvedValue({
      data: { ...trip, preferences: { planNeedsRefresh: true } },
      error: null,
    });
    expect((await POST(request(), context)).status).toBe(409);
    expect((await (await GET(request(), context)).json()).editable).toBe(false);
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("retains exact saved receipts after plan changes, with SQL validating the command", async () => {
    mocks.read.mockResolvedValue({
      data: { reports: [], receipt: true },
      error: null,
    });
    mocks.trip.mockResolvedValue({
      data: { ...trip, updated_at: "2026-10-04T00:00:00Z", status: "draft" },
      error: null,
    });
    expect((await POST(request(), context)).status).toBe(200);
    expect(mocks.save).toHaveBeenCalledWith(
      expect.objectContaining({ p_command: command }),
    );
  });
  it("redacts unavailable provider history and cannot transfer reports to a new generation", async () => {
    vi.stubEnv("VIATOR_CONTENT_ENABLED", "false");
    mocks.read.mockResolvedValue({
      data: {
        receipt: false,
        reports: [
          {
            id: "report",
            generation_id: id,
            item_id: item.id,
            status: "traveler_booked",
            item_snapshot: { name: "Restricted tour", source: "viator" },
            activity_date: "2099-06-01",
            trip_version: revision,
          },
        ],
      },
      error: null,
    });
    const result = await (await GET(request(), context)).json();
    expect(result.items[0].status).toBe("needed");
    expect(result.earlier[0].name).toBe("Provider activity");
    expect(JSON.stringify(result)).not.toContain("Restricted tour");
    mocks.trip.mockResolvedValue({
      data: {
        ...trip,
        itineraries: {
          ...trip.itineraries,
          days: [
            {
              date: "2099-06-01",
              morning: {
                activities: [{ name: "Restricted tour", source: "viator" }],
              },
            },
          ],
        },
      },
      error: null,
    });
    expect((await POST(request(), context)).status).toBe(409);
  });
  it("marks reports stale after trip edits without erasing their traveler status", async () => {
    mocks.read.mockResolvedValue({
      data: {
        receipt: false,
        reports: [
          {
            id: "report",
            generation_id: generationId,
            item_id: item.id,
            status: "traveler_booked",
            trip_version: "2026-10-02T00:00:00Z",
          },
        ],
      },
      error: null,
    });
    const result = await (await GET(request(), context)).json();
    expect(result.items[0]).toMatchObject({
      status: "traveler_booked",
      needsReview: true,
      reportId: "report",
    });
  });
  it("fails closed on unavailable persistence or a competing report", async () => {
    mocks.save.mockResolvedValueOnce({
      data: { state: "conflict" },
      error: null,
    });
    expect((await POST(request(), context)).status).toBe(409);
    mocks.save.mockResolvedValueOnce({
      data: null,
      error: { message: "Unavailable" },
    });
    expect((await POST(request(), context)).status).toBe(503);
    mocks.read.mockResolvedValueOnce({
      data: null,
      error: { message: "Unavailable" },
    });
    expect((await GET(request(), context)).status).toBe(503);
  });
});
