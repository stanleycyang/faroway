import { z } from 'zod';
import type { TravelerRequirements } from '@faroway/types';

// Match the saved-brief API contract. Invalid requirements must not silently
// disappear while restoring a draft or reading a saved trip.
export const travelerRequirementsSchema: z.ZodType<TravelerRequirements> = z
  .object({
    allergies: z.array(z.string().trim().min(1).max(100)).max(20),
    dietaryPreferences: z.array(z.string().trim().min(1).max(100)).max(20),
    accessibility: z
      .array(
        z.enum([
          'step_free_entrance',
          'accessible_restroom',
          'accessible_seating',
          'accessible_parking',
        ])
      )
      .max(4),
    mobilityNotes: z.string().trim().max(500),
  })
  .strict();

export function readTravelerRequirements(value: unknown) {
  return travelerRequirementsSchema.nullish().parse(value);
}
