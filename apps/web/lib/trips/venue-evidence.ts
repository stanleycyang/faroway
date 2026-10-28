import { z } from "zod";

export const EvidenceRevision = z.string().regex(/^[a-f0-9]{64}$/);
export const VenueEvidence = z.object({
  venue_id: z.string().min(1).max(200),
  requirement: z.enum([
    "allergy",
    "dietary",
    "step_free_entrance",
    "accessible_restroom",
    "accessible_seating",
    "accessible_parking",
    "other_mobility",
  ]),
  status: z.enum(["confirmed", "contradicted", "unknown"]),
  note: z.string().max(500),
  observed_at: z.string().datetime({ offset: true }),
  evidence_revision: EvidenceRevision,
});
export const VenueEvidenceRead = z
  .object({
    tripRevision: z.string().datetime({ offset: true }),
    evidenceRevision: EvidenceRevision,
    evidence: z.array(VenueEvidence),
  })
  .refine((value) =>
    value.evidence.every(
      (entry) => entry.evidence_revision === value.evidenceRevision,
    ),
  );
