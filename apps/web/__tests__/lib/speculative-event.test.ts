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
