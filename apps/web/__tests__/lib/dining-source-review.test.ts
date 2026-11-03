import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  createGateway: vi.fn(),
}));
vi.mock("ai", () => mocks);
import {
  discoverDiningReviewOptions,
  diningSourceReviewEnabled,
} from "@/lib/search/dining-source-review";

const env = {
  FAROWAY_DINING_SOURCE_EXPERIMENT: "public-review-v1",
  FAROWAY_SCHEDULE_EXPERIMENT: "compiled-narrated-v1",
  PLANNING_THINKING_AGGREGATOR: "low",
  VERCEL_ENV: "preview",
  NEXT_PUBLIC_SUPABASE_URL: "https://omovikloadpvzijoaqus.supabase.co",
  AI_GATEWAY_API_KEY: "synthetic-key",
};
const plan = {
  destination: "Example City",
  dates: { start: "2030-01-01" },
  dietaryNeeds: "PRIVATE_MEDICAL_DETAIL",
  requirements: { private: "PRIVATE_REQUIREMENT" },
  diningCriteria: { mealPriorities: ["dinner"] },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  mocks.createGateway.mockReturnValue(
    Object.assign((model: string) => model, {
      tools: { parallelSearch: () => ({}) },
    }),
  );
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
it("requires the explicit experiment, isolated target, preview context and key", async () => {
  expect(diningSourceReviewEnabled(env)).toBe(true);
  for (const change of [
    { FAROWAY_DINING_SOURCE_EXPERIMENT: undefined },
    { VERCEL_ENV: "production" },
    { AI_GATEWAY_API_KEY: "" },
    { NEXT_PUBLIC_SUPABASE_URL: "https://jcnephijkxgtprsutgsf.supabase.co" },
  ])
    expect(diningSourceReviewEnabled({ ...env, ...change })).toBe(false);
  vi.stubEnv("FAROWAY_DINING_SOURCE_EXPERIMENT", "");
  expect(await discoverDiningReviewOptions(plan as never)).toEqual([]);
  expect(mocks.createGateway).not.toHaveBeenCalled();
});
it("uses a public-only bounded request and returns unscheduled source-linked options", async () => {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  const venue = {
    name: "Cafe A",
    url: "https://cafe.example/",
    address: "12 Main Street",
    nameQuote: "Cafe A",
    addressQuote: "12 Main Street",
    mealQuote: "Dinner daily",
  };
  mocks.generateText.mockResolvedValue({
    text: JSON.stringify({ venues: [venue] }),
    usage: { inputTokens: 10, outputTokens: 20 },
    steps: [
      {
        toolResults: [
          {
            toolName: "parallel_search",
            providerExecuted: true,
            toolCallId: "call1",
            output: {
              search_id: "search1",
              results: [
                {
                  url: venue.url,
                  title: "Cafe A",
                  excerpts: ["12 Main Street. Dinner daily."],
                },
              ],
            },
          },
        ],
      },
    ],
    providerMetadata: { gateway: { cost: "0.01" } },
  });
  const options = await discoverDiningReviewOptions(plan as never);
  expect(options).toHaveLength(1);
  expect(options[0]).toMatchObject({
    name: "Cafe A",
    planningIdea: true,
    mealTypes: [],
    source: { url: venue.url },
    location: { address: venue.address },
  });
  expect(options[0].location.lat).toBeUndefined();
  const args = mocks.generateText.mock.calls[0][0];
  expect(args.maxRetries).toBe(0);
  expect(args.prompt).not.toContain("PRIVATE");
  expect(args.prompt).not.toContain("2030-01-01");
  expect(args.prompt).toContain("Example City");
  expect(args.maxOutputTokens).toBe(2500);
});
it("leaves review options empty on failure without retrying", async () => {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  mocks.generateText.mockRejectedValue(new Error("provider unavailable"));
  expect(await discoverDiningReviewOptions(plan as never)).toEqual([]);
  expect(mocks.generateText).toHaveBeenCalledTimes(1);
  expect(console.warn).toHaveBeenCalledWith(
    expect.stringContaining('"billingKnown":false'),
  );
});
