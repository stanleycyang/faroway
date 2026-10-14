import { expect, it } from "vitest";
import { normalizeLiteApiQuotes } from "@/lib/affiliates/liteapi-quotes";
import type { LiteApiRatesResponse } from "@/lib/affiliates/liteapi";

function response(currency = "USD"): LiteApiRatesResponse {
  return {
    sandbox: true,
    hotels: [{ id: "hotel", name: "Test Hotel" }],
    data: [
      {
        hotelId: "hotel",
        roomTypes: [
          {
            offerId: "offer",
            suggestedSellingPrice: { amount: 250.001, currency },
            rates: [1, 2].map(() => ({
              retailRate: {
                total: [{ amount: 100, currency }],
                suggestedSellingPrice: [{ amount: 250.001, currency }],
                taxesAndFees: [
                  {
                    amount: 10,
                    currency: "EUR",
                    included: false,
                    description: "Pay at hotel",
                  },
                  {
                    amount: 5,
                    currency: "USD",
                    included: true,
                    description: "Included tax",
                  },
                ],
              },
            })),
          },
        ],
      },
    ],
  };
}

it("applies the all-room selling minimum once and rounds upward", () => {
  const quote = normalizeLiteApiQuotes(response(), "USD", 2)[0].offers[0];
  expect(quote.stayAmount).toBe(250.01);
  expect(quote.roomCount).toBe(2);
  expect(quote.additionalTaxes).toEqual(
    Array(2).fill({ amount: 10, currency: "EUR", description: "Pay at hotel" }),
  );
});
it("never quotes a different currency or an incomplete room allocation", () => {
  expect(normalizeLiteApiQuotes(response("EUR"), "USD", 2)).toEqual([]);
  expect(normalizeLiteApiQuotes(response(), "USD", 1)).toEqual([]);
});
it("requires an identified property before displaying a quote", () => {
  expect(
    normalizeLiteApiQuotes({ ...response(), hotels: [] }, "USD", 2),
  ).toEqual([]);
});
it("does not quote when the supplier selling minimum cannot be compared", () => {
  const rates = response();
  rates.data[0].roomTypes[0].rates[0].retailRate.suggestedSellingPrice = [
    { amount: 500, currency: "EUR" },
  ];
  expect(normalizeLiteApiQuotes(rates, "USD", 2)).toEqual([]);
});

it("adds per-room selling minimums when no offer-level minimum is supplied", () => {
  const data = response();
  delete data.data[0].roomTypes[0].suggestedSellingPrice;
  const quote = normalizeLiteApiQuotes(data, "USD", 2)[0].offers[0];
  expect(quote.stayAmount).toBe(500.01);
});
it("reads documented rate-level prices and nullable taxes", () => {
  const data = response();
  const offer = data.data[0].roomTypes[0];
  delete offer.suggestedSellingPrice;
  for (const rate of offer.rates) {
    rate.suggestedSellingPrice = [{ amount: 150, currency: "USD" }];
    rate.taxesAndFees = null;
    delete rate.retailRate.suggestedSellingPrice;
    delete rate.retailRate.taxesAndFees;
  }
  expect(normalizeLiteApiQuotes(data, "USD", 2)[0].offers[0]).toMatchObject({
    stayAmount: 300,
    additionalTaxes: [],
  });
});
