import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
function replay(args: string[]) {
  return spawnSync(
    process.execPath,
    ["--no-env-file", "apps/web/scripts/aggregator-replay-live.ts", ...args],
    {
      cwd: root,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        FAROWAY_STAGING_SUPABASE_PROJECT_REF: "omovikloadpvzijoaqus",
      },
      encoding: "utf8",
      timeout: 10000,
    },
  );
}
test("aggregator replay refuses implicit paid calls", () => {
  const result = replay([]);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Explicit --live required");
});
test("aggregator replay refuses production targets before credentials", () => {
  const result = replay([
    "--live",
    "--supabase-url",
    "https://jcnephijkxgtprsutgsf.supabase.co",
  ]);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("production");
});
test("aggregator replay requires a dedicated staging credential", () => {
  const result = replay([
    "--live",
    "--supabase-url",
    "https://omovikloadpvzijoaqus.supabase.co",
  ]);
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Dedicated staging key required");
});

test("grounding probe refuses implicit paid calls and production targets", () => {
  for (const args of [
    [],
    ["--live", "--supabase-url", "https://jcnephijkxgtprsutgsf.supabase.co"],
  ]) {
    const result = spawnSync(
      process.execPath,
      ["--no-env-file", "apps/web/scripts/grounding-pilot-live.ts", ...args],
      {
        cwd: root,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          FAROWAY_STAGING_SUPABASE_PROJECT_REF: "omovikloadpvzijoaqus",
        },
        encoding: "utf8",
        timeout: 10000,
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      args.length ? "production" : "Explicit --live required",
    );
  }
});

test("dining repair refuses implicit calls, production, and missing credentials", () => {
  for (const [args, message] of [
    [[], "Explicit --live required"],
    [
      ["--live", "--supabase-url", "https://jcnephijkxgtprsutgsf.supabase.co"],
      "production",
    ],
    [["--live"], "Dedicated staging key required"],
  ] as Array<[string[], string]>) {
    const result = spawnSync(
      process.execPath,
      ["--no-env-file", "apps/web/scripts/dining-repair-live.ts", ...args],
      {
        cwd: root,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          FAROWAY_STAGING_SUPABASE_PROJECT_REF: "omovikloadpvzijoaqus",
        },
        encoding: "utf8",
        timeout: 10000,
      },
    );
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
  }
});
