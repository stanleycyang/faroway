import { z } from "zod";
import { fetchWithTimeout } from "@/lib/search/runtime";
import { isValidDateOnly } from "@/lib/api/date-range";

// Server-side only: never import this adapter into a client component.
const date = z.string().refine(isValidDateOnly, "Invalid calendar date");
const country = z.string().regex(/^[A-Z]{2}$/);
export const LiteApiSearchSchema = z
  .object({
    cityName: z.string().trim().min(1).max(120),
    countryCode: country,
    checkin: date,
    checkout: date,
    guestNationality: country,
    currency: z.string().regex(/^[A-Z]{3}$/),
    occupancies: z
      .array(
        z.object({
          adults: z.number().int().min(1).max(8),
          children: z.array(z.number().int().min(0).max(17)).max(6).default([]),
        }),
      )
      .min(1)
      .max(4),
    limit: z.number().int().min(1).max(20).default(10),
  })
  .strict()
  .refine((value) => value.checkout > value.checkin, {
    message: "Checkout must be after check-in",
    path: ["checkout"],
  });
export type LiteApiSearch = z.input<typeof LiteApiSearchSchema>;

const money = z
  .object({
    amount: z.number().finite().nonnegative(),
    currency: z.string().regex(/^[A-Z]{3}$/),
  })
  .passthrough();
const taxes = z
  .array(
    z
      .object({
        amount: z.number().finite().nonnegative(),
        currency: z.string().regex(/^[A-Z]{3}$/),
        included: z.boolean(),
        description: z.string(),
      })
      .passthrough(),
  )
  .nullable()
  .optional();
const prices = z.array(money).min(1).nullable().optional();
const ratesResponse = z
  .object({
    sandbox: z.literal(true),
    data: z.array(
      z
        .object({
          hotelId: z.string().min(1),
          roomTypes: z.array(
            z
              .object({
                offerId: z.string().min(1),
                suggestedSellingPrice: z
                  .union([money, z.array(money).min(1)])
                  .nullable()
                  .optional(),
                offerRetailRate: z
                  .union([money, z.array(money).min(1)])
                  .optional(),
                rates: z
                  .array(
                    z
                      .object({
                        retailRate: z
                          .object({
                            total: z.array(money).min(1),
                            suggestedSellingPrice: prices,
                            taxesAndFees: taxes,
                          })
                          .passthrough(),
                        suggestedSellingPrice: prices,
                        taxesAndFees: taxes,
                      })
                      .passthrough(),
                  )
                  .min(1),
              })
              .passthrough(),
          ),
        })
        .passthrough(),
    ),
    hotels: z
      .array(z.object({ id: z.string(), name: z.string() }).passthrough())
      .optional(),
  })
  .passthrough();

export type LiteApiRatesResponse = z.infer<typeof ratesResponse>;

export function isLiteApiConfigured(): boolean {
  return (
    process.env.LITEAPI_SANDBOX_ENABLED === "true" &&
    /^sand_[A-Za-z0-9_-]+$/.test(process.env.LITEAPI_API_KEY?.trim() || "")
  );
}

/** Sandbox quotes only. Preserve per-room totals, taxes and supplier terms;
 * do not turn incomplete quotes into bookable prices or booking confirmations.
 */
export async function searchLiteApiHotels(input: LiteApiSearch) {
  if (!isLiteApiConfigured())
    throw new Error("LiteAPI sandbox is disabled or unconfigured");
  const params = LiteApiSearchSchema.parse(input);
  const response = await fetchWithTimeout(
    "https://api.liteapi.travel/v3.0/hotels/rates",
    {
      method: "POST",
      headers: {
        "X-API-Key": process.env.LITEAPI_API_KEY!,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        ...params,
        includeHotelData: true,
        maxRatesPerHotel: 1,
        timeout: 6,
      }),
    },
    8000,
  );
  // Never print provider bodies or credentials on failure.
  if (!response.ok)
    throw new Error(`LiteAPI rate search failed (${response.status})`);
  const payload: unknown = await response.json();
  const result = ratesResponse.safeParse(payload);
  if (!result.success)
    throw new Error(
      "LiteAPI returned an invalid or non-sandbox rates response",
    );
  return result.data;
}
