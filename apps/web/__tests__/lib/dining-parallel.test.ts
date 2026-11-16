import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generatePlanningObject: vi.fn(),
  discoverDiningReviewOptions: vi.fn(),
  logPlanningFallback: vi.fn(),
}));

vi.mock("@/lib/ai/planning-step", () => ({
  generatePlanningObject: mocks.generatePlanningObject,
  logPlanningFallback: mocks.logPlanningFallback,
  planningModel: () => "test-model",
}));

vi.mock("@/lib/search/dining-source-review", () => ({
  discoverDiningReviewOptions: mocks.discoverDiningReviewOptions,
}));

import { runDiningAgent } from "@/lib/search/agents/dining";
import type { SearchPlan } from "@/lib/search/types";

const plan = {
  destination: "Lisbon",
  country: "Portugal",
  dates: { start: "2027-05-10", end: "2027-05-11", nights: 1 },
  travelers: 1,
  adults: 1,
  children: 0,
  searchPriorities: ["dining"],
  hotelCriteria: {
    priceRange: { min: 80, max: 200 },
    starRating: [3],
    amenities: [],
    neighborhoods: [],
  },
  activityCriteria: {
    categories: [],
    pacePreference: "moderate",
    mustSee: [],
    interests: [],
  },
  diningCriteria: {
    cuisineTypes: ["seafood"],
    priceRange: "moderate",
    dietaryNeeds: [],
    mealPriorities: ["dinner"],
  },
  vibeInterpretation: {
    vibes: ["food"],
    searchKeywords: [],
    avoidKeywords: [],
  },
} as SearchPlan;

describe("dining agent parallelism", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts source review with the model call and does not repeat either", async () => {
    const started: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    mocks.generatePlanningObject.mockImplementation(async () => {
      started.push("model");
      await gate;
      return { object: { restaurants: [] } };
    });
    mocks.discoverDiningReviewOptions.mockImplementation(async () => {
      started.push("review");
      await gate;
      return [];
    });

    const pending = runDiningAgent(plan, 2);
    await vi.waitFor(() => {
      expect(started.slice().sort()).toEqual(["model", "review"]);
    });
    release();
    await pending;
    expect(mocks.generatePlanningObject).toHaveBeenCalledTimes(1);
    expect(mocks.discoverDiningReviewOptions).toHaveBeenCalledTimes(1);
    expect(mocks.generatePlanningObject.mock.calls[0][1].maxRetries).toBe(0);
  });

  it("does not start a second paid review while repairing missing meals", async () => {
    mocks.generatePlanningObject.mockResolvedValue({
      object: { restaurants: [] },
    });
    mocks.discoverDiningReviewOptions.mockClear();
    await runDiningAgent(plan, 2, {
      coverageTargets: [{ area: "Belém", mealTypes: ["breakfast"] }],
    });
    expect(mocks.discoverDiningReviewOptions).not.toHaveBeenCalled();
    expect(mocks.generatePlanningObject).toHaveBeenCalledTimes(1);
  });

  it("cancels source review when the model call fails", async () => {
    let reviewSignal: AbortSignal | undefined;
    mocks.generatePlanningObject.mockRejectedValue(new Error("model down"));
    mocks.discoverDiningReviewOptions.mockImplementation(
      async (_plan: SearchPlan, signal: AbortSignal) => {
        reviewSignal = signal;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return [];
      },
    );
    await expect(runDiningAgent(plan, 1)).resolves.toEqual([]);
    expect(reviewSignal?.aborted).toBe(true);
    expect(mocks.generatePlanningObject).toHaveBeenCalledTimes(1);
  });
});
