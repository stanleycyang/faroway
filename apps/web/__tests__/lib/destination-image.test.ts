import { expect, it } from "vitest";
import { getImageUrl, IMAGE_PATHS } from "@faroway/constants";
import { destinationGuides } from "@/lib/destination-guides";
import {
  destinationImage,
  destinationCoverCatalog,
} from "@/lib/trips/destination-image";

it("uses the existing Lisbon photo for the real API destination label", () => {
  expect(destinationImage("Lisbon, Portugal")).toBe(
    getImageUrl(IMAGE_PATHS.destinations.lisbon),
  );
  expect(destinationImage("  LISBON ,  Portugal  ")).toBe(
    destinationImage("Lisbon"),
  );
});
it("covers the existing guide catalog without importing its editorial text in the client", () => {
  expect(destinationCoverCatalog).toHaveLength(destinationGuides.length);
  for (const guide of destinationGuides) {
    expect(destinationImage(`${guide.name}, ${guide.country}`)).toBe(
      guide.heroImage,
    );
    expect(destinationImage(guide.name)).toBe(guide.heroImage);
  }
});
it("does not substitute photography for a different or ambiguous destination", () => {
  for (const label of [
    "Paris, USA",
    "Paris, Texas, USA",
    "Lisbon, Spain",
    "Lisbon Heights",
    "Unknown",
    "",
    "Paris,",
    ",France",
  ])
    expect(destinationImage(label)).toBeUndefined();
  expect(destinationImage("New York, United States")).toBe(
    destinationImage("New York, USA"),
  );
  expect(destinationImage("London, UK")).toBe(destinationImage("London"));
});
