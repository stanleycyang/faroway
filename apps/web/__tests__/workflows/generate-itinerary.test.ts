import { beforeEach, describe, expect, it, vi } from "vitest";

const generateItineraryMock = vi.fn();

vi.mock("@/lib/ai", () => ({
  generateItinerary: (...args: unknown[]) => generateItineraryMock(...args),
}));

const updates: Record<string, unknown[]> = {};
const upserts: Record<string, unknown[]> = {};

function createTableChain(table: string) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.or = vi.fn(() => chain);
  chain.single = vi.fn(async () => ({
    data:
      table === "trips"
        ? {
            id: "trip-1",
            destination: "Tokyo",
            start_date: "2026-06-01",
            end_date: "2026-06-05",
            budget: "moderate",
            vibes: ["foodie"],
            travelers: { adults: 2, children: 0 },
          }
        : null,
    error: null,
  }));
  chain.update = vi.fn((payload) => {
    updates[table] ||= [];
    updates[table].push(payload);
    return chain;
  });
  chain.upsert = vi.fn(async (payload) => {
    upserts[table] ||= [];
    upserts[table].push(payload);
    return { data: payload, error: null };
  });
  return chain;
}

const adminClient = {
  from: vi.fn((table: string) => createTableChain(table)),
};

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => adminClient),
}));

import { generateItineraryWorkflow } from "@/workflows/generate-itinerary";

describe("generateItineraryWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
    for (const key of Object.keys(updates)) delete updates[key];
    for (const key of Object.keys(upserts)) delete upserts[key];
  });

  it("persists failed workflow state when AI generation fails", async () => {
    generateItineraryMock.mockRejectedValueOnce(new Error("model timeout"));

    const result = await generateItineraryWorkflow({
      tripId: "trip-1",
      destination: "Tokyo",
      startDate: "2026-06-01",
      endDate: "2026-06-05",
      travelers: { adults: 2, children: 0 },
      budget: "moderate",
      preferences: { vibes: ["foodie"] },
      userId: "user-1",
    });

    expect(result).toMatchObject({
      tripId: "trip-1",
      status: "failed",
      error: "AI generation failed: model timeout",
    });
    expect(upserts.workflow_progress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          trip_id: "trip-1",
          step: "error",
          message: "AI generation failed: model timeout",
        }),
      ]),
    );
    expect(updates.trips).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: "failed" })]),
    );
    expect(updates.workflow_runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "failed",
          error_message: "AI generation failed: model timeout",
        }),
      ]),
    );
  });
});
