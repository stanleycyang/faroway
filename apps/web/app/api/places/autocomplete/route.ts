import { NextRequest, NextResponse } from 'next/server';

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

export async function GET(request: NextRequest) {
  const input = request.nextUrl.searchParams.get('input');

  if (!input || input.length < 2) {
    return NextResponse.json({ predictions: [] });
  }

  if (!API_KEY) {
    return NextResponse.json({ predictions: [] }, { status: 501 });
  }

  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
      `?input=${encodeURIComponent(input)}` +
      `&types=(cities)` +
      `&key=${encodeURIComponent(API_KEY)}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.status === 'OK' && data.predictions) {
      return NextResponse.json({
        predictions: data.predictions.map((p: any) => ({
          placeId: p.place_id,
          mainText: p.structured_formatting?.main_text ?? p.description,
          secondaryText: p.structured_formatting?.secondary_text ?? '',
        })),
      });
    }

    return NextResponse.json({ predictions: [] });
  } catch {
    return NextResponse.json({ predictions: [] }, { status: 500 });
  }
}
