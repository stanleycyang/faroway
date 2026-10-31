import type { SuggestedDay } from "./types";
export interface DayNarration {
  date: string;
  title: string;
  summary: string;
  activityIds: string[];
}
const slots = ["morning", "afternoon", "evening"] as const;
export function narrationContext(days: SuggestedDay[]) {
  return days.map((day) => ({
    date: day.date,
    slots: slots.map((slot) => ({
      slot,
      activities: day[slot].activities.map((a) => ({
        id: a.id,
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
  const updates = days.map((day) => {
    const entry = narration.find((n) => n.date === day.date);
    if (
      !entry ||
      !entry.title.trim() ||
      !entry.summary.trim() ||
      entry.title.length > 100 ||
      entry.summary.length > 600
    )
      throw new Error("Missing or invalid day narration");
    const ids = slots.flatMap((slot) => day[slot].activities.map((a) => a.id));
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
