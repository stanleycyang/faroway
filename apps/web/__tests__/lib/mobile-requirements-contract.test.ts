import { describe, expect, it } from "vitest";
import { CreateTripSchema } from "@/lib/trips/create-trip-command";
import {
  UpdateBriefSchema,
  TravelerRequirementsSchema,
} from "@/lib/trips/brief";
import { readTravelerRequirements } from "../../../mobile/lib/travelerRequirements";
import {
  buildTripCreatePayload,
  buildTripUpdatePayload,
} from "../../../mobile/lib/offline/trip-payload";
import type { Trip } from "../../../mobile/lib/tripTypes";

const requirements = {
  allergies: ["severe peanut allergy"],
  dietaryPreferences: ["vegan"],
  accessibility: [
    "step_free_entrance" as const,
    "accessible_restroom" as const,
  ],
  mobilityNotes: "Wheelchair width 65 cm; no lifting; rest every 30 minutes.",
};
const trip: Trip = {
  id: "local-test",
  destination: "Edinburgh",
  country: "United Kingdom",
  startDate: "2099-06-01",
  endDate: "2099-06-04",
  travelers: 2,
  travelerType: "couple",
  vibes: ["culture"],
  requirements,
  days: [],
  coverImage: "",
  createdAt: "2099-01-01T00:00:00Z",
  status: "draft",
};

describe("native requirements against the actual saved-brief API schemas", () => {
  it("preserves the full brief across native create and edit payloads", () => {
    const created = CreateTripSchema.parse(buildTripCreatePayload(trip));
    expect(created.preferences?.requirements).toEqual(requirements);
    const updated = UpdateBriefSchema.parse(
      buildTripUpdatePayload({ requirements }, "2099-01-01T00:00:00Z"),
    );
    expect(updated.preferences?.requirements).toEqual(requirements);
    expect(
      UpdateBriefSchema.parse(
        buildTripUpdatePayload({ requirements: null }, "2099-01-01T00:00:00Z"),
      ).preferences?.requirements,
    ).toBeNull();
  });

  it.each([
    requirements,
    {
      ...requirements,
      allergies: Array(20).fill("x".repeat(100)),
      mobilityNotes: "x".repeat(500),
    },
    {
      ...requirements,
      allergies: ["  sesame  "],
      mobilityNotes: "  Rest often  ",
    },
  ])("normalizes valid native and server requirements identically", (value) => {
    expect(readTravelerRequirements(value)).toEqual(
      TravelerRequirementsSchema.parse(value),
    );
  });

  it.each([
    { ...requirements, allergies: [""] },
    { ...requirements, allergies: Array(21).fill("peanuts") },
    { ...requirements, dietaryPreferences: ["x".repeat(101)] },
    { ...requirements, mobilityNotes: "x".repeat(501) },
    { ...requirements, accessibility: ["guaranteed_accessible"] },
    { ...requirements, confirmedAllergySafe: true },
  ])(
    "rejects invalid constraints on both sides instead of silently losing them",
    (value) => {
      expect(() => readTravelerRequirements(value)).toThrow();
      expect(TravelerRequirementsSchema.safeParse(value).success).toBe(false);
    },
  );
});
