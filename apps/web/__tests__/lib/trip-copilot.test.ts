import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ActivityResult,
  GeneratedItinerary,
  ItineraryActivity,
} from "@faroway/types";
import {
  analyzeBookingReadiness,
  applyCopilotEdit,
  findOnTripUpNext,
  isIndoorStop,
  isOutdoorStop,
  parseCopilotPrompt,
} from "@/lib/trips/copilot";
import { TripCompanionBanner } from "@/components/trips/TripCompanionBanner";
import { TripCopilotBar } from "@/components/trips/TripCopilotBar";

const routeMocks = vi.hoisted(() => ({
  requireUserIdFromRequest: vi.fn(),
  getSupabase: vi.fn(),
}));

vi.mock("@/lib/auth/middleware", () => ({
  requireUserIdFromRequest: routeMocks.requireUserIdFromRequest,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: routeMocks.getSupabase,
}));

import { POST as copilotPost } from "@/app/api/trips/[id]/copilot/route";

function makeActivity(
  overrides: Partial<ItineraryActivity> & {
    id: string;
    name: string;
    planItemId?: string;
  },
): ItineraryActivity & { planItemId?: string } {
  return {
    description: "A curated local stop.",
    duration: 90,
    estimatedCost: { amount: 20, currency: "EUR", status: "estimate" },
    timeOfDay: "morning",
    category: "sightseeing",
    location: {
      name: "Central District",
      address: "10 Rue de Rivoli, Paris",
      coordinates: { lat: 48.8606, lng: 2.3376 },
    },
    vibeMatch: { matchedVibes: ["culture"], reasoning: "Matches culture" },
    bookingInfo: { requiresReservation: false },
    rating: 4.6,
    ...overrides,
  };
}

function makeItinerary(): GeneratedItinerary {
  return {
    tripId: "trip-paris-1",
    destination: "Paris",
    startDate: "2026-06-10",
    endDate: "2026-06-12",
    overview: "Three days in Paris.",
    totalEstimatedCost: { amount: 900, currency: "EUR" },
    generatedAt: "2026-05-01T00:00:00Z",
    days: [
      {
        dayNumber: 1,
        date: "2026-06-10",
        title: "Historic Heart",
        summary: "Walk the Seine and visit landmarks.",
        timingProposal: {
          mode: "proposed",
          blocks: [],
        } as unknown as GeneratedItinerary["days"][number]["timingProposal"],
        totalEstimatedCost: { amount: 180, currency: "EUR" },
        tips: ["Wear comfortable shoes."],
        morning: {
          activities: [
            makeActivity({
              id: "act-tuileries",
              planItemId: "item_11111111111111111111111111111111",
              name: "Tuileries Garden Walk",
              description: "Scenic outdoor park stroll along the Seine.",
              duration: 75,
              timeOfDay: "morning",
              category: "relaxation",
            }),
            makeActivity({
              id: "act-louvre",
              planItemId: "item_22222222222222222222222222222222",
              name: "Louvre Museum",
              description: "World-famous art museum with timed entry.",
              duration: 150,
              timeOfDay: "morning",
              category: "cultural",
              bookingInfo: { requiresReservation: true },
              rating: 4.9,
            }),
          ],
          meals: [],
        },
        afternoon: {
          activities: [
            makeActivity({
              id: "act-seine-cruise",
              planItemId: "item_33333333333333333333333333333333",
              name: "Seine River Boat Cruise",
              description: "Open-air sightseeing boat tour.",
              duration: 60,
              timeOfDay: "afternoon",
              category: "sightseeing",
              bookingInfo: {
                requiresReservation: true,
                bookingUrl: "https://example.test/cruise",
              },
            }),
          ],
          meals: [],
        },
        evening: {
          activities: [],
          meals: [
            {
              id: "meal-bistro",
              name: "Le Comptoir Fine Dining",
              cuisineType: ["French"],
              priceLevel: 3,
              description: "Seasonal French tasting menu.",
              estimatedCost: {
                amount: 70,
                currency: "EUR",
                perPerson: true,
              },
              mealType: "dinner",
              location: { name: "Saint-Germain" },
              dietaryOptions: [],
              vibeMatch: { matchedVibes: ["foodie"], reasoning: "Foodie" },
              reservationInfo: { recommended: true },
            },
          ],
        },
      },
      {
        dayNumber: 2,
        date: "2026-06-11",
        title: "Montmartre & Views",
        summary: "Hilltop views and neighborhood cafés.",
        tips: [],
        morning: {
          activities: [
            makeActivity({
              id: "act-montmartre",
              planItemId: "item_44444444444444444444444444444444",
              name: "Montmartre Viewpoint Walk",
              description: "Outdoor walking route through hilltop squares.",
              duration: 90,
              timeOfDay: "morning",
              category: "sightseeing",
            }),
          ],
          meals: [],
        },
        afternoon: { activities: [], meals: [] },
        evening: { activities: [], meals: [] },
      },
    ],
  };
}

