import { describe, expect, it } from "vitest";
import {
  resolveReviewedVenue,
  type ReviewedVenueIdentity,
} from "@/lib/search/venue-identity";
const source: ReviewedVenueIdentity = {
  id: "reviewed-branch",
  destination: "Example City, Canada",
  country: "Canada",
  aliases: ["Museum (ABC) International"],
  addresses: ["10 Example St, Unit 2, Example City, Canada"],
};
const candidate = {
  destination: source.destination,
  name: source.aliases[0],
  address: source.addresses[0],
};
describe("reviewed venue identity", () => {
  it.each([
    "Museum (ABC) International - Evening Visit",
    "Museum ABC International — Evening Visit",
    "Ｍｕｓｅｕｍ ABC International – Visit",
  ])("matches the ordinary visit %s", (name) => {
    expect(
      resolveReviewedVenue(
        { ...candidate, name, address: "10 Example St, Unit 2, Example City" },
        [source],
        "ordinary_visit",
      ),
    ).toMatchObject({ status: "matched", matches: [source] });
    expect(resolveReviewedVenue({ ...candidate, name }, [source]).status).toBe(
      "unresolved",
    );
  });
  it.each([
    "Museum ABC International Exterior Walk",
    "Museum ABC International Late View",
    "Museum ABC International Evening Concert",
    "Museum ABC International Guided Tour",
    "Museum ABC International Annex",
    "Museum ABC International - 2027 Visit",
    "Museum ABC",
  ])("does not discard qualifiers in %s", (name) => {
    expect(
      resolveReviewedVenue({ ...candidate, name }, [source], "ordinary_visit")
        .status,
    ).toBe("unresolved");
  });
  it.each([
    "11 Example St, Unit 2, Example City",
    "10 Example St, Unit 3, Example City",
    "10 Example St, Example City",
    "10 Example St, Unit 2, Other City",
    "",
  ])("does not transfer evidence to address %s", (address) => {
    expect(
      resolveReviewedVenue({ ...candidate, address }, [source]).status,
    ).toBe("unresolved");
  });
  it("requires joint anchors from one record and detects ambiguity", () => {
    expect(
      resolveReviewedVenue(candidate, [
        source,
        { ...source, id: "other-review" },
      ]).status,
    ).toBe("ambiguous");
    expect(
      resolveReviewedVenue(candidate, [
        { ...source, addresses: ["20 Different St"] },
        { ...source, aliases: ["Other Museum"] },
      ]).status,
    ).toBe("unresolved");
    expect(
      resolveReviewedVenue(
        { ...candidate, destination: "Other City, Canada" },
        [source],
      ).status,
    ).toBe("unresolved");
  });
  it("preserves non-Latin venue names and refuses empty names", () => {
    const local = { ...source, aliases: ["國立臺灣博物館"] };
    expect(
      resolveReviewedVenue({ ...candidate, name: "國立臺灣博物館" }, [local])
        .status,
    ).toBe("matched");
    expect(
      resolveReviewedVenue({ ...candidate, name: "國立故宮博物院" }, [local])
        .status,
    ).toBe("unresolved");
    expect(
      resolveReviewedVenue({ ...candidate, name: " " }, [source]).reason,
    ).toBe("missing_identity");
  });
});
