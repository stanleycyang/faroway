import { expect, it } from "vitest";
import { activitySourceContext } from "@/lib/search/activity-source-context";

const plan = {
  destination: "New York, USA",
  dates: { start: "2027-01-11", end: "2027-01-13", nights: 2 },
};

it("gives candidate generation reviewed branch/hours evidence without certifying suitability", () => {
  const context = activitySourceContext(plan, "2026-11-03");
  expect(context).toContain("The Jewish Museum");
  expect(context).toContain("1109 5th Ave");
  expect(context).toContain('"weekday":2,"intervals":[]');
  expect(context).toContain("https://thejewishmuseum.org/visit/");
  expect(context).toContain("Unknown claims remain unknown");
  expect(context).not.toContain("Edinburgh Press Club");
});

it("does not reuse stale evidence, future reviews or another destination", () => {
  expect(activitySourceContext(plan, "2030-01-01")).toBe("");
  expect(activitySourceContext(plan, "2020-01-01")).toBe("");
  expect(
    activitySourceContext({ ...plan, destination: "Unknown" }, "2026-11-03"),
  ).toBe("");
});

it("keeps dated review restrictions scoped to the actual trip", () => {
  const context = activitySourceContext(
    {
      destination: "Interlaken, Switzerland",
      dates: { start: "2027-07-11", end: "2027-07-13", nights: 2 },
    },
    "2026-11-03",
  );
  expect(context).not.toContain("Schynige Platte Winter Walk");
});
