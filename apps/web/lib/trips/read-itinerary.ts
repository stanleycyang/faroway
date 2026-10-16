import { z } from "zod";
import type { GeneratedItinerary } from "@/lib/ai/types";

// Older plans may omit day facts; existing renderers handle those omissions.
// Reject shapes that cannot be safely traversed or displayed, without deleting data.
const savedDay = z
  .object({
    date: z.string().optional(),
    title: z.string().optional(),
    summary: z.string().optional(),
    dayNumber: z.number().finite().optional(),
  })
  .passthrough();
const savedPlan = z
  .object({
    days: z.array(savedDay),
    overview: z.string().nullish(),
    packingList: z.array(z.string()).nullish(),
    generalTips: z.array(z.string()).nullish(),
  })
  .passthrough();

/** Shape guard for the saved-plan envelope; provider details remain renderer-validated. */
export function readSavedItinerary(value: unknown): GeneratedItinerary | null {
  if (value == null) return null;
  const parsed = savedPlan.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      "Your saved itinerary could not be read. Your trip is kept; refresh it before making changes.",
    );
  }
  return parsed.data as unknown as GeneratedItinerary;
}
