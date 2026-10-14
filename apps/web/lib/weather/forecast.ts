import { z } from "zod";

const instant = z.string().datetime({ offset: true });
export const ForecastSchema = z.object({
  updatedAt: instant,
  deprecated: z.boolean(),
  points: z
    .array(
      z.object({
        time: instant,
        temperatureC: z.number().finite(),
        windMetersPerSecond: z.number().finite().nonnegative(),
        precipitationMm: z.number().finite().nonnegative().nullable(),
        precipitationHours: z
          .union([z.literal(1), z.literal(6), z.literal(12)])
          .nullable(),
      }),
    )
    .min(1),
});

export type Forecast = z.infer<typeof ForecastSchema>;
export type ForecastPoint = Forecast["points"][number];
