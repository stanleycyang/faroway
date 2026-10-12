import { formatTripCalendarDate } from '../../lib/tripCalendarDate';

it('keeps saved calendar dates across DST boundaries', () => {
  expect(formatTripCalendarDate('2026-11-01')).toBe('Nov 1');
  expect(formatTripCalendarDate('2026-03-08', true)).toBe('Mar 8, 2026');
});
it('does not normalize impossible or timestamp inputs into different trip dates', () => {
  expect(formatTripCalendarDate('2026-02-30')).toBe('Date unavailable');
  expect(formatTripCalendarDate('2026-11-01T00:00:00Z')).toBe('Date unavailable');
});
