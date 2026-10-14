import { getMarkedDates, localCalendarDate } from '../../lib/dateRangeMarks';
it('uses local calendar keys and preserves both endpoints', () => {
  expect(localCalendarDate(new Date(2026, 10, 1))).toBe('2026-11-01');
  const marks = getMarkedDates('2026-11-01', '2026-11-03');
  expect(Object.keys(marks)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
  expect(marks['2026-11-01'].startingDay).toBe(true);
  expect(marks['2026-11-03'].endingDay).toBe(true);
});
it.each([
  ['2026-02-30', '2026-03-04'],
  ['2026-11-03', '2026-11-01'],
])('invalid range has no misleading marks: %s to %s', (start, end) => {
  expect(getMarkedDates(start, end)).toEqual({});
});
it('single selected date is both endpoints', () => {
  expect(getMarkedDates('2026-11-01', '')['2026-11-01']).toMatchObject({
    startingDay: true,
    endingDay: true,
  });
});
