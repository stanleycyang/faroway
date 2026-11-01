import { test, expect } from "bun:test";
import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

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

test("address extraction refuses implicit paid calls and production targets", () => {
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
      ["--no-env-file", "apps/web/scripts/address-extraction-live.ts", ...args],
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

test("narration refuses implicit paid calls and production targets", () => {
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
      ["--no-env-file", "apps/web/scripts/narration-live.ts", ...args],
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

test("hotel replay refuses unsafe or incomplete trials before a model call", () => {
  const directory = mkdtempSync(join(tmpdir(), "hotel-replay-preflight-"));
  const input = join(directory, "input.json");
  const out = join(directory, "out.json");
  writeFileSync(input, JSON.stringify({ status: "failed", trace: {} }));
  const run = (args: string[], key = true) =>
    spawnSync(
      process.execPath,
      ["--no-env-file", "apps/web/scripts/hotel-replay-live.ts", ...args],
      {
        cwd: root,
        encoding: "utf8",
        timeout: 10000,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          FAROWAY_STAGING_SUPABASE_PROJECT_REF: "omovikloadpvzijoaqus",
          ...(key
            ? { FAROWAY_STAGING_AI_GATEWAY_KEY: "invalid-preflight-only-key" }
            : {}),
        },
      },
    );
  const live = ["--live", "--input", input, "--out", out];
  try {
    for (const [args, expected, key] of [
      [[], "Explicit --live required", true],
      [
        [
          "--live",
          "--supabase-url",
          "https://jcnephijkxgtprsutgsf.supabase.co",
        ],
        "production",
        true,
      ],
      [live, "Dedicated staging key required", false],
      [
        [...live, "--thinking", "high"],
        "Explicit low or minimal thinking required",
        true,
      ],
      [
        [...live, "--thinking", "low"],
        "Completed passing non-fallback trace required",
        true,
      ],
    ] as Array<[string[], string, boolean]>) {
      const result = run(args, key);
      expect(result.status).toBe(1);
      expect(result.stderr).toContain(expected);
    }
    writeFileSync(out, "preserve this receipt");
    const result = run([...live, "--thinking", "minimal"]);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("Output already exists");
    expect(readFileSync(out, "utf8")).toBe("preserve this receipt");
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
