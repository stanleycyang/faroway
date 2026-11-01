import { venueConstraintsForDate } from "../../../../scripts/uat/lib/venue-constraints";
import venueFacts from "../../../../scripts/fixtures/agentic-venue-constraints.json";
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

it("uses reviewed opening-day evidence before allocating Paris museum visits", () => {
  const input = { ...extended, destination: "Paris, France" };
  const supply = [
    {
      ...visit("louvre", 120),
      name: "Private VIP Louvre Museum Tour with Art Historian",
    },
    { ...visit("orsay", 120), name: "Musée d'Orsay Private Guided Tour" },
    visit("walk", 60),
  ];
  const exclusions = ["2027-01-11", "2027-01-12", "2027-01-13"].flatMap(
    (date) =>
      supply.flatMap((activity) =>
        venueConstraintsForDate(
          input.destination,
          activity.name,
          date,
          venueFacts,
        ).map((finding) => ({
          activityId: activity.id,
          date,
          reason: finding.finding,
          sourceUrl: finding.sourceUrl,
          observedAt: finding.observedAt,
        })),
      ),
  );
  const result = compileSchedule(input, supply, [], exclusions);
  expect(
    result.days.flatMap((d) => slots.flatMap((slot) => d[slot].activities)),
  ).toHaveLength(3);
  for (const day of result.days) {
    const ids = slots.flatMap((slot) => day[slot].activities.map((a) => a.id));
    if (day.date === "2027-01-11") expect(ids).not.toContain("orsay");
    if (day.date === "2027-01-12") expect(ids).not.toContain("louvre");
  }
  expect(result.verified).toBe(false);
});

it("explains an omitted long highlight without silently relaxing the pace", () => {
  const input = {
    ...plan,
    activityCriteria: {
      ...plan.activityCriteria,
      pacePreference: "moderate" as const,
      mustSee: ["Golden Circle"],
    },
  };
  const result = compileSchedule(
    input,
    [
      { ...visit("long", 600), name: "Golden Circle and Glacier Tour" },
      visit("short", 60),
    ],
    [],
  );
  expect(result.deferredLongVisits).toEqual([
    {
      id: "long",
      name: "Golden Circle and Glacier Tour",
      durationMinutes: 600,
      dailyBudgetMinutes: 420,
      matchedHighlights: ["Golden Circle"],
    },
  ]);
  expect(result.days[0].tips.join(" ")).toContain("10h");
  expect(result.days[0].tips.join(" ")).toContain("7h daily activity limit");
  expect(
    result.days
      .flatMap((d) => slots.flatMap((slot) => d[slot].activities))
      .map((a) => a.id),
  ).not.toContain("long");
});
it("does not offer a long alcohol-focused visit as a family pace adjustment", () => {
  const input = {
    ...plan,
    children: 1,
    activityCriteria: { ...plan.activityCriteria, mustSee: ["Wine Tasting"] },
  };
  const result = compileSchedule(
    input,
    [
      { ...visit("wine", 600), name: "Wine Tasting Experience" },
      visit("short", 60),
    ],
    [],
  );
  expect(result.deferredLongVisits).toEqual([]);
  expect(result.days[0].tips.join(" ")).not.toContain("review the pace");
});
it("leaves descriptive aliases unresolved without verified identity evidence", () => {
  const input = {
    ...plan,
    activityCriteria: { ...plan.activityCriteria, mustSee: ["Perlan Museum"] },
  };
  const result = compileSchedule(
    input,
    [
      {
        ...visit("perlan", 150),
        name: "Perlan - Wonders of Iceland Nature Museum",
      },
    ],
    [],
  );
  expect(result.unfulfilledHighlights).toEqual(["Perlan Museum"]);
  expect(result.days[0].tips.join(" ")).toContain("not matched by name");
  expect(result.verified).toBe(false);
});

