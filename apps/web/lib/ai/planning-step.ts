import { PLANNING_MODEL } from "./planning-disclosure";
import { generateObject, type AiUsage, type GenerateObjectResult } from "./sdk";

/**
 * Per-step planning model settings.
 *
 * Today's request leaves thinking unset. Gemini 3 Flash then uses its default
 * thinking level, high (Google thinking docs). Defaults keep that request:
 * model google/gemini-3-flash, no thinkingConfig, no maxOutputTokens.
 * Env overrides are explicit and limited to Google model ids so the
 * planning-google-v1 recipient list stays accurate.
 */
export const PLANNING_STEPS = [
  "orchestrator",
  "hotels",
  "activities",
  "dining",
  "aggregator",
] as const;

export type PlanningStep = (typeof PLANNING_STEPS)[number];
export const DEFAULT_THINKING_LEVEL = "high" as const;
export type ThinkingLevel = "minimal" | "low" | "medium" | "high";

const THINKING_LEVELS = new Set<ThinkingLevel>([
  "minimal",
  "low",
  "medium",
  "high",
]);
const GOOGLE_MODEL = /^google\/[A-Za-z0-9][A-Za-z0-9._-]{1,80}$/;

export const PLANNING_STEP_ENV: Record<
  PlanningStep,
  { model: string; thinking: string; maxOutputTokens: string }
> = {
  orchestrator: {
    model: "PLANNING_MODEL_ORCHESTRATOR",
    thinking: "PLANNING_THINKING_ORCHESTRATOR",
    maxOutputTokens: "PLANNING_MAX_OUTPUT_TOKENS_ORCHESTRATOR",
  },
  hotels: {
    model: "PLANNING_MODEL_HOTELS",
    thinking: "PLANNING_THINKING_HOTELS",
    maxOutputTokens: "PLANNING_MAX_OUTPUT_TOKENS_HOTELS",
  },
  activities: {
    model: "PLANNING_MODEL_ACTIVITIES",
    thinking: "PLANNING_THINKING_ACTIVITIES",
    maxOutputTokens: "PLANNING_MAX_OUTPUT_TOKENS_ACTIVITIES",
  },
  dining: {
    model: "PLANNING_MODEL_DINING",
    thinking: "PLANNING_THINKING_DINING",
    maxOutputTokens: "PLANNING_MAX_OUTPUT_TOKENS_DINING",
  },
  aggregator: {
    model: "PLANNING_MODEL_AGGREGATOR",
    thinking: "PLANNING_THINKING_AGGREGATOR",
    maxOutputTokens: "PLANNING_MAX_OUTPUT_TOKENS_AGGREGATOR",
  },
};

export const PLANNING_ENV_KEYS = PLANNING_STEPS.flatMap((step) => {
  const names = PLANNING_STEP_ENV[step];
  return [names.model, names.thinking, names.maxOutputTokens];
});

export interface PlanningStepConfig {
  step: PlanningStep;
  model: string;
  thinkingLevel: ThinkingLevel;
  /** False when thinking is omitted, matching today's Gemini 3 Flash request. */
  thinkingExplicit: boolean;
  maxOutputTokens?: number;
  rejections: string[];
}

export interface PlanningUsageRecord {
  event: "planning.step.usage";
  step: PlanningStep;
  model: string;
  thinkingLevel: ThinkingLevel;
  thinkingExplicit: boolean;
  maxOutputTokens: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  totalTokens: number | null;
  latencyMs: number;
}

export interface PlanningFallbackRecord {
  event: "planning.step.fallback";
  step: PlanningStep;
  reason: string;
  outcome: string;
  detail?: string;
}

const usageListeners = new Set<(record: PlanningUsageRecord) => void>();
const fallbackListeners = new Set<(record: PlanningFallbackRecord) => void>();

export function onPlanningUsage(
  listener: (record: PlanningUsageRecord) => void,
): () => void {
  usageListeners.add(listener);
  return () => usageListeners.delete(listener);
}

