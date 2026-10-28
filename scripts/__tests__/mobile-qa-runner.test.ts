import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dir, "../..");
const temporary = mkdtempSync(join(tmpdir(), "faroway-qa-runner-"));
afterAll(() => rmSync(temporary, { recursive: true, force: true }));
const preload = join(temporary, "blocked-api.cjs");
writeFileSync(
  preload,
  `
globalThis.fetch = async () => new Response('Redirecting', { status: 302 });
require('node:child_process').spawnSync = () => { throw new Error('BUILD_COMMAND_REACHED'); };
require('node:module').syncBuiltinESMExports();
`,
);

test.each([
  "preflight",
  "android",
  "ios-simulator",
  "cloud-android",
  "cloud-ios",
  "cloud-ios-simulator",
])("%s stops before native commands when staging redirects", (action) => {
  // Real Expo config evaluation, synthetic key, no inherited app credentials.
  const key = `fixture.${Buffer.from(JSON.stringify({ ref: "omovikloadpvzijoaqus", role: "anon" })).toString("base64url")}.fixture`;
  const result = spawnSync(
    "node",
    ["--require", preload, "scripts/mobile-qa.mjs", action],
    {
      cwd: root,
      env: {
        PATH: process.env.PATH,
        HOME: temporary,
        EXPO_PUBLIC_QA_SUPABASE_ANON_KEY: key,
      },
      encoding: "utf8",
      timeout: 20000,
    },
  );
  expect(result.error).toBeUndefined();
  expect(result.status).toBe(1);
  expect(result.stdout).toContain("QA configuration validated");
  expect(result.stderr).toContain("HTTP 302");
  expect(result.stderr).not.toContain("BUILD_COMMAND_REACHED");
});