it("does not schedule a supplied stair conflict over a stroller-access request", () => {
  const input = {
    ...plan,
    mobilityNeeds: "Stroller access, short walks",
    activityCriteria: { ...plan.activityCriteria, mustSee: [] },
  };
  const supply = [
    {
      ...visit("bunker", 90),
      description:
        "While it has some stairs, this is a great historical visit.",
      vibeScore: 100,
    },
    { ...visit("garden", 60), description: "A botanical collection." },
  ];
  const original = JSON.stringify(supply);
  const result = compileSchedule(input, supply, []);
  expect(
    result.days
      .flatMap((day) => slots.flatMap((slot) => day[slot].activities))
      .map((a) => a.id),
  ).not.toContain("bunker");
  expect(result.reviewRequiredActivities).toContainEqual({
    id: "bunker",
    reason: "supplied_access_conflict",
  });
  expect(result.days[0].tips?.join(" ")).toContain(
    "Confirm an accessible route",
  );
  expect(result.verified).toBe(false);
  expect(JSON.stringify(supply)).toBe(original);
});

it("explains an unavoidable meal transition without inventing a route", () => {
  const supply = [
    {
      ...visit("near", 60, "morning"),
      location: { name: "near", address: "", lat: 41.9, lng: 12.5 },
    },
    {
      ...visit("far", 60, "afternoon"),
      location: { name: "far", address: "", lat: 42, lng: 12.5 },
    },
  ];
  const result = compileSchedule(
    { ...plan, activityCriteria: { ...plan.activityCriteria, mustSee: [] } },
    supply,
    [],
  );
  expect(result.issues).toContain("day_1:lunch:separated_visit_anchors");
  expect(
    result.days[0].tips?.some((tip) =>
      tip.includes("choose which area to eat in"),
    ),
  ).toBe(true);
  expect(result.verified).toBe(false);
});

it("adds a proposed daily rest timetable without changing selected visits", () => {
  const supply = [
    visit("garden", 90, "morning"),
    visit("museum", 90, "afternoon"),
  ];
  const baseline = compileSchedule(plan, supply, []);
  const result = compileSchedule(
    { ...plan, mobilityNeeds: "Short walks and a midday rest every day" },
    supply,
    [],
  );
  expect(result.days[0].morning.activities).toEqual(
    baseline.days[0].morning.activities,
  );
  expect(result.days[0].afternoon.activities).toEqual(
    baseline.days[0].afternoon.activities,
  );
  expect(result.timingProposals).toHaveLength(result.days.length);
  expect(result.timingProposals[0].fitsPolicy).toBe(true);
  expect(result.days[0].tips[0]).toContain("Proposed local timing");
  expect(baseline.timingProposals).toEqual([]);
});