export function onPlanningFallback(
  listener: (record: PlanningFallbackRecord) => void,
): () => void {
  fallbackListeners.add(listener);
  return () => fallbackListeners.delete(listener);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function tokenCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function resolvePlanningStepConfig(
  step: PlanningStep,
  env: NodeJS.ProcessEnv = process.env,
): PlanningStepConfig {
  const names = PLANNING_STEP_ENV[step];
  const rejections: string[] = [];
  const modelRaw = env[names.model];
  let model = PLANNING_MODEL;
  if (modelRaw != null && modelRaw.trim() !== "") {
    const candidate = modelRaw.trim();
    if (GOOGLE_MODEL.test(candidate)) model = candidate;
    else {
      rejections.push(
        `rejected model ${candidate.slice(0, 80)}; using ${PLANNING_MODEL}`,
      );
    }
  }
  const thinkingRaw = env[names.thinking];
  let thinkingLevel: ThinkingLevel = DEFAULT_THINKING_LEVEL;
  let thinkingExplicit = false;
  if (thinkingRaw != null && thinkingRaw.trim() !== "") {
    const candidate = thinkingRaw.trim().toLowerCase();
    if (THINKING_LEVELS.has(candidate as ThinkingLevel)) {
      thinkingLevel = candidate as ThinkingLevel;
      thinkingExplicit = true;
    } else {
      rejections.push(
        `rejected thinking level ${candidate.slice(0, 40)}; using ${DEFAULT_THINKING_LEVEL}`,
      );
    }
  }
  const maxRaw = env[names.maxOutputTokens];
  let maxOutputTokens: number | undefined;
  if (maxRaw != null && maxRaw.trim() !== "") {
    const value = Number(maxRaw);
    if (Number.isInteger(value) && value >= 100 && value <= 65000) {
      maxOutputTokens = value;
    } else {
      rejections.push(
        `rejected maxOutputTokens ${maxRaw.slice(0, 20)}; leaving unset`,
      );
    }
  }
  return {
    step,
    model,
    thinkingLevel,
    thinkingExplicit,
    maxOutputTokens,
    rejections,
  };
}

export function planningModel(
  step: PlanningStep,
  fallback: string = PLANNING_MODEL,
  env: NodeJS.ProcessEnv = process.env,
): string {
  return resolvePlanningStepConfig(step, env).model || fallback;
}

export function replacePlanningStepEnv(
  values: Record<string, string | undefined>,
  env: NodeJS.ProcessEnv = process.env,
): void {
  for (const key of PLANNING_ENV_KEYS) delete env[key];
  for (const [key, value] of Object.entries(values)) {
    if (!PLANNING_ENV_KEYS.includes(key)) continue;
    if (value != null && value !== "") env[key] = value;
  }
}

function withThinking(
  base: Record<string, unknown>,
  level: ThinkingLevel,
): Record<string, unknown> {
  const google = asRecord(base.google);
  const vertex = asRecord(base.vertex);
  return {
    ...base,
    google: {
      ...google,
      thinkingConfig: {
        ...asRecord(google.thinkingConfig),
        thinkingLevel: level,
      },
    },
    vertex: {
      ...vertex,
      thinkingConfig: {
        ...asRecord(vertex.thinkingConfig),
        thinkingLevel: level,
      },
    },
  };
}

export function applyPlanningStepArgs<T extends Record<string, unknown>>(
  step: PlanningStep,
  args: T,
  env: NodeJS.ProcessEnv = process.env,
): T & {
  maxOutputTokens?: number;
  providerOptions?: Record<string, unknown>;
} {
  const config = resolvePlanningStepConfig(step, env);
  let next = args;
  if (config.thinkingExplicit) {
    next = {
      ...next,
      providerOptions: withThinking(
        asRecord(args.providerOptions),
        config.thinkingLevel,
      ),
    } as T;
  }
  if (config.maxOutputTokens != null) {
    next = { ...next, maxOutputTokens: config.maxOutputTokens } as T;
  }
  return next;
}

function logLine(event: string, fields: object, warn = false) {
  const line = JSON.stringify({
    event,
    at: new Date().toISOString(),
    ...fields,
  });
  if (warn) console.warn(line);
  else console.info(line);
}

function logPlanningConfig(step: PlanningStep, detail: string) {
  logLine("planning.step.config", { step, detail });
}

export function logPlanningFallback(
  step: PlanningStep,
  reason: string,
  outcome: string,
  detail?: string,
): PlanningFallbackRecord {
  const record: PlanningFallbackRecord = {
    event: "planning.step.fallback",
    step,
    reason,
    outcome,
    ...(detail ? { detail: detail.slice(0, 300) } : {}),
  };
  logLine("planning.step.fallback", record, true);
  for (const listener of fallbackListeners) listener(record);
  return record;
}

function numeric(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function usageFromValue(value: unknown): AiUsage | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const details =
    record.outputTokenDetails && typeof record.outputTokenDetails === "object"
      ? (record.outputTokenDetails as Record<string, unknown>)
      : undefined;
  const inputTokens = numeric(record.inputTokens);
  const outputTokens = numeric(record.outputTokens);
  const totalTokens = numeric(record.totalTokens);
  const reasoningTokens = numeric(record.reasoningTokens);
  const textTokens = numeric(details?.textTokens);
  const detailReasoning = numeric(details?.reasoningTokens);
  if (
    inputTokens == null &&
    outputTokens == null &&
    totalTokens == null &&
    reasoningTokens == null &&
    textTokens == null &&
    detailReasoning == null
  ) {
    return null;
  }
  return {
    inputTokens,
    outputTokens,
    totalTokens,
    reasoningTokens,
    outputTokenDetails: details
      ? { textTokens, reasoningTokens: detailReasoning }
      : undefined,
  };
}

function addUsage(left: AiUsage, right: AiUsage): AiUsage {
  const add = (a: number | undefined, b: number | undefined) =>
    (a ?? 0) + (b ?? 0);
  return {
    inputTokens: add(left.inputTokens, right.inputTokens),
    outputTokens: add(left.outputTokens, right.outputTokens),
    totalTokens: add(left.totalTokens, right.totalTokens),
    reasoningTokens: add(left.reasoningTokens, right.reasoningTokens),
    outputTokenDetails: {
      textTokens: add(
        left.outputTokenDetails?.textTokens,
        right.outputTokenDetails?.textTokens,
      ),
      reasoningTokens: add(
        left.outputTokenDetails?.reasoningTokens,
        right.outputTokenDetails?.reasoningTokens,
      ),
    },
  };
}

function collectUsage(error: unknown, seen: Set<object>, out: AiUsage[]) {
  if (!error || typeof error !== "object" || seen.has(error)) return;
  seen.add(error);
  const record = error as {
    usage?: unknown;
    responseBody?: unknown;
    errors?: unknown;
    cause?: unknown;
  };
  const direct = usageFromValue(record.usage);
  if (direct) out.push(direct);
  else if (typeof record.responseBody === "string") {
    try {
      const parsed = JSON.parse(record.responseBody) as {
        usage?: unknown;
      };
      const fromBody = usageFromValue(parsed.usage) ?? usageFromValue(parsed);
      if (fromBody) out.push(fromBody);
    } catch {
      // Response bodies are not always JSON.
    }
  }
  if (Array.isArray(record.errors)) {
    for (const item of record.errors) collectUsage(item, seen, out);
  }
  collectUsage(record.cause, seen, out);
}

/** Token usage from a failed generation, including each retry nested on the error. */
export function usageFromModelError(error: unknown): AiUsage | undefined {
  const found: AiUsage[] = [];
  collectUsage(error, new Set(), found);
  if (!found.length) return undefined;
  return found.reduce(addUsage);
}

export function sumPlanningUsage(
  records: PlanningUsageRecord[],
): PlanningUsageRecord | undefined {
  if (!records.length) return undefined;
  const add = (a: number | null, b: number | null) =>
    a == null || b == null ? null : a + b;
  return records.reduce((sum, record) => ({
    ...record,
    inputTokens: add(sum.inputTokens, record.inputTokens),
    outputTokens: add(sum.outputTokens, record.outputTokens),
    reasoningTokens: add(sum.reasoningTokens, record.reasoningTokens),
    totalTokens: add(sum.totalTokens, record.totalTokens),
    latencyMs: sum.latencyMs + record.latencyMs,
  }));
}

function logPlanningUsage(
  step: PlanningStep,
  config: PlanningStepConfig,
  usage: AiUsage | undefined,
  latencyMs: number,
): PlanningUsageRecord {
  const details = usage?.outputTokenDetails;
  const record: PlanningUsageRecord = {
    event: "planning.step.usage",
    step,
    model: config.model,
    thinkingLevel: config.thinkingLevel,
    thinkingExplicit: config.thinkingExplicit,
    maxOutputTokens: config.maxOutputTokens ?? null,
    inputTokens: tokenCount(usage?.inputTokens),
    outputTokens: tokenCount(usage?.outputTokens),
    reasoningTokens:
      tokenCount(details?.reasoningTokens) ??
      tokenCount(usage?.reasoningTokens),
    totalTokens: tokenCount(usage?.totalTokens),
    latencyMs,
  };
  logLine("planning.step.usage", record);
  for (const listener of usageListeners) listener(record);
  return record;
}

export async function generatePlanningObject<T>(
  step: PlanningStep,
  args: Record<string, unknown>,
): Promise<GenerateObjectResult<T>> {
  const started = Date.now();
  const config = resolvePlanningStepConfig(step);
  for (const rejection of config.rejections) logPlanningConfig(step, rejection);
  try {
    const result = await generateObject<T>(applyPlanningStepArgs(step, args));
    logPlanningUsage(step, config, result.usage, Date.now() - started);
    return result;
  } catch (error) {
    const usage = usageFromModelError(error);
    if (usage) logPlanningUsage(step, config, usage, Date.now() - started);
    throw error;
  }
}
