import { describe, expect, it } from "vitest";
import {
  DreamTripPromptInputSchema,
  mergeParsedDreamTrip,
  parseDreamTripPrompt,
  summarizeParsedDreamTrip,
} from "@/lib/trips/prompt-parser";

const REF_DATE = new Date(2026, 3, 15); // April 15, 2026

describe("parseDreamTripPrompt", () => {
  it("extracts catalog destination, duration + month, anniversary group, vibes, dietary, and relaxed mornings", () => {
    const parsed = parseDreamTripPrompt(
      "5 days in Kyoto in October for our anniversary, foodie and temples, luxury, vegetarian, relaxed mornings",
      REF_DATE,
    );

    expect(parsed.destination).toEqual({
      name: "Kyoto",
      country: "Japan",
      slug: "kyoto",
      source: "catalog",
    });
    expect(parsed.startDate).toBe("2026-10-10");
    expect(parsed.endDate).toBe("2026-10-14");
    expect(parsed.durationDays).toBe(5);
    expect(parsed.monthHint).toBe("October");
    expect(parsed.travelers).toBe(2);
    expect(parsed.travelerType).toBe("couple");
    expect(parsed.budget).toBe("luxury");
    expect(parsed.vibes).toEqual(
      expect.arrayContaining(["foodie", "cultural", "romantic"]),
    );
    expect(parsed.vibes.length).toBeLessThanOrEqual(5);
    expect(parsed.dietaryPreferences).toEqual(["Vegetarian"]);
    expect(parsed.mobilityNotes).toContain("Relaxed mornings");
    expect(parsed.pacingPreference).toBe("relaxed");
    expect(parsed.confidence).toBe("high");
    expect(parsed.source).toBe("deterministic");
  });

  it("extracts exact date range, family of 4, allergies, accessibility, and midday rest", () => {
    const parsed = parseDreamTripPrompt(
      "Family of 4 trip to Tokyo from May 10-15, moderate budget, peanut allergy and allergic to shellfish, step-free entrance and accessible restroom, midday rest",
      REF_DATE,
    );

    expect(parsed.destination?.name).toBe("Tokyo");
    expect(parsed.startDate).toBe("2026-05-10");
    expect(parsed.endDate).toBe("2026-05-15");
    expect(parsed.durationDays).toBe(6);
    expect(parsed.travelers).toBe(4);
    expect(parsed.travelerType).toBe("family");
    expect(parsed.budget).toBe("moderate");
    expect(parsed.allergies).toEqual(
      expect.arrayContaining(["peanuts", "shellfish"]),
    );
    expect(parsed.accessibility).toEqual(
      expect.arrayContaining(["step_free_entrance", "accessible_restroom"]),
    );
    expect(parsed.mobilityNotes).toContain("Midday rest break");
  });

  it("handles solo travel, cross-month dates, budget tier, and free-form destinations outside catalog", () => {
    const parsed = parseDreamTripPrompt(
      "Solo budget getaway to Oaxaca May 28 to June 3, street food, photography, gluten-free",
      REF_DATE,
    );

    expect(parsed.destination).toEqual({
      name: "Oaxaca",
      country: undefined,
      source: "user",
    });
    expect(parsed.startDate).toBe("2026-05-28");
    expect(parsed.endDate).toBe("2026-06-03");
    expect(parsed.durationDays).toBe(7);
    expect(parsed.travelers).toBe(1);
    expect(parsed.travelerType).toBe("solo");
    expect(parsed.budget).toBe("budget");
    expect(parsed.vibes).toEqual(
      expect.arrayContaining(["foodie", "photography"]),
    );
    expect(parsed.dietaryPreferences).toEqual(["Gluten-free"]);
  });

  it("separates departure origin from destination and supports catalog aliases", () => {
    const parsed = parseDreamTripPrompt(
      "Flying from Seattle to NYC for 4 days in September with 3 friends, nightlife and shopping",
      REF_DATE,
    );

    expect(parsed.originHint).toBe("Seattle");
    expect(parsed.destination).toEqual({
      name: "New York",
      country: "USA",
      slug: "new-york",
      source: "catalog",
    });
    expect(parsed.travelers).toBe(4);
    expect(parsed.travelerType).toBe("friends");
    expect(parsed.vibes).toEqual(
      expect.arrayContaining(["nightlife", "shopping"]),
    );
  });

  it("rolls past months into the next year relative to referenceDate", () => {
    const parsed = parseDreamTripPrompt(
      "5 days in February in Lisbon",
      REF_DATE,
    );
    expect(parsed.startDate).toBe("2027-02-10");
    expect(parsed.endDate).toBe("2027-02-14");
  });

  it("caps extracted vibes at 5 and supports all dietary preferences", () => {
    const parsed = parseDreamTripPrompt(
      "Barcelona foodie, museums, beach, nightlife, romantic, hiking, spa, shopping, photography, vegan, halal, kosher, pescatarian",
      REF_DATE,
    );

    expect(parsed.vibes).toHaveLength(5);
    expect(parsed.dietaryPreferences).toEqual(
      expect.arrayContaining(["Vegan", "Halal", "Kosher", "Pescatarian"]),
    );
  });

  it("merges LLM enhancements safely without overriding strong deterministic fields", () => {
    const base = parseDreamTripPrompt("5 days in Lisbon in October", REF_DATE);
    const merged = mergeParsedDreamTrip(base, {
      destinationName: "Paris", // should NOT overwrite Lisbon
      vibes: ["foodie", "cultural"],
      budget: "moderate",
      travelerType: "couple",
      travelers: 2,
    });

    expect(merged.destination?.name).toBe("Lisbon");
    expect(merged.vibes).toEqual(["foodie", "cultural"]);
    expect(merged.budget).toBe("moderate");
    expect(merged.travelers).toBe(2);
    expect(merged.source).toBe("hybrid");
  });

  it("validates prompt input length limits with Zod and summarizes parsed fields", () => {
    expect(DreamTripPromptInputSchema.safeParse({ prompt: "a" }).success).toBe(
      false,
    );
    expect(
      DreamTripPromptInputSchema.safeParse({ prompt: "x".repeat(601) }).success,
    ).toBe(false);
    expect(
      DreamTripPromptInputSchema.safeParse({ prompt: "Lisbon in October" })
        .success,
    ).toBe(true);

    const parsed = parseDreamTripPrompt(
      "5 days in Lisbon in October, couple, vegetarian",
      REF_DATE,
    );
    const chips = summarizeParsedDreamTrip(parsed);
    expect(chips).toContain("Lisbon");
    expect(chips).toContain("Oct 10–14");
    expect(chips).toContain("2 · Couple");
    expect(chips).toContain("Vegetarian");
  });
});
