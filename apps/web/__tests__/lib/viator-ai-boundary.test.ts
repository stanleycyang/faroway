import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generateObject: vi.fn() }));
vi.mock("@/lib/ai/sdk", () => ({
  generateObject: mocks.generateObject,
  gateway: (model: string) => ({ model }),
  createGateway: () => (model: string) => ({ model }),
}));
import { runAggregatorAgent } from "@/lib/search/agents/aggregator";

const plan = {
  destination: "Paris",
  dates: { start: "2099-01-01", end: "2099-01-02", nights: 1 },
  vibeInterpretation: { vibes: ["culture"] },
  activityCriteria: { pacePreference: "balanced" },
};
const independent = {
  id: "local-1",
  name: "Independent walk",
  category: "sightseeing",
  duration: 60,
  price: 0,
  bestTimeOfDay: "morning",
};
const provider = {
  ...independent,
  id: "activity_v_123P1",
  name: "PROVIDER_ONLY_TITLE",
  affiliatePartner: "viator",
  viatorContentVersion: 1,
};

beforeEach(() => {
  mocks.generateObject.mockReset();
  mocks.generateObject.mockResolvedValue({
    object: { days: [], topHotelId: "" },
  });
  vi.stubEnv("VIATOR_CONTENT_ENABLED", "true");
  vi.stubEnv("VIATOR_CONTENT_APPROVAL_REF", "content-review-123");
  vi.stubEnv("VIATOR_EXTERNAL_PROCESSING_ENABLED", "false");
  vi.stubEnv("VIATOR_EXTERNAL_PROCESSING_APPROVAL_REF", "");
});
afterEach(() => vi.unstubAllEnvs());

it("keeps provider data out of the model prompt while planning continues", async () => {
  await runAggregatorAgent(
    plan as never,
    [],
    [provider, independent] as never,
    [],
  );
  const prompt = mocks.generateObject.mock.calls[0][0].prompt;
  expect(prompt).toContain("Independent walk");
  expect(prompt).not.toContain("PROVIDER_ONLY_TITLE");
  expect(prompt).not.toContain("activity_v_123P1");
});

it("requires separate recorded approval before including provider metadata", async () => {
  vi.stubEnv("VIATOR_EXTERNAL_PROCESSING_ENABLED", "true");
  vi.stubEnv("VIATOR_EXTERNAL_PROCESSING_APPROVAL_REF", "AI-review-123");
  await runAggregatorAgent(plan as never, [], [provider] as never, []);
  expect(mocks.generateObject.mock.calls[0][0].prompt).toContain(
    "PROVIDER_ONLY_TITLE",
  );
});

it("does not recover a provider item via a hallucinated model ID", async () => {
  mocks.generateObject.mockResolvedValue({
    object: {
      days: [
        {
          dayNumber: 1,
          date: "2099-01-01",
          title: "Day 1",
          summary: "",
          morning: { activityIds: [provider.id, independent.id] },
          afternoon: { activityIds: [] },
          evening: { activityIds: [] },
          tips: [],
          estimatedCost: 0,
          currency: "USD",
        },
      ],
    },
  });
  const result = await runAggregatorAgent(
    plan as never,
    [],
    [provider, independent] as never,
    [],
  );
  expect(result.days[0].morning.activities).toEqual([independent]);
});
