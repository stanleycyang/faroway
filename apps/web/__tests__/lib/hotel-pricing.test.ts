import { describe, expect, it, vi } from "vitest";
vi.mock("amadeus", () => ({ default: class {} }));
import {
  normalizeBookingDemandHotel,
  normalizeBookingHotel,
} from "@/lib/affiliates/booking";
import { normalizeHotelOffer } from "@/lib/affiliates/amadeus";

const dates = { checkIn: "2026-12-01", checkOut: "2026-12-04" };
const location = {
  latitude: 35,
  longitude: 139,
  city: "Tokyo",
  country: "Japan",
  countryCode: "JP",
};

describe("provider hotel normalization", () => {
  it("preserves Booking totals, nightly averages, currency and review scale", () => {
    const hotel = normalizeBookingDemandHotel(
      { id: 1, currency: "EUR", price: { total: 301.5 } },
      {
        name: "Provider hotel",
        rating: { stars: 4, review_score: 8.7, number_of_reviews: 125 },
      },
      dates,
      location,
    );
    expect(hotel.price).toMatchObject({
      total: 301.5,
      perNight: 100.5,
      currencyCode: "EUR",
      formatted: "EUR 100.50/night estimate",
    });
    expect(hotel.userRating).toBe(8.7);
    expect(hotel.starRating).toBe(4);
  });
  it("does not present a Booking base-only price as a total or invent currency/ratings", () => {
    const hotel = normalizeBookingDemandHotel(
      { id: 1, price: { base: 300 } },
      undefined,
      dates,
      location,
    );
    expect(hotel.price.total).toBeUndefined();
    expect(hotel.price.perNight).toBeUndefined();
    expect(hotel.price.currencyCode).toBeUndefined();
    expect(hotel.price.formatted).toBe("Price unavailable");
    expect(hotel.userRating).toBeUndefined();
    expect(hotel.starRating).toBeUndefined();
  });
  it("handles legacy Booking zero and missing pricing differently and does not invent policies", () => {
    const zero = normalizeBookingHotel(
      { hotel_id: 1, min_total_price: 0, currency_code: "JPY" },
      dates,
    );
    expect(zero.price.formatted).toBe("JPY 0/night estimate");
    const missing = normalizeBookingHotel({ hotel_id: 1 }, dates);
    expect(missing.price.total).toBeUndefined();
    expect(missing.price.currencyCode).toBeUndefined();
    expect(missing.policies.cancellation).toBe(
      "Confirm cancellation terms with the provider",
    );
    expect(missing.policies.checkIn).toBe("");
    expect(missing.price.formatted).toBe("Price unavailable");
  });
  it("preserves Amadeus currency precision and does not interpret absent offers as free", () => {
    const params = { ...dates, cityCode: "TYO", adults: 2 };
    const hotel = normalizeHotelOffer(
      {
        hotel: { hotelId: "h1", rating: "5" },
        offers: [{ price: { total: "3.702", currency: "KWD" } }],
      },
      params,
    );
    expect(hotel.price).toEqual({
      total: 3.702,
      perNight: 1.234,
      currency: "KWD",
    });
    const missing = normalizeHotelOffer({ hotel: { hotelId: "h2" } }, params);
    expect(missing.price.total).toBeUndefined();
    expect(missing.price.currency).toBeUndefined();
    expect(missing.starRating).toBeUndefined();
  });
  it("does not assume one night when Booking stay dates are absent or invalid", () => {
    for (const stay of [
      {},
      { checkIn: dates.checkIn, checkOut: dates.checkIn },
      { checkIn: "invalid", checkOut: dates.checkOut },
    ]) {
      const demand = normalizeBookingDemandHotel(
        { id: 1, currency: "EUR", price: { total: 300 } },
        undefined,
        stay,
        location,
      );
      const legacy = normalizeBookingHotel(
        { hotel_id: 1, currency_code: "EUR", min_total_price: 300 },
        stay,
      );
      for (const hotel of [demand, legacy]) {
        expect(hotel.price.total).toBe(300);
        expect(hotel.price.perNight).toBeUndefined();
        expect(hotel.price.formatted).toBe("Price unavailable");
      }
    }
  });
});
