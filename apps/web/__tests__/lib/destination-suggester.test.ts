import { describe, expect, it } from "vitest";
import {
  IMAGE_PATHS,
  destinationCoverCatalog,
  getImageUrl,
} from "@faroway/constants";
import {
  SUGGESTER_CATALOG_COUNT,
  SuggestDestinationsInputSchema,
  suggestDestinations,
} from "@/lib/trips/destination-suggester";

const REF_DATE = new Date(2026, 3, 15); // April 15, 2026

describe("suggestDestinations", () => {
  it("covers all 42 destinations in destinationCoverCatalog without bundling destination-guides", () => {
    expect(SUGGESTER_CATALOG_COUNT).toBe(destinationCoverCatalog.length);
    expect(SUGGESTER_CATALOG_COUNT).toBe(42);
  });

  it("returns 3 warm winter-sun destinations when asked for warm beaches in January", () => {
    const results = suggestDestinations(
      {
        query: "Warm sunny beach getaway to escape the cold",
        month: "January",
        budget: "moderate",
        days: 6,
      },
      REF_DATE,
    );

    expect(results).toHaveLength(3);
    for (const pitch of results) {
      expect(pitch.whyItFits.length).toBeGreaterThan(10);
      expect(pitch.seasonNote.length).toBeGreaterThan(10);
      expect(pitch.heroImage).toBe(
        getImageUrl(IMAGE_PATHS.destinations[pitch.slug]),
      );
      expect(pitch.suggestedVibes.length).toBeGreaterThan(0);
      expect(pitch.prefillParams.destination).toBe(pitch.name);
      expect(pitch.prefillParams.startDate).toBe("2027-01-10");
      expect(pitch.prefillParams.endDate).toBe("2027-01-15");
    }
    // Should not pitch alpine ski towns for a warm beach escape
    expect(results.map((r) => r.slug)).not.toContain("chamonix");
    expect(results.map((r) => r.slug)).not.toContain("reykjavik");
  });

  it("respects origin hub and short flight duration constraints", () => {
    const results = suggestDestinations(
      {
        query: "Short flight under 6 hours with beaches or culture",
        origin: "NYC",
        month: "February",
        days: 4,
      },
      REF_DATE,
    );

    expect(results).toHaveLength(3);
    expect(results[0].flightHint).toContain("US East Coast");
    // Top pick from NYC under 6h should be nearby (e.g. Cancun, Costa Rica, Havana, New York, Reykjavik, Dublin)
    const slugs = results.map((r) => r.slug);
    expect(
      slugs.some((s) =>
        [
          "cancun",
          "costa-rica",
          "havana",
          "new-york",
          "reykjavik",
          "dublin",
        ].includes(s),
      ),
    ).toBe(true);
  });

  it("scores alpine & snow queries toward mountain destinations", () => {
    const results = suggestDestinations(
      {
        query: "Alpine mountains and skiing in Europe",
        month: "January",
      },
      REF_DATE,
    );

    expect(results).toHaveLength(3);
    const slugs = results.map((r) => r.slug);
    expect(slugs).toContain("chamonix");
  });

  it("excludes destinations the traveler explicitly asks to skip and diversifies countries", () => {
    const results = suggestDestinations(
      {
        query: "Walkable foodie city in Europe, not Paris and skip Rome",
        month: "October",
      },
      REF_DATE,
    );

    expect(results).toHaveLength(3);
    const slugs = results.map((r) => r.slug);
    expect(slugs).not.toContain("paris");
    expect(slugs).not.toContain("rome");
    const countries = new Set(results.map((r) => r.country));
    expect(countries.size).toBe(3);
  });

  it("validates API input schema cleanly", () => {
    expect(
      SuggestDestinationsInputSchema.safeParse({ query: "a" }).success,
    ).toBe(false);
    expect(
      SuggestDestinationsInputSchema.safeParse({
        query: "Warm foodie city",
        origin: "SFO",
        month: "October",
        budget: "budget",
        days: 5,
      }).success,
    ).toBe(true);
  });
});
