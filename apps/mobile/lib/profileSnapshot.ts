import { z } from 'zod';

export const savedProfile = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string().nullish(),
  avatar: z.string().nullish(),
  preferences: z
    .object({
      vibes: z.array(z.string()).optional(),
      budget: z.string().optional(),
      travelerType: z.string().optional(),
    })
    .nullish(),
});
export type EditorProfile = z.infer<typeof savedProfile>;
