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
import { loadSharedTrip } from "../../lib/trips/load-shared-trip";
test("shared read preserves revoked/missing links as unavailable", async () => {
  mocks.single.mockResolvedValueOnce({
    data: null,
    error: { code: "PGRST116" },
  });
  expect(await loadSharedTrip("missing-link")).toBeNull();
  expect(mocks.eq).toHaveBeenCalledWith("is_shared", true);
});
test("shared read outage exposes retryable failure rather than a missing link", async () => {
  mocks.single.mockResolvedValueOnce({
    data: null,
    error: { code: "503", message: "Internal private diagnostics" },
  });
  await expect(loadSharedTrip("valid-link")).rejects.toThrow(
    "could not be loaded",
  );
});

test.each([
  { days: {} },
  { days: [null] },
  { days: "unreadable saved days" },
  { days: [], general_tips: { length: 1 } },
])(
  "unreadable shared itinerary rejects rather than displaying an empty plan: %j",
  async (itinerary) => {
    mocks.single.mockResolvedValueOnce({
      data: { destination: "Tokyo", itineraries: itinerary },
      error: null,
    });
    await expect(loadSharedTrip("unreadable-link")).rejects.toThrow(
      "could not be read",
    );
  },
);

test("legacy JSON days remain readable and an unplanned trip remains shareable", async () => {
  mocks.single.mockResolvedValueOnce({
    data: {
      destination: "Tokyo",
      itineraries: [{ days: '[{"dayNumber":1,"title":"Arrival"}]' }],
    },
    error: null,
  });
  expect(await loadSharedTrip("legacy-link")).toMatchObject({
    itineraries: [{ days: [{ dayNumber: 1, title: "Arrival" }] }],
  });
  mocks.single.mockResolvedValueOnce({
    data: { destination: "Tokyo", itineraries: null },
    error: null,
  });
  expect(await loadSharedTrip("unplanned-link")).toMatchObject({
    itineraries: null,
  });
});
