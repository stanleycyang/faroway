import type { HotelQuoteResult } from "@faroway/types";
import type { LiteApiRatesResponse } from "./liteapi";

/** A public rate must never undercut the supplier's all-room selling minimum.
 * Do not add potentially differently denominated or payable-on-arrival taxes.
 */
export function normalizeLiteApiQuotes(
  response: LiteApiRatesResponse,
  currency: string,
  roomCount: number,
): HotelQuoteResult["hotels"] {
  return response.data.flatMap((hotel) => {
    const detail = response.hotels?.find((item) => item.id === hotel.hotelId);
    if (!detail?.name.trim()) return [];
    const offers = hotel.roomTypes.flatMap((offer) => {
      if (offer.rates.length !== roomCount) return [];
      let roomTotal = 0;
      let sellingMinimum = 0;
      const additionalTaxes: HotelQuoteResult["hotels"][number]["offers"][number]["additionalTaxes"] =
        [];
      for (const rate of offer.rates) {
        const prices = rate.retailRate.total.filter(
          (price) => price.currency === currency,
        );
        if (prices.length !== 1) return [];
        const minimums = rate.retailRate.suggestedSellingPrice || [];
        if (
          minimums.length &&
          !minimums.some((price) => price.currency === currency)
        )
          return [];
        roomTotal += prices[0].amount;
        for (const minimum of minimums) {
          if (minimum.currency === currency)
            sellingMinimum = Math.max(sellingMinimum, minimum.amount);
        }
        for (const tax of rate.retailRate.taxesAndFees || []) {
          if (!tax.included)
            additionalTaxes.push({
              amount: tax.amount,
              currency: tax.currency,
              description: tax.description,
            });
        }
      }
      if (!Number.isFinite(roomTotal)) return [];
      const publicAmount =
        Math.ceil(Math.max(roomTotal, sellingMinimum) * 100) / 100;
      return [
        {
          id: offer.offerId,
          stayAmount: publicAmount,
          currency,
          roomCount,
          additionalTaxes,
          cancellationNote:
            "Confirm cancellation conditions and final price with the supplier before booking.",
        },
      ];
    });
    return offers.length
      ? [{ id: hotel.hotelId, name: detail.name, offers }]
      : [];
  });
}
