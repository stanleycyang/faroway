import { isValidDateOnly, isValidDateRange } from "@/lib/api/date-range";
import { z } from "zod";
import { HotelSearchDetailsSchema } from "./brief";

const DateOnlySchema = z
  .string()
  .refine(isValidDateOnly, "Must be a valid YYYY-MM-DD date");

export const CreateTripSchema = z
  .object({
    requestId: z
      .string()
      .uuid()
      .transform((value) => value.toLowerCase())
      .optional(),
    destination: z.string().trim().min(1).max(200),
    start_date: DateOnlySchema,
    end_date: DateOnlySchema,
    travelers: z.number().int().min(1).max(50).optional(),
    budget: z.enum(["budget", "moderate", "luxury"]).optional(),
    preferences: z
      .object({
        travelerType: z
          .enum(["solo", "couple", "family", "friends", "business"])
          .optional(),
        originCity: z.string().max(200).optional(),
        originAirport: z.string().max(10).optional(),
        vibes: z.array(z.string().max(50)).max(10).optional(),
        budget: z.enum(["budget", "moderate", "luxury"]).optional(),
        adults: z.number().int().min(1).max(50).optional(),
        children: z.number().int().min(0).max(49).optional(),
        hotelSearch: HotelSearchDetailsSchema.nullable().optional(),
        interests: z.array(z.string().max(50)).max(20).optional(),
      })
      .optional(),
  })
  .refine((data) => isValidDateRange(data.start_date, data.end_date), {
    message: "End date must be on or after start date",
    path: ["end_date"],
  });

export type PendingCreateTrip = z.infer<typeof CreateTripSchema> & {
  requestId: string;
};
