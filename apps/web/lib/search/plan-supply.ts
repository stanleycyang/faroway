import type { SuggestedDay } from "./types";

/** A hotel, transport quote or generic planning idea cannot stand in for a plan.
 * This is a minimum failure gate, not venue verification or traveler-quality acceptance. */
export function hasUsableScheduledSupply(days: SuggestedDay[]): boolean {
  return days.some((day) =>
    [day.morning, day.afternoon, day.evening].some((slot) =>
      [...(slot?.activities ?? []), ...(slot?.meal ? [slot.meal] : [])].some(
        (item) =>
          item.planningIdea !== true &&
          typeof item.name === "string" &&
          item.name.trim().length > 0,
      ),
    ),
  );
}
