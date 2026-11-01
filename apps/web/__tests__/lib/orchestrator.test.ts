import { describe, expect, it } from "vitest";
import { buildFallbackSearchPlan } from "@/lib/search/agents/orchestrator";

describe("orchestrator fallback search plan", () => {
  it("preserves traveler needs and party details on fallback", () => {
    const plan = buildFallbackSearchPlan({
      destination: "Paris",
      startDate: "2026-06-01",
      endDate: "2026-06-03",
      travelers: 3,
      adults: 2,
      children: 1,
      vibes: [],
      interests: ["art"],
      dietaryRestrictions: ["peanut allergy"],
      mobilityNeeds: "step-free access",
    });
    expect(plan.dietaryRestrictions).toEqual(["peanut allergy"]);
    expect(plan.diningCriteria.dietaryNeeds).toEqual(["peanut allergy"]);
    expect(plan.mobilityNeeds).toBe("step-free access");
    expect(plan.activityCriteria.interests).toContain("art");
    expect(plan).toMatchObject({ travelers: 3, adults: 2, children: 1 });
  });
  it("includes a destination IATA code when origin airport is supplied", () => {
    const plan = buildFallbackSearchPlan({
      destination: "Tokyo, Japan",
      startDate: "2026-06-01",
      endDate: "2026-06-05",
      travelers: 2,
      vibes: ["foodie"],
      budget: "moderate",
      originCity: "San Francisco",
      originAirport: "SFO",
    });

    expect(plan.searchPriorities).toContain("transport");
    expect(plan.transportCriteria).toMatchObject({
      originCity: "San Francisco",
      originAirport: "SFO",
      destinationAirport: "TYO",
      cabinClass: "economy",
      maxStops: 1,
    });
  });

  it("keeps transport optional when no origin airport is supplied", () => {
    const plan = buildFallbackSearchPlan({
      destination: "Tokyo",
      startDate: "2026-06-01",
      endDate: "2026-06-05",
      travelers: 2,
      vibes: ["foodie"],
      budget: "moderate",
    });

    expect(plan.searchPriorities).not.toContain("transport");
    expect(plan.transportCriteria).toBeUndefined();
  });

  it("resolves origin city-only input so fallback transport still runs", () => {
    const plan = buildFallbackSearchPlan({
      destination: "Paris",
      startDate: "2026-06-01",
      endDate: "2026-06-05",
      travelers: 2,
      vibes: ["romantic"],
      budget: "luxury",
      originCity: "New York",
    });

    expect(plan.searchPriorities).toContain("transport");
    expect(plan.transportCriteria).toMatchObject({
      originCity: "New York",
      originAirport: "NYC",
      destinationAirport: "PAR",
      cabinClass: "business",
      maxStops: 0,
    });
  });
});