const groundedBackups: ActivityResult[] = [
  {
    id: "backup-orsay",
    name: "Musée d'Orsay Gallery",
    description: "Impressionist masterpieces inside a historic rail hall.",
    category: "cultural",
    duration: 120,
    price: 16,
    currency: "EUR",
    rating: 4.8,
    reviewCount: 4200,
    location: {
      name: "Left Bank",
      address: "Esplanade Valéry Giscard d'Estaing, Paris",
      lat: 48.86,
      lng: 2.3266,
    },
    images: [],
    bestTimeOfDay: "afternoon",
    vibeScore: 95,
    vibeMatch: ["culture", "art"],
    bookingRequired: true,
  },
  {
    id: "backup-covered-market",
    name: "Marché des Enfants Rouges Covered Market",
    description: "Historic covered market hall with local food stalls.",
    category: "cultural",
    duration: 75,
    price: 0,
    currency: "EUR",
    rating: 4.7,
    reviewCount: 1900,
    location: {
      name: "Le Marais",
      address: "39 Rue de Bretagne, Paris",
      lat: 48.8628,
      lng: 2.362,
    },
    images: [],
    bestTimeOfDay: "morning",
    vibeScore: 90,
    vibeMatch: ["foodie"],
    bookingRequired: false,
  },
  {
    id: "backup-idea-stub",
    name: "Generic Neighborhood Idea",
    description: "Unverified inspiration stub.",
    category: "cultural",
    duration: 60,
    price: 0,
    currency: "EUR",
    rating: 4.0,
    reviewCount: 0,
    location: { name: "Paris", address: "", lat: 48.85, lng: 2.35 },
    images: [],
    bestTimeOfDay: "any",
    vibeScore: 50,
    vibeMatch: [],
    bookingRequired: false,
    planningIdea: true,
  },
];

