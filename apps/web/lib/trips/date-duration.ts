import { differenceInCalendarDays } from "date-fns";

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
