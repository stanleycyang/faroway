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

test('passes hotel affiliatePartner through booking options', () => {
  const options = collectBookingOptions({
    days: [],
    hotel: {
      id: 'htl-1',
      name: 'Grand Stay',
      description: 'Central',
      pricePerNight: 210,
      currency: 'USD',
      totalPrice: 630,
      rating: 4.5,
      reviewCount: 100,
      amenities: [],
      images: [],
      bookingUrl: 'https://www.stay22.com/embed/gm?aid=1',
      affiliatePartner: 'stay22',
      location: { name: 'Center', address: '1 Main', lat: 0, lng: 0 },
    },
  } as unknown as Trip);
  expect(options).toHaveLength(1);
  expect(options[0].activity.affiliatePartner).toBe('stay22');
  expect(options[0].activity.price).toBe('USD 210 / night');
});

test('formats hotel booking option cleanly when nightly price is missing', () => {
  const options = collectBookingOptions({
    days: [],
    hotel: {
      id: 'htl-2',
      name: 'Rate Unknown Stay',
      description: 'Central',
      pricePerNight: NaN,
      currency: undefined,
      totalPrice: 0,
      rating: 4.5,
      reviewCount: 10,
      amenities: [],
      images: [],
      bookingUrl: 'https://www.booking.com/hotel/fr/example.html',
      affiliatePartner: 'booking',
      location: { name: 'Center', address: '1 Main', lat: 0, lng: 0 },
    },
  } as unknown as Trip);
  expect(options).toHaveLength(1);
  expect(options[0].activity.price).toBe('Check rates');
});