describe("Trip Surgical Co-Pilot Engine", () => {
  it("swaps a stop using only grounded unused candidates and clears stale timing", () => {
    const itinerary = makeItinerary();
    const result = applyCopilotEdit(
      itinerary,
      { action: "swap_stop", dayNumber: 1, stopName: "Tuileries" },
      { backupPool: groundedBackups },
    );

    expect(result.applied).toBe(true);
    expect(result.diff).toHaveLength(1);
    expect(result.diff[0]).toMatchObject({
      dayNumber: 1,
      slot: "morning",
      before: "Tuileries Garden Walk",
      action: "swapped",
    });
    expect(result.diff[0].after).toBe(
      "Marché des Enfants Rouges Covered Market",
    );
    expect(result.updatedItinerary.days[0].timingProposal).toBeUndefined();
    expect(result.updatedItinerary.days[0].totalEstimatedCost).toBeUndefined();
    // Original snapshot untouched
    expect(
      result.previousItinerarySnapshot.days[0].morning.activities[0].name,
    ).toBe("Tuileries Garden Walk");
  });

  it("never invents ungrounded venues when no backup exists (and ignores planningIdea stubs)", () => {
    const itinerary = makeItinerary();
    const result = applyCopilotEdit(
      itinerary,
      { action: "swap_stop", dayNumber: 1 },
      { backupPool: [groundedBackups[2]] }, // only a planningIdea stub
    );

    expect(result.applied).toBe(false);
    expect(result.diff).toEqual([]);
    expect(result.notice).toMatch(/never invent/i);
    expect(result.updatedItinerary).toEqual(itinerary);
  });

  it("respects locked items on swap_stop, relax_day, rain_backup, and shift_day", () => {
    const itinerary = makeItinerary();
    const locked = ["item_11111111111111111111111111111111"]; // Tuileries Garden Walk

    const swapRes = applyCopilotEdit(
      itinerary,
      { action: "swap_stop", dayNumber: 1, stopName: "Tuileries" },
      { lockedItemIds: locked, backupPool: groundedBackups },
    );
    expect(swapRes.applied).toBe(false);
    expect(swapRes.summary).toMatch(/locked/i);

    const rainRes = applyCopilotEdit(
      itinerary,
      { action: "rain_backup", dayNumber: 1 },
      { lockedItemIds: locked, backupPool: groundedBackups },
    );
    // Tuileries stays untouched, Seine River Boat Cruise gets swapped!
    expect(rainRes.applied).toBe(true);
    expect(rainRes.diff).toHaveLength(1);
    expect(rainRes.diff[0].before).toBe("Seine River Boat Cruise");
    expect(rainRes.updatedItinerary.days[0].morning.activities[0].name).toBe(
      "Tuileries Garden Walk",
    );
    expect(rainRes.notice).toMatch(/Tuileries Garden Walk/);
  });

  it("relax_day trims lowest-priority optional stop and preserves reservation/locked stops", () => {
    const itinerary = makeItinerary();
    const result = applyCopilotEdit(itinerary, {
      action: "relax_day",
      dayNumber: 1,
    });

    expect(result.applied).toBe(true);
    expect(result.diff).toEqual([
      {
        dayNumber: 1,
        slot: "morning",
        before: "Tuileries Garden Walk",
        action: "removed",
      },
    ]);
    // Louvre Museum (requiresReservation) remains intact
    expect(
      result.updatedItinerary.days[0].morning.activities.map((a) => a.name),
    ).toEqual(["Louvre Museum"]);
    expect(result.updatedItinerary.days[0].timingProposal).toBeUndefined();
  });

  it("rain_backup swaps outdoor stops for indoor backups and returns honest notice when cache is empty", () => {
    const itinerary = makeItinerary();

    const withCache = applyCopilotEdit(
      itinerary,
      { action: "rain_backup", dayNumber: 1 },
      { backupPool: groundedBackups },
    );
    expect(withCache.applied).toBe(true);
    expect(withCache.diff).toHaveLength(2);
    expect(withCache.diff.map((d) => d.before)).toEqual([
      "Tuileries Garden Walk",
      "Seine River Boat Cruise",
    ]);
    expect(withCache.diff.every((d) => d.after && d.action === "swapped")).toBe(
      true,
    );

    const withoutCache = applyCopilotEdit(
      itinerary,
      { action: "rain_backup", dayNumber: 1 },
      { backupPool: [] },
    );
    expect(withoutCache.applied).toBe(false);
    expect(withoutCache.summary).toMatch(/no indoor grounded backups/i);
    expect(withoutCache.notice).toMatch(/never invent/i);
  });

  it("shift_day supports natural-language move and late-arrival slot clearing", () => {
    const itinerary = makeItinerary();

    const moveRes = applyCopilotEdit(itinerary, {
      prompt: "Move Louvre Museum to Day 2 afternoon",
    });
    expect(moveRes.applied).toBe(true);
    expect(moveRes.diff[0]).toMatchObject({
      dayNumber: 2,
      slot: "afternoon",
      action: "moved",
    });
    expect(
      moveRes.updatedItinerary.days[1].afternoon.activities.map((a) => a.name),
    ).toContain("Louvre Museum");
    expect(
      moveRes.updatedItinerary.days[0].morning.activities.map((a) => a.name),
    ).not.toContain("Louvre Museum");

    const clearRes = applyCopilotEdit(itinerary, {
      prompt: "We land at 3pm on Day 1, clear Day 1 morning",
    });
    expect(clearRes.applied).toBe(true);
    expect(clearRes.updatedItinerary.days[0].morning.activities).toHaveLength(
      0,
    );
    expect(clearRes.diff).toHaveLength(2);
    expect(clearRes.diff.every((d) => d.action === "moved")).toBe(true);
  });

  it("undo reverts cleanly to previousItinerarySnapshot", () => {
    const itinerary = makeItinerary();
    const relaxed = applyCopilotEdit(itinerary, {
      action: "relax_day",
      dayNumber: 1,
    });
    expect(relaxed.applied).toBe(true);
    expect(relaxed.updatedItinerary.days[0].morning.activities).toHaveLength(1);

    const undone = applyCopilotEdit(relaxed.updatedItinerary, {
      action: "undo",
      previousItinerarySnapshot:
        relaxed.previousItinerarySnapshot as unknown as Record<
          string,
          unknown
        > & { days: Record<string, unknown>[] },
    });
    expect(undone.applied).toBe(true);
    expect(undone.updatedItinerary.days[0].morning.activities).toHaveLength(2);
    expect(undone.updatedItinerary.days[0].morning.activities[0].name).toBe(
      "Tuileries Garden Walk",
    );
  });

  it("classifies indoor and outdoor stops accurately", () => {
    expect(isOutdoorStop({ name: "Tuileries Garden Walk" })).toBe(true);
    expect(isOutdoorStop({ name: "Louvre Museum" })).toBe(false);
    expect(isIndoorStop({ name: "Louvre Museum" })).toBe(true);
    expect(
      isOutdoorStop({ name: "Marché des Enfants Rouges Covered Market" }),
    ).toBe(false);
    expect(
      isIndoorStop({ name: "Marché des Enfants Rouges Covered Market" }),
    ).toBe(true);
  });

  it("parses natural-language co-pilot prompts into structured intents", () => {
    const itinerary = makeItinerary();
    expect(
      parseCopilotPrompt("Rainy day backup for Day 2", itinerary),
    ).toMatchObject({
      action: "rain_backup",
      dayNumber: 2,
    });
    expect(
      parseCopilotPrompt("Make Day 1 slower and lighter", itinerary),
    ).toMatchObject({
      action: "relax_day",
      dayNumber: 1,
    });
    expect(parseCopilotPrompt("Undo last edit", itinerary)).toEqual({
      action: "undo",
    });
  });
});

