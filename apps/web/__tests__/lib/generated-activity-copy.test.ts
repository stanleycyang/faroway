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

it("removes the saved Melbourne operating-hours claim while retaining experience text", () => {
  const original = {
    ...candidate,
    name: "State Library Victoria",
    description:
      "Visit the oldest public library in Australia, featuring the heritage La Trobe Reading Room. While the library typically closes at 21:00, visitors can explore the soaring domed ceiling and Victorian architectural grandeur during the evening hours.",
    vibeMatch: ["heritage"],
  };
  const result = screenGeneratedActivityCopy(original);
  expect(result.description).toBe(
    "Visit the oldest public library in Australia, featuring the heritage La Trobe Reading Room.",
  );
  expect(result.location).toEqual(original.location);
  expect(result.duration).toBe(original.duration);
  expect(screenGeneratedActivityCopy(result)).toEqual(result);
});
it.each([
  "The museum opens at 9am.",
  "It is open until midnight.",
  "Last admission is at 8pm.",
  "Opening hours are 9–5.",
  "The gallery is closed on Mondays.",
  "The park is open daily.",
  "The hall closes at ２１:００.",
])(
  "does not present generated operating schedules as evidence: %s",
  (description) => {
    const result = screenGeneratedActivityCopy({
      ...candidate,
      name: "Museum",
      vibeMatch: [],
      description,
    });
    expect(result.description).toBe("Explore this suggested stop.");
    expect(screenGeneratedActivityCopy(result)).toEqual(result);
  },
);
it("preserves experience descriptions, duration estimates and access concerns", () => {
  const description =
    "Explore the open-air sculpture garden. Allow 90 minutes for your visit. Watch the sunset from the terrace.";
  expect(
    screenGeneratedActivityCopy({
      ...candidate,
      name: "Garden",
      vibeMatch: [],
      description,
    }).description,
  ).toBe(description);
  const result = screenGeneratedActivityCopy({
    ...candidate,
    name: "Museum",
    vibeMatch: [],
    description: "The museum closes at 9pm and requires steep stairs.",
  });
  expect(result.description).toContain(GENERATED_ACCESS_CONCERN_NOTE);
  expect(screenGeneratedActivityCopy(result)).toEqual(result);
});

it.each([
  "The interior is largely level, though some side chapels have small thresholds.",
  "The Glasshouses provide a level environment to see exotic plants (some sections might have narrow paths).",
  "While sections are sloped, the lower paths provide a flatter walking route.",
])(
  "retains access review for mixed reassurance and obstacles: %s",
  (description) => {
    const result = screenGeneratedActivityCopy({
      ...candidate,
      name: "Visit",
      vibeMatch: [],
      description: `See the collection. ${description}`,
    });
    expect(result.description).toBe(
      `See the collection. ${GENERATED_ACCESS_CONCERN_NOTE}`,
    );
    expect(
      activityMobilityReviewReason(
        { requirements: { accessibility: ["step_free_entrance"] } },
        result.description,
      ),
    ).toBe("supplied_access_conflict");
    expect(screenGeneratedActivityCopy(result)).toEqual(result);
  },
);

it.each([
  "The interior is largely level.",
  "A flat route connects the collections.",
  "The lower path provides a flatter walking route.",
  "The extension offers improved connectivity between floors.",
  "Smooth surfaces make movement easier.",
  "There are no steep paths.",
  "A route without narrow passages.",
])("does not present unverified surface reassurance: %s", (description) => {
  const result = screenGeneratedActivityCopy({
    ...candidate,
    name: "Visit",
    vibeMatch: [],
    description,
  });
  expect(result.description).toBe(GENERATED_ACCESS_REVIEW_NOTE);
});

it.each([
  "Admire the level of detail in the mosaics.",
  "The upper level houses the sculpture collection.",
  "Visit the flat where the writer lived.",
  "The tour does not involve steep paths. View the gardens.",
])(
  "does not invent an access obstacle from unrelated or negated copy: %s",
  (description) => {
    const result = screenGeneratedActivityCopy({
      ...candidate,
      name: "Visit",
      vibeMatch: [],
      description,
    });
    expect(result.description).toBe(description);
  },
);