const restPlan: SearchPlan = {
  ...plan,
  dates: { start: "2027-01-11", end: "2027-01-11", nights: 0 },
  mobilityNeeds: "Short walks and a midday rest every day",
  activityCriteria: {
    ...plan.activityCriteria,
    pacePreference: "moderate",
    mustSee: ["museum"],
  },
};
const restMeals: DiningResult[] = (
  ["breakfast", "lunch", "dinner"] as const
).map((type) => ({
  ...dining[0],
  id: type,
  mealTypes: [type],
}));
it("screens the live 210-minute morning conflict before selecting visits", () => {
  const input = [
    visit("museum", 150, "morning"),
    visit("walk", 60, "morning"),
    visit("gallery", 180, "afternoon"),
  ];
  const original = structuredClone(input);
  const result = compileSchedule(restPlan, input, restMeals);
  expect(result.timingProposals.every((proposal) => proposal.fitsPolicy)).toBe(
    true,
  );
  expect(result.days[0].morning.activities.map((a) => a.id)).toEqual([
    "museum",
  ]);
  expect(result.unselectedActivityIds).toContain("walk");
  expect(input).toEqual(original);
  for (const item of slots.flatMap((slot) => result.days[0][slot].activities))
    expect(item).toEqual(input.find((a) => a.id === item.id));
  expect(result.days[0].tips.join(" ")).toContain("Review any omitted visits");
});
it("does not reserve coverage for visits that cannot fit any permitted rest window", () => {
  const result = compileSchedule(
    {
      ...restPlan,
      dates: { start: "2027-01-11", end: "2027-01-12", nights: 1 },
    },
    [
      visit("too-long", 300, "morning"),
      visit("short-a", 60),
      visit("short-b", 60),
    ],
    restMeals,
  );
  expect(
    result.days.every(
      (day) => slots.flatMap((slot) => day[slot].activities).length > 0,
    ),
  ).toBe(true);
  expect(result.timingProposals.every((proposal) => proposal.fitsPolicy)).toBe(
    true,
  );
  expect(result.reviewRequiredActivities).toContainEqual({
    id: "too-long",
    reason: "does_not_fit_proposed_rest_windows",
  });
  expect(result.days[0].tips.join(" ")).toContain(
    "visit has not been shortened",
  );
});
it("reports insufficient supply when all supplied visits conflict with the rest policy", () => {
  const result = compileSchedule(
    restPlan,
    [visit("too-long", 300, "morning")],
    restMeals,
  );
  expect(slots.flatMap((slot) => result.days[0][slot].activities)).toEqual([]);
  expect(result.issues).toContain("day_1:activity_supply_gap");
  expect(result.unselectedActivityIds).toEqual(["too-long"]);
});
it("keeps the non-rest selection unchanged for a negated request", () => {
  const input = [
    visit("museum", 150, "morning"),
    visit("walk", 60, "morning"),
    visit("gallery", 180, "afternoon"),
  ];
  const negated = compileSchedule(
    { ...restPlan, mobilityNeeds: "No midday rest every day" },
    input,
    restMeals,
  );
  const baseline = compileSchedule(
    { ...restPlan, mobilityNeeds: undefined },
    input,
    restMeals,
  );
  for (const day of negated.days)
    day.tips = day.tips.filter((tip) => !tip.startsWith("Your requirements:"));
  expect(negated).toEqual(baseline);
});

it("keeps explicitly speculative events as review leads rather than dated visits", () => {
  const event = {
    ...visit("event", 90),
    name: "Carpentry Exhibition (Check Local Schedules)",
    vibeScore: 100,
  };
  const result = compileSchedule(plan, [event, visit("museum", 90)], dining);
  expect(
    result.days
      .flatMap((day) => slots.flatMap((slot) => day[slot].activities))
      .map((a) => a.id),
  ).not.toContain("event");
  expect(result.reviewRequiredActivities).toContainEqual({
    id: "event",
    reason: "speculative_event_title",
  });
  expect(result.days[0].tips.join(" ")).toContain(
    "Confirm the event's dates and venue",
  );
  expect(result.unselectedActivityIds).toContain("event");
});

it("leaves pre-arrival visits and meals unscheduled without losing later-day coverage", () => {
  const result = compileSchedule(
    { ...extended, mobilityNeeds: "Arrive on the first day at 18:00" },
    [
      visit("morning-a", 90, "morning"),
      visit("morning-b", 90, "morning"),
      visit("afternoon-a", 90, "afternoon"),
      visit("evening-only", 60, "evening"),
    ],
    restMeals,
  );
  expect(result.days[0].morning.activities).toEqual([]);
  expect(result.days[0].morning.meal).toBeUndefined();
  expect(result.days[0].afternoon.activities).toEqual([]);
  expect(result.days[0].afternoon.meal).toBeUndefined();
  expect(result.days[0].evening.activities.map((a) => a.id)).toEqual([
    "evening-only",
  ]);
  expect(
    result.days
      .slice(1)
      .every((day) => slots.flatMap((slot) => day[slot].activities).length > 0),
  ).toBe(true);
  expect(result.days[0].tips.join(" ")).toContain("18:00–24:00");
});
it("keeps visits within a shortened day-part budget including a meal and buffer", () => {
  const result = compileSchedule(
    { ...plan, mobilityNeeds: "No starts before 11am" },
    [visit("morning", 60, "morning"), visit("afternoon", 60, "afternoon")],
    restMeals,
  );
  expect(result.days[0].morning.activities).toEqual([]);
  expect(result.days[0].morning.meal).toBeDefined();
  expect(result.unselectedActivityIds).toContain("morning");
});
it("leaves conflicting availability empty and exposes the conflict", () => {
  const result = compileSchedule(
    {
      ...plan,
      mobilityNeeds:
        "Arrive on the first day at 18:00; depart on the final day at 09:00",
    },
    [visit("walk", 30)],
    restMeals,
  );
  expect(slots.flatMap((slot) => result.days[0][slot].activities)).toEqual([]);
  expect(slots.every((slot) => !result.days[0][slot].meal)).toBe(true);
  expect(result.issues).toContain("day_1:conflicting_traveler_availability");
  expect(result.issues).toContain("day_1:activity_supply_gap");
});

