import {
  formatMissingTripRequirements,
  getMissingTripRequirements,
} from '../../lib/tripRequirements';

describe('trip generate requirements', () => {
  it('tells the user when destination and dates are missing', () => {
    expect(getMissingTripRequirements(null)).toEqual(['destination', 'dates']);
    expect(formatMissingTripRequirements(['destination', 'dates'])).toBe(
      'Add a destination and dates to generate'
    );
  });

  it('names a single missing field', () => {
    expect(
      getMissingTripRequirements({ destination: 'Tokyo', startDate: '', endDate: '' })
    ).toEqual(['dates']);
    expect(formatMissingTripRequirements(['dates'])).toBe('Add travel dates to generate');
    expect(
      formatMissingTripRequirements(
        getMissingTripRequirements({ startDate: '2026-09-01', endDate: '2026-09-08' })
      )
    ).toBe('Add a destination to generate');
  });

  it('returns nothing when the draft is complete', () => {
    expect(
      getMissingTripRequirements({
        destination: 'Tokyo',
        startDate: '2026-09-01',
        endDate: '2026-09-08',
      })
    ).toEqual([]);
  });
});

it.each([
  ['2026-02-30', '2026-03-03'],
  ['2026-06-10', '2026-06-01'],
  ['invalid', '2026-06-01'],
])('requires usable ordered calendar dates for %s to %s', (startDate, endDate) => {
  expect(getMissingTripRequirements({ destination: 'Tokyo', startDate, endDate })).toEqual([
    'dates',
  ]);
});
