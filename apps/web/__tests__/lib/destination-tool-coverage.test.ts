import { describe, expect, it } from "vitest";
import { getGuideSlugs } from "@/lib/destination-guides";
import { getClimateData } from "@/lib/tools/climate-data";
import { getCostProfile } from "@/lib/tools/cost-data";
import { getVisaInfoForDestination } from "@/lib/tools/visa-data";

describe("destination tool coverage", () => {
  it("has cost, climate, and visa data for every destination guide", () => {
    const slugs = getGuideSlugs();
    expect(slugs.length).toBeGreaterThan(0);
    for (const slug of slugs) {
      expect(getCostProfile(slug)?.slug, slug).toBe(slug);
      expect(getClimateData(slug)?.slug, slug).toBe(slug);
      expect(getVisaInfoForDestination(slug).length, slug).toBeGreaterThan(0);
    }
  });
});
