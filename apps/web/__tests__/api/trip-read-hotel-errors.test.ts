import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ result: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/auth/middleware", () => ({
  requireUserIdFromRequest: mocks.auth,
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ single: mocks.result, maybeSingle: mocks.result }),
        }),
      }),
    }),
  }),
  createClientFromRequest: vi.fn(),
}));

import { GET } from "@/app/api/trips/[id]/route";

const topHotel = { id: "global", name: "Saved featured stay" };
const savedTrip = {
  id: "trip-a",
  user_id: "owner-a",
  search_id: "current-search",
  itineraries: { days: [{ hotel: { id: "day-one", name: "Day one" } }] },
};
const healthySearch = {
  data: { status: "completed", intermediate_results: { topHotel } },
  error: null,
};
const invoke = () =>
  GET(new NextRequest("https://fixture.test/api/trips/trip-a"), {
    params: Promise.resolve({ id: "trip-a" }),
  });
const tripThenSearch = (search: unknown) => {
  mocks.result
    .mockResolvedValueOnce({ data: savedTrip, error: null })
    .mockResolvedValueOnce(search);
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ userId: "owner-a" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

test.each(["503", "57014", "42703"])(
  "GET returns a failure without a replacement itinerary on hotel lookup error %s",
  async (code) => {
    tripThenSearch({
      data: null,
      error: { code, message: "Internal private hotel diagnostics" },
    });
    const response = await invoke();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "Internal server error" });
  },
);

test("GET recovers the current recommendation after a transient lookup failure", async () => {
  tripThenSearch(healthySearch);
  const initial = await invoke();
  expect(initial.status).toBe(200);
  expect((await initial.json()).itinerary.topHotel).toEqual(topHotel);

  tripThenSearch({ data: null, error: { code: "503" } });
  expect((await invoke()).status).toBe(500);

  tripThenSearch(healthySearch);
  const recovered = await invoke();
  expect(recovered.status).toBe(200);
  expect(recovered.headers.get("cache-control")).toBe("private, no-store");
  expect((await recovered.json()).itinerary).toMatchObject({
    topHotel,
    days: [{ hotel: { id: "day-one", name: "Day one" } }],
  });
});

test("GET preserves a genuinely absent recommendation as a successful null", async () => {
  tripThenSearch({ data: null, error: null });
  const response = await invoke();
  expect(response.status).toBe(200);
  expect((await response.json()).itinerary.topHotel).toBeNull();
});
