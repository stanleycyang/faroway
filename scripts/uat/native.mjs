import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";

const device = process.argv[2];
assert.ok(device, "Pass the Android serial from adb devices -l");
const root = resolve(import.meta.dirname, "../..");
const directory = resolve(homedir(), ".local/share/faroway-uat");
const [account] = JSON.parse(readFileSync(resolve(directory, "accounts.json")));
assert.ok(account.email.endsWith("@faroway-test.invalid"));
const installed = spawnSync(
  "adb",
  ["-s", device, "shell", "pm", "path", "ai.faroway.app.qa"],
  { encoding: "utf8" },
);
assert.ok(
  installed.status === 0 && installed.stdout.includes("package:"),
  "Install Faroway QA first",
);
const output = resolve(directory, "native", String(Date.now()));
mkdirSync(output, { recursive: true, mode: 0o700 });
const java = [
  "/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home",
  "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home",
].find((p) => existsSync(p + "/bin/java"));
console.log("Running real staging login and session restoration on " + device);
const result = spawnSync(
  "maestro",
  [
    "--device",
    device,
    "test",
    "--test-output-dir",
    output,
    resolve(root, "scripts/uat/login.yaml"),
  ],
  {
    env: {
      ...process.env,
      ...(java ? { JAVA_HOME: java } : {}),
      MAESTRO_UAT_EMAIL: account.email,
      MAESTRO_UAT_PASSWORD: account.password,
    },
    encoding: "utf8",
    timeout: 240000,
    maxBuffer: 8 * 1024 * 1024,
  },
);
const log = (result.stdout || "") + (result.stderr || "");
const redacted = log
  .replaceAll(account.password, "[REDACTED]")
  .replaceAll(account.email, "[QA ACCOUNT]");
writeFileSync(resolve(output, "runner.log"), redacted, { mode: 0o600 });
console.log(redacted.slice(-5000));
console.log("Private device evidence: " + output);
process.exitCode = result.status ?? 1;
