import { describe, expect, it } from "vitest";
import { isSpeculativeEventTitle } from "@/lib/search/speculative-event";
describe("explicitly speculative event titles", () => {
  it.each([
    "Carpentry Exhibition (Check Local Schedules)",
    "Concert — dates TBC",
    "Jazz performance if available",
    "Festival subject to confirmation",
    "Show (if running)",
  ])("flags %s", (title) => expect(isSpeculativeEventTitle(title)).toBe(true));
  it.each([
    "National Museum",
    "Permanent exhibition",
    "Carnegie Hall performance",
    "Museum (check opening hours)",
    "Festival history walking tour",
    "Local market — check local schedule",
  ])("does not infer event uncertainty from %s", (title) =>
    expect(isSpeculativeEventTitle(title)).toBe(false),
  );
});

import { isGenericEventTitle } from "@/lib/search/speculative-event";
it.each([
  "Performance at Carnegie Hall",
  "Classical Music Performance at Carnegie Hall",
  "Concert at Carnegie Hall",
  "Broadway Show",
])("defers the unidentified event %s", (title) =>
  expect(isGenericEventTitle(title)).toBe(true),
);
it.each([
  "Tour of Carnegie Hall",
  "On the Town in Concert",
  "Concert at Carnegie Hall featuring a named artist",
  "Museum of the Performing Arts",
])("does not infer a generic performance from %s", (title) =>
  expect(isGenericEventTitle(title)).toBe(false),
);

import { isSpecialOpeningTitle } from "@/lib/search/speculative-event";
it.each([
  "National Gallery of Victoria (NGV International) Late View",
  "Museum late-opening",
  "After-hours admission to the gallery",
  "After hours tour of the museum",
])("requires dated special-opening evidence for %s", (title) =>
  expect(isSpecialOpeningTitle(title)).toBe(true),
);
it.each([
  "Royal Exhibition Building Twilight Viewing",
  "Gallery evening visit",
  "Riverside night walk",
  "Late lunch",
])("does not infer special admission from %s", (title) =>
  expect(isSpecialOpeningTitle(title)).toBe(false),
);
