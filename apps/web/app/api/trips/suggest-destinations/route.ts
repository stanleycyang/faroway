import { NextRequest, NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";
import { checkRateLimitAsync } from "@/lib/security/rate-limit";
import { parseJsonRequest } from "@/lib/api/json";
import {
  SuggestDestinationsInputSchema,
  suggestDestinations,
} from "@/lib/trips/destination-suggester";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await checkRateLimitAsync(`suggest-destinations:${user.id}`, {
      maxRequests: 40,
      windowMs: 60_000,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment and try again." },
        { status: 429 },
      );
    }

    const jsonResult = await parseJsonRequest(request);
    if (!jsonResult.ok) return jsonResult.response;

    const validated = SuggestDestinationsInputSchema.safeParse(jsonResult.data);
    if (!validated.success) {
      return NextResponse.json(
        {
          error:
            validated.error.issues[0]?.message ||
            "Please tell us a little about what you're looking for.",
        },
        { status: 400 },
      );
    }

    const suggestions = suggestDestinations(validated.data);
    return NextResponse.json(
      { suggestions },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[suggest-destinations] Unexpected error:", error);
    return NextResponse.json(
      { error: "Could not suggest destinations" },
      { status: 500 },
    );
  }
}
