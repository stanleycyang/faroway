import { expect, test, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { loadDashboardTrips } from "@/lib/trips/load-dashboard-trips";
import type { createClient } from "@/lib/supabase/server";
const rows = Array.from({ length: 1105 }, (_, i) => ({
  id: `88888888-8888-4888-8888-${String(2000 - i).padStart(12, "0")}`,
  destination: "Paris",
  start_date: i % 2 ? "2099-06-02" : "2099-06-01",
  end_date: "2099-06-03",
  travelers: 2,
  created_at: "2026-01-01T00:00:00Z",
}));
function database(failAt?: number) {
  let reads = 0;
  const scope = vi.fn();
  const db = {
    from: () => {
      let boundary: string | undefined;
      const chain = {
        select: () => chain,
        eq: (...args: unknown[]) => {
          scope(...args);
          return chain;
        },
        order: () => chain,
        limit: () => chain,
        or: (value: string) => {
          boundary = value.match(/id\.lt\.([0-9a-f-]{36})/)?.[1];
          return chain;
        },
        get data() {
          reads++;
          return rows
            .filter((row) => !boundary || row.id < boundary)
            .slice(0, 100);
        },
        get error() {
          return reads === failAt ? { message: "Unavailable" } : null;
        },
      };
      return chain;
    },
  };
  return {
    db: db as unknown as Awaited<ReturnType<typeof createClient>>,
    scope,
  };
}
test("reads beyond the configured1000-row cap and applies the requested sort to all summaries", async () => {
  const { db, scope } = database();
  const result = await loadDashboardTrips(db, "owner", "date-asc");
  expect(result.error).toBeNull();
  expect(result.data).toHaveLength(1105);
  expect(new Set(result.data!.map((trip) => trip.id)).size).toBe(1105);
  expect(result.data![0].start_date).toBe("2099-06-01");
  expect(result.data!.at(-1)!.start_date).toBe("2099-06-02");
  expect(scope).toHaveBeenCalledTimes(12);
  expect(
    scope.mock.calls.every(
      (call) => call[0] === "user_id" && call[1] === "owner",
    ),
  ).toBe(true);
});
test("a later-page failure returns recovery rather than partial totals", async () => {
  const { db } = database(2);
  const result = await loadDashboardTrips(db, "owner", "created");
  expect(result.data).toBeNull();
  expect(result.error).not.toBeNull();
});
