/** Travel-date phase is independent of the plan's generation/status lifecycle. */
export type TripDatePhase = "upcoming" | "in-progress" | "past" | "unknown";

function validDate(value: string): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(0);
  parsed.setUTCFullYear(year, month - 1, day);
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function localCalendarDate(now = new Date()): string {
  return `${String(now.getFullYear()).padStart(4, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function tripDatePhase(
  start: string,
  end: string,
  today: string,
): TripDatePhase {
  if (!validDate(start) || !validDate(end) || !validDate(today) || end < start)
    return "unknown";
  if (end < today) return "past";
  if (start > today) return "upcoming";
  return "in-progress";
}
