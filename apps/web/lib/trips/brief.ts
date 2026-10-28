import { z } from "zod";
import { isValidDateOnly, isValidDateRange } from "@/lib/api/date-range";
import {
  validateHotelSearchDetails,
  validateFlightSearchDetails,
  type FlightSearchDetails,
  hotelGuestCounts,
  type HotelSearchDetails,
} from "@faroway/constants";

export const HotelSearchDetailsSchema = z.custom<HotelSearchDetails>(
  (value) => validateHotelSearchDetails(value),
  "Provide complete hotel nationality, room occupancy and consent",
);

export const FlightSearchDetailsSchema = z.custom<FlightSearchDetails>(
  (value) => validateFlightSearchDetails(value),
  "Provide valid child ages and flight-search consent",
);

export const TravelerRequirementsSchema = z
  .object({
    allergies: z.array(z.string().trim().min(1).max(100)).max(20),
    dietaryPreferences: z.array(z.string().trim().min(1).max(100)).max(20),
    accessibility: z
      .array(
        z.enum([
          "step_free_entrance",
          "accessible_restroom",
          "accessible_seating",
          "accessible_parking",
        ]),
      )
      .max(4),
    mobilityNotes: z.string().trim().max(500),
  })
  .strict();

export const BriefPreferencesSchema = z
  .object({
    travelerType: z
      .enum(["solo", "couple", "family", "friends", "business"])
      .optional(),
    originCity: z.string().trim().max(200).optional(),
    originAirport: z.string().trim().max(10).optional(),
    adults: z.number().int().min(1).max(50).optional(),
    children: z.number().int().min(0).max(49).optional(),
    hotelSearch: HotelSearchDetailsSchema.nullable().optional(),
    flightSearch: FlightSearchDetailsSchema.nullable().optional(),
    requirements: TravelerRequirementsSchema.nullable().optional(),
    interests: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
  })
  .strict();

export const UpdateBriefSchema = z
  .object({
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    destination: z.string().trim().min(1).max(200).optional(),
    start_date: z.string().refine(isValidDateOnly).optional(),
    end_date: z.string().refine(isValidDateOnly).optional(),
    travelers: z.number().int().min(1).max(50).optional(),
    preferences: BriefPreferencesSchema.optional(),
    vibes: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
    budget_tier: z.enum(["budget", "moderate", "luxury"]).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 1,
    "No brief changes supplied",
  );

export function validBriefComposition(
  travelers: number,
  preferences: Record<string, unknown>,
) {
  if (
    preferences.hotelSearch != null &&
    !validateHotelSearchDetails(preferences.hotelSearch, travelers)
  )
    return false;
  if (
    preferences.hotelSearch != null &&
    (preferences.adults != null || preferences.children != null)
  ) {
    const counts = hotelGuestCounts(
      preferences.hotelSearch as HotelSearchDetails,
    );
    if (
      counts.adults !== preferences.adults ||
      counts.children !== (preferences.children ?? 0)
    )
      return false;
  }
  const flightChildren =
    typeof preferences.children === "number"
      ? preferences.children
      : preferences.hotelSearch != null
        ? hotelGuestCounts(preferences.hotelSearch as HotelSearchDetails)
            .children
        : undefined;
  if (
    preferences.flightSearch != null &&
    (flightChildren === undefined ||
      !validateFlightSearchDetails(preferences.flightSearch, flightChildren))
  )
    return false;
  if (preferences.adults == null && preferences.children == null) return true;
  const adults = preferences.adults;
  const children = preferences.children ?? 0;
  return (
    typeof adults === "number" &&
    typeof children === "number" &&
    adults + children === travelers
  );
}
export { isValidDateRange };
