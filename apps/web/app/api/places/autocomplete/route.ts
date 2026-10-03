import { fetchWithTimeout } from "@/lib/search/runtime";
import { NextRequest, NextResponse } from "next/server";
import { checkRateLimitAsync, getClientIp } from "@/lib/security/rate-limit";

export async function GET(request: NextRequest) {
  if (process.env.GOOGLE_PLACES_LIVE_ENABLED !== "true") {
    return NextResponse.json(
      { predictions: [] },
      { status: 501, headers: { "Cache-Control": "private, no-store" } },
    );
  }
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
    const res = await fetchWithTimeout(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": API_KEY,
          "X-Goog-FieldMask":
            "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat",
        },
        body: JSON.stringify({ input, includedPrimaryTypes: ["(cities)"] }),
      },
    );
    if (!res.ok) return NextResponse.json({ predictions: [] }, { status: 502 });
    const data = await res.json();
    if (Array.isArray(data.suggestions)) {
      return NextResponse.json(
        {
          predictions: data.suggestions.flatMap(
            (suggestion: {
              placePrediction?: {
                placeId?: string;
                text?: { text?: string };
                structuredFormat?: {
                  mainText?: { text?: string };
                  secondaryText?: { text?: string };
                };
              };
            }) => {
              const p = suggestion.placePrediction;
              const mainText =
                p?.structuredFormat?.mainText?.text ?? p?.text?.text;
              return p?.placeId && mainText
                ? [
                    {
                      placeId: p.placeId,
                      mainText,
                      secondaryText:
                        p.structuredFormat?.secondaryText?.text ?? "",
                    },
                  ]
                : [];
            },
          ),
        },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }

    return NextResponse.json({ predictions: [] });
  } catch {
    return NextResponse.json({ predictions: [] }, { status: 500 });
  }
}
