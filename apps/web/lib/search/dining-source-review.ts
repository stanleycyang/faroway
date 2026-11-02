import type { DiningResult, SearchPlan } from "./types";
import { diningSourceReviewEnabled } from "./dining-source-review-gate";
export { diningSourceReviewEnabled } from "./dining-source-review-gate";
import {
  auditDiningDiscovery,
  diningDiscoveryPrompt,
  diningOptionsForReview,
  parseDiningDiscovery,
  validatePublicDiningBrief,
} from "../../../../scripts/uat/lib/dining-discovery";

export async function discoverDiningReviewOptions(
  plan: SearchPlan,
): Promise<DiningResult[]> {
  if (!diningSourceReviewEnabled()) return [];
  const started = Date.now();
  try {
    const brief = validatePublicDiningBrief({
      destination: plan.destination,
      area: "central visitor areas",
      meal:
        plan.diningCriteria.mealPriorities.find((meal) =>
          ["breakfast", "lunch", "dinner"].includes(meal),
        ) ?? "dinner",
      maxCandidates: 3,
    });
    // Only the bounded public brief reaches search, never the original prompt,
    // dates, party, saved requirements, hotel locations or private traveler data.
    const { createGateway, generateText } = await import("ai");
    const gateway = createGateway({ apiKey: process.env.AI_GATEWAY_API_KEY });
    const result = await generateText({
      model: gateway("google/gemini-3-flash"),
      prompt: diningDiscoveryPrompt(brief),
      tools: {
        parallel_search: gateway.tools.parallelSearch({
          mode: "agentic",
          maxResults: 6,
          excerpts: { maxCharsPerResult: 2500, maxCharsTotal: 12000 },
        }),
      },
      toolChoice: "required",
      providerOptions: {
        gateway: { only: ["google"] },
        google: { thinkingConfig: { thinkingLevel: "low" } },
      },
      maxOutputTokens: 2500,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(60000),
    });
    const billingKnown =
      Number.isFinite(result.usage.inputTokens) &&
      Number.isFinite(result.usage.outputTokens);
    const audit = auditDiningDiscovery(
      parseDiningDiscovery(result.text),
      result.steps.flatMap((step) => step.toolResults),
      brief,
    );
    const options = billingKnown
      ? diningOptionsForReview(audit, new Date().toISOString().slice(0, 10))
      : [];
    console.info(
      JSON.stringify({
        event: "planning.step.dining_source_review",
        model: "google/gemini-3-flash",
        latencyMs: Date.now() - started,
        billingKnown,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        gatewayCostUsd: result.providerMetadata?.gateway?.cost ?? null,
        retainedOptions: options.length,
        rejectedOptions: audit.rejected.length,
        shapeValid: audit.shapeValid,
      }),
    );
    return options;
  } catch {
    console.warn(
      JSON.stringify({
        event: "planning.step.dining_source_review",
        outcome: "unavailable",
        billingKnown: false,
        latencyMs: Date.now() - started,
      }),
    );
    return [];
  }
}
