import type { SuggestedDay } from "./types";
export interface DayNarration {
  date: string;
  title: string;
  summary: string;
  activityIds: string[];
}
const slots = ["morning", "afternoon", "evening"] as const;
// Conservative lexical screen for this unverified draft, not a fact checker.
// Suitability cautions remain in tips; narration must not repeat these labels
// from model-generated inventory names as though they were established facts.
const suitabilityLabel =
  /\b(?:accessible|wheelchair[ -]friendly|step[ -]free|allerg(?:y|en)[ -](?:safe|free)|gluten[ -]free|nut[ -]free|vegan|vegetarian|halal|kosher)\b/i;
export function narrationContext(days: SuggestedDay[]) {
  return days.map((day, dayIndex) => ({
    date: day.date,
    slots: slots.map((slot) => ({
      slot,
      activities: day[slot].activities.map((a, activityIndex) => ({
        // Request-local references avoid copying long generated inventory IDs.
        // Date + slot + position is unique; saved inventory IDs never change.
        id: `d${dayIndex + 1}s${slots.indexOf(slot) + 1}v${activityIndex + 1}`,
        name: a.name,
        category: a.category,
        durationMinutes: a.duration,
      })),
      meal: day[slot].meal?.name ?? null,
    })),
  }));
}
/** Atomic structural guard, not a semantic fact checker. Leaves all schedule data intact. */
export function applyScheduleNarration(
  days: SuggestedDay[],
  narration: DayNarration[],
): SuggestedDay[] {
  if (
    narration.length !== days.length ||
    new Set(narration.map((n) => n.date)).size !== days.length
  )
    throw new Error("Narration must cover each date exactly once");
  const context = narrationContext(days);
  const updates = days.map((day, dayIndex) => {
    const entry = narration.find((n) => n.date === day.date);
    if (
      !entry ||
      !entry.title.trim() ||
      !entry.summary.trim() ||
      entry.title.length > 100 ||
      entry.summary.length > 600
    )
      throw new Error("Missing or invalid day narration");
    if (suitabilityLabel.test(`${entry.title} ${entry.summary}`))
      throw new Error("Narration repeats unverified suitability labels");
    const ids = context[dayIndex].slots.flatMap((slot) =>
      slot.activities.map((a) => a.id),
    );
    if (
      new Set(entry.activityIds).size !== entry.activityIds.length ||
      ids.length !== entry.activityIds.length ||
      ids.some((id) => !entry.activityIds.includes(id))
    )
      throw new Error("Narration references a different selection of visits");
    return { title: entry.title.trim(), summary: entry.summary.trim() };
  });
  return structuredClone(days).map((day, index) => ({
    ...day,
    ...updates[index],
  }));
}
