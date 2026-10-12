/** Saved trip dates are calendar dates, not instants in the device time zone. */
export function formatTripCalendarDate(value: string, includeYear = false): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Date unavailable';
  const date = new Date(`${value}T12:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    return 'Date unavailable';
  return date.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
}
