import {
  MODEL_COMPARE_SPEND_CAP_USD,
  SpendTracker,
  estimateUsageUsd,
  type TokenUsage,
} from "../../../apps/web/lib/ai/model-cost";
import { UAT_BRIEFS, assertValidBriefParty, type UatBrief } from "./briefs";
import {
  assertStagingTarget,
  type StagingTargetInput,
} from "./staging-project";

export const COMPARE_STEPS = [
  "orchestrator",
  "hotels",
  "activities",
  "dining",
  "aggregator",
] as const;

export type CompareStep = (typeof COMPARE_STEPS)[number];

export interface ModelCompareConfig {
  id: string;
  label: string;
  env: Record<string, string>;
}

/** Today's default versus the cheaper Google mixes from the cost review. */
export const MODEL_COMPARE_CONFIGS: ModelCompareConfig[] = [
  {
    id: "baseline-flash-high",
    label: "gemini-3-flash / high (today's default; thinking left unset)",
    env: {},
  },
  {
    id: "flash-low",
    label: "gemini-3-flash / low, aggregator medium",
    env: {
      PLANNING_THINKING_ORCHESTRATOR: "low",
      PLANNING_THINKING_HOTELS: "low",
      PLANNING_THINKING_ACTIVITIES: "low",
      PLANNING_THINKING_DINING: "low",
      PLANNING_THINKING_AGGREGATOR: "medium",
    },
  },
  {
    id: "mixed-lite",
    label:
      "3.1-flash-lite minimal for extraction and lists; 3-flash medium aggregator",
    env: {
      PLANNING_MODEL_ORCHESTRATOR: "google/gemini-3.1-flash-lite",
      PLANNING_MODEL_HOTELS: "google/gemini-3.1-flash-lite",
      PLANNING_MODEL_ACTIVITIES: "google/gemini-3.1-flash-lite",
      PLANNING_MODEL_DINING: "google/gemini-3.1-flash-lite",
      PLANNING_THINKING_ORCHESTRATOR: "minimal",
      PLANNING_THINKING_HOTELS: "minimal",
      PLANNING_THINKING_ACTIVITIES: "minimal",
      PLANNING_THINKING_DINING: "minimal",
      PLANNING_MODEL_AGGREGATOR: "google/gemini-3-flash",
      PLANNING_THINKING_AGGREGATOR: "medium",
    },
  },
];

export interface StepExecution {
  model: string;
  thinkingLevel: string;
  usage: TokenUsage;
  latencyMs: number;
  fallback?: { reason: string; outcome: string };
  notes?: string[];
}

export interface CompareRow {
  configId: string;
  briefId: string;
  status: "planned" | "completed" | "aborted";
  latencyMs: number | null;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  estimatedUsd: number | null;
  fallbacks: number;
  fallbackRate: number | null;
  notes: string[];
}

export interface CompareReport {
  ok: boolean;
  mode: "dry-run" | "mock" | "live";
  projectRef: string;
  capUsd: number;
  spentUsd: number;
  aborted: boolean;
  rows: CompareRow[];
  markdown: string;
}

function modelFor(config: ModelCompareConfig, step: CompareStep): string {
  return (
    config.env[`PLANNING_MODEL_${step.toUpperCase()}`] ||
    "google/gemini-3-flash"
  );
}

function thinkingFor(config: ModelCompareConfig, step: CompareStep): string {
  return config.env[`PLANNING_THINKING_${step.toUpperCase()}`] || "high";
}

export function mockStepExecution(input: {
  config: ModelCompareConfig;
  brief: UatBrief;
  step: CompareStep;
}): StepExecution {
  const fallback =
    input.config.id === "mixed-lite" &&
    input.brief.id === "interlaken-sparse" &&
    input.step === "dining";
  return {
    model: modelFor(input.config, input.step),
    thinkingLevel: thinkingFor(input.config, input.step),
    latencyMs: 800 + input.step.length * 10,
    usage: fallback
      ? {
          inputTokens: 400,
          outputTokens: 20,
          reasoningTokens: 0,
          totalTokens: 420,
        }
      : {
          inputTokens: 1000,
          outputTokens: 1500,
          reasoningTokens: 800,
          textTokens: 700,
          totalTokens: 2500,
        },
    ...(fallback ? { fallback: { reason: "error", outcome: "empty" } } : {}),
    notes: ["mock output; no live model call"],
  };
}

