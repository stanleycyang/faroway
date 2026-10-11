import { differenceInCalendarDays, parseISO } from "date-fns";

/** Trip dates count calendar days, including both endpoints, regardless of DST. */
export function getTripDuration(start?: Date, end?: Date): number | null {
  if (
    !start ||
    !end ||
    Number.isNaN(start.getTime()) ||
    Number.isNaN(end.getTime())
  )
    return null;
  const days = differenceInCalendarDays(end, start);
  return days < 0 ? null : days + 1;
}

/** Database trip dates have no timezone; parsing them as UTC shifts western displays. */
export function parseTripDate(value: string): Date {
  return parseISO(value);
}

export function formatTripDate(value: string): string {
  return parseTripDate(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
