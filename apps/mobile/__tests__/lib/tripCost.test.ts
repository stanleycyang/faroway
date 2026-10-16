import { formatKnownPrice, readTripCost, summarizeTripCosts } from '../../lib/tripCost';
test('known estimates keep currencies and price bases separate without parsing display strings', () => {
  const result = summarizeTripCosts({
    hotel: { totalPrice: 600, currency: 'USD' },
    days: [
      {
        transport: { price: 200, currency: 'EUR' },
        activities: [
          { estimatedCost: { amount: 20, currency: 'USD', perPerson: true } },
          { estimatedCost: { amount: 30, currency: 'USD', perPerson: true } },
          { estimatedCost: { amount: 10, currency: 'EUR' } },
          {},
        ],
      },
    ],
  });
  expect(result).toEqual([
    'USD 600 · stay',
    'EUR 200 · transport',
    'USD 50 · activities / person',
    'EUR 10 · activities',
  ]);
});
test('unknown currency and malformed numeric values never become fabricated dollar quotes', () => {
  expect(formatKnownPrice(120)).toBe('Price unavailable');
  expect(formatKnownPrice(120, 'EUR')).toBe('EUR 120');
  for (const value of [
    120,
    '$120',
    { amount: '120', currency: 'USD' },
    { amount: Infinity, currency: 'USD' },
    { amount: -1, currency: 'USD' },
    { amount: 20, currency: 'unknown' },
  ])
    expect(readTripCost(value)).toBeUndefined();
  expect(
    summarizeTripCosts({ hotel: { totalPrice: 0, currency: 'USD' }, days: [{ activities: [{}] }] })
  ).toEqual([]);
});
