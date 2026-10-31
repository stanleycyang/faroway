import { readCachedTrips } from '../../../lib/offline/cached-trip';

const summary = {
  id: 'saved-trip',
  destination: 'Lisbon, Portugal',
  country: '',
  startDate: '2026-12-07',
  endDate: '2026-12-09',
  travelers: 2,
  travelerType: 'friends',
  vibes: [],
  budget: null,
  days: [],
  coverImage: 'https://example.com/lisbon.jpg',
  createdAt: '2026-10-28T00:00:00Z',
  status: 'planned',
};

it('recovers older sync summaries with an absent budget without dropping the trip', () => {
  const [trip] = readCachedTrips(JSON.parse(JSON.stringify([summary])));
  expect(trip.id).toBe(summary.id);
  expect(trip.budget).toBeUndefined();
  expect(trip.destination).toBe(summary.destination);
});

it('still rejects a malformed budget and damaged itinerary instead of silently erasing data', () => {
  expect(() => readCachedTrips([{ ...summary, budget: {} }])).toThrow();
  expect(() => readCachedTrips([{ ...summary, days: [{ date: 'bad' }] }])).toThrow();
});
