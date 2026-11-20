import { describe, expect, test } from "bun:test";
import {
  gradeItinerary,
  type GradeBrief,
  type GradeDay,
  type GradeStop,
} from "../uat/lib/itinerary-rubric";

function baseBrief(overrides: Partial<GradeBrief> = {}): GradeBrief {
  return {
    destinations: ["Kyoto"],
    start: "2026-05-10",
    end: "2026-05-11",
    budget: 300,
    pacePreference: "relaxed",
    rejectBoilerplate: true,
    requireTiming: true,
    preferences: ["food"],
    avoid: [],
    hazards: ["peanut"],
    children: 0,
    requireStepFree: false,
    month: 5,
    inventory: [
      { id: "s1", name: "Nishiki Market Food Stroll" },
      { id: "s2", name: "Kiyomizu Temple Terrace" },
      { id: "s3", name: "Arashiyama Bamboo Path" },
      { id: "s4", name: "Gion Ramen House" },
      { id: "s5", name: "Peanut Noodle Kitchen" },
      { id: "s6", name: "Pontocho Izakaya" },
      { id: "s7", name: "Philosopher's Path Walk" },
    ],
    trustedEvidenceHosts: [],
    ...overrides,
  };
}

function stop(overrides: Partial<GradeStop> = {}): GradeStop {
  return {
    id: "s1",
    name: "Nishiki Market Food Stroll",
    description:
      "Walk five blocks of covered market stalls sampling pickled vegetables, tofu skewers, and matcha sweets.",
    kind: "activity",
    destination: "Kyoto",
    lat: 35.005,
    lng: 135.7649,
    startMinute: 540,
    endMinute: 660,
    price: 25,
    tags: ["food", "market"],
    ...overrides,
  };
}

