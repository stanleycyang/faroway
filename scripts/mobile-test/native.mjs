import { mkdtempSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
const [account] = JSON.parse(
  readFileSync(path.join(tmpdir(), "faroway-mobile-test-stack/accounts.json")),
);
const root = path.resolve(import.meta.dirname, "../..");
if (!process.argv[2]) throw new Error("Pass the iOS simulator UDID");
const artifacts = mkdtempSync(path.join(tmpdir(), "faroway-maestro-"));
const result = spawnSync(
  "maestro",
  [
    "--device",
    process.argv[2],
    "test",
    "--test-output-dir",
    artifacts,
    "-e",
    `TEST_EMAIL=${account.email}`,
    "-e",
    `TEST_PASSWORD=${account.password}`,
    path.join(root, "scripts/mobile-test/flows/login.yaml"),
  ],
  { stdio: "inherit" },
);
process.exitCode = result.status ?? 1;
if (result.status === 0) {
  const find = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const location = path.join(directory, entry.name);
      if (entry.isFile() && entry.name === "local-mobile-saved-trip.png")
        return location;
      if (entry.isDirectory()) {
        const match = find(location);
        if (match) return match;
      }
    }
  };
  const screenshot = find(artifacts);
  if (!screenshot)
    throw new Error("Passed flow did not produce its required screenshot");
  console.log(`Native screenshot: ${screenshot}`);
}
console.log(`Native artifacts: ${artifacts}`);
