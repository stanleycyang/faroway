import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSupabaseMock } = vi.hoisted(() => ({
  getSupabaseMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: getSupabaseMock,
}));

import { loadTripForUserUncached } from "@/lib/trips/load-trip";
import { loadSharedTripUncached } from "@/lib/trips/load-shared-trip";

function setQueryResult(result: { data: unknown; error: unknown }) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  getSupabaseMock.mockReturnValue({ from: vi.fn(() => query) });
}

describe("trip server loaders", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it.each([
    ["private", () => loadTripForUserUncached("missing", "user-1")],
    ["shared", () => loadSharedTripUncached("missing-token")],
  ])("returns null for a genuinely missing %s trip", async (_kind, load) => {
    setQueryResult({
      data: null,
      error: { code: "PGRST116", message: "No rows found" },
    });

    await expect(load()).resolves.toBeNull();
  });

  it.each([
    ["private", () => loadTripForUserUncached("trip-1", "user-1")],
    ["shared", () => loadSharedTripUncached("share-token")],
  ])("surfaces a database failure for a %s trip", async (_kind, load) => {
    setQueryResult({
      data: null,
      error: { code: "08006", message: "connection failure" },
    });

    await expect(load()).rejects.toThrow(/Unable to load/);
  });
});
