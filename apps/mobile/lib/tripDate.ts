/** Saved trip calendar dates are local dates, not UTC timestamps. */
export function parseTripDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(value);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(0, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : new Date(NaN);
}

export function formatTripDate(value: string, options: Intl.DateTimeFormatOptions = {}): string {
  const date = parseTripDate(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleDateString('en-US', options);
}

export function formatTripTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Time unavailable'
    : date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}

/** Inclusive travel duration, independent of itinerary availability and DST. */
export function tripDurationDays(start: string, end: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return null;
  const first = parseTripDate(start);
  const last = parseTripDate(end);
  const ordinal = (date: Date) => {
    const utc = new Date(0);
    utc.setUTCFullYear(date.getFullYear(), date.getMonth(), date.getDate());
    utc.setUTCHours(0, 0, 0, 0);
    return utc.getTime() / 86400000;
  };
  const days = ordinal(last) - ordinal(first) + 1;
  return Number.isFinite(days) && days > 0 ? days : null;
}
