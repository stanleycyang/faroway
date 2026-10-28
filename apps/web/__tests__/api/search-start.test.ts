import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const startMock = vi.fn();

vi.mock("@/lib/workflow/runtime", () => ({
  startWorkflow: (...args: unknown[]) => startMock(...args),
}));

vi.mock("@/workflows/plan-trip", () => ({
  planTripWorkflow: vi.fn(async () => ({})),
}));

const authMock = vi.fn(
  async (request: unknown): Promise<{ userId: string } | NextResponse> => {
    void request;
    return { userId: "user-1" };
  },
);

vi.mock("@/lib/auth/middleware", () => ({
  requireUserIdFromRequest: (request: unknown) => authMock(request),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimitAsync: vi.fn(async () => ({ allowed: true })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

const updates: unknown[] = [];

function createTableChain(table: string) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.insert = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.single = vi.fn(async () => ({
    data: table === "searches" ? { id: "search-1" } : null,
    error: null,
  }));
  chain.update = vi.fn((payload) => {
    updates.push(payload);
    return chain;
  });
  chain.eq = vi.fn(() => chain);
  return chain;
}

const supabaseMock = {
  from: vi.fn((table: string) => createTableChain(table)),
};

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: vi.fn(() => supabaseMock),
}));

import { POST } from "@/app/api/search/start/route";

function makeReq() {
  return new NextRequest("http://localhost:3000/api/search/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-faroway-ai-disclosure": "planning-google-v1",
    },
    body: JSON.stringify({
      destination: "Tokyo",
      startDate: "2026-06-01",
      endDate: "2026-06-05",
      travelers: 2,
      vibes: ["foodie"],
      budget: "moderate",
    }),
  });
}

describe("POST /api/search/start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updates.length = 0;
    authMock.mockResolvedValue({ userId: "user-1" });
  });

  it("starts the durable workflow with a fast generation estimate", async () => {
    const res = await POST(makeReq());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      searchId: "search-1",
      status: "started",
      estimatedTime: 5,
    });
    expect(startMock).toHaveBeenCalledOnce();
  });

  it("passes party and accessibility requirements to the workflow", async () => {
    const request = new NextRequest("http://localhost:3000/api/search/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-faroway-ai-disclosure": "planning-google-v1",
      },
      body: JSON.stringify({
        destination: "Paris",
        startDate: "2026-06-01",
        endDate: "2026-06-03",
        travelers: 3,
        adults: 2,
        children: 1,
        interests: ["art"],
        dietaryRestrictions: ["peanut allergy"],
        mobilityNeeds: "step-free",
      }),
    });
    expect((await POST(request)).status).toBe(200);
    expect(startMock).toHaveBeenCalledWith(expect.any(Function), [
      expect.objectContaining({
        adults: 2,
        children: 1,
        interests: ["art"],
        dietaryRestrictions: ["peanut allergy"],
        mobilityNeeds: "step-free",
      }),
    ]);
  });

  it("requires an authenticated user", async () => {
    authMock.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );

    const res = await POST(makeReq());

    expect(res.status).toBe(401);
    expect(startMock).not.toHaveBeenCalled();
  });

  it("passes origin fields through to the durable workflow", async () => {
    const res = await POST(
      new NextRequest("http://localhost:3000/api/search/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-faroway-ai-disclosure": "planning-google-v1",
        },
        body: JSON.stringify({
          destination: "Tokyo",
          startDate: "2026-06-01",
          endDate: "2026-06-05",
          travelers: 2,
          travelerType: "couple",
          vibes: ["foodie"],
          budget: "moderate",
          originCity: "San Francisco",
          originAirport: "SFO",
        }),
      }),
    );

    expect(res.status).toBe(200);
    expect(startMock.mock.calls[0][1][0]).toEqual(
      expect.objectContaining({
        originCity: "San Francisco",
        originAirport: "SFO",
        travelerType: "couple",
      }),
    );
  });

  it("marks the search errored when workflow start fails", async () => {
    startMock.mockRejectedValueOnce(new Error("workflow unavailable"));

    const res = await POST(makeReq());
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Internal server error");
    expect(updates).toContainEqual(
      expect.objectContaining({
        status: "error",
        error_message: "workflow unavailable",
      }),
    );
  });

  it("returns 400 for malformed JSON without starting the workflow", async () => {
    const res = await POST(
      new NextRequest("http://localhost:3000/api/search/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-faroway-ai-disclosure": "planning-google-v1",
        },
        body: "{not-json",
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid request body");
    expect(startMock).not.toHaveBeenCalled();
  });

  it("rejects searches with an end date before the start date", async () => {
    const res = await POST(
      new NextRequest("http://localhost:3000/api/search/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-faroway-ai-disclosure": "planning-google-v1",
        },
        body: JSON.stringify({
          destination: "Tokyo",
          startDate: "2026-06-05",
          endDate: "2026-06-01",
          travelers: 2,
        }),
      }),
    );

    expect(res.status).toBe(400);
    expect(startMock).not.toHaveBeenCalled();
  });
});
