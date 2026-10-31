import { DEVELOPMENT_BRIEFS, HOLDOUT_BRIEFS } from "../uat/lib/eval-briefs";
import romeOverload from "../fixtures/agentic-rome-overload.json";
import { suppliedDistanceKm } from "../uat/lib/route-eval";
import { describe, expect, test } from "bun:test";
import { evaluateVenueConstraints } from "../uat/lib/venue-constraints";
import {
  evaluateAgenticTrace,
  type AgenticTrace,
} from "../uat/lib/agentic-eval";

function fixture(): AgenticTrace {
  const activity = {
    id: "walk",
    name: "Riverside walk",
    duration: 60,
    bestTimeOfDay: "morning",
  };
  const meal = { id: "cafe", name: "Cafe", mealTypes: ["breakfast"] };
  const day = {
    date: "2026-12-07",
    dayNumber: 1,
    title: "A river morning",
    summary: "Walk and rest",
    morning: { activities: [activity], meal },
    afternoon: { activities: [] },
    evening: { activities: [] },
  };
  const outputs = [
    {
      dates: { start: day.date, end: day.date },
      travelers: 2,
      adults: 2,
      children: 0,
      activityCriteria: { interests: ["culture"] },
      diningCriteria: { dietaryNeeds: ["vegetarian"] },
      mobilityNeeds: "short walks",
      requirements: {
        allergies: ["peanuts"],
        dietaryPreferences: [],
        accessibility: ["step_free_entrance"],
        mobilityNotes: "Frequent rests",
      },
    },
    [],
    [activity],
    [meal],
    { days: [day] },
  ];
  return {
    version: 1,
    runId: "fixture",
    configId: "baseline",
    source: { commit: "fixture", dirty: false, filesSha256: "fixture" },
    startedAt: "2026-10-31T00:00:00Z",
    settings: {},
    brief: {
      id: "fixture",
      destination: "Lisbon",
      startDate: day.date,
      endDate: day.date,
      travelers: 2,
      adults: 2,
      children: 0,
      interests: ["culture"],
      vibes: [],
      budget: "moderate",
      travelerType: "couple",
      dietaryRestrictions: ["vegetarian"],
      mobilityNeeds: "short walks",
      requirements: {
        allergies: ["peanuts"],
        dietaryPreferences: [],
        accessibility: ["step_free_entrance"],
        mobilityNotes: "Frequent rests",
      },
    },
    steps: ["orchestrator", "hotels", "activities", "dining", "aggregator"].map(
      (step, i) => ({
        step,
        output: outputs[i],
        usage: {},
        latencyMs: 10,
        fallbacks: [],
      }),
    ),
    mappedItinerary: {
      days: [{ ...day, morning: { activities: [activity], meals: [meal] } }],
    },
  };
}

describe("production-shape agentic evaluation", () => {
  test("flags the observed Rome plan despite successful generation and intact IDs", () => {
    const trace = romeOverload.trace as unknown as AgenticTrace;
    const result = evaluateAgenticTrace(trace);
    expect(result.contractPass).toBe(true);
    expect(result.metrics.fallbackSteps).toBe(0);
    expect(result.warnings).toEqual(romeOverload.expected.paceWarnings);
    const inventory = trace.steps[2].output as Array<{ duration: number }>;
    expect(inventory.reduce((sum, item) => sum + item.duration, 0)).toBe(525);
  });
  test("passes intact contracts without certifying generated venue claims", () => {
    const result = evaluateAgenticTrace(fixture());
    expect(result.contractPass).toBe(true);
    expect(result.unknowns.join(" ")).toContain("independent evidence");
    expect(result.metrics).toMatchObject({
      days: 1,
      activities: 1,
      meals: 1,
      serialAgentMs: 50,
    });
  });
  test("rejects a dinner-only restaurant scheduled for breakfast", () => {
    const trace = fixture();
    const meals = trace.steps[3].output as Array<{ mealTypes: string[] }>;
    meals[0].mealTypes = ["dinner"];
    expect(evaluateAgenticTrace(trace).failures).toContain(
      "day_1:morning:incompatible_meal_type",
    );
  });
  test("flags a relaxed day that exceeds its daily time budget", () => {
    const trace = fixture();
    (
      trace.steps[0].output as { activityCriteria: { pacePreference?: string } }
    ).activityCriteria.pacePreference = "relaxed";
    (trace.steps[2].output as Array<{ duration: number }>)[0].duration = 300;
    expect(evaluateAgenticTrace(trace).warnings).toContain(
      "day_1:exceeds_relaxed_pace_budget",
    );
  });
  test("counts incomplete and fallback runs as failures", () => {
    const trace = fixture();
    trace.steps[0].fallbacks.push({
      reason: "timeout",
      outcome: "fallback_plan",
    });
    expect(evaluateAgenticTrace(trace).failures).toContain("fallback_used");
    trace.steps.pop();
    const result = evaluateAgenticTrace(trace);
    expect(result.contractPass).toBe(false);
    expect(result.failures).toContain("incomplete_or_invalid_step_sequence");
    expect(result.failures).toContain("day_coverage");
  });
  test("detects party, interest and critical requirement loss", () => {
    const trace = fixture();
    trace.steps[0].output = {
      dates: { start: trace.brief.startDate, end: trace.brief.endDate },
      adults: 1,
      travelers: 1,
      children: 0,
    };
    const result = evaluateAgenticTrace(trace);
    for (const failure of [
      "orchestrator_adults_changed",
      "interests_lost",
      "mobility_needs_lost",
      "dietary_restrictions_lost",
      "requirements_allergies_lost",
      "requirements_accessibility_lost",
    ])
      expect(result.failures).toContain(failure);
  });
  test("detects dropped display content instead of grading only agent output", () => {
    const trace = fixture();
    trace.mappedItinerary = {
      days: [
        { date: trace.brief.startDate, morning: { activities: [], meals: [] } },
      ],
    };
    const result = evaluateAgenticTrace(trace);
    expect(result.failures).toContain("day_1:morning:mapped_activity_identity");
    expect(result.failures).toContain("day_1:morning:mapped_meal_identity");
  });
  test("detects duplicates, invalid inventory references and durations", () => {
    const trace = fixture();
    const day = (
      trace.steps[4].output as {
        days: Array<{ morning: { activities: unknown[] } }>;
      }
    ).days[0];
    day.morning.activities.push({
      id: "walk",
      duration: -1,
      bestTimeOfDay: "evening",
    });
    day.morning.activities.push({
      id: "invented",
      duration: 60,
      bestTimeOfDay: "any",
    });
    const result = evaluateAgenticTrace(trace);
    for (const failure of [
      "duplicate_activity:walk",
      "invalid_duration:walk",
      "wrong_time_of_day:walk",
      "unknown_activity:invented",
    ])
      expect(result.failures).toContain(failure);
  });
  test("rejects unbounded or invalid date ranges before iterating", () => {
    const trace = fixture();
    trace.brief.endDate = "9999-12-31";
    expect(() => evaluateAgenticTrace(trace)).toThrow(/valid dates/);
    trace.brief.endDate = "bad";
    expect(() => evaluateAgenticTrace(trace)).toThrow(/valid dates/);
  });
});

