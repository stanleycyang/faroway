import { z } from "zod";
export const BookingReportCommand = z
  .object({
    requestId: z.string().uuid(),
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    generationId: z.string().uuid(),
    itemId: z.string().regex(/^item_[a-f0-9]{32}$/),
    expectedReportId: z.string().uuid().nullable(),
    status: z.enum(["needed", "provider_opened", "traveler_booked"]),
  })
  .strict();
export type BookingReportInput = z.infer<typeof BookingReportCommand>;
export const bookingLabels = {
  needed: "Review / still needed",
  provider_opened: "Provider opened · reported by you",
  traveler_booked: "Booked · reported by you",
} as const;
