import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const startMock = vi.fn();

vi.mock("@/lib/workflow/runtime", () => ({
  startWorkflow: (...args: unknown[]) => startMock(...args),
}));

const planTripWorkflowMock = vi.hoisted(() => vi.fn(async () => ({})));

vi.mock("@/workflows/plan-trip", () => ({
  planTripWorkflow: planTripWorkflowMock,
}));

const adminUpdates: Record<string, unknown[]> = {};
const adminUpserts: Record<string, unknown[]> = {};
const adminInserts: Record<string, unknown[]> = {};

function createUserTableChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.single = vi.fn(async () => ({
    data: { id: tripId, status: "draft" },
    error: null,
  }));
  return chain;
}

function createAdminTableChain(table: string) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.eq = vi.fn(() => chain);
  chain.select = vi.fn(() => chain);
  chain.single = vi.fn(async () => ({
    data: table === "searches" ? { id: "search-1" } : null,
    error: null,
  }));
  chain.update = vi.fn((payload) => {
    adminUpdates[table] ||= [];
    adminUpdates[table].push(payload);
    return chain;
  });
  chain.upsert = vi.fn(async (payload) => {
    adminUpserts[table] ||= [];
    adminUpserts[table].push(payload);
    return { data: payload, error: null };
  });
  chain.insert = vi.fn((payload) => {
    adminInserts[table] ||= [];
    adminInserts[table].push(payload);
    return chain;
  });
  return chain;
}

const tripId = "11111111-1111-4111-8111-111111111111";
const userClient = {
  auth: {
    getUser: vi.fn(async () => ({
      data: { user: { id: "user-1" } },
      error: null,
    })),
  },
  from: vi.fn(() => createUserTableChain()),
};
const adminClient = {
  from: vi.fn((table: string) => createAdminTableChain(table)),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => userClient),
  createClientFromRequest: vi.fn(async () => userClient),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => adminClient),
}));

import { POST } from "@/app/api/workflows/generate-itinerary/route";

function makeReq() {
  return new NextRequest(
    "http://localhost:3000/api/workflows/generate-itinerary",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripId,
        destination: "Tokyo",
        startDate: "2026-06-01",
        endDate: "2026-06-05",
        travelers: { adults: 2, children: 0 },
        budget: "moderate",
        preferences: { vibes: ["foodie"] },
      }),
    },
  );
}

describe("POST /api/workflows/generate-itinerary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(adminUpdates)) delete adminUpdates[key];
    for (const key of Object.keys(adminUpserts)) delete adminUpserts[key];
    for (const key of Object.keys(adminInserts)) delete adminInserts[key];
  });

  it("marks the trip and progress failed when workflow start fails", async () => {
    startMock.mockRejectedValueOnce(new Error("workflow unavailable"));

    const res = await POST(makeReq());
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Failed to start workflow");
    expect(adminUpdates.trips).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "generating" }),
        expect.objectContaining({ status: "failed" }),
      ]),
    );
    expect(adminUpserts.workflow_progress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          trip_id: tripId,
          step: "error",
          message: "workflow unavailable",
        }),
      ]),
    );
  });

  it("starts the parallel trip planning workflow with a linked search record", async () => {
    startMock.mockResolvedValueOnce({ id: "workflow-1" });

    const res = await POST(makeReq());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.workflowId).toBe("workflow-1");
    expect(adminInserts.searches).toEqual([
      expect.objectContaining({
        destination: "Tokyo",
        travelers: 2,
        status: "pending",
      }),
    ]);
    expect(adminUpdates.trips).toEqual([
      expect.objectContaining({
        status: "generating",
        search_id: "search-1",
      }),
    ]);
    expect(startMock).toHaveBeenCalledWith(planTripWorkflowMock, [
      expect.objectContaining({
        searchId: "search-1",
        tripId,
        travelers: 2,
        vibes: ["foodie"],
      }),
    ]);
  });
});
