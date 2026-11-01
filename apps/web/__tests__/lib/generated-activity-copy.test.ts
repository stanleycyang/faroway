import { expect, it } from "vitest";
import {
  screenGeneratedActivityCopy,
  GENERATED_ACCESS_REVIEW_NOTE,
  GENERATED_ACCESS_CONCERN_NOTE,
} from "@/lib/search/generated-activity-copy";
import { activityMobilityReviewReason } from "@/lib/search/party-suitability";
const candidate = {
  id: "visit-1",
  name: "Accessible Gondola Ride",
  description:
    "Explore the canals. A hydraulic platform provides safe wheelchair boarding.",
  vibeMatch: ["culture", "wheelchair-accessible"],
  duration: 90,
  location: { address: "Original address" },
};
it("removes generated access promises from copy, title and labels without changing duration or location", () => {
  const result = screenGeneratedActivityCopy(candidate);
  expect(result.name).toBe("Gondola Ride");
  expect(result.description).toBe(
    `Explore the canals. ${GENERATED_ACCESS_REVIEW_NOTE}`,
  );
  expect(result.vibeMatch).toEqual(["culture"]);
  expect(result.id).toBe(candidate.id);
  expect(result.duration).toBe(candidate.duration);
  expect(result.location).toEqual(candidate.location);
  expect(screenGeneratedActivityCopy(result)).toEqual(result);
  expect(candidate.name).toBe("Accessible Gondola Ride");
});
it.each([
  "It is not wheelchair accessible.",
  "There is no lift.",
  "The tour requires steep stairs.",
  "It is inaccessible to wheelchair users.",
])("does not turn a generated obstacle into reassurance: %s", (description) => {
  const result = screenGeneratedActivityCopy({ ...candidate, description });
  expect(result.description).toContain(GENERATED_ACCESS_CONCERN_NOTE);
  expect(
    activityMobilityReviewReason(
      { requirements: { accessibility: ["step_free_entrance"] } },
      result.description,
    ),
  ).toBe("supplied_access_conflict");
  expect(screenGeneratedActivityCopy(result)).toEqual(result);
});
it("does not treat negated stairs as a reported obstacle, or Spanish Steps as an access promise", () => {
  const negated = screenGeneratedActivityCopy({
    ...candidate,
    description: "The tour does not require stairs. Ramps are available.",
  });
  expect(negated.description).toContain(GENERATED_ACCESS_REVIEW_NOTE);
  expect(negated.description).not.toContain(GENERATED_ACCESS_CONCERN_NOTE);
  const ordinary = {
    ...candidate,
    name: "Spanish Steps",
    description: "See historic architecture.",
    vibeMatch: ["art"],
  };
  expect(screenGeneratedActivityCopy(ordinary)).toEqual(ordinary);
});
it("retains an obstacle flagged only in generated labels", () => {
  const result = screenGeneratedActivityCopy({
    ...candidate,
    name: "Museum",
    description: "Art collections.",
    vibeMatch: ["not wheelchair accessible"],
  });
  expect(result.description).toContain(GENERATED_ACCESS_CONCERN_NOTE);
});
