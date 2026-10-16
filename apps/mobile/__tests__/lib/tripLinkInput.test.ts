import { tripInputFromLink } from '../../lib/tripLinkInput';
import { travelVibes } from '@faroway/constants';
it('ignores repeated parameters and strict-invalid counts without importing malformed data', () => {
  expect(tripInputFromLink({ destination: ['Tokyo', 'Paris'] })).toBeNull();
  for (const travelers of ['0', '-2', '99', '2people', '1.5', ['2', '3']])
    expect(
      tripInputFromLink({
        destination: 'Tokyo',
        travelers,
        vibes: ['foodie'],
        travelerType: 'unknown',
      })
    ).toEqual({ destination: 'Tokyo' });
});
it('keeps valid facts and deduplicates allowed vibes within the five-choice limit', () => {
  const ids = travelVibes.map((v) => v.id);
  expect(
    tripInputFromLink({
      destination: ' Tokyo ',
      travelers: '3',
      vibes: [...ids, ids[0], 'unknown'].join(','),
    })
  ).toEqual({ destination: 'Tokyo', travelers: 3, vibes: ids.slice(0, 5) });
});
