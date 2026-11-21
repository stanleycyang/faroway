import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  searchRow: null as unknown,
  tripRow: null as unknown,
  userId: "user-1",
}));

vi.mock("@/lib/supabase/server", () => ({
  createClientFromRequest: vi.fn(async () => ({
    auth: {
      getUser: async () => ({
        data: { user: { id: mocks.userId } },
        error: null,
      }),
    },
  })),
  getSupabase: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: async () =>
              table === "searches"
                ? { data: mocks.searchRow, error: null }
                : { data: mocks.tripRow, error: null },
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      }),
    }),
  }),
}));

import { GET as getSearchStatus } from "@/app/api/search/[searchId]/route";
import { loadTripForUserUncached } from "@/lib/trips/load-trip";

describe("P2-3 runtime Zod validation (zero as unknown as)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("rejects malformed search row in /api/search/[searchId] with 500 instead of blind cast", async () => {
    mocks.searchRow = {
      id: "search-1",
      user_id: "user-1",
      status: "not-a-valid-status",
      progress: {},
    };

    const res = await getSearchStatus(
      new NextRequest("http://localhost:3000/api/search/search-1"),
      { params: Promise.resolve({ searchId: "search-1" }) },
    );
    expect(res.status).toBe(500);
  });

  it("rejects malformed search_results data payload in /api/search/[searchId]", async () => {
    mocks.searchRow = {
      id: "search-1",
      user_id: "user-1",
      status: "completed",
      progress: {},
      search_results: [
        {
          id: "res-1",
          category: "hotel",
          data: { id: 12345, vibeScore: "invalid-number" },
          vibe_score: 50,
        },
      ],
      search_itineraries: [],
    };

    const res = await getSearchStatus(
      new NextRequest("http://localhost:3000/api/search/search-1"),
      { params: Promise.resolve({ searchId: "search-1" }) },
    );
    expect(res.status).toBe(500);
  });

  it("rejects malformed trip rows in loadTripForUserUncached cleanly", async () => {
    mocks.tripRow = {
      id: 999,
      user_id: "user-1",
    };

    await expect(loadTripForUserUncached("trip-1", "user-1")).rejects.toThrow(
      "Your trip could not be loaded",
    );
  });
});
