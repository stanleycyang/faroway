import { NextRequest, NextResponse } from "next/server";
import { requireUserIdFromRequest } from "@/lib/auth/middleware";
import { z } from "zod";

/** Retired: every paid trip generation must use the owned-trip claim in
 * /api/trips/[id]/generate. Do not silently accept legacy unsaved preferences.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUserIdFromRequest(request);
  if (auth instanceof NextResponse) return auth;
  const input = z
    .object({ tripId: z.string().uuid() })
    .safeParse(await request.json().catch(() => null));
  if (!input.success)
    return NextResponse.json({ error: "Invalid trip ID" }, { status: 400 });
  return NextResponse.json(
    {
      error:
        "This planning endpoint has been retired. Open your saved trip to review your choices and start planning.",
      tripId: input.data.tripId,
      generationUrl: `/api/trips/${input.data.tripId}/generate`,
    },
    { status: 410, headers: { "Cache-Control": "no-store" } },
  );
}
