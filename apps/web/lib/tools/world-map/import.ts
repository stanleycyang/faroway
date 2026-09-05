import { z } from "zod";
import { migrate } from "./migrations";
import type { AppState, Profile } from "./types";

const MAX_VISITS_PER_PROFILE = 300;

const RawVisitSchema = z
  .object({
    iso: z.string().regex(/^[A-Z]{3}$/),
    status: z.string().min(1).max(32),
    firstVisit: z.string().max(64).optional(),
    lastVisit: z.string().max(64).optional(),
    visitCount: z.number().finite().min(0).optional(),
    // These editor fields have no length cap. The upload-size limit bounds
    // input, without rejecting or truncating the app's own exported data.
    pinnedCity: z.string().optional(),
    notes: z.string().optional(),
    rating: z
      .union([
        z.literal(1),
        z.literal(2),
        z.literal(3),
        z.literal(4),
        z.literal(5),
      ])
      .optional(),
    photoDataUrl: z
      .string()
      .regex(/^data:image\/(?:jpeg|png|webp);base64,/)
      .optional(),
  })
  .strict();

function visitsSchema<T extends z.ZodType<{ iso: string }>>(visitSchema: T) {
  return z
    .record(visitSchema)
    .refine((visits) => Object.keys(visits).length <= MAX_VISITS_PER_PROFILE)
    .refine((visits) =>
      Object.entries(visits).every(([iso, visit]) => iso === visit.iso),
    );
}

const RawVisitsSchema = visitsSchema(RawVisitSchema);

const RawProfileSchema = z
  .object({
    id: z.string().min(1).max(128),
    name: z.string().min(1),
    emoji: z.string().optional(),
    createdAt: z.string().min(1).max(64),
    updatedAt: z.string().min(1).max(64),
    visits: RawVisitsSchema,
  })
  .strict();

const CurrentProfileSchema = RawProfileSchema.extend({
  visits: visitsSchema(RawVisitSchema.extend({ status: z.literal("visited") })),
});

const StateShape = {
  schemaVersion: z.number().int().min(1).max(100).default(1),
  profiles: z.array(RawProfileSchema).min(1),
  activeProfileId: z.string().min(1).max(128),
  settings: z
    .object({
      theme: z.string().max(50).optional(),
      showLegend: z.boolean().optional(),
      quickPin: z.boolean().optional(),
      lastBackupAt: z.string().max(64).optional(),
    })
    .default({}),
};

function hasUniqueProfileIds(state: { profiles: Array<{ id: string }> }) {
  return (
    new Set(state.profiles.map((profile) => profile.id)).size ===
    state.profiles.length
  );
}

const RawStateSchema = z
  .object(StateShape)
  .strict()
  .refine(hasUniqueProfileIds);

const CurrentStateSchema = z
  .object({
    ...StateShape,
    schemaVersion: z.literal(2),
    profiles: z.array(CurrentProfileSchema).min(1),
  })
  .strict()
  .refine(hasUniqueProfileIds);

export type ParsedWorldMapImport =
  { kind: "state"; state: AppState } | { kind: "profile"; profile: Profile };

export function parseWorldMapImport(
  input: unknown,
): ParsedWorldMapImport | null {
  const rawState = RawStateSchema.safeParse(input);
  if (rawState.success) {
    const current = CurrentStateSchema.safeParse(migrate(rawState.data));
    return current.success ? { kind: "state", state: current.data } : null;
  }

  const profile = CurrentProfileSchema.safeParse(input);
  return profile.success ? { kind: "profile", profile: profile.data } : null;
}
