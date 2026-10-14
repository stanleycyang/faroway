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
