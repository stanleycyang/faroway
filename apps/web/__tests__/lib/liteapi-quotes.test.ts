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
