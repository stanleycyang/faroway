import { afterEach, describe, expect, it, vi } from "vitest";

const generateObject = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/sdk", () => ({ generateObject }));

import {
  PLANNING_MODEL,
  PLANNING_DISCLOSURE,
} from "@/lib/ai/planning-disclosure";
import {
  PLANNING_ENV_KEYS,
  applyPlanningStepArgs,
  generatePlanningObject,
  planningModel,
  resolvePlanningStepConfig,
} from "@/lib/ai/planning-step";

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  for (const key of PLANNING_ENV_KEYS) delete process.env[key];
});

describe("planning step configuration", () => {
  it("keeps today's model, omitted thinking level and unset output cap", () => {
    const args = {
      providerOptions: { gateway: { only: ["google", "vertex"] } },
      maxRetries: 0,
    };
    expect(applyPlanningStepArgs("dining", args)).toBe(args);
    expect(resolvePlanningStepConfig("aggregator")).toMatchObject({
      model: "google/gemini-3-flash",
      thinkingLevel: "high",
      thinkingExplicit: false,
      maxOutputTokens: undefined,
    });
    expect(PLANNING_MODEL).toBe("google/gemini-3-flash");
    expect(PLANNING_DISCLOSURE.version).toBe("planning-google-v1");
    expect(PLANNING_DISCLOSURE.model).toBe(PLANNING_MODEL);
  });

  it("applies an explicit thinking level and output cap without dropping the gateway allowlist", () => {
    vi.stubEnv("PLANNING_THINKING_AGGREGATOR", "medium");
    vi.stubEnv("PLANNING_MAX_OUTPUT_TOKENS_AGGREGATOR", "4000");
    vi.stubEnv("PLANNING_MODEL_AGGREGATOR", "google/gemini-3-flash");
    const args = applyPlanningStepArgs("aggregator", {
      providerOptions: { gateway: { only: ["google", "vertex"] } },
    });
    expect(args.providerOptions).toMatchObject({
      gateway: { only: ["google", "vertex"] },
      google: { thinkingConfig: { thinkingLevel: "medium" } },
      vertex: { thinkingConfig: { thinkingLevel: "medium" } },
    });
    expect(args.maxOutputTokens).toBe(4000);
    expect(planningModel("aggregator")).toBe("google/gemini-3-flash");
  });

  it("rejects a non-Google model and an invalid cap instead of changing the request", () => {
    vi.stubEnv("PLANNING_MODEL_HOTELS", "openai/gpt-4.1");
    vi.stubEnv("PLANNING_MAX_OUTPUT_TOKENS_HOTELS", "10");
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const config = resolvePlanningStepConfig("hotels");
    expect(config.model).toBe(PLANNING_MODEL);
    expect(config.maxOutputTokens).toBeUndefined();
    expect(config.rejections.join(" ")).toContain("rejected model");
    expect(applyPlanningStepArgs("hotels", { prompt: "x" })).toEqual({
      prompt: "x",
    });
    info.mockRestore();
  });

  it("logs token usage for a successful step", async () => {
    generateObject.mockResolvedValueOnce({
      object: { ok: true },
      usage: {
        inputTokens: 12,
        outputTokens: 30,
        totalTokens: 42,
        outputTokenDetails: { textTokens: 10, reasoningTokens: 20 },
      },
    });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const result = await generatePlanningObject<{ ok: boolean }>(
      "orchestrator",
      {
        providerOptions: { gateway: { only: ["google", "vertex"] } },
        prompt: "plan",
      },
    );
    expect(result.object.ok).toBe(true);
    const line = info.mock.calls.map((call) => String(call[0])).join("\n");
    expect(line).toContain('"event":"planning.step.usage"');
    expect(line).toContain('"step":"orchestrator"');
    expect(line).toContain('"model":"google/gemini-3-flash"');
    expect(line).toContain('"thinkingLevel":"high"');
    expect(line).toContain('"thinkingExplicit":false');
    expect(line).toContain('"inputTokens":12');
    expect(line).toContain('"reasoningTokens":20');
    info.mockRestore();
  });
});
