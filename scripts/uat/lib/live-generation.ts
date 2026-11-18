/**
 * One paid generation, only after the live gate has already allowed it.
 * The offline eval never imports this module.
 */
import {
  estimateUsageUsd,
  type TokenUsage,
} from "../../../apps/web/lib/ai/model-cost";
import {
  onPlanningUsage,
  planningModel,
  type PlanningUsageRecord,
} from "../../../apps/web/lib/ai/planning-step";
import { runAggregatorAgent } from "../../../apps/web/lib/search/agents/aggregator";
import { DEVELOPMENT_BRIEFS } from "./eval-briefs";
import { catalogForBrief, gradeDays } from "./generated-itinerary-eval";
import { liveModelCredential } from "./generation-quality";

export interface LiveGenerationReport {
  live_model_quality_measured: boolean;
  brief_id?: string;
  model?: string;
  estimated_usd?: number;
  budget_usd: number;
  scores?: ReturnType<typeof gradeDays>["scores"];
  affiliate?: ReturnType<typeof gradeDays>["affiliate"];
  failures?: string[];
  accepted?: boolean;
  reason: string;
}

function redact(text: string, secret: string): string {
  return secret ? text.split(secret).join("[redacted]") : text;
}

function costOf(records: PlanningUsageRecord[]): number {
  return records.reduce((sum, record) => {
    const usage: TokenUsage = record;
    try {
      return sum + estimateUsageUsd(record.model, usage);
    } catch {
      return sum;
    }
  }, 0);
}

export async function runLiveGeneratedSample(
  budgetUsd: number,
  env: NodeJS.ProcessEnv = process.env,
): Promise<LiveGenerationReport> {
  const credential = liveModelCredential(env);
  if (!credential) {
    return {
      live_model_quality_measured: false,
      budget_usd: budgetUsd,
      reason:
        "Set FAROWAY_STAGING_AI_GATEWAY_KEY or AI_GATEWAY_API_KEY before --live. No model call was made.",
    };
  }
  const secret = env[credential.name]?.trim() ?? "";
  const previous = env.AI_GATEWAY_API_KEY;
  if (credential.name === "FAROWAY_STAGING_AI_GATEWAY_KEY")
    env.AI_GATEWAY_API_KEY = secret;
  const model = planningModel("aggregator", undefined, env);
  let ceiling = Number.POSITIVE_INFINITY;
  try {
    ceiling = estimateUsageUsd(model, {
      inputTokens: 20000,
      outputTokens: 8000,
    });
  } catch (error) {
    if (previous === undefined) delete env.AI_GATEWAY_API_KEY;
    else env.AI_GATEWAY_API_KEY = previous;
    return {
      live_model_quality_measured: false,
      budget_usd: budgetUsd,
      model,
      reason: redact(
        error instanceof Error
          ? error.message
          : "No list price for this model.",
        secret,
      ),
    };
  }
  if (ceiling > budgetUsd) {
    if (previous === undefined) delete env.AI_GATEWAY_API_KEY;
    else env.AI_GATEWAY_API_KEY = previous;
    return {
      live_model_quality_measured: false,
      budget_usd: budgetUsd,
      model,
      reason: `A single aggregator call is capped at about $${ceiling.toFixed(4)} before it starts, which is above FAROWAY_LIVE_EVAL_BUDGET_USD. No model call was made.`,
    };
  }
  const brief =
    DEVELOPMENT_BRIEFS.find((item) => item.id === "rome-single-day") ??
    DEVELOPMENT_BRIEFS[0];
  const catalog = catalogForBrief(brief);
  const usage: PlanningUsageRecord[] = [];
  const stop = onPlanningUsage((record) => usage.push(record));
  try {
    const result = await runAggregatorAgent(
      catalog.plan,
      [],
      catalog.activities,
      catalog.dining,
      [],
      {
        forceModel: true,
        requireGeneratedPlan: true,
        activityBudget: catalog.budget,
        maxOutputTokens: 8000,
      },
    );
    const spent = costOf(usage);
    const overBudget = spent > budgetUsd;
    const grade = gradeDays(
      catalog.plan,
      result.days,
      catalog.activities,
      catalog.dining,
      catalog.budget,
    );
    const accepted =
      !overBudget &&
      Object.values(grade.scores).every((score) => score >= 4) &&
      Object.values(grade.affiliate).every((score) => score >= 4);
    return {
      live_model_quality_measured: true,
      brief_id: brief.id,
      model,
      estimated_usd: spent,
      budget_usd: budgetUsd,
      scores: grade.scores,
      affiliate: grade.affiliate,
      failures: overBudget
        ? [...grade.failures, "live:over_budget"]
        : grade.failures,
      accepted,
      reason: overBudget
        ? `The call cost about $${spent.toFixed(4)}, above FAROWAY_LIVE_EVAL_BUDGET_USD. The grade was not accepted.`
        : accepted
          ? "The live aggregator output was graded with the release rubric."
          : "The live aggregator output was graded and did not clear the release rubric.",
    };
  } catch (error) {
    return {
      live_model_quality_measured: false,
      brief_id: brief.id,
      model,
      estimated_usd: costOf(usage),
      budget_usd: budgetUsd,
      reason: redact(
        error instanceof Error ? error.message : "The model call failed.",
        secret,
      ),
    };
  } finally {
    stop();
    if (previous === undefined) delete env.AI_GATEWAY_API_KEY;
    else env.AI_GATEWAY_API_KEY = previous;
  }
}
