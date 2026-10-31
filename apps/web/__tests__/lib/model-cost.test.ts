import { describe, expect, it } from "vitest";
import { billedOutputTokens, estimateUsageUsd } from "@/lib/ai/model-cost";

describe("model cost", () => {
  it("does not bill reasoning twice when output already includes it", () => {
    expect(
      billedOutputTokens({
        inputTokens: 1000,
        outputTokens: 1500,
        textTokens: 700,
        reasoningTokens: 800,
      }),
    ).toEqual({ input: 1000, output: 1500 });
    expect(
      estimateUsageUsd("google/gemini-3-flash", {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
      }),
    ).toBe(3.5);
  });

  it("adds reasoning when output is only the visible text", () => {
    expect(
      billedOutputTokens({
        inputTokens: 10,
        outputTokens: 5,
        textTokens: 5,
        reasoningTokens: 7,
      }),
    ).toEqual({ input: 10, output: 12 });
  });
});
