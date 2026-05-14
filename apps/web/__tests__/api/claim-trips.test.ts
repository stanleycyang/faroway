import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const user = { id: "user-1" };
let authUser: typeof user | null = user;
let claimedTrips: Array<{ id: string; search_id: string | null }> = [];
let claimError: unknown = null;

const authClient = {
  auth: {
    getUser: vi.fn(async () => ({
      data: { user: authUser },
      error: authUser ? null : { message: "No session" },
    })),
  },
};

const adminClient = {
  rpc: vi.fn(() => ({ data: claimedTrips, error: claimError })),
};
const createClientFromRequestMock = vi.fn(async (request: unknown) => {
  void request;
  return authClient;
});

vi.mock("@/lib/supabase/server", () => ({
  createClientFromRequest: (request: unknown) =>
    createClientFromRequestMock(request),
  getSupabase: vi.fn(() => adminClient),
}));

import { POST } from "@/app/api/auth/claim-trips/route";

function makeRequest(tripIds: string[], headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/auth/claim-trips", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ tripIds }),
  });
}

function makeRawRequest(body: string, headers: Record<string, string> = {}) {
  return new NextRequest("http://localhost:3000/api/auth/claim-trips", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

describe("POST /api/auth/claim-trips", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authUser = user;
    claimError = null;
    claimedTrips = [
      {
        id: "00000000-0000-4000-8000-000000000001",
        search_id: "search-1",
      },
      {
        id: "00000000-0000-4000-8000-000000000002",
        search_id: null,
      },
    ];
  });

  it("claims anonymous trips for a bearer-authenticated mobile user", async () => {
    const tripIds = claimedTrips.map((trip) => trip.id);
    const req = makeRequest(tripIds, { Authorization: "Bearer mobile-token" });

    const res = await POST(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ claimed: 2, tripIds });
    expect(createClientFromRequestMock).toHaveBeenCalledWith(req);
    expect(adminClient.rpc).toHaveBeenCalledWith("claim_anonymous_trips", {
      p_user_id: "user-1",
      p_trip_ids: tripIds,
    });
  });

  it("rejects unauthenticated claim attempts", async () => {
    authUser = null;

    const res = await POST(
      makeRequest(["00000000-0000-4000-8000-000000000001"]),
    );

    expect(res.status).toBe(401);
    expect(adminClient.rpc).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON as a client error", async () => {
    const res = await POST(
      makeRawRequest("{not-json", { Authorization: "Bearer mobile-token" }),
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid JSON body");
    expect(adminClient.rpc).not.toHaveBeenCalled();
  });

  it("returns 500 when the atomic claim function fails", async () => {
    claimError = { message: "function failed" };

    const res = await POST(
      makeRequest(["00000000-0000-4000-8000-000000000001"], {
        Authorization: "Bearer mobile-token",
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe("Failed to claim trips");
  });
});
