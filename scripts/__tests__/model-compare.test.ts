import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { STAGING_PROJECT_REF } from "../uat/lib/staging-project";
import { runModelComparison } from "../uat/lib/model-compare";

const root = resolve(import.meta.dirname, "../..");
const stagingUrl = `https://${STAGING_PROJECT_REF}.supabase.co`;
const productionUrl = "https://jcnephijkxgtprsutgsf.supabase.co";

function runCli(args: string[], env: Record<string, string> = {}) {
  return spawnSync(
    process.execPath,
    ["--no-env-file", "scripts/uat/model-compare.ts", ...args],
    {
      cwd: root,
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        ...env,
      },
    },
  );
}

describe("model comparison harness", () => {
  test("dry-run lists the default and cheaper mixes without calling a model", async () => {
    let called = false;
    const report = await runModelComparison({
      mode: "dry-run",
      target: { supabaseUrl: stagingUrl },
      executeStep: () => {
        called = true;
        throw new Error("dry-run called a model");
      },
    });
    expect(called).toBe(false);
    expect(report.rows).toHaveLength(9);
    expect(report.markdown).toContain("baseline-flash-high");
    expect(report.markdown).toContain("flash-low");
    expect(report.markdown).toContain("mixed-lite");
    expect(report.spentUsd).toBe(0);
  });

  test("mock mode prices token usage and records a fallback", async () => {
    const report = await runModelComparison({
      mode: "mock",
      target: { projectRef: STAGING_PROJECT_REF },
    });
    expect(report.aborted).toBe(false);
    expect(report.spentUsd).toBeGreaterThan(0);
    expect(report.spentUsd).toBeLessThan(20);
    const fallback = report.rows.find(
      (row) =>
        row.configId === "mixed-lite" && row.briefId === "interlaken-sparse",
    );
    expect(fallback?.fallbacks).toBe(1);
    expect(report.markdown).toContain("est. USD");
    expect(report.markdown).toContain("fallback");
  });

  test("aborts once estimated spend reaches $20", async () => {
    let calls = 0;
    const report = await runModelComparison({
      mode: "live",
      target: { supabaseUrl: stagingUrl },
      executeStep: async () => {
        calls += 1;
        return {
          model: "google/gemini-3-flash",
          thinkingLevel: "high",
          latencyMs: 1,
          usage: { inputTokens: 0, outputTokens: 10_000_000 },
        };
      },
    });
    expect(calls).toBe(1);
    expect(report.aborted).toBe(true);
    expect(report.spentUsd).toBeGreaterThanOrEqual(20);
    expect(report.rows).toHaveLength(1);
  });

  test("counts fallback and schema-failure tokens toward the $20 cap", async () => {
    let calls = 0;
    const report = await runModelComparison({
      mode: "live",
      target: { supabaseUrl: stagingUrl },
      executeStep: async () => {
        calls += 1;
        return {
          model: "google/gemini-3-flash",
          thinkingLevel: "high",
          latencyMs: 4,
          usage: {
            inputTokens: 2_000_000,
            outputTokens: 8_000_000,
            reasoningTokens: 1_000_000,
          },
          fallback: {
            reason: "schema_recovery",
            outcome: "recovered_itinerary",
          },
        };
      },
    });
    expect(calls).toBe(1);
    expect(report.aborted).toBe(true);
    expect(report.spentUsd).toBeGreaterThanOrEqual(20);
    expect(report.rows[0]?.fallbacks).toBe(1);
    expect(report.rows[0]?.outputTokens).toBe(8_000_000);
    expect(report.rows[0]?.reasoningTokens).toBe(1_000_000);
  });

  test("refuses a production API host before any comparison", async () => {
    let calls = 0;
    await expect(
      runModelComparison({
        mode: "dry-run",
        target: { supabaseUrl: stagingUrl, apiUrl: "https://faroway.ai" },
        executeStep: async () => {
          calls += 1;
          return {
            model: "google/gemini-3-flash",
            thinkingLevel: "high",
            latencyMs: 1,
            usage: { inputTokens: 1, outputTokens: 1 },
          };
        },
      }),
    ).rejects.toThrow(/production app/);
    expect(calls).toBe(0);
  });

  test("refuses an unpriced model instead of continuing", async () => {
    await expect(
      runModelComparison({
        mode: "mock",
        target: { supabaseUrl: stagingUrl },
        configs: [{ id: "unknown", label: "unknown", env: {} }],
        briefs: [
          {
            id: "one",
            destination: "Lisbon, Portugal",
            startDate: "2026-12-07",
            endDate: "2026-12-09",
            travelers: 2,
            adults: 2,
            children: 0,
            interests: [],
            budget: "moderate",
            vibes: [],
            travelerType: "friends",
          },
        ],
        executeStep: async () => ({
          model: "openai/gpt-unknown",
          thinkingLevel: "low",
          latencyMs: 1,
          usage: { inputTokens: 10, outputTokens: 10 },
        }),
      }),
    ).rejects.toThrow(/No list price/);
  });
});

describe("model comparison CLI", () => {
  test("live mode refuses to start without FAROWAY_STAGING_AI_GATEWAY_KEY", () => {
    const result = runCli(["--live", "--supabase-url", stagingUrl]);
    expect(result.status).toBe(2);
    expect(result.stderr).toContain("FAROWAY_STAGING_AI_GATEWAY_KEY");
    expect(result.stdout).not.toContain("FAROWAY_MODEL_COMPARE_JSON");
  });

  test("refuses production before a mock run", () => {
    const result = runCli(["--mock", "--supabase-url", productionUrl]);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("production");
  });

  test("dry-run and mock succeed without a gateway key", () => {
    const dry = runCli(["--dry-run", "--supabase-url", stagingUrl]);
    expect(dry.status).toBe(0);
    expect(dry.stdout).toContain("baseline-flash-high");
    const out = join(mkdtempSync(join(tmpdir(), "model-compare-")), "result");
    const mock = runCli(["--mock", "--supabase-url", stagingUrl, "--out", out]);
    expect(mock.status).toBe(0);
    expect(mock.stdout).toContain("mixed-lite");
    expect(mock.stdout).toContain("fallback");
  });
});

test("live comparison cannot silently substitute a mock executor", async () => {
  await expect(
    runModelComparison({ mode: "live", target: { supabaseUrl: stagingUrl } }),
  ).rejects.toThrow(/real step executor/);
});

test("unknown billing usage aborts before another paid call", async () => {
  let calls = 0;
  const report = await runModelComparison({
    mode: "live",
    target: { supabaseUrl: stagingUrl },
    executeStep: () => {
      calls += 1;
      return {
        model: "google/gemini-3-flash",
        thinkingLevel: "high",
        latencyMs: 1,
        usage: {},
      };
    },
  });
  expect(calls).toBe(1);
  expect(report.ok).toBe(false);
  expect(report.rows[0]?.status).toBe("aborted");
  expect(report.rows[0]?.estimatedUsd).toBe(null);
  expect(report.markdown).toContain("billing usage is unknown");
});

test("CLI requires one explicit mode even when a key is present", () => {
  for (const args of [[], ["--mock", "--live"]]) {
    const result = runCli([...args, "--supabase-url", stagingUrl], {
      FAROWAY_STAGING_AI_GATEWAY_KEY: "unused-test-key",
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Choose exactly one");
  }
});
