import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

let searchRecord: Record<string, unknown> | null;

const requestClient = {
  auth: {
    getUser: vi.fn(async () => ({
      data: { user: { id: "user-1" } },
      error: null,
    })),
  },
};

function createSearchChain() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.single = vi.fn(async () => ({
    data: searchRecord,
    error: searchRecord ? null : { message: "not found" },
  }));
  return chain;
}

const adminClient = {
  from: vi.fn(() => createSearchChain()),
};

const createClientFromRequestMock = vi.fn(async (request: unknown) => {
  void request;
  return requestClient;
});

vi.mock("@/lib/supabase/server", () => ({
  createClientFromRequest: (request: unknown) =>
    createClientFromRequestMock(request),
  getSupabase: vi.fn(() => adminClient),
}));

import { GET } from "@/app/api/search/[searchId]/route";

function makeReq() {
  return new NextRequest("http://localhost:3000/api/search/search-1", {
    headers: { Authorization: "Bearer mobile-token" },
  });
}

function makeParams(searchId = "search-1") {
  return { params: Promise.resolve({ searchId }) };
}

describe("GET /api/search/[searchId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchRecord = {
      id: "search-1",
      user_id: "user-1",
      status: "searching",
      progress: {},
      created_at: "2026-05-01T00:00:00.000Z",
      completed_at: null,
      error_message: null,
      json_render_spec: null,
      search_results: [],
      search_itineraries: [],
    };
  });

  it("uses request-derived auth and returns owned search status", async () => {
    const req = makeReq();
    const res = await GET(req, makeParams());
    const json = await res.json();

    expect(createClientFromRequestMock).toHaveBeenCalledWith(req);
    expect(res.status).toBe(200);
    expect(json).toMatchObject({
      searchId: "search-1",
      status: "searching",
    });
  });

  it("hides searches owned by a different user", async () => {
    searchRecord = { ...searchRecord, user_id: "user-2" };

    const res = await GET(makeReq(), makeParams());
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error).toBe("Search not found");
  });
});
