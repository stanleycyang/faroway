// Isolated local integration environment. Never reads application dotenv files.
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const root = path.resolve(import.meta.dirname, "../..");
const stack = path.join(tmpdir(), "faroway-mobile-test-stack");
const container = "supabase_db_faroway-mobile-test-stack";
const baseEnv = Object.fromEntries(
  ["PATH", "HOME", "TMPDIR", "USER", "SHELL", "LANG", "JAVA_HOME"]
    .filter((k) => process.env[k])
    .map((k) => [k, process.env[k]]),
);
const cli = ["supabase@2.76.15"];
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    env: baseEnv,
    cwd: stack,
    encoding: "utf8",
    ...options,
  });
  if (result.status !== 0)
    throw new Error(
      `${command} failed: ${result.stderr || result.error || result.stdout}`,
    );
  return result.stdout;
}
mkdirSync(path.join(stack, "supabase"), { recursive: true });
const config = path.join(stack, "supabase/config.toml");
const expected = readFileSync(
  path.join(root, "scripts/mobile-test/config.toml"),
  "utf8",
);
if (existsSync(config) && readFileSync(config, "utf8") !== expected)
  throw new Error(
    "Unexpected local stack configuration; inspect it before continuing",
  );
writeFileSync(config, expected);
console.log("Starting dedicated local Supabase (first run downloads images)…");
run(
  "bunx",
  [
    ...cli,
    "start",
    "--workdir",
    stack,
    "--exclude",
    "studio,postgres-meta,edge-runtime,logflare,vector,supavisor,imgproxy,realtime",
  ],
  { stdio: ["ignore", "ignore", "inherit"] },
);
const status = JSON.parse(
  run("bunx", [...cli, "status", "--workdir", stack, "-o", "json"]),
);
const url = status.API_URL;
if (new URL(url).origin !== "http://127.0.0.1:55421")
  throw new Error("Unexpected local API identity");
function sql(source) {
  return run(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-qAt",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    { input: source },
  );
}
const manifest = JSON.parse(
  readFileSync(path.join(root, "supabase/staging/manifest.json")),
);
const followups = JSON.parse(
  readFileSync(path.join(root, "supabase/release-candidate/migrations.json")),
);
const migrations = [
  ...manifest.migrations.filter((e) => e.action !== "exclude"),
  ...followups.application_order,
];
const source = migrations
  .map((entry) =>
    readFileSync(path.join(root, entry.path), "utf8").replace(
      /^(?:BEGIN|COMMIT);\s*$/gm,
      "",
    ),
  )
  .join("\n");
const permissions = readFileSync(
  path.join(root, "supabase/staging/permissions.sql"),
  "utf8",
);
const schemaHash = createHash("sha256")
  .update(source + permissions)
  .digest("hex");
const receipt = path.join(stack, "schema.sha256");
if (sql("SELECT to_regclass('public.trips') IS NOT NULL;").trim() !== "t") {
  // One transaction: partial setup cannot be mistaken for a complete application schema.
  sql("BEGIN;\n" + source + "\n" + permissions + "\nCOMMIT;");
  sql("NOTIFY pgrst, 'reload schema';");
  writeFileSync(receipt, schemaHash, { mode: 0o600 });
} else if (
  !existsSync(receipt) ||
  readFileSync(receipt, "utf8") !== schemaHash
) {
  throw new Error(
    "Dedicated local schema differs from this repository. Rebuild only this disposable test stack before continuing; no automatic reset was performed.",
  );
}
const admin = createClient(url, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const credentialsFile = path.join(stack, "accounts.json");
let accounts;
if (existsSync(credentialsFile))
  accounts = JSON.parse(readFileSync(credentialsFile));
else {
  accounts = [];
  for (const name of ["owner", "other"]) {
    const email = `${name}@mobile-test.invalid`;
    const password = randomBytes(24).toString("base64url");
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Local ${name}` },
    });
    if (error) throw error;
    accounts.push({ email, password, id: data.user.id });
  }
  writeFileSync(credentialsFile, JSON.stringify(accounts, null, 2), {
    mode: 0o600,
  });
}
const workspace = mkdtempSync(path.join(tmpdir(), "faroway-mobile-app-"));
for (const app of ["mobile", "web"]) {
  cpSync(path.join(root, "apps", app), path.join(workspace, "apps", app), {
    recursive: true,
    filter: (source) =>
      ![
        "node_modules",
        ".next",
        ".expo",
        "coverage",
        "dist",
        ".turbo",
      ].includes(path.basename(source)) &&
      !path.basename(source).startsWith(".env"),
  });
}
cpSync(path.join(root, "packages"), path.join(workspace, "packages"), {
  recursive: true,
  filter: (source) =>
    !["node_modules", "dist", ".turbo"].includes(path.basename(source)) &&
    !path.basename(source).startsWith(".env"),
});
for (const file of ["package.json", "bun.lock"])
  cpSync(path.join(root, file), path.join(workspace, file));
run("bun", ["install", "--frozen-lockfile", "--linker", "hoisted"], {
  cwd: workspace,
  stdio: ["ignore", "inherit", "inherit"],
});
const scenario = process.argv[2] || "success";
if (!["success", "failure", "timeout"].includes(scenario))
  throw new Error("Use success, failure or timeout");
const webEnv = {
  ...baseEnv,
  NODE_ENV: "development",
  NEXT_PUBLIC_SUPABASE_URL: url,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  FAROWAY_TEST_GENERATION: scenario,
  FAROWAY_PLANNING_PAUSED: "false",
  NEXT_TELEMETRY_DISABLED: "1",
};
const mobileEnv = {
  ...baseEnv,
  NODE_ENV: "development",
  EXPO_NO_DOTENV: "1",
  EXPO_PUBLIC_TEST_LOGIN: "true",
  EXPO_PUBLIC_SUPABASE_URL: url,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
  EXPO_PUBLIC_API_URL: "http://127.0.0.1:3011",
  EXPO_PUBLIC_ITINERARY_STREAMING_ENABLED: "false",
};
const web = spawn(
  "bunx",
  ["next", "dev", "--webpack", "--hostname", "127.0.0.1", "--port", "3011"],
  { cwd: path.join(workspace, "apps/web"), env: webEnv, stdio: "inherit" },
);
const mobile = spawn("bunx", ["expo", "start", "--offline", "--port", "8092"], {
  cwd: path.join(workspace, "apps/mobile"),
  env: mobileEnv,
  stdio: "inherit",
});
console.log(
  `Workspace: ${workspace}\nSynthetic account credentials: ${credentialsFile}\nMobile: exp://127.0.0.1:8092\nAPI: http://127.0.0.1:3011\nScenario: ${scenario}. No provider keys are inherited.`,
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    web.kill(signal);
    mobile.kill(signal);
  });
for (const child of [web, mobile])
  child.on("exit", (code) => {
    if (code) {
      console.error(`App exited ${code}`);
      web.kill();
      mobile.kill();
      process.exitCode = code;
    }
  });
