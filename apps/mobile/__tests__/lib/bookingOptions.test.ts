import { collectBookingOptions } from '../../lib/bookingOptions';
import { transformItineraryDays } from '../../lib/itineraryNormalization';
import type { Trip } from '../../stores/tripStore';

test('booking options include transport alongside activities without inventing available inventory', () => {
  const days = transformItineraryDays([
    {
      dayNumber: 2,
      date: '2026-11-02',
      transport: {
        type: 'train',
        provider: 'Rail partner',
        price: 60,
        currency: 'EUR',
        bookingUrl: 'https://partner.example/train',
      },
      activities: [
        { title: 'Museum', bookingUrl: 'https://partner.example/museum' },
        { title: 'A walk' },
      ],
    },
    { dayNumber: 3, transport: { type: 'flight', provider: 'No link' }, activities: [] },
  ]);
  const options = collectBookingOptions({ days } as Trip);
  expect(options).toHaveLength(2);
  expect(options[0]).toMatchObject({
    dayNumber: 2,
    activity: {
      type: 'transport',
      title: 'Rail partner',
      price: 'EUR 60',
      bookingUrl: 'https://partner.example/train',
    },
  });
  expect(options[1].activity.title).toBe('Museum');
  expect(collectBookingOptions({ days: [] } as unknown as Trip)).toEqual([]);
});
