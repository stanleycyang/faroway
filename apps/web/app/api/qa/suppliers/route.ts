import { NextRequest, NextResponse } from "next/server";
import { requireUserIdFromRequest } from "@/lib/auth/middleware";
import { checkRateLimitAsync } from "@/lib/security/rate-limit";
import { probeViatorSandbox } from "@/lib/affiliates/viator";

export const maxDuration = 40;

/** Isolated QA diagnostics, never a public production supplier proxy. */
export async function POST(request: NextRequest) {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.NEXT_PUBLIC_SUPABASE_URL !==
      "https://omovikloadpvzijoaqus.supabase.co"
  )
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  const auth = await requireUserIdFromRequest(request);
  if (auth instanceof NextResponse) return auth;
  const limit = await checkRateLimitAsync(`qa-suppliers:${auth.userId}`, {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000,
    failClosed: true,
  });
  if (!limit.allowed)
    return NextResponse.json({ error: "Probe limit reached" }, { status: 429 });
  const viator = await probeViatorSandbox();
  return NextResponse.json(
    { viator },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