describe("Proactive Companion Radar (Booking Readiness & On-Trip Up Next)", () => {
  it("computes days until trip and flags timed-entry / popular dining stops", () => {
    const itinerary = makeItinerary();
    const now = new Date(2026, 4, 27, 10, 0, 0); // May 27, 2026 -> 14 days before June 10, 2026
    const report = analyzeBookingReadiness(
      itinerary,
      "2026-06-10",
      "2026-06-12",
      now,
    );

    expect(report.daysUntilTrip).toBe(14);
    expect(report.urgency).toBe("high");
    expect(report.urgentStops.map((s) => s.name)).toEqual([
      "Louvre Museum",
      "Seine River Boat Cruise",
      "Le Comptoir Fine Dining",
    ]);
    expect(report.headline).toBe(
      "14 days out · 3 timed-entry stops typically sell out early",
    );
  });

  it("surfaces on-trip Up Next stop only when today is within [start_date, end_date]", () => {
    const itinerary = makeItinerary();

    const beforeTrip = findOnTripUpNext(
      itinerary,
      "2026-06-10",
      "2026-06-12",
      new Date(2026, 5, 8, 10, 0, 0),
    );
    expect(beforeTrip).toBeNull();

    const duringMorning = findOnTripUpNext(
      itinerary,
      "2026-06-10",
      "2026-06-12",
      new Date(2026, 5, 10, 9, 30, 0),
    );
    expect(duringMorning).toMatchObject({
      dayNumber: 1,
      slot: "morning",
      stop: { name: "Tuileries Garden Walk" },
    });

    const duringAfternoon = findOnTripUpNext(
      itinerary,
      "2026-06-10",
      "2026-06-12",
      new Date(2026, 5, 10, 14, 0, 0),
    );
    expect(duringAfternoon).toMatchObject({
      dayNumber: 1,
      slot: "afternoon",
      stop: { name: "Seine River Boat Cruise" },
    });
  });

  it("renders TripCompanionBanner and TripCopilotBar cleanly without h4 headings", () => {
    const itinerary = makeItinerary();
    const bannerHtml = renderToStaticMarkup(
      React.createElement(TripCompanionBanner, {
        destination: "Paris",
        startDate: "2026-06-10",
        endDate: "2026-06-12",
        itinerary,
        activeDayNumber: 1,
        now: new Date(2026, 5, 10, 9, 30, 0),
        onTriggerRainSwap: () => {},
      }),
    );
    expect(bannerHtml).toContain("Show taxi driver");
    expect(bannerHtml).toContain("Tuileries Garden Walk");
    expect(bannerHtml).toContain("Booking Readiness");
    expect(bannerHtml).toContain("Rain-Swap Radar");
    expect(bannerHtml).not.toMatch(/<h4\b/);

    const copilotHtml = renderToStaticMarkup(
      React.createElement(TripCopilotBar, {
        tripId: "trip-paris-1",
        destination: "Paris",
        itinerary,
        activeDayNumber: 1,
        onItineraryUpdated: () => {},
      }),
    );
    expect(copilotHtml).toContain("Make Day 1 more relaxed");
    expect(copilotHtml).toContain("Rainy-day indoor backup");
    expect(copilotHtml).toContain("Swap a stop for something new");
    expect(copilotHtml).toContain("Later start on Day 1");
    expect(copilotHtml).not.toMatch(/<h4\b/);
  });
});

