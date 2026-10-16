import type { HotelQuoteResult } from "@faroway/types";
import type { LiteApiRatesResponse } from "./liteapi";

/** Offer-level minimums cover all rooms; rate-level minimums are per room.
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
      const offerMinimums =
        offer.suggestedSellingPrice == null
          ? []
          : Array.isArray(offer.suggestedSellingPrice)
            ? offer.suggestedSellingPrice
            : [offer.suggestedSellingPrice];
      if (
        offerMinimums.length &&
        !offerMinimums.some((price) => price.currency === currency)
      )
        return [];
      const offerMinimum = Math.max(
        0,
        ...offerMinimums
          .filter((price) => price.currency === currency)
          .map((price) => price.amount),
      );
      const additionalTaxes: HotelQuoteResult["hotels"][number]["offers"][number]["additionalTaxes"] =
        [];
      for (const rate of offer.rates) {
        const prices = rate.retailRate.total.filter(
          (price) => price.currency === currency,
        );
        if (prices.length !== 1) return [];
        const minimums =
          rate.suggestedSellingPrice ??
          rate.retailRate.suggestedSellingPrice ??
          [];
        if (
          minimums.length &&
          !minimums.some((price) => price.currency === currency)
        )
          return [];
        roomTotal += prices[0].amount;
        sellingMinimum += Math.max(
          prices[0].amount,
          ...minimums
            .filter((price) => price.currency === currency)
            .map((price) => price.amount),
        );
        for (const tax of rate.taxesAndFees ??
          rate.retailRate.taxesAndFees ??
          []) {
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
        Math.ceil(
          Math.max(
            roomTotal,
            offerMinimums.length ? offerMinimum : sellingMinimum,
          ) * 100,
        ) / 100;
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
