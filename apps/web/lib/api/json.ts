import { NextResponse } from "next/server";

interface JsonParseOk {
  ok: true;
  data: unknown;
}

interface JsonParseError {
  ok: false;
  response: NextResponse;
}

export type JsonParseResult = JsonParseOk | JsonParseError;

export async function parseJsonRequest(
  request: Request,
  message = "Invalid JSON body",
): Promise<JsonParseResult> {
  try {
    const text = await request.text();
    if (!text.trim()) {
      return {
        ok: false,
        response: NextResponse.json({ error: message }, { status: 400 }),
      };
    }

    return { ok: true, data: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: message }, { status: 400 }),
    };
  }
}
