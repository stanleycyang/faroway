import {
  parseTripDate,
  formatTripDate,
  formatTripTime,
  tripDurationDays,
} from '../../lib/tripDate';

describe('native trip calendar dates', () => {
  it('keeps the saved calendar day in local time', () => {
    const date = parseTripDate('2026-11-01');
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([
      2026, 10, 1, 0,
    ]);
  });
  it('supports leap dates and rejects impossible calendar dates', () => {
    expect(parseTripDate('2028-02-29').getDate()).toBe(29);
    for (const value of ['2026-02-29', '2026-13-01', '2026-11-31']) {
      expect(Number.isNaN(parseTripDate(value).getTime())).toBe(true);
    }
  });
  it('preserves explicit timestamp instants', () => {
    expect(parseTripDate('2026-11-01T09:00:00Z').toISOString()).toBe('2026-11-01T09:00:00.000Z');
  });
});

test('missing or malformed calendar and transport dates have clear fallback labels', () => {
  expect(formatTripDate('')).toBe('Date unavailable');
  expect(formatTripDate('2026-02-30')).toBe('Date unavailable');
  expect(formatTripTime('')).toBe('Time unavailable');
  expect(formatTripTime('not a timestamp')).toBe('Time unavailable');
});

test('travel duration follows inclusive calendar dates rather than saved itinerary rows', () => {
  expect(tripDurationDays('2099-06-01', '2099-06-02')).toBe(2);
  expect(tripDurationDays('2026-03-07', '2026-03-09')).toBe(3);
  expect(tripDurationDays('2026-10-31', '2026-11-02')).toBe(3);
  expect(tripDurationDays('2028-02-28', '2028-03-01')).toBe(3);
  expect(tripDurationDays('2026-01-01', '2026-01-01')).toBe(1);
  expect(tripDurationDays('2026-02-30', '2026-03-01')).toBeNull();
  expect(tripDurationDays('2026-03-02', '2026-03-01')).toBeNull();
  expect(tripDurationDays('', '')).toBeNull();
});
