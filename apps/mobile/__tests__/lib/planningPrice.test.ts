import { formatPlanningPrice, formatPlanningDuration } from '../../lib/planningPrice';
it('preserves foreign currencies and per-person meal estimates', () => {
  expect(formatPlanningPrice({ amount: 40, currency: 'EUR' }, undefined, true)).toBe(
    'Est. EUR 40 /pp'
  );
  expect(formatPlanningPrice(20, 'JPY')).toBe('Est. JPY 20');
});
it('keeps missing currencies and unknown prices unavailable', () => {
  expect(formatPlanningPrice(40)).toBe('Price unavailable');
  expect(formatPlanningPrice({ amount: 0, currency: 'USD', status: 'unknown' })).toBe(
    'Price unavailable'
  );
  expect(formatPlanningPrice({ amount: Infinity, currency: 'USD' })).toBe('Price unavailable');
});
it('keeps short and fractional-hour activities in minutes', () => {
  expect(formatPlanningDuration(20)).toBe('20m');
  expect(formatPlanningDuration(90)).toBe('1h 30m');
  expect(formatPlanningDuration(undefined)).toBe('Duration unavailable');
});
