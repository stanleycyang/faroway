import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { explainStopSelection } from "@/lib/trips/explain-stop";
import { ActivityCard, type Activity } from "@/components/trips/ActivityCard";

describe("explainStopSelection", () => {
  it("explains vibe match, walking proximity, and caps output at 2 crisp reasons", () => {
    const reasons = explainStopSelection(
      {
        name: "Nakamise Street Food Stalls",
        description: "Traditional Japanese street snacks and sweet treats.",
        category: "shopping",
        rating: 4.8,
        location: {
          neighborhood: "Asakusa",
          // ~480m away from Senso-ji -> ~6 min walk
          lat: 35.7105,
          lng: 139.7966,
        },
      },
      {
        vibes: ["foodie"],
        previousStop: {
          name: "Senso-ji",
          lat: 35.7148,
          lng: 139.7967,
        },
      },
    );

    expect(reasons).toHaveLength(2);
    expect(reasons[0]).toBe("Matches your Foodie vibe");
    expect(reasons[1]).toMatch(/^\d+ min walk from Senso-ji$/);
  });

  it("includes high rating when >= 4.5 and falls back to neighborhood or duration", () => {
    const rated = explainStopSelection(
      {
        name: "Meiji Jingu",
        category: "cultural",
        rating: 4.8,
        location: { neighborhood: "Shibuya" },
      },
      { vibes: ["culture"] },
    );

    expect(rated).toEqual(["Matches your Culture vibe", "Highly rated (4.8★)"]);

    const shortStop = explainStopSelection({
      name: "Local Tea Stand",
      duration: 45,
    });
    expect(shortStop).toEqual(["Quick 45 min stop"]);
  });

  it("returns empty array for minimal stop with no factual signals", () => {
    expect(explainStopSelection({ name: "Mystery Spot" }, {})).toEqual([]);
  });

  it("ignores invalid or (0, 0) coordinates for walking proximity", () => {
    const reasons = explainStopSelection(
      {
        name: "Shibuya Sky",
        rating: 4.7,
        location: { lat: 0, lng: 0 },
      },
      {
        previousStop: { name: "Senso-ji", lat: 35.7148, lng: 139.7967 },
      },
    );

    expect(reasons).toEqual(["Highly rated (4.7★)"]);
    expect(reasons.join(" ")).not.toContain("walk");
  });

  it("NEVER fabricates allergen, dietary, or accessibility safety guarantees", () => {
    const reasons = explainStopSelection(
      {
        name: "Ramen Street Kitchen",
        description: "Rich pork broth ramen near Tokyo Station.",
        category: "sightseeing",
        rating: 4.6,
        location: { neighborhood: "Marunouchi", lat: 35.6812, lng: 139.7671 },
      },
      {
        vibes: ["foodie"],
        requirements: {
          allergies: ["peanuts", "shellfish", "tree nuts"],
          dietaryPreferences: ["vegan", "gluten-free", "halal"],
          accessibility: [
            "step_free_entrance",
            "accessible_restroom",
            "accessible_seating",
          ],
          mobilityNotes: "Uses a wheelchair; needs elevators",
        },
      },
    );

    const joined = reasons.join(" ").toLowerCase();
    expect(reasons.length).toBeGreaterThanOrEqual(1);
    expect(reasons.length).toBeLessThanOrEqual(2);
    expect(joined).not.toMatch(
      /allerg|peanut|shellfish|nut-free|vegan|gluten|halal|wheelchair|step-free|accessible|safe for|verified/,
    );
  });

  it("renders rationale pills in ActivityCard using span elements only (no links or buttons)", () => {
    const activity: Activity = {
      id: "act-sensoji",
      name: "Senso-ji Temple",
      description: "Historic Buddhist temple in Asakusa.",
      duration: 90,
      estimatedCost: { amount: 0, currency: "USD" },
      timeOfDay: "morning",
      category: "cultural",
      location: { name: "Asakusa" },
      rating: 4.8,
    };

    const html = renderToStaticMarkup(
      createElement(ActivityCard, {
        activity,
        rationale: ["Matches your Culture vibe", "Highly rated (4.8★)"],
      }),
    );

    expect(html).toContain("Matches your Culture vibe");
    expect(html).toContain("Highly rated (4.8★)");
    expect(html).not.toMatch(/<(a|button)\b/);
  });
});
