import {
  HotelCardSchema,
  ActivityCardSchema,
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
