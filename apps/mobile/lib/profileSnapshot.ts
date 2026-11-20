import { z } from 'zod';

export const savedProfile = z.object({
  id: z.string(),
  email: z
    .string()
    .nullish()
    .transform((value) => value ?? ''),
  name: z.string().nullish(),
  avatar: z.string().nullish(),
  preferences: z
    .object({
      vibes: z
        .array(z.string())
        .nullish()
        .transform((value) => value ?? undefined),
      budget: z
        .string()
        .nullish()
        .transform((value) => value ?? undefined),
      travelerType: z
        .string()
        .nullish()
        .transform((value) => value ?? undefined),
    })
    .nullish(),
});
export type EditorProfile = z.infer<typeof savedProfile>;
