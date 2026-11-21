import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClientFromRequest } from "@/lib/supabase/server";
import { checkRateLimitAsync } from "@/lib/security/rate-limit";
import { parseJsonRequest } from "@/lib/api/json";
import {
  DreamTripPromptInputSchema,
  VALID_ACCESSIBILITY,
  VALID_BUDGETS,
  VALID_DIETARY,
  VALID_TRAVELER_TYPES,
  VALID_VIBES,
  mergeParsedDreamTrip,
  parseDreamTripPrompt,
  type LlmPromptEnhancement,
  type ParsedDreamTrip,
} from "@/lib/trips/prompt-parser";
import {
  createGateway,
  gateway as defaultGateway,
  generateObject,
} from "@/lib/ai/sdk";
import { validateApiKey } from "@/lib/ai/client";
import {
  PLANNING_MODEL,
  PLANNING_PROVIDER_OPTIONS,
} from "@/lib/ai/planning-disclosure";
import { withAbortTimeout } from "@/lib/search/runtime";

const LLM_ENHANCE_TIMEOUT_MS = 3_500;

const LlmExtractionSchema = z.object({
  destinationName: z.string().trim().min(2).max(120).optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  travelers: z.number().int().min(1).max(50).optional(),
  travelerType: z.enum(VALID_TRAVELER_TYPES).optional(),
  budget: z.enum(VALID_BUDGETS).optional(),
  vibes: z.array(z.enum(VALID_VIBES)).max(5).optional(),
  dietaryPreferences: z.array(z.enum(VALID_DIETARY)).max(6).optional(),
  allergies: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  accessibility: z.array(z.enum(VALID_ACCESSIBILITY)).max(4).optional(),
  mobilityNotes: z.string().trim().max(300).optional(),
  pacingPreference: z.enum(["relaxed", "balanced", "packed"]).optional(),
});

function shouldEnhanceWithLlm(
  prompt: string,
  deterministic: ParsedDreamTrip,
): boolean {
  if (!validateApiKey()) return false;
  if (process.env.NODE_ENV === "test") return false;
  // Enhance only when the deterministic parse has gaps or the prompt is rich/nuanced.
  return (
    !deterministic.destination ||
    !deterministic.startDate ||
    deterministic.vibes.length === 0 ||
    prompt.length > 90
  );
}

async function enhanceWithLlm(
  prompt: string,
  referenceDate: Date,
): Promise<LlmPromptEnhancement | null> {
  const aiGateway = process.env.AI_GATEWAY_API_KEY
    ? createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY })
    : defaultGateway;
  const todayIso = referenceDate.toISOString().slice(0, 10);

  const { object } = await withAbortTimeout(
    (abortSignal) =>
      generateObject<LlmPromptEnhancement>({
        model: aiGateway(PLANNING_MODEL),
        providerOptions: PLANNING_PROVIDER_OPTIONS,
        schema: LlmExtractionSchema,
        maxOutputTokens: 400,
        maxRetries: 0,
        timeout: LLM_ENHANCE_TIMEOUT_MS,
        abortSignal,
        system:
          "Extract structured travel preferences from a single trip request. Only populate fields explicitly stated or clearly implied by the user. Never invent allergies, dietary needs, accessibility needs, or dates not grounded in the prompt.",
        prompt: `Today's date is ${todayIso}. Extract trip details from:\n"""\n${prompt}\n"""`,
      }),
    LLM_ENHANCE_TIMEOUT_MS,
    "dream trip prompt parser",
  );

  return object ?? null;
}

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

    const rl = await checkRateLimitAsync(`parse-prompt:${user.id}`, {
      maxRequests: 30,
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

    const validated = DreamTripPromptInputSchema.safeParse(jsonResult.data);
    if (!validated.success) {
      return NextResponse.json(
        {
          error:
            validated.error.issues[0]?.message ||
            "Please provide a valid trip description.",
        },
        { status: 400 },
      );
    }

    const now = new Date();
    const { prompt } = validated.data;
    const deterministic = parseDreamTripPrompt(prompt, now);

    let parsed = deterministic;
    if (shouldEnhanceWithLlm(prompt, deterministic)) {
      try {
        const enhancement = await enhanceWithLlm(prompt, now);
        if (enhancement) {
          parsed = mergeParsedDreamTrip(deterministic, enhancement);
        }
      } catch {
        // Always fall back cleanly to the deterministic result on slow/unavailable gateway.
        parsed = deterministic;
      }
    }

    return NextResponse.json(
      { parsed },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[parse-prompt] Unexpected error:", error);
    return NextResponse.json(
      { error: "Could not parse trip description" },
      { status: 500 },
    );
  }
}
