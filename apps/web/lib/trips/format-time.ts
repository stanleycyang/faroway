/**
 * Format the clock portion supplied by a travel provider without converting it
 * into the server or viewer's time zone. Flight APIs return airport-local ISO
 * timestamps, so preserving the encoded clock is both deterministic for SSR
 * and correct for the departure/arrival airport.
 */
export function formatTravelTime(dateTime: string): string {
  const isoClock = dateTime.match(/T(\d{2}):(\d{2})/);
  if (isoClock) {
    return formatClock(Number(isoClock[1]), isoClock[2]);
  }

  const parsed = new Date(dateTime);
  if (Number.isNaN(parsed.getTime())) return "—";
  return formatClock(
    parsed.getUTCHours(),
    String(parsed.getUTCMinutes()).padStart(2, "0"),
  );
}

export function formatTripDate(dateValue: string): string {
  const parts = parseDateOnly(dateValue);
  if (!parts) return "—";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)));
}

export function getTripDuration(startValue: string, endValue: string): number {
  const start = parseDateOnly(startValue);
  const end = parseDateOnly(endValue);
  if (!start || !end) return 0;

  const startMs = Date.UTC(start.year, start.month - 1, start.day);
  const endMs = Date.UTC(end.year, end.month - 1, end.day);
  return Math.max(0, Math.round((endMs - startMs) / 86_400_000) + 1);
}

function parseDateOnly(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

function formatClock(hour: number, minute: string): string {
  const displayHour = hour % 12 || 12;
  const period = hour < 12 ? "AM" : "PM";
  return `${String(displayHour).padStart(2, "0")}:${minute} ${period}`;
}