it("leaves an early departure day free of visits without reporting missing supply", () => {
  const result = compileSchedule(
    { ...extended, mobilityNeeds: "Depart on the final day at 09:00" },
    [visit("museum", 90), visit("gallery", 90), visit("walk", 60)],
    restMeals,
  );
  const last = result.days[2];
  expect(slots.flatMap((slot) => last[slot].activities)).toEqual([]);
  expect(last.morning.meal).toBeDefined();
  expect(last.afternoon.meal).toBeUndefined();
  expect(last.evening.meal).toBeUndefined();
  expect(result.issues).not.toContain("day_3:activity_supply_gap");
  expect(last.tips.join(" ")).toContain("confirm transfer time");
  expect(
    result.days
      .slice(0, 2)
      .every((day) => slots.flatMap((slot) => day[slot].activities).length > 0),
  ).toBe(true);
});

it("still reports missing supply when a restricted day has room for visits", () => {
  const result = compileSchedule(
    { ...plan, mobilityNeeds: "Depart on the final day at 12:00" },
    [],
    restMeals,
  );
  expect(result.issues).toContain("day_1:activity_supply_gap");
});

it("does not show a midday rest before a declared evening arrival", () => {
  const result = compileSchedule(
    {
      ...restPlan,
      mobilityNeeds:
        "Arrive on the first day at 18:00; a midday rest every day",
    },
    [visit("evening", 60, "evening")],
    restMeals,
  );
  expect(result.timingProposals[0].fitsPolicy).toBe(false);
  expect(result.days[0].timingProposal?.events).toEqual([]);
  expect(result.issues).toContain("day_1:midday_rest_timing_conflict");
});

it("keeps explicit dietary, access and mobility requirements visible on every day without certifying venues", () => {
  const input: SearchPlan = {
    ...extended,
    mobilityNeeds: "Wheelchair access and step-free routes",
    requirements: {
      allergies: [],
      dietaryPreferences: ["gluten-free"],
      accessibility: ["step_free_entrance"],
      mobilityNotes:
        "Celiac disease; direct kitchen cross-contact confirmation required",
    },
  };
  const supplied = activities.map((activity) => ({
    ...activity,
    description: activity.description ?? "Museum visit.",
  }));
  const baseline = compileSchedule(
    { ...input, requirements: undefined },
    supplied,
    dining,
  );
  const result = compileSchedule(input, supplied, dining);
  for (const day of result.days) {
    const note = day.tips.find((tip) => tip.startsWith("Your requirements:"));
    expect(note).toContain(input.requirements!.mobilityNotes);
    expect(note).toContain("gluten-free");
    expect(note).toContain("step free entrance");
    expect(note).toContain("not verified venue features");
  }
  expect(result.days.map((d) => slots.map((s) => d[s].meal?.id))).toEqual(
    baseline.days.map((d) => slots.map((s) => d[s].meal?.id)),
  );
});
