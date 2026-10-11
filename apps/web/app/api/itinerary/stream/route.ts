import { NextResponse } from "next/server";
/** Retired: the legacy unsaved stream bypassed authenticated, consent-bound
 * generation. Saved-trip streaming remains available as a read-only connection. */
export async function POST(request: Request) {
  void request;
  return NextResponse.json(
    {
      error: "Use the signed-in saved-trip planning flow.",
      code: "legacy_planning_retired",
    },
    { status: 410 },
  );
}
