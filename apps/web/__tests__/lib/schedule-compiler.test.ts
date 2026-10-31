import { describe, expect, it } from "vitest";
import rome from "../../../../scripts/fixtures/agentic-rome-overload.json";
import { compileSchedule } from "@/lib/search/schedule-compiler";
import type {
  ActivityResult,
  DiningResult,
  SearchPlan,
} from "@/lib/search/types";

const plan = rome.trace.steps[0].output as unknown as SearchPlan;
const activities = rome.trace.steps[2].output as unknown as ActivityResult[];
const dining = rome.trace.steps[3].output as unknown as DiningResult[];
const slots = ["morning", "afternoon", "evening"] as const;
const extended = {
  ...plan,
  dates: { start: "2027-01-11", end: "2027-01-13", nights: 0 },
};
function visit(
  id: string,
  duration: number,
  time: ActivityResult["bestTimeOfDay"] = "any",
): ActivityResult {
  return {
    ...activities[0],
    id,
    name: id,
    duration,
    bestTimeOfDay: time,
    vibeScore: 80,
  };
}

describe("experimental schedule compiler", () => {
  it("defers alcohol-focused stops for a party with children and exposes the missing highlight", () => {
    const input = {
      ...plan,
      children: 1,
      activityCriteria: {
        ...plan.activityCriteria,
        mustSee: ["Mulled Wine Experience"],
      },
    };
    const supply = [
      {
        ...visit("wine", 60),
        name: "Hviids Vinstue Mulled Wine Experience",
        vibeScore: 100,
      },
      visit("market", 60),
    ];
    const result = compileSchedule(input, supply, []);
    expect(
      slots.flatMap((slot) => result.days[0][slot].activities).map((a) => a.id),
    ).toEqual(["market"]);
    expect(result.reviewRequiredActivities).toEqual([
      { id: "wine", reason: "alcohol_focused_title" },
    ]);
    expect(result.unfulfilledHighlights).toContain("Mulled Wine Experience");
    expect(result.verified).toBe(false);
    expect(
      compileSchedule({ ...input, children: 0 }, supply, [])
        .reviewRequiredActivities,
    ).toEqual([]);
  });
  it("keeps room for a long evening highlight rather than filling the day with short visits", () => {
    const input = {
      ...plan,
      activityCriteria: {
        ...plan.activityCriteria,
        pacePreference: "relaxed" as const,
        mustSee: ["Evening highlight"],
      },
    };
    const supply = [
      ...Array.from({ length: 10 }, (_, i) =>
        visit(`walk-${i}`, 60, "morning"),
      ),
      {
        ...visit("highlight", 240, "evening"),
        name: "Evening highlight experience",
      },
    ];
    const result = compileSchedule(input, supply, []);
    expect(result.days[0].evening.activities.map((a) => a.id)).toEqual([
      "highlight",
    ]);
    expect(
      slots.flatMap((slot) => result.days[0][slot].activities),
    ).toHaveLength(1);
  });
  it("reserves the only available final-day visit instead of greedily using it earlier", () => {
    const supply = Array.from({ length: 10 }, (_, i) => ({
      ...visit(`v${i}`, 60),
      vibeScore: i === 0 ? 100 : 80,
    }));
    const exclusions = supply.slice(1).map((activity) => ({
      activityId: activity.id,
      date: extended.dates.end,
      reason: "closed on final day",
      sourceUrl: "https://official.example/hours",
      observedAt: "2026-10-31",
    }));
    const result = compileSchedule(extended, supply, [], exclusions);
    expect(
      slots.flatMap((slot) => result.days[2][slot].activities).map((a) => a.id),
    ).toContain("v0");
    expect(
      result.issues.filter((issue) => issue.endsWith("activity_supply_gap")),
    ).toHaveLength(0);
  });
  it("respects a dated exclusion without interpreting other dates as verified open", () => {
    const supply = [
      visit("museum", 60),
      visit("walk", 60),
      visit("gallery", 60),
    ];
    const result = compileSchedule(
      extended,
      supply,
      [],
      [
        {
          activityId: "museum",
          date: extended.dates.start,
          reason: "reported closed weekday",
          sourceUrl: "https://official.example/hours",
          observedAt: "2026-10-31",
        },
      ],
    );
    expect(
      slots.flatMap((slot) => result.days[0][slot].activities).map((a) => a.id),
    ).not.toContain("museum");
    expect(
      result.days
        .flatMap((day) => slots.flatMap((slot) => day[slot].activities))
        .map((a) => a.id),
    ).toContain("museum");
    for (const day of result.days)
      expect(slots.flatMap((slot) => day[slot].activities)).toHaveLength(1);
    expect(result.verified).toBe(false);
  });
  it("allocates the observed 525-minute Rome inventory without shortening or inventing visits", () => {
    const before = JSON.stringify(activities);
    const result = compileSchedule(plan, activities, dining);
    const selected = slots.flatMap((slot) => result.days[0][slot].activities);
    expect(selected.length).toBeGreaterThan(0);
    expect(
      selected.reduce((sum, a) => sum + a.duration, 0),
    ).toBeLessThanOrEqual(420);
    for (const activity of selected) expect(activities).toContain(activity);
    expect(result.unselectedActivityIds.length).toBeGreaterThan(0);
    expect(JSON.stringify(activities)).toBe(before);
    expect(result.verified).toBe(false);
  });

  it("reserves supply for later days even when every visit is evening-only", () => {
    const result = compileSchedule(
      extended,
      [1, 2, 3, 4].map((i) => visit(`v${i}`, 60, "evening")),
      [],
    );
    expect(result.days.map((day) => day.date)).toEqual([
      "2027-01-11",
      "2027-01-12",
      "2027-01-13",
    ]);
    for (const day of result.days) {
      expect(day.evening.activities.length).toBeGreaterThan(0);
      expect(day.morning.activities).toHaveLength(0);
      expect(day.afternoon.activities).toHaveLength(0);
    }
  });

  it("exposes sparse and invalid inventory instead of fabricating coverage", () => {
    const result = compileSchedule(
      extended,
      [visit("hours", 2.5), visit("zero", 0), visit("valid", 60)],
      [],
    );
    expect(
      result.days.flatMap((day) =>
        slots.flatMap((slot) => day[slot].activities),
      ),
    ).toHaveLength(1);
    expect(
      result.issues.filter((issue) => issue.endsWith("activity_supply_gap")),
    ).toHaveLength(2);
    expect(
      result.issues.filter((issue) => issue.endsWith("meal_supply_gap")),
    ).toHaveLength(9);
    expect(result.issues).toContain(
      "excluded_invalid_or_infeasible_activity:hours",
    );
  });

  it("keeps a nearby repeated restaurant ahead of a distant unused one and discloses allergy uncertainty", () => {
    const point = { ...activities[0].location, lat: 40, lng: -74 };
    const options = [
      {
        ...dining[0],
        id: "near",
        location: point,
        mealTypes: ["breakfast", "lunch", "dinner"],
      },
      {
        ...dining[0],
        id: "far",
        location: { ...point, lat: 40.04 },
        mealTypes: ["breakfast", "lunch", "dinner"],
      },
    ] as DiningResult[];
    const result = compileSchedule(
      {
        ...plan,
        requirements: {
          allergies: ["peanuts"],
          dietaryPreferences: [],
          accessibility: [],
          mobilityNotes: "",
        },
      },
      [{ ...visit("nearby", 60), location: point }],
      options,
    );
    for (const slot of slots)
      expect(result.days[0][slot].meal?.id).toBe("near");
    expect(result.days[0].tips.join(" ")).toContain(
      "No venue's allergy handling has been verified",
    );
  });

  it("enforces independent pace, duration, identity and slot constraints across varied inventories", () => {
    for (const pace of ["relaxed", "moderate", "packed"] as const) {
      const supply = Array.from({ length: 12 }, (_, i) =>
        visit(
          `v${i}`,
          [45, 120, 180, 240][i % 4],
          [...slots, "any" as const][i % 4],
        ),
      );
      const input = {
        ...extended,
        activityCriteria: { ...plan.activityCriteria, pacePreference: pace },
      };
      const result = compileSchedule(input, supply, []);
      const used = new Set<string>();
      for (const day of result.days) {
        const all = slots.flatMap((slot) => day[slot].activities);
        expect(all.length).toBeGreaterThan(0);
        expect(all.length).toBeLessThanOrEqual(
          pace === "relaxed" ? 2 : pace === "packed" ? 5 : 4,
        );
        expect(all.reduce((sum, a) => sum + a.duration, 0)).toBeLessThanOrEqual(
          pace === "relaxed" ? 240 : pace === "packed" ? 600 : 420,
        );
        for (const slot of slots)
          for (const a of day[slot].activities) {
            expect(a.bestTimeOfDay === "any" || a.bestTimeOfDay === slot).toBe(
              true,
            );
            expect(used.has(a.id)).toBe(false);
            used.add(a.id);
            expect(supply).toContain(a);
          }
      }
      expect(compileSchedule(input, supply, [])).toEqual(result);
    }
  });

  it("rejects malformed or unbounded dates before searching", () => {
    for (const dates of [
      { start: "2027-02-30", end: "2027-03-03", nights: 1 },
      { start: "2027-01-01", end: "2027-03-01", nights: 1 },
      { start: "invalid", end: "2027-03-01", nights: 1 },
    ])
      expect(() =>
        compileSchedule({ ...plan, dates }, activities, dining),
      ).toThrow(/valid dates/);
  });
});
