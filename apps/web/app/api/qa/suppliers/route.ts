import { NextRequest, NextResponse } from "next/server";
import { requireUserIdFromRequest } from "@/lib/auth/middleware";
import { checkRateLimitAsync } from "@/lib/security/rate-limit";
import { probeViatorSandbox } from "@/lib/affiliates/viator";
import { isValidDateOnly } from "@/lib/api/date-range";
import { z } from "zod";

export const maxDuration = 40;
const date = z.string().refine(isValidDateOnly);
const input = z.union([
  z.object({}).strict(),
  z
    .object({ startDate: date, endDate: date })
    .strict()
    .refine((value) => value.endDate >= value.startDate),
]);

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
  const parsed = input.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json({ error: "Invalid probe dates" }, { status: 400 });
  const limit = await checkRateLimitAsync(`qa-suppliers:${auth.userId}`, {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000,
    failClosed: true,
  });
  if (!limit.allowed)
    return NextResponse.json({ error: "Probe limit reached" }, { status: 429 });
  const viator = await probeViatorSandbox(
    typeof parsed.data.startDate === "string" &&
      typeof parsed.data.endDate === "string"
      ? { startDate: parsed.data.startDate, endDate: parsed.data.endDate }
      : undefined,
  );
  return NextResponse.json(
    { viator },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
