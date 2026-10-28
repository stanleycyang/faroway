import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dir, "../..");
const config = readFileSync(join(root, "turbo.json"), "utf8");
const turbo = join(root, "node_modules/.bin/turbo");
const staging = "abcdefghijklmnopqrst";
const cwd = mkdtempSync(join(tmpdir(), "faroway-build-env-"));
afterAll(() => rmSync(cwd, { recursive: true, force: true }));

// Exercise Turbo's real strict-mode child environment, not just the guard
// called directly by a unit test. Never inherit application credentials.
function probe(extra: Record<string, string>, dry = false) {
  writeFileSync(join(cwd, "turbo.json"), config);
  writeFileSync(
    join(cwd, "package.json"),
    JSON.stringify({
      name: "preview-build-env-probe",
      private: true,
      packageManager: "bun@1.4.4",
      scripts: { build: "bun probe.ts" },
    }),
  );
  writeFileSync(
    join(cwd, "probe.ts"),
    `import { assertDatabaseIsolation } from ${JSON.stringify(join(root, "apps/web/lib/config/database-isolation.ts"))};
try {
  assertDatabaseIsolation(process.env);
  if (process.env.FAROWAY_PLANNING_PAUSED !== "true") throw new Error("Planning pause lost");
  console.log("ISOLATED_PREVIEW_OK");
} catch (error) {
  console.log(error.message);
  process.exitCode = 1;
}`,
  );
  return spawnSync(turbo, ["run", "build", dry ? "--dry=json" : "--force"], {
    cwd,
    encoding: "utf8",
    timeout: 20_000,
    env: {
      PATH: `${dirname(process.execPath)}:${process.env.PATH || ""}`,
      HOME: cwd,
      CI: "1",
      TURBO_TELEMETRY_DISABLED: "1",
      VERCEL_ENV: "preview",
      FAROWAY_STAGING_SUPABASE_PROJECT_REF: staging,
      NEXT_PUBLIC_SUPABASE_URL: `https://${staging}.supabase.co`,
      FAROWAY_PLANNING_PAUSED: "true",
      ...extra,
    },
  });
}

describe("Preview build environment through Turbo", () => {
  test("passes the approved target and planning pause in strict mode", () => {
    const result = probe({});
    expect(result.status, result.stderr + result.stdout).toBe(0);
    expect(result.stdout).toContain("ISOLATED_PREVIEW_OK");
  });

  test.each(["preview", "development"])(
    "still rejects production reuse in %s",
    (VERCEL_ENV) => {
      const result = probe({
        VERCEL_ENV,
        NEXT_PUBLIC_SUPABASE_URL: "https://jcnephijkxgtprsutgsf.supabase.co",
      });
      expect(result.status).not.toBe(0);
      expect(result.stdout + result.stderr).toContain(
        "Non-production database isolation check failed",
      );
    },
  );

  test("still rejects a missing approved ref", () => {
    const result = probe({ FAROWAY_STAGING_SUPABASE_PROJECT_REF: "" });
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain(
      "Non-production database isolation check failed",
    );
  });

  test("isolation, pause and activation changes invalidate cached builds", () => {
    function hash(extra: Record<string, string>) {
      const result = probe(extra, true);
      expect(result.status, result.stderr).toBe(0);
      return JSON.parse(result.stdout).tasks[0].hash;
    }
    const baseline = hash({});
    expect(hash({})).toBe(baseline);
    for (const name of [
      "VERCEL_ENV",
      "FAROWAY_STAGING_SUPABASE_PROJECT_REF",
      "FAROWAY_BUILD_WITHOUT_BLOG_DB",
      "FAROWAY_PLANNING_PAUSED",
      "FAROWAY_PLAN_EDITING_ENABLED",
      "FAROWAY_BOOKING_CHECKLIST_ENABLED",
      "ACCOUNT_DELETION_ENABLED",
      "PUSH_CONSENT_V2_ENABLED",
      "PUSH_DELIVERY_ENABLED",
      "GOOGLE_PLACES_LIVE_ENABLED",
      "MET_WEATHER_ENABLED",
      "VIATOR_CONTENT_ENABLED",
      "VIATOR_CONTENT_APPROVAL_REF",
      "VIATOR_EXTERNAL_PROCESSING_ENABLED",
      "VIATOR_EXTERNAL_PROCESSING_APPROVAL_REF",
      "VIATOR_HOSTED_CHECKOUT_ENABLED",
    ]) {
      expect(hash({ [name]: "changed" }), name).not.toBe(baseline);
    }
  });
});
