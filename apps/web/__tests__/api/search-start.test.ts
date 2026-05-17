import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const startMock = vi.fn();

vi.mock("@/lib/workflow/runtime", () => ({
  startWorkflow: (...args: unknown[]) => startMock(...args),
}));

vi.mock("@/workflows/plan-trip", () => ({
  planTripWorkflow: vi.fn(async () => ({})),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true })),
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
  auth: {
    getUser: vi.fn(async () => ({ data: { user: null } })),
  },
  from: vi.fn((table: string) => createTableChain(table)),
};

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: vi.fn(() => supabaseMock),
}));

import { POST } from "@/app/api/search/start/route";

function makeReq() {
  return new NextRequest("http://localhost:3000/api/search/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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

  it("passes origin fields through to the durable workflow", async () => {
    const res = await POST(
      new NextRequest("http://localhost:3000/api/search/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
        body: "{not-json",
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid request body");
    expect(startMock).not.toHaveBeenCalled();
  });
});
