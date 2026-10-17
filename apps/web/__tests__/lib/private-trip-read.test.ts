import { expect, test, vi } from "vitest";
const mocks = vi.hoisted(() => ({ single: vi.fn(), eq: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: (...args: unknown[]) => {
          mocks.eq(...args);
          return {
            eq: (...args: unknown[]) => {
              mocks.eq(...args);
              return { single: mocks.single };
            },
          };
        },
      }),
    }),
  }),
}));
import { loadTripForUserUncached } from "../../lib/trips/load-trip";
test("private read preserves missing owned trips as unavailable", async () => {
  mocks.single.mockResolvedValueOnce({
    data: null,
    error: { code: "PGRST116" },
  });
  expect(await loadTripForUserUncached("missing-trip", "owner-a")).toBeNull();
  expect(mocks.eq).toHaveBeenCalledWith("user_id", "owner-a");
});
test("private read outage exposes retryable failure rather than a missing trip", async () => {
  mocks.single.mockResolvedValueOnce({
    data: null,
    error: { code: "503", message: "Internal private diagnostics" },
  });
  await expect(loadTripForUserUncached("trip-a", "owner-a")).rejects.toThrow(
    "could not be loaded",
  );
});

test("reload reads the global recommendation from only the current owned search", async () => {
  const topHotel = { id: "global", name: "Global choice" };
  mocks.eq.mockClear();
  mocks.single
    .mockResolvedValueOnce({
      data: {
        id: "trip-a",
        user_id: "owner-a",
        search_id: "current-search",
        itineraries: { days: [{ hotel: { id: "day-one", name: "Day one" } }] },
      },
      error: null,
    })
    .mockResolvedValueOnce({
      data: {
        status: "completed",
        intermediate_results: { topHotel },
      },
      error: null,
    });
  const result = await loadTripForUserUncached("trip-a", "owner-a");
  expect(result?.itinerary).toHaveProperty("topHotel", topHotel);
  expect(result?.itinerary?.days[0].hotel?.id).toBe("day-one");
  expect(mocks.eq).toHaveBeenCalledWith("id", "current-search");
  expect(mocks.eq.mock.calls.filter(([key]) => key === "user_id")).toHaveLength(
    2,
  );
});

test.each([
  { data: null, error: { code: "PGRST116" } },
  { data: null, error: { code: "503" } },
  {
    data: {
      status: "searching",
      intermediate_results: { topHotel: { name: "Provisional" } },
    },
    error: null,
  },
  {
    data: {
      status: "completed",
      intermediate_results: { topHotel: { name: 42 } },
    },
    error: null,
  },
])(
  "missing, inaccessible or unfinished current search never replaces the saved day hotel",
  async (search) => {
    mocks.single.mockReset();
    mocks.single
      .mockResolvedValueOnce({
        data: {
          id: "trip-a",
          user_id: "owner-a",
          search_id: "current-search",
          itineraries: {
            days: [{ hotel: { id: "day-one", name: "Day one" } }],
          },
        },
        error: null,
      })
      .mockResolvedValueOnce(search);
    const result = await loadTripForUserUncached("trip-a", "owner-a");
    expect(result?.itinerary?.topHotel).toBeNull();
    expect(result?.itinerary?.days[0].hotel?.id).toBe("day-one");
  },
);
test("legacy trip without a current search does not query unrelated search metadata", async () => {
  mocks.single.mockReset();
  mocks.single.mockResolvedValueOnce({
    data: {
      id: "trip-a",
      user_id: "owner-a",
      itineraries: { days: [] },
    },
    error: null,
  });
  await loadTripForUserUncached("trip-a", "owner-a");
  expect(mocks.single).toHaveBeenCalledTimes(1);
});
