import { durationLabel } from '../../lib/durationLabel';
it('formats fractional duration strings in readable units without guessing different units', () => {
  expect(durationLabel('0.008333333333333333 hours')).toBe('Less than 1 min');
  expect(durationLabel('1.5 hours')).toBe('1 hr 30 min');
  expect(durationLabel('90 min')).toBe('1 hr 30 min');
  expect(durationLabel('1-2 hours')).toBe('1-2 hours');
  expect(durationLabel('0 hours')).toBe('');
});
