import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { IMAGE_PATHS } from "../../packages/constants/src/images";
import { runSmoke, type UatAccount } from "./lib/smoke-runner";
import { StagingGuardError } from "./lib/staging-project";

const root = resolve(import.meta.dirname, "../..");

function has(flag: string): boolean {
  return process.argv.includes(flag);
}

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function tiers(): Array<0 | 1 | 2> {
  const raw = arg("--tier") ?? "0";
  const parsed = raw.split(",").map((item) => Number(item.trim()));
  if (parsed.some((tier) => tier !== 0 && tier !== 1 && tier !== 2)) {
    throw new Error("Use --tier 0,1,2");
  }
  return parsed as Array<0 | 1 | 2>;
}

function accounts(): UatAccount[] | undefined {
  const path = resolve(homedir(), ".local/share/faroway-uat/accounts.json");
  if (!existsSync(path)) return undefined;
  const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!Array.isArray(parsed)) return undefined;
  return parsed.flatMap((item) => {
    const account = item as { email?: unknown; password?: unknown };
    return typeof account.email === "string" &&
      typeof account.password === "string"
      ? [{ email: account.email, password: account.password }]
      : [];
  });
}

function imagePaths(): string[] {
  return [
    ...new Set(
      Object.values(IMAGE_PATHS).flatMap((group) => Object.values(group)),
    ),
  ];
}

async function main() {
  if (has("--help")) {
    console.log(`Usage:
  bun run uat:smoke -- --dry-run --tier 0,1,2 --supabase-url https://omovikloadpvzijoaqus.supabase.co
  bun run uat:smoke -- --tier 0 --supabase-url https://omovikloadpvzijoaqus.supabase.co --api-url https://faroway-git-verify-staging-readiness-20261018-testimonio.vercel.app
  bun run uat:smoke -- --tier 2 --live --supabase-url https://omovikloadpvzijoaqus.supabase.co --api-url https://faroway-git-verify-staging-readiness-20261018-testimonio.vercel.app

Refuses production (${"jcnephijkxgtprsutgsf"}), faroway.ai, and any API host that is not a faroway staging preview.
Tier 2 is not dispatched unless --live is set. Existing uat:api, uat:images and uat:native scripts are unchanged.`);
    return;
  }
  const report = await runSmoke({
    tiers: tiers(),
    dryRun: has("--dry-run"),
    liveAi: has("--live"),
    rateLimitProbe: has("--rate-limit"),
    briefIds: arg("--brief")?.split(","),
    target: {
      supabaseUrl:
        arg("--supabase-url") ||
        process.env.NEXT_PUBLIC_SUPABASE_URL ||
        process.env.EXPO_PUBLIC_SUPABASE_URL,
      projectRef: process.env.FAROWAY_STAGING_SUPABASE_PROJECT_REF,
      anonKey:
        process.env.EXPO_PUBLIC_QA_SUPABASE_ANON_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      apiUrl:
        arg("--api-url") ||
        process.env.FAROWAY_UAT_API_URL ||
        process.env.EXPO_PUBLIC_API_URL,
    },
    accounts: has("--dry-run") ? undefined : accounts(),
    env: process.env,
    imagePaths: imagePaths(),
    expectedImageCount: 79,
    repoRoot: root,
  });
  const dir = resolve(root, "artifacts/uat");
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file =
    arg("--out") ||
    resolve(
      dir,
      `smoke-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
  writeFileSync(file, JSON.stringify(report, null, 2), { mode: 0o600 });
  for (const item of report.checks) {
    console.log(
      `${item.status.toUpperCase()} T${item.tier} ${item.name}${item.detail ? ` — ${item.detail}` : ""}`,
    );
  }
  console.log(`Evidence: ${file}`);
  if (!report.ok) process.exitCode = 1;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(error instanceof StagingGuardError ? 1 : 1);
});
