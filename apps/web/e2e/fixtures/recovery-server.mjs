// Test-only local backend. Never imports a production environment or contacts providers.
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  cpSync,
  mkdtempSync,
  symlinkSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { tmpdir } from "node:os";
for (const file of [
  ".env",
  ".env.local",
  ".env.development",
  ".env.development.local",
]) {
  if (existsSync(file))
    throw new Error("Recovery tests require a workspace without dotenv files");
}
let trips = new Map();
let inserts = 0;
let searches = new Map();
let generationUpdates = [];
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "fixture@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
};
const server = createServer(async (req, res) => {
  let text = "";
  for await (const chunk of req) text += chunk;
  const body = text ? JSON.parse(text) : null;
  const url = new URL(req.url, "http://127.0.0.1:4401");
  res.setHeader("Content-Type", "application/json");
  const send = (value, status = 200) => {
    res.statusCode = status;
    res.end(JSON.stringify(value));
  };
  if (url.pathname === "/fixture/reset") {
    trips = new Map();
    inserts = 0;
    searches = new Map();
    generationUpdates = [];
    return send({});
  }
  if (url.pathname === "/fixture/state")
    return send({
      trips: [...trips.values()],
      inserts,
      searches: [...searches.values()],
      generationUpdates,
    });
  if (url.pathname === "/fixture/trip") {
    trips.set(body.id, body);
    return send({});
  }
  if (url.pathname === "/auth/v1/user") return send(user);
  if (url.pathname === "/rest/v1/rpc/update_trip_brief") {
    const trip = trips.get(body.p_trip_id);
    if (
      !trip ||
      trip.user_id !== body.p_user_id ||
      trip.updated_at !== body.p_expected_updated_at ||
      trip.status === "generating"
    )
      return send(null);
    Object.assign(trip, body.p_changes, {
      preferences: {
        ...trip.preferences,
        ...body.p_changes.preferences,
        planNeedsRefresh: !!trip.itineraries,
      },
      status: "draft",
      search_id: null,
      is_shared: false,
      share_token: null,
      shared_at: null,
      updated_at: new Date().toISOString(),
    });
    return send(trip);
  }
  if (url.pathname === "/rest/v1/rpc/consume_rate_limit")
    return send([{ allowed: true, remaining: 19, reset_in_ms: 60000 }]);
  if (url.pathname === "/rest/v1/rpc/apply_trip_generation_update") {
    generationUpdates.push(body);
    // This fixture models an attempt whose claim has been superseded. The
    // real compiled workflow must stop before invoking any paid AI step.
    return send(false);
  }
  if (url.pathname === "/rest/v1/searches") {
    if (req.method === "POST") {
      const row = {
        ...body,
        id: randomUUID(),
        created_at: new Date().toISOString(),
      };
      searches.set(row.id, row);
      return send(row, 201);
    }
    const row = searches.get(url.searchParams.get("id")?.slice(3));
    if (
      !row ||
      (url.searchParams.has("user_id") &&
        url.searchParams.get("user_id") !== `eq.${row.user_id}`)
    )
      return send({ code: "PGRST116" }, 406);
    if (req.method === "PATCH") Object.assign(row, body);
    if (req.method === "DELETE") searches.delete(row.id);
    return send(row);
  }
  if (url.pathname === "/rest/v1/trips") {
    if (req.method === "POST") {
      if (trips.has(body.id))
        return send({ code: "23505", message: "duplicate" }, 409);
      inserts++;
      const trip = {
        ...body,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_shared: false,
        share_token: null,
        search_id: null,
      };
      trips.set(body.id, trip);
      return send(trip, 201);
    }
    const matches = [...trips.values()].filter((row) =>
      [...url.searchParams].every(
        ([key, value]) =>
          key === "select" ||
          key === "order" ||
          key === "limit" ||
          (value.startsWith("eq.")
            ? String(row[key]) === value.slice(3)
            : true),
      ),
    );
    if (req.method === "PATCH") {
      for (const row of matches) Object.assign(row, body);
      res.setHeader(
        "Content-Range",
        `0-${Math.max(0, matches.length - 1)}/${matches.length}`,
      );
      return send(matches[0] || null);
    }
    if (req.headers.accept?.includes("vnd.pgrst.object"))
      return matches[0] ? send(matches[0]) : send({ code: "PGRST116" }, 406);
    return send(matches);
  }
  if (url.pathname.startsWith("/rest/v1/")) return send([]);
  send({ error: "Unhandled fixture request" }, 404);
});
server.listen(4401, "127.0.0.1");
// Run an isolated source copy so test-only image configuration never changes
// application configuration. Exclude dotenv files and all local build/cache data.
const fixtureRoot = mkdtempSync(path.join(tmpdir(), "faroway-recovery-app-"));
const repoRoot = path.resolve("../..");
const copyFilter = (source) =>
  ![
    "node_modules",
    ".next",
    ".turbo",
    ".git",
    "test-results",
    "playwright-report",
  ].includes(path.basename(source)) &&
  !path.basename(source).startsWith(".env");
