import { NextRequest, NextResponse } from "next/server";
import { checkRateLimitAsync, getClientIp } from "@/lib/security/rate-limit";
import { fetchWithTimeout } from "@/lib/search/runtime";
import { z } from "zod";

const AutocompleteResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ZERO_RESULTS") }),
  z.object({
    status: z.literal("OK"),
    predictions: z.array(
      z.object({
        place_id: z.string().min(1),
        description: z.string().min(1),
        structured_formatting: z
          .object({
            main_text: z.string().optional(),
            secondary_text: z.string().optional(),
          })
          .optional(),
      }),
    ),
  }),
]);

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get("input");

  if (!input || input.length < 2) {
    return NextResponse.json({ predictions: [] });
  }

  if (input.length > 120) {
    return NextResponse.json({ error: "Input too long" }, { status: 400 });
  }

  const ip = getClientIp(request);
  const rl = await checkRateLimitAsync(`places-autocomplete:${ip}`, {
    maxRequests: 120,
    windowMs: 60_000,
    failClosed: true,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
  if (!API_KEY) {
    return NextResponse.json({ predictions: [] }, { status: 501 });
  }

  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(input)}` +
      `&types=(cities)` +
      `&key=${encodeURIComponent(API_KEY)}`;

    const res = await fetchWithTimeout(url);
    if (!res.ok) {
      return NextResponse.json({ predictions: [] }, { status: 502 });
    }
    const parsed = AutocompleteResponseSchema.safeParse(await res.json());
    if (!parsed.success) {
      // Google also uses HTTP 200 for quota/configuration errors. Never pass
      // error_message through or disguise a provider failure as zero results.
      return NextResponse.json(
        { predictions: [], error: "Places provider unavailable" },
        { status: 502 },
      );
    }
    const data = parsed.data;

    if (data.status === "ZERO_RESULTS") {
      return NextResponse.json({ predictions: [] });
    }

    return NextResponse.json({
      predictions: data.predictions.map((p) => ({
        placeId: p.place_id,
        mainText: p.structured_formatting?.main_text ?? p.description,
        secondaryText: p.structured_formatting?.secondary_text ?? "",
      })),
    });
  } catch {
    return NextResponse.json({ predictions: [] }, { status: 500 });
  }
}