export async function runModelComparison(options: {
  mode: "dry-run" | "mock" | "live";
  target: StagingTargetInput;
  capUsd?: number;
  configs?: ModelCompareConfig[];
  briefs?: UatBrief[];
  executeStep?: (input: {
    config: ModelCompareConfig;
    brief: UatBrief;
    step: CompareStep;
  }) => StepExecution | Promise<StepExecution>;
}): Promise<CompareReport> {
  const target = assertStagingTarget(options.target);
  if (options.mode === "live" && !options.executeStep) {
    throw new Error("Live comparison requires a real step executor");
  }
  const configs = options.configs ?? MODEL_COMPARE_CONFIGS;
  const briefs = options.briefs ?? UAT_BRIEFS;
  briefs.forEach(assertValidBriefParty);
  const capUsd = options.capUsd ?? MODEL_COMPARE_SPEND_CAP_USD;
  const rows: CompareRow[] = [];
  if (options.mode === "dry-run") {
    for (const config of configs) {
      for (const brief of briefs) {
        rows.push({
          configId: config.id,
          briefId: brief.id,
          status: "planned",
          latencyMs: null,
          inputTokens: 0,
          outputTokens: 0,
          reasoningTokens: 0,
          estimatedUsd: null,
          fallbacks: 0,
          fallbackRate: null,
          notes: [config.label],
        });
      }
    }
    return report(options.mode, target.projectRef, capUsd, 0, false, rows);
  }
  const execute = options.executeStep ?? mockStepExecution;
  const tracker = new SpendTracker(capUsd);
  let aborted = false;
  for (const config of configs) {
    for (const brief of briefs) {
      const notes = new Set<string>();
      let latencyMs = 0;
      let inputTokens = 0;
      let outputTokens = 0;
      let reasoningTokens = 0;
      let estimatedUsd: number | null = 0;
      let fallbacks = 0;
      let stepsRun = 0;
      for (const step of COMPARE_STEPS) {
        if (tracker.capped) {
          aborted = true;
          notes.add(`aborted at $${capUsd} before ${step}`);
          break;
        }
        const execution = await execute({ config, brief, step });
        latencyMs += execution.latencyMs;
        inputTokens += execution.usage.inputTokens ?? 0;
        outputTokens += execution.usage.outputTokens ?? 0;
        reasoningTokens += execution.usage.reasoningTokens ?? 0;
        if (execution.fallback) {
          fallbacks += 1;
          notes.add(
            `${step} fallback ${execution.fallback.reason}/${execution.fallback.outcome}`,
          );
        }
        for (const note of execution.notes ?? []) notes.add(note);
        stepsRun += 1;
        if (
          options.mode === "live" &&
          ![execution.usage.inputTokens, execution.usage.outputTokens].every(
            (value) =>
              typeof value === "number" && Number.isFinite(value) && value >= 0,
          )
        ) {
          aborted = true;
          estimatedUsd = null;
          notes.add(
            `aborted after ${step}: billing usage is unknown; reconcile gateway spend before another live run`,
          );
          break;
        }
        const usd = estimateUsageUsd(execution.model, execution.usage);
        tracker.add(usd);
        estimatedUsd += usd;
        if (tracker.capped) {
          aborted = true;
          notes.add(`aborted at $${capUsd} after ${step}`);
          break;
        }
      }
      rows.push({
        configId: config.id,
        briefId: brief.id,
        status: aborted ? "aborted" : "completed",
        latencyMs,
        inputTokens,
        outputTokens,
        reasoningTokens,
        estimatedUsd,
        fallbacks,
        fallbackRate: stepsRun ? fallbacks / stepsRun : null,
        notes: [...notes],
      });
      if (aborted) break;
    }
    if (aborted) break;
  }
  return report(
    options.mode,
    target.projectRef,
    capUsd,
    tracker.spentUsd,
    aborted,
    rows,
  );
}

function report(
  mode: CompareReport["mode"],
  projectRef: string,
  capUsd: number,
  spentUsd: number,
  aborted: boolean,
  rows: CompareRow[],
): CompareReport {
  const markdown = renderCompareMarkdown({
    mode,
    projectRef,
    capUsd,
    spentUsd,
    aborted,
    rows,
  });
  return {
    ok: !aborted || mode === "dry-run",
    mode,
    projectRef,
    capUsd,
    spentUsd,
    aborted,
    rows,
    markdown,
  };
}

export function renderCompareMarkdown(input: {
  mode: string;
  projectRef: string;
  capUsd: number;
  spentUsd: number;
  aborted: boolean;
  rows: CompareRow[];
}): string {
  const lines = [
    `# Model comparison (${input.mode})`,
    "",
    `Staging project \`${input.projectRef}\`. Estimated-spend stop threshold $${input.capUsd}. Recorded estimated spend $${input.spentUsd.toFixed(6)}. ${input.aborted ? "Aborted; see row notes. Total cost may be unknown." : "Finished under the threshold."} An in-flight call can exceed the threshold; use a gateway key budget for a billing cap.`,
    "",
    "| config | trip | latency ms | input | output | reasoning | est. USD | fallback rate | notes |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |",
  ];
  for (const row of input.rows) {
    const rate =
      row.fallbackRate == null ? "" : `${Math.round(row.fallbackRate * 100)}%`;
    const usd = row.estimatedUsd == null ? "" : row.estimatedUsd.toFixed(6);
    lines.push(
      `| ${row.configId} | ${row.briefId} | ${row.latencyMs ?? ""} | ${row.inputTokens} | ${row.outputTokens} | ${row.reasoningTokens} | ${usd} | ${rate} | ${row.notes.join("; ").replaceAll("|", "/")} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}