cpSync(path.join(repoRoot, "apps/web"), path.join(fixtureRoot, "apps/web"), {
  recursive: true,
  filter: copyFilter,
});
cpSync(path.join(repoRoot, "packages"), path.join(fixtureRoot, "packages"), {
  recursive: true,
  filter: copyFilter,
});
cpSync(
  path.join(repoRoot, "package.json"),
  path.join(fixtureRoot, "package.json"),
);
// Preserve workspace-local versions (web uses Zod 3 while the hoisted tree
// also contains Zod 4), and resolve @faroway imports to this source snapshot.
const dependencies = realpathSync(path.join(repoRoot, "node_modules"));
const fixtureModules = path.join(fixtureRoot, "node_modules");
mkdirSync(fixtureModules);
for (const entry of readdirSync(dependencies)) {
  if (entry !== "@faroway")
    symlinkSync(
      path.join(dependencies, entry),
      path.join(fixtureModules, entry),
    );
}
mkdirSync(path.join(fixtureModules, "@faroway"));
for (const entry of readdirSync(path.join(dependencies, "@faroway"))) {
  const installed = realpathSync(path.join(dependencies, "@faroway", entry));
  const isWeb = entry === "web";
  const snapshot = isWeb
    ? path.join(fixtureRoot, "apps/web")
    : path.join(fixtureRoot, "packages", entry);
  symlinkSync(
    existsSync(snapshot) ? snapshot : installed,
    path.join(fixtureModules, "@faroway", entry),
  );
  if (
    existsSync(snapshot) &&
    existsSync(path.join(installed, "node_modules"))
  ) {
    symlinkSync(
      path.join(installed, "node_modules"),
      path.join(snapshot, "node_modules"),
    );
  }
}
const fixtureConfig = path.join(fixtureRoot, "apps/web/next.config.ts");
writeFileSync(
  fixtureConfig,
  readFileSync(fixtureConfig, "utf8").replace(
    "remotePatterns: [",
    'remotePatterns: [{ protocol: "http", hostname: "127.0.0.1", port: "4401", pathname: "/storage/v1/object/public/**" },',
  ),
);
// Compile before serving: dev-server rebuilds/restarts can interrupt the local
// Workflow queue and read partially rewritten manifests. Exercise the same
// compiled handlers without HMR, with bounded heap and build concurrency.
const fixtureEnv = {
  PATH: process.env.PATH,
  HOME: path.join(fixtureRoot, "home"),
  NODE_ENV: "production",
  IP_HASH_SALT: "isolated-fixture-rate-limit-salt",
  NODE_OPTIONS: "--max-old-space-size=3072",
  WORKFLOW_TARGET_WORLD: "local",
  WORKFLOW_LOCAL_DATA_DIR: path.join(fixtureRoot, "workflow-data"),
  WORKFLOW_LOCAL_BASE_URL: "http://127.0.0.1:4400",
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_FONT_GOOGLE_MOCKED_RESPONSES: path.join(
    fixtureRoot,
    "apps/web/e2e/fixtures/fonts.cjs",
  ),
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:4401",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key",
  NEXT_PUBLIC_BASE_URL: "http://127.0.0.1:4400",
};
writeFileSync(
  fixtureConfig,
  readFileSync(fixtureConfig, "utf8").replace(
    "const nextConfig: NextConfig = {",
    "const nextConfig: NextConfig = { experimental: { cpus: 2 },",
  ),
);
const launch = (args) =>
  spawn(
    process.execPath,
    [path.join(repoRoot, "node_modules/next/dist/bin/next"), ...args],
    {
      stdio: "inherit",
      detached: true,
      cwd: path.join(fixtureRoot, "apps/web"),
      env: fixtureEnv,
    },
  );
let child = launch(["build", "--webpack"]);
let building = true;
let stopping = false;
let forceStop;
const killChildGroup = (signal) => {
  try {
    process.kill(-child.pid, signal);
  } catch {
    /* Already stopped. */
  }
};
const cleanup = () => {
  server.closeAllConnections();
  server.close();
  rmSync(fixtureRoot, { recursive: true, force: true });
};
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    killChildGroup("SIGTERM");
    server.closeAllConnections();
    server.close();
    // Detached Next descendants otherwise keep Playwright's output pipes open.
    forceStop = setTimeout(() => {
      killChildGroup("SIGKILL");
      cleanup();
      process.exit(0);
    }, 2_000);
  });
const onExit = (code, signal) => {
  if (building && !stopping && code === 0 && !signal) {
    building = false;
    child = launch(["start", "--hostname", "127.0.0.1", "--port", "4400"]);
    child.on("exit", onExit);
    return;
  }
  if (forceStop) clearTimeout(forceStop);
  killChildGroup("SIGKILL");
  cleanup();
  process.exit(stopping ? 0 : code || 1);
};
child.on("exit", onExit);
