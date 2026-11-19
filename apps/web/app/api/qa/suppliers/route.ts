import { NextRequest, NextResponse } from "next/server";
import { requireUserIdFromRequest } from "@/lib/auth/middleware";
import { checkRateLimitAsync } from "@/lib/security/rate-limit";
import { probeViatorSandbox } from "@/lib/affiliates/viator";
import { isValidDateOnly } from "@/lib/api/date-range";
import { z } from "zod";

export const maxDuration = 70;
const date = z.string().refine(isValidDateOnly);
const input = z
  .object({
    startDate: date.optional(),
    endDate: date.optional(),
    maxDurationMinutes: z.number().int().min(30).max(720).optional(),
    transport: z.enum(["fetch", "https"]).optional(),
  })
  .strict()
  .refine((value) => !value.transport || !value.startDate)
  .refine(
    (value) =>
      (!value.startDate && !value.endDate) ||
      (!!value.startDate &&
        !!value.endDate &&
        value.endDate >= value.startDate),
  );

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
    return NextResponse.json({ error: "Invalid probe input" }, { status: 400 });
  const limit = await checkRateLimitAsync(`qa-suppliers:${auth.userId}`, {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000,
    failClosed: true,
  });
  if (!limit.allowed)
    return NextResponse.json({ error: "Probe limit reached" }, { status: 429 });
  const viator = await probeViatorSandbox(parsed.data);
  return NextResponse.json(
    { viator },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
