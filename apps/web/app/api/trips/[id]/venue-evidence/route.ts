import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserIdFromRequest } from "@/lib/auth/middleware";
import { getSupabase } from "@/lib/supabase/server";
import {
  EvidenceRevision,
  VenueEvidence,
  VenueEvidenceRead,
} from "@/lib/trips/venue-evidence";
import { checkRateLimitAsync } from "@/lib/security/rate-limit";

const SavedEvidence = VenueEvidence.extend({
  trip_id: z.string(),
  user_id: z.string(),
});
const Input = z
  .object({
    evidenceRevision: EvidenceRevision,
    venueId: z.string().trim().min(1).max(200),
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
    note: z.string().trim().max(500),
  })
  .strict()
  .refine(
    (value) => value.status === "unknown" || !!value.note.trim(),
    "Describe what was confirmed",
  );
const json = (value: unknown, status = 200) =>
  NextResponse.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
type Context = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireUserIdFromRequest(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    const expected = request.nextUrl.searchParams.get("tripRevision");
    if (
      expected !== null &&
      !z.string().datetime({ offset: true }).safeParse(expected).success
    )
      return json({ error: "Invalid trip revision" }, 400);
    const { data, error } = await getSupabase().rpc(
      "read_trip_venue_evidence",
      {
        p_trip_id: id,
        p_user_id: auth.userId,
        p_expected_trip_revision: expected,
      },
    );
    if (error?.code === "40001")
      return json(
        { error: "Your plan changed. Reload to view confirmations." },
        409,
      );
    if (error) return json({ error: "Confirmations are unavailable" }, 503);
    if (data === null) return json({ error: "Trip not found" }, 404);
    const parsed = VenueEvidenceRead.safeParse(data);
    if (!parsed.success)
      return json({ error: "Confirmations are unavailable" }, 503);
    return json(parsed.data);
  } catch {
    return json({ error: "Confirmations are unavailable" }, 503);
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireUserIdFromRequest(request);
    if (auth instanceof NextResponse) return auth;
    const limit = await checkRateLimitAsync(`venue-evidence:${auth.userId}`, {
      maxRequests: 30,
      windowMs: 60_000,
      failClosed: true,
    });
    if (!limit.allowed)
      return json(
        { error: "Please wait before saving another confirmation" },
        429,
      );
    const input = Input.safeParse(await request.json().catch(() => null));
    if (!input.success) return json({ error: "Invalid confirmation" }, 400);
    const { id } = await params;
    const value = input.data;
    const { data, error } = await getSupabase()
      .rpc("save_trip_venue_evidence_v2", {
        p_trip_id: id,
        p_user_id: auth.userId,
        p_evidence_revision: value.evidenceRevision,
        p_venue_id: value.venueId,
        p_requirement: value.requirement,
        p_status: value.status,
        p_note: value.note,
      })
      .maybeSingle();
    if (error?.code === "40001")
      return json(
        { error: "Your trip changed. Reload it before saving." },
        409,
      );
    if (error?.code === "22023")
      return json({ error: "This venue is not in the current plan." }, 400);
    const parsedRow = SavedEvidence.safeParse(data);
    if (!parsedRow.success)
      return json(
        {
          error: "Confirmation could not be verified. Reload before retrying.",
        },
        503,
      );
    const row = parsedRow.data;
    if (
      error ||
      row.trip_id !== id ||
      row.user_id !== auth.userId ||
      row.venue_id !== value.venueId ||
      row.requirement !== value.requirement ||
      row.status !== value.status ||
      row.note !== value.note ||
      row.evidence_revision !== value.evidenceRevision
    )
      return json(
        {
          error: "Confirmation could not be verified. Reload before retrying.",
        },
        503,
      );
    return json({
      evidence: {
        venue_id: row.venue_id,
        requirement: row.requirement,
        status: row.status,
        note: row.note,
        observed_at: row.observed_at,
        evidence_revision: row.evidence_revision,
      },
    });
  } catch {
    return json({ error: "Confirmation could not be saved" }, 503);
  }
}
