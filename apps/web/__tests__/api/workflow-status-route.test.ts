import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const requestClient = {
  auth: {
    getUser: vi.fn(async () => ({
      data: { user: { id: "user-1" } },
      error: null,
    })),
  },
};

function createAdminChain(table: string) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.limit = vi.fn(() => chain);
  chain.single = vi.fn(async () => {
    if (table === "workflow_runs") {
      return {
        data: {
          id: "workflow-1",
          trip_id: "trip-1",
          user_id: "user-1",
          status: "completed",
          started_at: "2026-05-01T00:00:00.000Z",
          completed_at: "2026-05-01T00:01:00.000Z",
          error_message: null,
        },
        error: null,
      };
    }

    if (table === "workflow_progress") {
      return {
        data: {
          progress: 100,
          step: "complete",
          message: "Your itinerary is ready",
        },
        error: null,
      };
    }

    if (table === "itineraries") {
      return { data: { id: "itinerary-1" }, error: null };
    }

    return { data: null, error: null };
  });
  return chain;
}

const adminClient = {
  from: vi.fn((table: string) => createAdminChain(table)),
};

const createClientFromRequestMock = vi.fn(async (request: unknown) => {
  void request;
  return requestClient;
});

vi.mock("@/lib/supabase/server", () => ({
  createClientFromRequest: (request: unknown) =>
    createClientFromRequestMock(request),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => adminClient),
}));

import { GET } from "@/app/api/workflows/[workflowId]/status/route";

function makeReq() {
  return new NextRequest(
    "http://localhost:3000/api/workflows/workflow-1/status",
    {
      headers: { Authorization: "Bearer mobile-token" },
    },
  );
}

function makeParams(workflowId = "workflow-1") {
  return { params: Promise.resolve({ workflowId }) };
}

describe("GET /api/workflows/[workflowId]/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses request-derived auth so bearer-token clients can poll workflow status", async () => {
    const req = makeReq();
    const res = await GET(req, makeParams());
    const json = await res.json();

    expect(createClientFromRequestMock).toHaveBeenCalledWith(req);
    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      workflowId: "workflow-1",
      tripId: "trip-1",
      status: "completed",
      progress: 100,
      result: { itineraryId: "itinerary-1" },
    });
  });
});