describe("strict UX & traveler quality rubric gates", () => {
  test("rejects hollow 0-stop days when supplier search succeeded", () => {
    const days: GradeDay[] = [
      {
        date: "2026-05-10",
        destination: "Kyoto",
        supplierSearch: "ok",
        stops: [stop()],
      },
      {
        date: "2026-05-11",
        destination: "Kyoto",
        supplierSearch: "ok",
        stops: [],
      },
    ];
    const grade = gradeItinerary(baseBrief(), days);
    expect(grade.scores.feasibility).toBe(1);
    expect(grade.failures).toContain("feasibility:empty_day:2026-05-11");
  });

  test("rejects severe allergen-named venue even when hedged with 'Ask the venue'", () => {
    const days: GradeDay[] = [
      {
        date: "2026-05-10",
        destination: "Kyoto",
        supplierSearch: "ok",
        stops: [
          stop(),
          stop({
            id: "s5",
            name: "Peanut Noodle Kitchen",
            kind: "meal",
            description:
              "Hand-pulled sesame and peanut noodles served in a casual dining room. Ask the venue about this restriction before you go. This sentence is not a clearance.",
            startMinute: 720,
            endMinute: 780,
          }),
        ],
      },
      {
        date: "2026-05-11",
        destination: "Kyoto",
        supplierSearch: "ok",
        stops: [
          stop({
            id: "s2",
            name: "Kiyomizu Temple Terrace",
            startMinute: 540,
            endMinute: 660,
          }),
        ],
      },
    ];
    const grade = gradeItinerary(baseBrief(), days);
    expect(grade.scores.preference_fit).toBe(1);
    expect(grade.failures).toContain("preference:hazard_venue:s5");
  });

  test("rejects zero-minute teleportation across distinct distant venues", () => {
    const days: GradeDay[] = [
      {
        date: "2026-05-10",
        destination: "Kyoto",
        supplierSearch: "ok",
        stops: [
          stop({
            id: "s1",
            name: "Nishiki Market Food Stroll",
            lat: 35.005,
            lng: 135.7649,
            startMinute: 540,
            endMinute: 660,
          }),
          stop({
            id: "s3",
            name: "Arashiyama Bamboo Path",
            // ~8.5 km away from Nishiki Market with 0-minute gap
            lat: 35.017,
            lng: 135.6713,
            startMinute: 660,
            endMinute: 780,
          }),
        ],
      },
      {
        date: "2026-05-11",
        destination: "Kyoto",
        supplierSearch: "ok",
        stops: [
          stop({
            id: "s2",
            name: "Kiyomizu Temple Terrace",
            startMinute: 540,
            endMinute: 660,
          }),
        ],
      },
    ];
    const grade = gradeItinerary(baseBrief(), days);
    expect(grade.scores.feasibility).toBe(1);
    expect(grade.failures).toContain("feasibility:transfer_buffer:s1:s3");
  });

  test("rejects cumulative urban zig-zagging exceeding 25 km/day", () => {
    const days: GradeDay[] = [
      {
        date: "2026-05-10",
        destination: "Kyoto",
        supplierSearch: "ok",
        stops: [
          stop({
            id: "s1",
            name: "Nishiki Market Food Stroll",
            lat: 35.0,
            lng: 135.75,
            startMinute: 540,
            endMinute: 600,
          }),
          stop({
            id: "s2",
            name: "Kiyomizu Temple Terrace",
            lat: 35.09,
            lng: 135.75,
            startMinute: 640,
            endMinute: 700,
          }),
          stop({
            id: "s3",
            name: "Arashiyama Bamboo Path",
            lat: 35.0,
            lng: 135.75,
            startMinute: 740,
            endMinute: 800,
          }),
          stop({
            id: "s4",
            name: "Gion Ramen House",
            kind: "meal",
            lat: 35.09,
            lng: 135.75,
            startMinute: 840,
            endMinute: 900,
          }),
        ],
      },
      {
        date: "2026-05-11",
        destination: "Kyoto",
        supplierSearch: "ok",
        stops: [
          stop({
            id: "s6",
            name: "Pontocho Izakaya",
            kind: "meal",
            startMinute: 1080,
            endMinute: 1140,
          }),
        ],
      },
    ];
    const grade = gradeItinerary(baseBrief({ pacePreference: "packed" }), days);
    expect(grade.scores.feasibility).toBe(1);
    expect(grade.failures).toContain("feasibility:daily_distance:2026-05-10");
  });

  test("rejects repeating the same restaurant across different days", () => {
    const days: GradeDay[] = [
      {
        date: "2026-05-10",
        destination: "Kyoto",
        supplierSearch: "ok",
        stops: [
          stop(),
          stop({
            id: "s4",
            name: "Gion Ramen House",
            kind: "meal",
            startMinute: 720,
            endMinute: 780,
          }),
        ],
      },
      {
        date: "2026-05-11",
        destination: "Kyoto",
        supplierSearch: "ok",
        stops: [
          stop({
            id: "s2",
            name: "Kiyomizu Temple Terrace",
            startMinute: 540,
            endMinute: 660,
          }),
          stop({
            id: "s4",
            name: "Gion Ramen House",
            kind: "meal",
            startMinute: 720,
            endMinute: 780,
          }),
        ],
      },
    ];
    const grade = gradeItinerary(baseBrief(), days);
    expect(grade.scores.diversity).toBe(1);
    expect(grade.failures).toContain(
      "diversity:cross_day_duplicate:gion ramen house",
    );
  });

  test("rejects relaxed-pace days that exceed the relaxed daily duration cap", () => {
    const days: GradeDay[] = [
      {
        date: "2026-05-10",
        destination: "Kyoto",
        supplierSearch: "ok",
        stops: [
          stop({ id: "s1", startMinute: 540, endMinute: 780 }),
          stop({
            id: "s2",
            name: "Kiyomizu Temple Terrace",
            startMinute: 820,
            endMinute: 1060,
          }),
        ],
      },
      {
        date: "2026-05-11",
        destination: "Kyoto",
        supplierSearch: "ok",
        stops: [
          stop({
            id: "s7",
            name: "Philosopher's Path Walk",
            startMinute: 540,
            endMinute: 630,
          }),
        ],
      },
    ];
    const grade = gradeItinerary(
      baseBrief({ pacePreference: "relaxed" }),
      days,
    );
    expect(grade.scores.feasibility).toBe(1);
    expect(grade.failures).toContain("feasibility:pace:2026-05-10");
  });

  test("rejects excessive robotic boilerplate descriptions when rejectBoilerplate is set", () => {
    const boilerplate =
      "Spend about 90 minutes at Nishiki Market Food Stroll in Kyoto. Confirm the day's hours before you go.";
    const days: GradeDay[] = [
      {
        date: "2026-05-10",
        destination: "Kyoto",
        supplierSearch: "ok",
        stops: [stop({ description: boilerplate })],
      },
      {
        date: "2026-05-11",
        destination: "Kyoto",
        supplierSearch: "ok",
        stops: [
          stop({
            id: "s2",
            name: "Kiyomizu Temple Terrace",
            description:
              "Spend about 120 minutes at Kiyomizu Temple Terrace in Kyoto. Confirm the day's hours before you go.",
          }),
        ],
      },
    ];
    const grade = gradeItinerary(baseBrief({ rejectBoilerplate: true }), days);
    expect(grade.scores.specificity).toBe(1);
    expect(grade.failures).toContain("specificity:boilerplate");
  });

  test("rejects a hotel located >25 km from the day's activity centroid", () => {
    const days: GradeDay[] = [
      {
        date: "2026-05-10",
        destination: "Kyoto",
        supplierSearch: "ok",
        hotel: {
          id: "h1",
          name: "Far Airport Lodge",
          lat: 34.43,
          lng: 135.24,
        },
        stops: [stop()],
      },
      {
        date: "2026-05-11",
        destination: "Kyoto",
        supplierSearch: "ok",
        stops: [
          stop({
            id: "s2",
            name: "Kiyomizu Temple Terrace",
            startMinute: 540,
            endMinute: 660,
          }),
        ],
      },
    ];
    const grade = gradeItinerary(baseBrief(), days);
    expect(grade.scores.feasibility).toBe(1);
    expect(grade.failures).toContain("feasibility:hotel_distance:2026-05-10");
  });
});
