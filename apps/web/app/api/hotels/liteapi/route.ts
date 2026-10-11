import { NextRequest, NextResponse } from "next/server";
import { requireUserIdFromRequest } from "@/lib/auth/middleware";
import { checkRateLimitAsync } from "@/lib/security/rate-limit";
import {
  isLiteApiConfigured,
  LiteApiSearchSchema,
  searchLiteApiHotels,
} from "@/lib/affiliates/liteapi";

export async function POST(request: NextRequest) {
  if (process.env.VERCEL_ENV !== "preview" || !isLiteApiConfigured()) {
    return NextResponse.json(
      { error: "Hotel sandbox is unavailable" },
      { status: 503 },
    );
  }
  const auth = await requireUserIdFromRequest(request);
  if (auth instanceof NextResponse) return auth;
  const limit = await checkRateLimitAsync(`liteapi-sandbox:${auth.userId}`, {
    maxRequests: 5,
    windowMs: 60 * 60 * 1000,
  });
  if (!limit.allowed)
    return NextResponse.json(
      { error: "Hotel search limit reached" },
      { status: 429 },
    );
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid hotel search" },
      { status: 400 },
    );
  }
  const parsed = LiteApiSearchSchema.safeParse(input);
  if (!parsed.success)
    return NextResponse.json(
      { error: "Provide dates, nationality and room occupancy" },
      { status: 400 },
    );
  try {
    const result = await searchLiteApiHotels(parsed.data);
    return NextResponse.json(result, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Hotel supplier is temporarily unavailable" },
      { status: 502 },
    );
  }
}
