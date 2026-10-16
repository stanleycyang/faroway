import { z } from "zod";

export const PlanCommand = z
  .object({
    requestId: z.string().uuid(),
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    expectedPlanRevision: z.string().uuid().nullable(),
    action: z.enum(["lock", "unlock", "swap"]),
    itemId: z.string().regex(/^item_[a-f0-9]{32}$/),
    otherItemId: z
      .string()
      .regex(/^item_[a-f0-9]{32}$/)
      .optional(),
  })
  .strict()
  .refine((v) =>
    v.action === "swap"
      ? !!v.otherItemId && v.otherItemId !== v.itemId
      : !v.otherItemId,
  );
export type PlanCommandInput = z.infer<typeof PlanCommand>;

export const PlanSaveReceipt = z.object({
  state: z.enum(["applied", "replayed"]),
  requestId: z.string().uuid(),
  planRevision: z.string().uuid(),
  revision: z.string().datetime({ offset: true }),
});
