import hotelFacts from "../fixtures/agentic-hotel-constraints.json";
import { evaluateHotelConstraints as evaluateHotelConstraintsAt } from "../uat/lib/hotel-constraints";
const evaluateHotelConstraints: typeof evaluateHotelConstraintsAt = (
  plan,
  hotels,
  evidence,
  asOfDate = "2026-11-01",
) => evaluateHotelConstraintsAt(plan, hotels, evidence, asOfDate);
import seasonalFacts from "../fixtures/agentic-venue-constraints.json";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { evaluateVenueAddresses } from "../uat/lib/venue-address-evidence";
import addressFacts from "../fixtures/agentic-venue-addresses.json";
import { DEVELOPMENT_BRIEFS, HOLDOUT_BRIEFS } from "../uat/lib/eval-briefs";
import romeOverload from "../fixtures/agentic-rome-overload.json";
import { suppliedDistanceKm } from "../uat/lib/route-eval";
import { describe, expect, test } from "bun:test";
import {
  evaluateVenueConstraints,
  venueConstraintsForDate,
} from "../uat/lib/venue-constraints";
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
  test("checks meals against the day's stops when their own slot has no activity", () => {
    const trace = fixture();
    Object.assign((trace.steps[2].output as object[])[0], {
      location: { lat: 40, lng: -74 },
    });
    Object.assign((trace.steps[3].output as object[])[0], {
      mealTypes: ["breakfast", "lunch"],
      location: { lat: 41, lng: -74 },
    });
    const day = (
      trace.steps[4].output as { days: Array<Record<string, unknown>> }
    ).days[0];
    day.afternoon = {
      activities: [],
      meal: (trace.steps[3].output as object[])[0],
    };
    const result = evaluateAgenticTrace(trace);
    expect(result.warnings).toContain(
      "day_1:afternoon:meal_over_3km_from_day_activities_on_unverified_coordinates",
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

test("distinguishes a closed former location from the institution and limits date-specific closures", () => {
  const trace = fixture();
  trace.brief.destination = "New York";
  const day = (
    trace.steps[4].output as {
      days: Array<{
        date: string;
        morning: { activities: Array<{ name: string }> };
      }>;
    }
  ).days[0];
  const facts = [
    {
      id: "old-location",
      destination: "New York",
      aliases: ["Frick Madison"],
      sourceUrl: "https://www.frick.org/about/frick_madison",
      observedAt: "2026-10-31",
      closedFrom: "2024-03-04",
    },
  ];
  day.morning.activities = [{ name: "The Frick Collection at Frick Madison" }];
  expect(evaluateVenueConstraints(trace, facts).findings[0]?.finding).toBe(
    "scheduled_on_reported_closed_date",
  );
  day.morning.activities = [{ name: "The Frick Collection" }];
  expect(evaluateVenueConstraints(trace, facts).findings).toHaveLength(0);
  const dated = [
    {
      ...facts[0],
      aliases: ["The Frick Collection"],
      closedFrom: undefined,
      closedDates: [day.date],
    },
  ];
  expect(evaluateVenueConstraints(trace, dated).findings).toHaveLength(1);
  day.date = "2026-12-08";
  expect(evaluateVenueConstraints(trace, dated).findings).toHaveLength(0);
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
  expect(DEVELOPMENT_BRIEFS.length).toBe(40);
  expect(HOLDOUT_BRIEFS.length).toBe(20);
  for (const brief of cases) {
    expect(brief.travelers).toBe(brief.adults + brief.children);
    const trace = fixture();
    trace.brief = brief;
    expect(() => evaluateAgenticTrace(trace)).not.toThrow();
  }
});

describe("reviewed venue address evidence", () => {
  test("a reviewed garden restaurant address does not establish its entrance or meal service", () => {
    const trace = fixture();
    const bloomhouse = addressFacts.find(
      (item) => item.id === "bloomhouse-ginger-garden",
    )!;
    trace.brief.destination = "Singapore";
    trace.steps[4].output = {
      days: [
        {
          date: "2027-01-11",
          morning: {
            meal: {
              name: "The Bloomhouse by Little Farms",
              location: { address: bloomhouse.sourceAddress },
            },
          },
        },
      ],
    };
    const result = evaluateVenueAddresses(trace, addressFacts, "2026-10-31");
    expect(result.supported).toBe(1);
    expect(result.routeFeasibilityVerified).toBe(false);
    expect(result.mealServiceVerified).toBe(false);
    expect(result.futureAvailabilityVerified).toBe(false);
  });
  const fact = addressFacts[1];
  function addressTrace(
    name = "Afuri Roppongi Hills",
    address = fact.contradictedAddresses[0],
  ) {
    const trace = fixture();
    trace.brief.destination = "Tokyo, Japan";
    trace.steps[4].output = {
      days: [
        {
          date: "2027-01-11",
          morning: { meal: { name, location: { address } } },
        },
      ],
    };
    return trace;
  }
  test("catches the live AFURI conflict without trusting generated coordinates", () => {
    const result = evaluateVenueAddresses(
      addressTrace(),
      addressFacts,
      "2026-10-31",
    );
    expect(result.contradicted).toBe(1);
    expect(result.futureAvailabilityVerified).toBe(false);
  });
  test("does not transfer evidence between branches or cities", () => {
    expect(
      evaluateVenueAddresses(
        addressTrace("Afuri Roppongi"),
        addressFacts,
        "2026-10-31",
      ).unresolved,
    ).toBe(1);
    const trace = addressTrace();
    trace.brief.destination = "Kyoto";
    expect(
      evaluateVenueAddresses(trace, addressFacts, "2026-10-31").unresolved,
    ).toBe(1);
  });
  test("unreviewed spellings, missing addresses and stale evidence remain unresolved", () => {
    for (const address of ["", "6-4-1 Roppongi"]) {
      expect(
        evaluateVenueAddresses(
          addressTrace(undefined, address),
          addressFacts,
          "2026-10-31",
        ).unresolved,
      ).toBe(1);
    }
    expect(
      evaluateVenueAddresses(addressTrace(), addressFacts, "2027-03-01")
        .unresolved,
    ).toBe(1);
    expect(
      evaluateVenueAddresses(addressTrace(), addressFacts, "2026-10-01")
        .unresolved,
    ).toBe(1);
  });
  test("supports only the reviewed address, not dining suitability", () => {
    const result = evaluateVenueAddresses(
      addressTrace("Sakura-tei", addressFacts[2].supportedAddresses[0]),
      addressFacts,
      "2026-10-31",
    );
    expect(result.supported).toBe(1);
    expect(result.mealServiceVerified).toBe(false);
    expect(result.routeFeasibilityVerified).toBe(false);
  });
  test("conflicting and duplicate reviews cannot support a claim", () => {
    const conflict = {
      ...fact,
      supportedAddresses: fact.contradictedAddresses,
    };
    expect(
      evaluateVenueAddresses(addressTrace(), [conflict], "2026-10-31")
        .results[0].reason,
    ).toBe("conflicting_evidence");
    expect(
      evaluateVenueAddresses(addressTrace(), [fact, fact], "2026-10-31")
        .results[0].reason,
    ).toBe("ambiguous_evidence");
  });
});

test("offline CLI rejects unfinished receipts rather than grading frozen outputs", () => {
  const dir = mkdtempSync(join(tmpdir(), "faroway-incomplete-eval-"));
  try {
    for (const status of ["started", "failed"]) {
      writeFileSync(
        join(dir, "trace.json"),
        JSON.stringify({ status, trace: fixture() }),
      );
      const result = spawnSync(
        process.execPath,
        ["--no-env-file", "scripts/uat/evaluate-traces.ts", dir],
        {
          cwd: resolve(import.meta.dirname, "../.."),
          env: { PATH: process.env.PATH },
          encoding: "utf8",
          timeout: 10000,
        },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("incomplete trace");
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("seasonal evidence flags winter dates without certifying summer availability", () => {
  const trace = fixture();
  const fact = {
    id: "river-walk",
    destination: trace.brief.destination,
    aliases: ["Riverside walk"],
    sourceUrl: "https://official.example/season",
    observedAt: "2026-10-31",
    reportedOperatingMonths: [6, 7, 8, 9, 10],
  };
  expect(evaluateVenueConstraints(trace, [fact]).findings[0].finding).toBe(
    "outside_reported_operating_season",
  );
  const output = trace.steps[4].output as { days: Array<{ date: string }> };
  output.days[0].date = "2027-07-01";
  expect(evaluateVenueConstraints(trace, [fact]).findings).toHaveLength(0);
  expect(evaluateVenueConstraints(trace, [fact]).coverage).toContain(
    "does not establish availability",
  );
  expect(() =>
    evaluateVenueConstraints(trace, [
      { ...fact, reportedOperatingMonths: [0, 13] },
    ]),
  ).toThrow();
});

test("the observed November Interlaken recommendations fail published-season checks", () => {
  const trace = fixture();
  trace.brief.destination = "Interlaken, Switzerland";
  trace.steps[4].output = {
    days: [
      {
        date: "2026-11-05",
        morning: {
          activities: [
            { name: "Mürren-Gimmelwald Via Ferrata" },
            { name: "Canyoning Grimsel Adventure" },
          ],
        },
      },
    ],
  };
  const result = evaluateVenueConstraints(trace, seasonalFacts);
  expect(result.findings.map((f) => f.venueId).sort()).toEqual([
    "grimsel-canyoning-published-season",
    "muerren-gimmelwald-via-ferrata-season",
  ]);
  expect(
    result.findings.every(
      (f) => f.finding === "outside_reported_operating_season",
    ),
  ).toBe(true);
});

test("meal comparison exposes unknowns and rejects mismatched or changed traces", () => {
  const root = mkdtempSync(join(tmpdir(), "meal-comparison-"));
  const before = join(root, "before"),
    after = join(root, "after");
  mkdirSync(before);
  mkdirSync(after);
  const run = () =>
    spawnSync(
      process.execPath,
      [resolve("scripts/uat/evaluate-meal-geography.ts"), before, after],
      { encoding: "utf8" },
    );
  const save = (dir: string, trace: AgenticTrace) =>
    writeFileSync(join(dir, "fixture.json"), JSON.stringify({ trace }));
  try {
    expect(run().status).not.toBe(0);
    const trace = fixture();
    save(before, trace);
    expect(run().status).not.toBe(0);
    save(after, trace);
    const result = run();
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      qualityAccepted: false,
      results: [
        { before: { known: 0, unknown: 1, missing: 2, sameDayRepeats: 0 } },
      ],
    });
    const changed = structuredClone(trace);
    (
      changed.steps[4].output as {
        days: Array<{ morning: { activities: Array<{ duration: number }> } }>;
      }
    ).days[0].morning.activities[0].duration = 90;
    save(after, changed);
    expect(run().status).not.toBe(0);
    save(after, {
      ...trace,
      brief: { ...trace.brief, destination: "Different city" },
    });
    expect(run().status).not.toBe(0);
    save(after, { ...trace, steps: trace.steps.slice(1) });
    expect(run().status).not.toBe(0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("flags a named meal experience plus a separate restaurant without asserting meal inclusion", () => {
  const trace = fixture();
  const activities = trace.steps[2].output as Array<{ name: string }>;
  activities[0].name = "Winery Breakfast & Tasting";
  const result = evaluateAgenticTrace(trace);
  expect(result.contractPass).toBe(true);
  expect(result.warnings).toContain(
    "day_1:morning:possible_duplicate_breakfast_activity_and_restaurant",
  );
  activities[0].name = "Winery Tour";
  expect(evaluateAgenticTrace(trace).warnings.join(" ")).not.toContain(
    "possible_duplicate",
  );
});

test("does not certify requested rest timing from day parts or a generic rest tip", () => {
  const trace = fixture();
  const result = evaluateAgenticTrace(trace);
  expect(result.contractPass).toBe(true);
  expect(result.timing).toMatchObject({
    representation: "day_parts_only",
    feasibility: "unverified",
    restInstructionPresent: true,
    days: [{ date: "2026-12-07", activityMinutes: 60 }],
  });
  const day = (trace.steps[4].output as { days: Array<{ tips?: string[] }> })
    .days[0];
  day.tips = ["Leave time for rest."];
  expect(evaluateAgenticTrace(trace).timing).toEqual(result.timing);
  trace.brief.mobilityNeeds = "No midday rest needed";
  trace.brief.requirements = undefined;
  // A negative instruction is still an instruction to review, not a rest request.
  expect(evaluateAgenticTrace(trace).timing.restInstructionPresent).toBe(true);
  trace.brief.mobilityNeeds = "Short walks";
  expect(evaluateAgenticTrace(trace).timing.restInstructionPresent).toBe(false);
});

test("new live NYC conflicts use exact reviewed venues without transferring hours to another branch", () => {
  for (const [name, date, id] of [
    [
      "The Morgan Library & Museum",
      "2027-01-11",
      "morgan-library-weekly-closure",
    ],
    ["The Frick Collection", "2027-01-12", "frick-fifth-avenue-weekly-closure"],
    [
      "The Metropolitan Museum of Art",
      "2027-01-13",
      "met-fifth-avenue-weekly-closure",
    ],
  ]) {
    expect(
      venueConstraintsForDate("New York, USA", name, date, seasonalFacts).map(
        (f) => f.venueId,
      ),
    ).toContain(id);
    expect(
      venueConstraintsForDate(
        "New York, USA",
        `${name} Exterior Walk`,
        date,
        seasonalFacts,
      ),
    ).toHaveLength(0);
    expect(
      venueConstraintsForDate("Pittsburgh, USA", name, date, seasonalFacts),
    ).toHaveLength(0);
  }
  expect(
    venueConstraintsForDate(
      "New York, USA",
      "The Frick Collection (Frick Madison)",
      "2027-01-12",
      seasonalFacts,
    ).map((f) => f.venueId),
  ).toEqual(["frick-madison-former-location"]);
});

test("reviewed hotel policies detect the family and invented-lift regression without transferring branch facts", () => {
  const hotel = {
    name: "Heritage Collection on Chinatown",
    amenities: ["Elevator"],
  };
  const family = { destination: "Singapore, Singapore", children: 2 };
  const result = evaluateHotelConstraints(family, [hotel], hotelFacts);
  expect(result.findings.map((f) => f.finding)).toEqual([
    "party_conflicts_with_published_minimum_guest_age",
    "lift_amenity_contradicted_by_published_property_information",
  ]);
  expect(result.qualityAccepted).toBe(false);
  expect(result.uncheckedHotels).toBe(0);
  expect(
    evaluateHotelConstraints(
      { ...family, children: 0 },
      [{ ...hotel, amenities: ["No elevator"] }],
      hotelFacts,
    ).findings,
  ).toHaveLength(0);
  expect(
    evaluateHotelConstraints(
      { ...family, children: 0, childAges: [0] },
      [{ ...hotel, amenities: [] }],
      hotelFacts,
    ).findings,
  ).toHaveLength(1);
  for (const name of [
    "Heritage Collection on Clarke Quay",
    "Heritage Collection on Chinatown Annex",
  ]) {
    const unknown = evaluateHotelConstraints(
      family,
      [{ ...hotel, name }],
      hotelFacts,
    );
    expect(unknown.findings).toHaveLength(0);
    expect(unknown.uncheckedHotels).toBe(1);
    expect(unknown.qualityAccepted).toBe(false);
  }
  expect(
    evaluateHotelConstraints(
      { ...family, destination: "New York, USA" },
      [hotel],
      hotelFacts,
    ).matchedHotels,
  ).toBe(0);
});

test("hotel evidence expires into review rather than a permanent exclusion or verified result", () => {
  const plan = { destination: "Singapore", children: 2 };
  const hotels = [{ name: hotelFacts[0].name, amenities: ["Elevator"] }];
  expect(
    evaluateHotelConstraints(plan, hotels, hotelFacts, "2026-10-31").findings,
  ).toHaveLength(2);
  for (const [date, reason] of [
    ["2026-10-30", "observation_is_in_the_future"],
    ["2026-11-30", "source_review_due"],
    ["2027-01-11", "source_review_due"],
  ]) {
    const result = evaluateHotelConstraints(plan, hotels, hotelFacts, date);
    expect(result.findings).toHaveLength(0);
    expect(result.reviewRequired[0].reason).toBe(reason);
    expect(result.currentEvidenceHotels).toBe(0);
    expect(result.uncheckedHotels).toBe(1);
    expect(result.qualityAccepted).toBe(false);
  }
  for (const patch of [
    { reviewAfter: undefined },
    { observedAt: "2026-02-31" },
    { reviewAfter: "2026-10-30" },
  ]) {
    const result = evaluateHotelConstraints(plan, hotels, [
      { ...hotelFacts[0], ...patch },
    ]);
    expect(result.findings).toHaveLength(0);
    expect(result.reviewRequired[0].reason).toBe(
      "invalid_or_missing_review_dates",
    );
  }
  expect(() =>
    evaluateHotelConstraints(plan, hotels, hotelFacts, "2026-02-31"),
  ).toThrow("Valid evidence evaluation date");
});

test("reviewed Copenhagen private-room policy prompts room review rather than excluding families", () => {
  const result = evaluateHotelConstraints(
    { destination: "Copenhagen, Denmark", children: 1 },
    [{ name: "Steel House Copenhagen", amenities: [] }],
    hotelFacts,
  );
  expect(result.findings).toHaveLength(0);
  expect(result.reviewRequired[0].reason).toBe(
    "age_policy_requires_room_or_check_in_review",
  );
  expect(result.qualityAccepted).toBe(false);
});

test("full-chain contract preserves infant age zero, explicit empty ages and room count", () => {
  for (const ages of [[0, 7], []]) {
    const trace = fixture();
    trace.brief.children = ages.length;
    trace.brief.travelers = trace.brief.adults + ages.length;
    trace.brief.childAges = ages;
    trace.brief.roomCount = 2;
    const plan = trace.steps[0].output as Record<string, unknown>;
    plan.children = trace.brief.children;
    plan.travelers = trace.brief.travelers;
    plan.childAges = [...ages];
    plan.roomCount = 2;
    expect(evaluateAgenticTrace(trace).failures).not.toContain(
      "orchestrator_child_ages_changed",
    );
    expect(evaluateAgenticTrace(trace).failures).not.toContain(
      "orchestrator_room_count_changed",
    );
    delete plan.childAges;
    plan.roomCount = 1;
    expect(evaluateAgenticTrace(trace).failures).toContain(
      "orchestrator_child_ages_changed",
    );
    expect(evaluateAgenticTrace(trace).failures).toContain(
      "orchestrator_room_count_changed",
    );
  }
});

test("invalid eval party definitions are rejected instead of measured", () => {
  for (const change of [
    { childAges: [0] },
    { roomCount: 0 },
    { roomCount: 1.5 },
    { adults: -1 },
    { travelers: 3 },
  ]) {
    const trace = fixture();
    Object.assign(trace.brief, change);
    expect(() => evaluateAgenticTrace(trace)).toThrow(
      "Invalid evaluation brief party",
    );
  }
});

test("restoration notice requires reopening review without treating a calendar end as availability", () => {
  for (const date of ["2027-01-11", "2028-01-01"]) {
    expect(
      venueConstraintsForDate(
        "Singapore",
        "Sun Yat Sen Nanyang Memorial Hall",
        date,
        seasonalFacts,
      ).some((f) => f.finding === "reopening_confirmation_required"),
    ).toBe(true);
  }
  expect(
    venueConstraintsForDate(
      "Singapore",
      "Sun Yat Sen Nanyang Memorial Hall offsite programme",
      "2027-01-11",
      seasonalFacts,
    ),
  ).toEqual([]);
});

import { dayTimingBasis } from "../../packages/types/src/day-timing";
test("trace contracts reject unresolved or lost structured timing", () => {
  const trace = fixture();
  const day = (trace.steps[4].output as { days: Record<string, unknown>[] })
    .days[0];
  const mapped = (trace.mappedItinerary as { days: Record<string, unknown>[] })
    .days[0];
  const proposal = {
    policy: "midday-rest-v1",
    basis: dayTimingBasis(day),
    fitsPolicy: true,
    verified: false,
    conflict: null,
    events: [
      {
        id: "meal:morning:cafe",
        kind: "meal",
        durationMinutes: 45,
        startMinute: 480,
        endMinute: 525,
        bufferBeforeMinutes: 0,
      },
      {
        id: "activity:walk",
        kind: "activity",
        durationMinutes: 60,
        startMinute: 555,
        endMinute: 615,
        bufferBeforeMinutes: 30,
      },
      {
        id: "rest:midday",
        kind: "rest",
        durationMinutes: 60,
        startMinute: 780,
        endMinute: 840,
        bufferBeforeMinutes: 0,
      },
    ],
  };
  day.timingProposal = proposal;
  mapped.timingProposal = structuredClone(proposal);
  expect(
    evaluateAgenticTrace(trace).failures.filter((f) => f.includes("timing")),
  ).toEqual([]);
  delete mapped.timingProposal;
  expect(evaluateAgenticTrace(trace).failures).toContain(
    "day_1:mapped_timing_changed",
  );
  const conflict = {
    ...proposal,
    fitsPolicy: false,
    events: [],
    conflict: { eventId: "activity:walk", overrunMinutes: 15 },
  };
  day.timingProposal = conflict;
  mapped.timingProposal = structuredClone(conflict);
  expect(evaluateAgenticTrace(trace).failures).toContain(
    "day_1:midday_rest_timing_conflict",
  );
});

test("surfaces event evidence gaps even for confident generated titles", () => {
  for (const name of [
    "Carpentry Exhibition (Check Local Schedules)",
    "Performance at Carnegie Hall",
    "Winter Jazz Festival",
  ]) {
    const trace = fixture();
    const items = trace.steps[2].output as Array<{ name: string }>;
    items[0].name = name;
    const result = evaluateAgenticTrace(trace);
    expect(result.warnings).toContain(
      "event_date_and_venue_evidence_required:walk",
    );
    expect(result.contractPass).toBe(true);
  }
  expect(evaluateAgenticTrace(fixture()).warnings).not.toContain(
    "event_date_and_venue_evidence_required:walk",
  );
});
