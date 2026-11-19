import {
  HotelCardSchema,
  ActivityCardSchema,
  RestaurantCardSchema,
  BookingButtonSchema,
  PriceTagSchema,
} from '../../lib/json-render/catalog';
import { formatPrice } from '@faroway/constants';

describe('streamed price contracts', () => {
  it('preserves explicit currencies through card validation', () => {
    expect(HotelCardSchema.parse({ name: 'Test', amenities: [], currency: 'EUR' }).currency).toBe(
      'EUR'
    );
    expect(
      ActivityCardSchema.parse({
        name: 'Test',
        description: '',
        duration: '1 hour',
        time: '09:00',
        currency: 'JPY',
      }).currency
    ).toBe('JPY');
    expect(
      BookingButtonSchema.parse({ label: 'Test', url: 'https://example.invalid', currency: 'CAD' })
        .currency
    ).toBe('CAD');
  });
  it('keeps missing currency unknown rather than defaulting to USD', () => {
    const price = PriceTagSchema.parse({ amount: 30 });
    expect(price.currency).toBeUndefined();
    expect(formatPrice(price.amount, price.currency)).toBeUndefined();
  });
  it('preserves decimals and explicit zero without inventing missing prices', () => {
    expect(formatPrice(101.25, 'EUR')).toBe('EUR 101.25');
    expect(formatPrice(0, 'USD')).toBe('USD 0.00');
    expect(formatPrice(undefined, 'USD')).toBeUndefined();
  });
});

describe('streamed visit scope', () => {
  const card = { name: 'Visit', description: 'Explore', duration: '1 hour', time: '09:00' };
  it.each(['ordinary_entry', 'exterior_walk', 'guided_tour', 'event', 'unknown'])(
    'retains %s rather than stripping it at the schema boundary',
    (proposedVisitType) => {
      expect(ActivityCardSchema.parse({ ...card, proposedVisitType }).proposedVisitType).toBe(
        proposedVisitType
      );
    }
  );
  it('keeps older cards readable and rejects a claimed confirmation as intent', () => {
    expect(ActivityCardSchema.parse(card).proposedVisitType).toBeUndefined();
    expect(ActivityCardSchema.safeParse({ ...card, proposedVisitType: 'confirmed' }).success).toBe(
      false
    );
  });
});

it('retains supplied identities on streamed activity and meal cards', () => {
  expect(
    ActivityCardSchema.parse({
      id: 'visit-1',
      name: 'Visit',
      description: '',
      duration: '1 hour',
      time: 'Morning',
    }).id
  ).toBe('visit-1');
  expect(RestaurantCardSchema.parse({ id: 'meal-1', name: 'Cafe', cuisine: 'French' }).id).toBe(
    'meal-1'
  );
});
