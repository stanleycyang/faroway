import { z } from "zod";

export const hotelSearchEnabled = () =>
  process.env.NEXT_PUBLIC_HOTEL_SEARCH_ENABLED === "true";

const currency = z.string().regex(/^[A-Z]{3}$/);
const amount = z.number().finite().nonnegative();
export const HotelQuoteResultSchema = z.object({
  tripId: z.string().min(1),
  tripUpdatedAt: z.string().min(1),
  observedAt: z.string().datetime({ offset: true }),
  sandbox: z.literal(true),
  hotels: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1),
        offers: z
          .array(
            z.object({
              id: z.string().min(1),
              stayAmount: amount,
              currency,
              roomCount: z.number().int().min(1).max(4),
              additionalTaxes: z.array(
                z.object({ amount, currency, description: z.string() }),
              ),
              cancellationNote: z.string(),
            }),
          )
          .max(20),
      }),
    )
    .max(20),
});
