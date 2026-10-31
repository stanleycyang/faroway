/** List prices per 1M tokens. AI Gateway adds no markup. Thinking tokens bill as output. */
export const MODEL_TOKEN_PRICES: Record<
  string,
  { inputPerMillionUsd: number; outputPerMillionUsd: number }
> = {
  "google/gemini-3-flash": { inputPerMillionUsd: 0.5, outputPerMillionUsd: 3 },
  "google/gemini-3.1-flash-lite": {
    inputPerMillionUsd: 0.25,
    outputPerMillionUsd: 1.5,
  },
  "google/gemini-3.5-flash-lite": {
    inputPerMillionUsd: 0.3,
    outputPerMillionUsd: 2.5,
  },
  "google/gemini-2.5-flash-lite": {
    inputPerMillionUsd: 0.1,
    outputPerMillionUsd: 0.4,
  },
};

export const MODEL_COMPARE_SPEND_CAP_USD = 20;

export interface TokenUsage {
  inputTokens?: number | null;
  outputTokens?: number | null;
  reasoningTokens?: number | null;
  textTokens?: number | null;
  totalTokens?: number | null;
}

function finite(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : 0;
}

/**
 * Output tokens already include reasoning when they equal text + reasoning.
 * When output equals the text count, reasoning is additional billed output.
 */
export function billedOutputTokens(usage: TokenUsage): {
  input: number;
  output: number;
} {
  const input = finite(usage.inputTokens);
  const output = finite(usage.outputTokens);
  const reasoning = finite(usage.reasoningTokens);
  const text = finite(usage.textTokens);
  if (output > 0 && text > 0 && reasoning > 0 && output === text)
    return { input, output: output + reasoning };
  if (output > 0) return { input, output };
  if (reasoning > 0) return { input, output: reasoning };
  const total = finite(usage.totalTokens);
  if (total > input) return { input, output: total - input };
  return { input, output: 0 };
}

export function estimateUsageUsd(model: string, usage: TokenUsage): number {
  const price = MODEL_TOKEN_PRICES[model];
  if (!price) throw new Error(`No list price configured for model ${model}`);
  const billed = billedOutputTokens(usage);
  return (
    (billed.input * price.inputPerMillionUsd +
      billed.output * price.outputPerMillionUsd) /
    1_000_000
  );
}

export class SpendTracker {
  spentUsd = 0;

  constructor(readonly capUsd = MODEL_COMPARE_SPEND_CAP_USD) {
    if (
      !Number.isFinite(capUsd) ||
      capUsd <= 0 ||
      capUsd > MODEL_COMPARE_SPEND_CAP_USD
    )
      throw new Error(
        "Spend threshold must be greater than zero and at most $20",
      );
  }

  get capped(): boolean {
    return this.spentUsd >= this.capUsd;
  }

  add(usd: number): void {
    if (!Number.isFinite(usd) || usd < 0) throw new Error("Invalid cost");
    this.spentUsd += usd;
  }
}
