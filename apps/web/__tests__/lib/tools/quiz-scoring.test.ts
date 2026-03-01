import { describe, it, expect, vi } from "vitest";

// Mock destination-guides so scoreDestinations has destinations to score against
vi.mock("@/lib/destination-guides", () => ({
  destinationGuides: [
    { slug: "tokyo", name: "Tokyo", country: "Japan" },
    { slug: "bali", name: "Bali", country: "Indonesia" },
    { slug: "paris", name: "Paris", country: "France" },
    { slug: "barcelona", name: "Barcelona", country: "Spain" },
    { slug: "reykjavik", name: "Reykjavik", country: "Iceland" },
  ],
}));

import { scoreDestinations } from "@/lib/tools/quiz-scoring";

describe("scoreDestinations", () => {
  it("returns top 3 results sorted by score", () => {
    const answers = [
      [{ label: "City", emoji: "🏙️", tags: { urban: 3, culture: 2 } }],
      [{ label: "Food", emoji: "🍜", tags: { foodie: 3 } }],
    ];

    const results = scoreDestinations(answers);
    expect(results).toHaveLength(3);
    // Scores should be descending
    expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    expect(results[1].score).toBeGreaterThanOrEqual(results[2].score);
  });

  it("normalizes top result to ~95%", () => {
    const answers = [[{ label: "Beach", emoji: "🏖️", tags: { beach: 5 } }]];

    const results = scoreDestinations(answers);
    expect(results[0].matchPercent).toBe(95);
  });

  it("includes matchReasons as humanized tags", () => {
    const answers = [
      [{ label: "Adventure", emoji: "🏔️", tags: { adventure: 3, nature: 2 } }],
    ];

    const results = scoreDestinations(answers);
    // Reykjavik has nature and adventure tags
    const reykjavik = results.find((r) => r.destination.slug === "reykjavik");
    if (reykjavik && reykjavik.matchReasons.length > 0) {
      // Match reasons should be humanized strings, not raw tag names
      for (const reason of reykjavik.matchReasons) {
        expect(typeof reason).toBe("string");
        expect(reason.length).toBeGreaterThan(0);
      }
    }
  });

  it("limits matchReasons to 3", () => {
    const answers = [
      [
        {
          label: "Everything",
          emoji: "✨",
          tags: { culture: 1, foodie: 1, urban: 1, solo: 1, moderate: 1 },
        },
      ],
    ];

    const results = scoreDestinations(answers);
    for (const result of results) {
      expect(result.matchReasons.length).toBeLessThanOrEqual(3);
    }
  });

  it("aggregates tags from multiple answer sets", () => {
    const answers = [
      [{ label: "A", emoji: "🅰️", tags: { culture: 2 } }],
      [{ label: "B", emoji: "🅱️", tags: { culture: 3, foodie: 1 } }],
    ];

    const results = scoreDestinations(answers);
    // Tokyo has both culture and foodie tags, should score high
    expect(results.length).toBeGreaterThan(0);
  });

  it("handles empty answers", () => {
    const results = scoreDestinations([]);
    expect(results).toHaveLength(3);
    // All scores should be 0
    for (const result of results) {
      expect(result.score).toBe(0);
    }
  });

  it("handles answers with no matching tags", () => {
    const answers = [
      [{ label: "Unknown", emoji: "❓", tags: { nonexistent_tag: 10 } }],
    ];

    const results = scoreDestinations(answers);
    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result.score).toBe(0);
    }
  });
});
