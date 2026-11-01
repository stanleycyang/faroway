import { expect, it, vi } from "vitest";

const generateObject = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/sdk", () => ({
  generateObject,
  gateway: (model: string) => model,
  createGateway: () => (model: string) => model,
}));
import {
  buildFallbackSearchPlan,
  runOrchestratorAgent,
} from "@/lib/search/agents/orchestrator";

it("keeps saved requirements and origin when the model omits or changes them", async () => {
  const input = {
    destination: "Tokyo",
    startDate: "2026-06-01",
    endDate: "2026-06-03",
    travelers: 3,
    adults: 2,
    children: 1,
    vibes: [],
    interests: ["art"],
    dietaryRestrictions: ["peanut allergy"],
    mobilityNeeds: "step-free access",
    originCity: "San Francisco",
    originAirport: "SFO",
  };
  const modelPlan = buildFallbackSearchPlan({
    ...input,
    interests: [],
    dietaryRestrictions: [],
    mobilityNeeds: undefined,
    originCity: "New York",
    originAirport: "JFK",
  });
  modelPlan.dietaryRestrictions = ["model-added restriction"];
  modelPlan.diningCriteria.dietaryNeeds = ["model-added preference"];
  modelPlan.destination = "Wrong destination";
  modelPlan.dates = { start: "2026-01-01", end: "2026-01-02", nights: 1 };
  generateObject.mockResolvedValue({ object: modelPlan });
  const plan = await runOrchestratorAgent(input);
  expect(plan.destination).toBe("Tokyo");
  expect(plan.dates).toEqual({
    start: "2026-06-01",
    end: "2026-06-03",
    nights: 2,
  });
  expect(plan.dietaryRestrictions).toEqual(["peanut allergy"]);
  expect(plan.diningCriteria.dietaryNeeds).toContain("peanut allergy");
  expect(plan.mobilityNeeds).toBe("step-free access");
  expect(plan.activityCriteria.interests).toContain("art");
  expect(plan.transportCriteria).toMatchObject({
    originCity: "San Francisco",
    originAirport: "SFO",
  });
  expect(plan).toMatchObject({ travelers: 3, adults: 2, children: 1 });
  expect(generateObject.mock.calls[0][0].prompt).toContain("peanut allergy");
  expect(generateObject.mock.calls[0][0].prompt).toContain("step-free access");
});
