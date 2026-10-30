import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import {
  mockStepExecution,
  renderCompareMarkdown,
  runModelComparison,
} from "./lib/model-compare";
import { StagingGuardError, assertStagingTarget } from "./lib/staging-project";

const root = resolve(import.meta.dirname, "../..");

function has(flag: string): boolean {
  return process.argv.includes(flag);
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function targetFromEnv() {
  return {
    supabaseUrl:
      arg("--supabase-url") ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.EXPO_PUBLIC_SUPABASE_URL,
    projectRef: process.env.FAROWAY_STAGING_SUPABASE_PROJECT_REF,
    anonKey:
      process.env.EXPO_PUBLIC_QA_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    apiUrl: arg("--api-url") || process.env.FAROWAY_UAT_API_URL,
  };
}

async function main() {
  if (has("--help")) {
    console.log(`Usage:
  bun run uat:model-compare -- --dry-run --supabase-url https://omovikloadpvzijoaqus.supabase.co
  bun run uat:model-compare -- --mock --supabase-url https://omovikloadpvzijoaqus.supabase.co
  FAROWAY_STAGING_AI_GATEWAY_KEY=... bun run uat:model-compare -- --live --supabase-url https://omovikloadpvzijoaqus.supabase.co

--dry-run and --mock do not call a model and do not need the gateway key.
--live reads FAROWAY_STAGING_AI_GATEWAY_KEY from the environment, refuses to start without it, and aborts once estimated spend reaches $20.
The key is never accepted as a command argument.`);
    return;
  }
  const mode = has("--dry-run") ? "dry-run" : has("--mock") ? "mock" : "live";
  const target = targetFromEnv();
  if (mode !== "live") {
    const report = await runModelComparison({
      mode,
      target,
      ...(mode === "mock" ? { executeStep: mockStepExecution } : {}),
    });
    writeReport(report.markdown, report);
    console.log(report.markdown);
    if (report.aborted) process.exitCode = 3;
    return;
  }
  const checked = assertStagingTarget(target);
  const key = process.env.FAROWAY_STAGING_AI_GATEWAY_KEY?.trim();
  if (!key) {
    console.error("Refusing to run: FAROWAY_STAGING_AI_GATEWAY_KEY is not set");
    process.exit(2);
  }
  const staging =
    target.supabaseUrl || `https://${checked.projectRef}.supabase.co`;
  const child = spawnSync(
    process.execPath.includes("bun") ? process.execPath : "bun",
    [
      resolve(root, "apps/web/scripts/model-compare-live.ts"),
      "--supabase-url",
      staging,
    ],
    {
      cwd: root,
      encoding: "utf8",
      env: process.env,
      timeout: 30 * 60 * 1000,
    },
  );
  if (child.stdout) {
    const line = child.stdout
      .split("\n")
      .reverse()
      .find((item) => item.startsWith("FAROWAY_MODEL_COMPARE_JSON:"));
    if (line) {
      const report = JSON.parse(
        line.slice("FAROWAY_MODEL_COMPARE_JSON:".length),
      );
      const markdown =
        typeof report.markdown === "string"
          ? report.markdown
          : renderCompareMarkdown(report);
      writeReport(markdown, report);
      console.log(markdown);
    }
  }
  if (child.stderr) process.stderr.write(child.stderr);
  process.exitCode = child.status ?? 1;
}

function writeReport(markdown: string, report: unknown) {
  const dir = resolve(root, "artifacts/uat");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const base = arg("--out") || resolve(dir, `model-compare-${stamp}`);
  writeFileSync(`${base}.md`, markdown, { mode: 0o600 });
  writeFileSync(`${base}.json`, JSON.stringify(report, null, 2), {
    mode: 0o600,
  });
  console.error(`Evidence: ${base}.md`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(
    error instanceof StagingGuardError && error.code === "production" ? 1 : 1,
  );
});