describe("POST /api/trips/[id]/copilot route guards", () => {
  beforeEach(() => {
    routeMocks.requireUserIdFromRequest.mockReset();
    routeMocks.getSupabase.mockReset();
  });

  it("rejects unauthenticated requests with 401", async () => {
    routeMocks.requireUserIdFromRequest.mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const req = new NextRequest("http://localhost/api/trips/trip-1/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "relax_day", dayNumber: 1 }),
    });
    const res = await copilotPost(req, {
      params: Promise.resolve({ id: "trip-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when trip does not belong to user", async () => {
    routeMocks.requireUserIdFromRequest.mockResolvedValue({
      userId: "user-other",
    });
    routeMocks.getSupabase.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: async () => ({
                data: null,
                error: { code: "PGRST116" },
              }),
            }),
          }),
        }),
      }),
    });
    const req = new NextRequest("http://localhost/api/trips/trip-1/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "relax_day", dayNumber: 1 }),
    });
    const res = await copilotPost(req, {
      params: Promise.resolve({ id: "trip-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns 409 on revision conflict without mutating itinerary", async () => {
    routeMocks.requireUserIdFromRequest.mockResolvedValue({
      userId: "owner-1",
    });
    const itinerary = makeItinerary();
    routeMocks.getSupabase.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: "trip-1",
                  user_id: "owner-1",
                  destination: "Paris",
                  start_date: "2026-06-10",
                  end_date: "2026-06-12",
                  status: "planned",
                  updated_at: "2026-05-02T12:00:00Z",
                  preferences: {},
                  plan_revision_id: null,
                  search_id: null,
                  itineraries: [
                    {
                      id: "itin-1",
                      days: itinerary.days,
                      overview: itinerary.overview,
                      total_cost: 900,
                      packing_list: [],
                      general_tips: [],
                      generated_at: "2026-05-01T00:00:00Z",
                    },
                  ],
                },
                error: null,
              }),
            }),
          }),
        }),
      }),
    });
    const req = new NextRequest("http://localhost/api/trips/trip-1/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "relax_day",
        dayNumber: 1,
        expectedUpdatedAt: "2026-05-01T00:00:00Z",
      }),
    });
    const res = await copilotPost(req, {
      params: Promise.resolve({ id: "trip-1" }),
    });
    expect(res.status).toBe(409);
  });

  it("persists an applied edit for the verified owner and returns before/after diff", async () => {
    routeMocks.requireUserIdFromRequest.mockResolvedValue({
      userId: "owner-1",
    });
    const itinerary = makeItinerary();
    const savedDays: unknown[] = [];

    routeMocks.getSupabase.mockReturnValue({
      from: (table: string) => {
        if (table === "trips") {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: async () => ({
                    data: {
                      id: "trip-1",
                      user_id: "owner-1",
                      destination: "Paris",
                      start_date: "2026-06-10",
                      end_date: "2026-06-12",
                      status: "planned",
                      updated_at: "2026-05-02T12:00:00Z",
                      preferences: {},
                      plan_revision_id: null,
                      search_id: null,
                      itineraries: [
                        {
                          id: "itin-1",
                          days: itinerary.days,
                          overview: itinerary.overview,
                          total_cost: 900,
                          packing_list: [],
                          general_tips: [],
                          generated_at: "2026-05-01T00:00:00Z",
                        },
                      ],
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            update: (payload: { updated_at: string }) => ({
              eq: () => ({
                eq: () => ({
                  eq: () => ({
                    select: () => ({
                      maybeSingle: async () => ({
                        data: { updated_at: payload.updated_at },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        if (table === "itineraries") {
          return {
            update: (payload: { days: unknown }) => {
              savedDays.push(payload.days);
              return {
                eq: () => ({
                  eq: async () => ({ error: null }),
                }),
              };
            },
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    });

    const req = new NextRequest("http://localhost/api/trips/trip-1/copilot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "relax_day",
        dayNumber: 1,
        expectedUpdatedAt: "2026-05-02T12:00:00Z",
      }),
    });
    const res = await copilotPost(req, {
      params: Promise.resolve({ id: "trip-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applied).toBe(true);
    expect(body.diff).toHaveLength(1);
    expect(body.diff[0].action).toBe("removed");
    expect(
      body.previousItinerarySnapshot.days[0].morning.activities,
    ).toHaveLength(2);
    expect(savedDays).toHaveLength(1);
  });
});
