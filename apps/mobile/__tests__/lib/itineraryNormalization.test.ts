import { transformApiHotel, transformItineraryDays } from '../../lib/itineraryNormalization';
test('hotel keeps usable provider facts and excludes malformed display arrays or invented stay totals', () => {
  const hotel = transformApiHotel({
    name: 'A real hotel',
    description: {},
    pricePerNight: 120,
    currency: 'EUR',
    userRating: 4.5,
    amenities: ['Pool', {}],
    images: ['https://example.test/photo.jpg', null],
    location: { name: {}, address: 'A valid address' },
  });
  expect(hotel).toMatchObject({
    name: 'A real hotel',
    description: '',
    pricePerNight: 120,
    totalPrice: 0,
    currency: 'EUR',
    rating: 4.5,
    amenities: ['Pool'],
    images: ['https://example.test/photo.jpg'],
    location: { name: '', address: 'A valid address' },
  });
  expect(transformApiHotel({ name: {} })).toBeUndefined();
});
test('shared normalization preserves known stream currency and transport without trusting malformed chapters', () => {
  const days = transformItineraryDays([
    null,
    {
      dayNumber: 2,
      date: '2026-11-02',
      morning: {
        activities: [
          null,
          { name: 'Museum', estimatedCost: { amount: 20, currency: 'EUR', perPerson: true } },
        ],
      },
      transport: { type: 'train', price: 55, currency: 'EUR', departure: {}, arrival: {} },
    },
  ]);
  expect(days).toHaveLength(1);
  expect(days[0].activities[0].estimatedCost).toEqual({
    amount: 20,
    currency: 'EUR',
    perPerson: true,
  });
  expect(days[0].activities[0].price).toBe('EUR 20 / person');
  expect(days[0].transport).toMatchObject({ type: 'train', price: 55, currency: 'EUR' });
});

test('shared conversion preserves streamed booking links and valid cached personal flags', () => {
  const days = transformItineraryDays([
    {
      dayNumber: 1,
      morning: {
        activities: [
          {
            name: 'A stop',
            affiliateUrl: 'https://partner.example/stop',
            isSaved: true,
            topReview: 'Worth a visit',
            freeCancellation: 'false',
          },
        ],
        meal: {
          name: 'Dinner',
          reservationUrl: 'https://partner.example/table',
          images: ['https://partner.example/photo'],
        },
      },
    },
  ]);
  expect(days[0].activities[0]).toMatchObject({
    bookingUrl: 'https://partner.example/stop',
    isSaved: true,
    topReview: 'Worth a visit',
  });
  expect(days[0].activities[0].freeCancellation).toBeUndefined();
  expect(days[0].activities[1]).toMatchObject({
    bookingUrl: 'https://partner.example/table',
    image: 'https://partner.example/photo',
  });
});

test('transport preserves explicit direct service and leaves unknown duration and stops unconfirmed', () => {
  const convert = (fields: Record<string, unknown>) =>
    transformItineraryDays([{ transport: { type: 'flight', ...fields } }])[0].transport!;
  expect(convert({}).duration).toBeUndefined();
  expect(convert({}).stops).toBeUndefined();
  expect(convert({ duration: -20, stops: 1.5 }).duration).toBeUndefined();
  expect(convert({ duration: -20, stops: 1.5 }).stops).toBeUndefined();
  expect(convert({ duration: 90, stops: 0 })).toMatchObject({ duration: 90, stops: 0 });
});

test('retains verification reminders for display on native itineraries', () => {
  const days = transformItineraryDays([
    {
      date: '2026-06-01',
      dayNumber: 1,
      title: 'Day 1',
      tips: ['Confirm allergen safety with the restaurant', null, ''],
    },
  ]);
  expect(days[0].tips).toEqual(['Confirm allergen safety with the restaurant']);
});

test('does not show legacy unknown costs as free or revive a fallback price', () => {
  const [day] = transformItineraryDays([
    {
      morning: {
        activities: [
          {
            name: 'Walk',
            price: 50,
            estimatedCost: { amount: 0, currency: 'USD', status: 'unknown' },
          },
        ],
        meals: [
          {
            name: 'Meal',
            price: 50,
            estimatedCost: { amount: 0, currency: 'USD', status: 'unknown' },
          },
        ],
      },
    },
  ]);
  expect(day.activities.map((activity) => activity.estimatedCost)).toEqual([undefined, undefined]);
  expect(day.activities.map((activity) => activity.price)).toEqual([undefined, undefined]);
});

test('saved trips remain readable when their supplier is no longer integrated', () => {
  const days = transformItineraryDays([
    {
      dayNumber: 1,
      date: '2027-01-01',
      transport: {
        type: 'flight',
        provider: 'Historic airline',
        affiliatePartner: 'retired-provider',
        source: 'retired-provider',
        departure: { airport: 'LAX' },
        arrival: { airport: 'JFK' },
      },
      morning: { activities: [{ name: 'Museum' }] },
    },
  ]);
  expect(days[0].transport).toMatchObject({
    provider: 'Historic airline',
    departure: { airport: 'LAX' },
    arrival: { airport: 'JFK' },
  });
  expect(days[0].activities[0].title).toBe('Museum');
});
