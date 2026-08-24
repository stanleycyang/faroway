import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireUserIdFromRequest: vi.fn(),
  checkRateLimitAsync: vi.fn(),
  from: vi.fn(),
  tripSingle: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/auth/middleware", () => ({
  requireUserIdFromRequest: mocks.requireUserIdFromRequest,
}));

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimitAsync: mocks.checkRateLimitAsync,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => ({ from: mocks.from }),
}));

import { POST } from "@/app/api/trips/[id]/feedback/route";

const tripId = "00000000-0000-4000-8000-000000000001";
const userId = "00000000-0000-4000-8000-000000000002";

function request(body: unknown) {
  return new NextRequest(
    new URL(`/api/trips/${tripId}/feedback`, "http://localhost:3000"),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
  );
}

function context(id = tripId) {
  return { params: Promise.resolve({ id }) };
}

describe("POST /api/trips/[id]/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireUserIdFromRequest.mockResolvedValue({ userId });
    mocks.checkRateLimitAsync.mockResolvedValue({ allowed: true });
    mocks.tripSingle.mockResolvedValue({
      data: { id: tripId, status: "planned" },
      error: null,
    });
    mocks.upsert.mockResolvedValue({ error: null });

    const tripQuery = {
      select: vi.fn(),
      eq: vi.fn(),
      single: mocks.tripSingle,
    };
    tripQuery.select.mockReturnValue(tripQuery);
    tripQuery.eq.mockReturnValue(tripQuery);

    mocks.from.mockImplementation((table: string) => {
      if (table === "trips") return tripQuery;
      if (table === "trip_feedback") return { upsert: mocks.upsert };
      return {};
    });
  });

  it("upserts structured feedback for an owned completed trip", async () => {
    const response = await POST(
      request({
        score: 5,
        wouldUseAgain: true,
        issueTags: ["great_fit", "easy_to_use"],
        comment: "Exactly the pacing I wanted.",
        source: "web",
      }),
      context(),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(mocks.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        trip_id: tripId,
        user_id: userId,
        score: 5,
        would_use_again: true,
        issue_tags: ["great_fit", "easy_to_use"],
        source: "web",
      }),
      { onConflict: "trip_id,user_id" },
    );
  });

  it("rejects invalid feedback", async () => {
    const response = await POST(request({ score: 6 }), context());

    expect(response.status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("rejects feedback before generation completes", async () => {
    mocks.tripSingle.mockResolvedValueOnce({
      data: { id: tripId, status: "generating" },
      error: null,
    });

    const response = await POST(request({ score: 3 }), context());

    expect(response.status).toBe(409);
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("rejects malformed trip IDs before querying", async () => {
    const response = await POST(request({ score: 5 }), context("../bad"));

    expect(response.status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
