import { reportedCount, reportedProgress, hotelPreviewFacts } from '../../lib/generationFacts';

it.each([undefined, null, '10', -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
  'does not turn malformed counts into inventory (%s)',
  (value) => {
    expect(reportedCount(value)).toBeUndefined();
  }
);
it('preserves zero and actual reported counts instead of inferring ten from a hotel', () => {
  expect(reportedCount(0)).toBe(0);
  expect(reportedCount(1)).toBe(1);
  expect(reportedCount(7)).toBe(7);
  expect(reportedCount({ topHotel: { name: 'Preview' } })).toBeUndefined();
});
it.each([undefined, '50', -1, 101, NaN, Infinity])('rejects invalid progress (%s)', (value) => {
  expect(reportedProgress(value)).toBeUndefined();
});
it('preserves supplied bounded progress including zero and completion', () => {
  expect(reportedProgress(0)).toBe(0);
  expect(reportedProgress(42.5)).toBe(42.5);
  expect(reportedProgress(100)).toBe(100);
});
it.each([
  {},
  { pricePerNight: 200 },
  { pricePerNight: 0, currency: 'USD' },
  { pricePerNight: -2, currency: 'EUR' },
  { pricePerNight: '200', currency: 'USD' },
  { pricePerNight: Infinity, currency: 'USD' },
  { pricePerNight: 200, currency: 'usd' },
  { pricePerNight: 200, currency: 'USD', priceStatus: 'unknown' },
])('leaves an unsupported price unavailable (%j)', (hotel) => {
  expect(hotelPreviewFacts(hotel).price).toBe('Price unavailable');
});
it('preserves supplied currency and labels the nightly amount as an estimate', () => {
  expect(hotelPreviewFacts({ pricePerNight: 125.5, currency: 'EUR' }).price).toBe(
    'Est. EUR 125.5 / night'
  );
});
it('does not invent ratings or round invalid star classes into valid ones', () => {
  expect(hotelPreviewFacts({})).toMatchObject({ stars: null, rating: null });
  expect(hotelPreviewFacts({ starRating: 4.8, userRating: '4.5' })).toMatchObject({
    stars: null,
    rating: null,
  });
  expect(hotelPreviewFacts({ starRating: 8, userRating: Infinity })).toMatchObject({
    stars: null,
    rating: null,
  });
  expect(hotelPreviewFacts({ starRating: 3, userRating: 8.6 })).toMatchObject({
    stars: '★★★',
    rating: '8.6',
  });
});
