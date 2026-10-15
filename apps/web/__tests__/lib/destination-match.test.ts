import { describe, expect, it } from "vitest";
import { destinationGuides } from "@/lib/destination-guides";
import {
  matchDestination,
  postMatchesDestination,
} from "@/lib/destination-match";

describe("matchDestination", () => {
  it("prefers the named city over an earlier country guide", () => {
    expect(
      matchDestination({
        title: "Three days in Kyoto, Japan",
        tags: ["Japan"],
      })?.slug,
    ).toBe("kyoto");
    expect(
      matchDestination({ title: "Phuket beaches in Thailand" })?.slug,
    ).toBe("phuket");
    expect(
      matchDestination({ title: "Driving the Amalfi Coast, Italy" })?.slug,
    ).toBe("amalfi-coast");
    expect(matchDestination({ title: "Ibiza in summer, Spain" })?.slug).toBe(
      "ibiza",
    );
    expect(
      matchDestination({ title: "Skiing in Chamonix, France" })?.slug,
    ).toBe("chamonix");
  });

  it("does not match a country that belongs to more than one city", () => {
    for (const title of [
      "Two weeks in Japan",
      "Thailand itinerary",
      "Italy in spring",
      "Spain by train",
      "France for first timers",
    ]) {
      expect(matchDestination({ title })?.slug).toBeUndefined();
    }
  });

  it("matches an unambiguous country, and not a longer word that contains it", () => {
    expect(matchDestination({ title: "A week in India" })?.slug).toBe("jaipur");
    expect(matchDestination({ title: "Indian street food" })).toBeNull();
    expect(matchDestination({ title: "USA road trip" })?.slug).toBe("new-york");
    expect(matchDestination({ title: "usage tips for trains" })).toBeNull();
  });

  it("lets a tag name beat a less specific title", () => {
    expect(
      matchDestination({
        title: "Tokyo day trip ideas",
        tags: ["Kyoto"],
      })?.slug,
    ).toBe("kyoto");
  });

  it("only lists a post on the destination it actually matches", () => {
    const kyoto = { title: "Kyoto temples", tags: ["Japan"] };
    expect(postMatchesDestination(kyoto, "kyoto")).toBe(true);
    expect(postMatchesDestination(kyoto, "tokyo")).toBe(false);
    expect(destinationGuides.some((guide) => guide.slug === "kyoto")).toBe(
      true,
    );
  });
});