test("frozen venue evidence exposes a closed weekday and uncertain reopening", () => {
  const trace = fixture();
  const day = (
    trace.steps[4].output as {
      days: Array<{ morning: { activities: unknown[] } }>;
    }
  ).days[0];
  day.morning.activities = [
    { name: "Jerónimos Monastery" },
    { name: "National Tile Museum" },
  ];
  const result = evaluateVenueConstraints(trace, [
    {
      id: "monastery",
      destination: "Lisbon",
      aliases: ["Jeronimos Monastery"],
      sourceUrl: "https://official.example/hours",
      observedAt: "2026-10-31",
      closedWeekdays: [1],
    },
    {
      id: "tiles",
      destination: "Lisbon",
      aliases: ["National Tile Museum"],
      sourceUrl: "https://official.example/status",
      observedAt: "2026-10-31",
      temporarilyClosed: true,
    },
  ]);
  expect(result.findings.map((f) => f.finding)).toEqual([
    "scheduled_on_reported_closed_weekday",
    "reopening_confirmation_required",
  ]);
  expect(result.findings[0].sourceUrl).toBe("https://official.example/hours");
  expect(result.coverage).toContain(
    "no finding does not establish availability",
  );
});

test("rejects fractional hours accidentally represented as minutes", () => {
  const trace = fixture();
  const day = (
    trace.steps[4].output as {
      days: Array<{ morning: { activities: Array<{ duration: number }> } }>;
    }
  ).days[0];
  day.morning.activities[0].duration = 2.5;
  expect(evaluateAgenticTrace(trace).failures).toContain(
    "invalid_duration:walk",
  );
});

test("route screening treats missing, invalid and placeholder coordinates as unknown", () => {
  expect(suppliedDistanceKm(undefined, {})).toBe(null);
  expect(suppliedDistanceKm({ lat: 0, lng: 0 }, { lat: 38, lng: -9 })).toBe(
    null,
  );
  expect(suppliedDistanceKm({ lat: 91, lng: 2 }, { lat: 38, lng: -9 })).toBe(
    null,
  );
  expect(
    suppliedDistanceKm(
      { lat: 38.6979, lng: -9.2067 },
      { lat: 38.7165, lng: -9.1398 },
    ),
  ).toBeGreaterThan(5);
});

test("development and reserved holdout briefs have distinct IDs and valid bounded dates and parties", () => {
  const cases = [...DEVELOPMENT_BRIEFS, ...HOLDOUT_BRIEFS];
  expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
  expect(DEVELOPMENT_BRIEFS.length).toBe(12);
  expect(HOLDOUT_BRIEFS.length).toBe(6);
  for (const brief of cases) {
    expect(brief.travelers).toBe(brief.adults + brief.children);
    const trace = fixture();
    trace.brief = brief;
    expect(() => evaluateAgenticTrace(trace)).not.toThrow();
  }
});
