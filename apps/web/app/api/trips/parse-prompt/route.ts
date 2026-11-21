import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserIdFromRequest } from "@/lib/auth/middleware";
import { checkRateLimitAsync } from "@/lib/security/rate-limit";
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
  isStalePlanningDisclosure,
} from "@/lib/ai/planning-disclosure";
import { withAbortTimeout } from "@/lib/search/runtime";

const LLM_ENHANCE_TIMEOUT_MS = 3_500;
const MAX_BODY_BYTES = 4_096;

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
  headers: Headers,
): boolean {
  if (!validateApiKey()) return false;
  if (process.env.NODE_ENV === "test") return false;
  // Never transmit user prompt text (which may include health/allergy/accessibility details)
  // to Google Gemini / Vercel AI Gateway without explicit AI disclosure consent.
  if (isStalePlanningDisclosure(headers)) return false;
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
    const auth = await requireUserIdFromRequest(request);
    if (auth instanceof NextResponse) return auth;

    const rl = await checkRateLimitAsync(`parse-prompt:${auth.userId}`, {
      maxRequests: 30,
      windowMs: 60_000,
      failClosed: true,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please wait a moment and try again." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil(rl.resetIn / 1000))),
          },
        },
      );
    }

    const rawText = await request.text().catch(() => null);
    if (rawText === null || rawText.length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { error: "Please provide a shorter trip description." },
        { status: 400 },
      );
    }

    let body: unknown = null;
    try {
      body = JSON.parse(rawText);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body." },
        { status: 400 },
      );
    }

    const validated = DreamTripPromptInputSchema.safeParse(body);
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
    if (shouldEnhanceWithLlm(prompt, deterministic, request.headers)) {
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
