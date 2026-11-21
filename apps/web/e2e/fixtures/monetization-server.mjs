// Test-only local backend for monetization API route E2E tests.
// Uses dedicated ports 4410 (Next) and 4411 (loopback Supabase + mock Viator API).
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { execFileSync, spawn } from "node:child_process";
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
  if (existsSync(file) || existsSync(path.join("../..", file))) {
    throw new Error(
      "Monetization route tests require a workspace without dotenv files",
    );
  }
}

let trips = new Map();
let affiliateClicks = new Map();
let affiliateConversions = new Map();
let rateLimitConfig = { allowed: true, remaining: 29, reset_in_ms: 60000 };
let rateLimitCalls = [];
let viatorConfig = { status: 200, products: {} };
let viatorCalls = [];
let prepareHandoffOverride = null;

function decodeJwtSub(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  try {
    const token = authHeader.slice(7).trim();
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8"),
    );
    return typeof payload?.sub === "string" && payload.sub.length > 0
      ? payload.sub
      : null;
  } catch {
    return null;
  }
}

function projectSelect(row, selectParam) {
  if (!selectParam || selectParam === "*" || selectParam.includes("(")) {
    return row;
  }
  const cols = selectParam
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  if (cols.length === 0) return row;
  const projected = {};
  for (const col of cols) {
    if (col in row) projected[col] = row[col];
  }
  return projected;
}

function matchesSearchParams(row, searchParams) {
  for (const [key, value] of searchParams.entries()) {
    if (
      key === "select" ||
      key === "order" ||
      key === "limit" ||
      key === "on_conflict"
    ) {
      continue;
    }
    if (value.startsWith("eq.")) {
      if (String(row[key]) !== value.slice(3)) return false;
    } else if (value.startsWith("like.")) {
      const pattern = value.slice(5);
      if (pattern.endsWith("%")) {
        if (!String(row[key] ?? "").startsWith(pattern.slice(0, -1))) {
          return false;
        }
      } else if (String(row[key] ?? "") !== pattern) {
        return false;
      }
    }
  }
  return true;
}

const server = createServer(async (req, res) => {
  let text = "";
  for await (const chunk of req) text += chunk;
  const body = text ? JSON.parse(text) : null;
  const url = new URL(req.url || "/", "http://127.0.0.1:4411");
  res.setHeader("Content-Type", "application/json");

  const send = (value, status = 200) => {
    res.statusCode = status;
    res.end(JSON.stringify(value));
  };

  // Fixture control endpoints
  if (url.pathname === "/fixture/reset") {
    trips = new Map();
    affiliateClicks = new Map();
    affiliateConversions = new Map();
    rateLimitConfig = { allowed: true, remaining: 29, reset_in_ms: 60000 };
    rateLimitCalls = [];
    viatorConfig = { status: 200, products: {} };
    viatorCalls = [];
    prepareHandoffOverride = null;
    return send({});
  }

  if (url.pathname === "/fixture/state") {
    return send({
      trips: [...trips.values()],
      affiliateClicks: [...affiliateClicks.values()],
      affiliateConversions: [...affiliateConversions.values()],
      rateLimitCalls,
      viatorCalls,
    });
  }

  if (url.pathname === "/fixture/trip") {
    trips.set(body.id, body);
    return send({ ok: true });
  }

  if (url.pathname === "/fixture/rate-limit") {
    rateLimitConfig = { ...rateLimitConfig, ...body };
    return send(rateLimitConfig);
  }

  if (url.pathname === "/fixture/viator") {
    if (body?.reset) {
      viatorConfig = { status: 200, products: {} };
    } else if (body?.productCode) {
      viatorConfig.products[body.productCode] = body;
    } else {
      viatorConfig = { ...viatorConfig, ...body };
    }
    return send(viatorConfig);
  }

  if (url.pathname === "/fixture/handoff-override") {
    prepareHandoffOverride = body?.value ?? null;
    return send({ prepareHandoffOverride });
  }

  // Mock Viator Partner API
  if (url.pathname.startsWith("/viator-partner/products/")) {
    const code = decodeURIComponent(
      url.pathname.slice("/viator-partner/products/".length),
    );
    viatorCalls.push({
      code,
      search: url.search,
      apiKey: req.headers["exp-api-key"] ?? null,
    });
    const entry = viatorConfig.products[code];
    const status = entry?.status ?? viatorConfig.status ?? 200;
    if (status !== 200) {
      return send({ error: "Product lookup failed" }, status);
    }
    const product = entry?.product ?? {
      productCode: code,
      title: `Mock Viator Tour ${code}`,
      productUrl: `https://www.viator.com/tours/Paris/Walk/d479-${code}?pid=P12345678&mcid=42383&medium=api`,
    };
    return send(product);
  }

  // Supabase Auth
  if (url.pathname === "/auth/v1/user") {
    const sub = decodeJwtSub(req.headers.authorization);
    if (!sub) {
      return send({ message: "Invalid or missing token" }, 401);
    }
    return send({
      id: sub,
      aud: "authenticated",
      role: "authenticated",
      email: "fixture@example.invalid",
      app_metadata: {},
      user_metadata: {},
    });
  }

  // Supabase RPCs
  if (url.pathname === "/rest/v1/rpc/consume_rate_limit") {
    rateLimitCalls.push(body);
    return send([rateLimitConfig]);
  }

  if (url.pathname === "/rest/v1/rpc/prepare_trip_handoff") {
    if (prepareHandoffOverride !== null) {
      const result = prepareHandoffOverride;
      prepareHandoffOverride = null;
      return send(result);
    }
    const trip = trips.get(body.p_trip_id);
    if (
      !trip ||
      trip.user_id !== body.p_user_id ||
      trip.updated_at !== body.p_revision ||
      !["planned", "generated", "booked", "completed"].includes(trip.status) ||
      trip.preferences?.planNeedsRefresh === true
    ) {
      return send(false);
    }
    if (!affiliateClicks.has(body.p_click_id)) {
      affiliateClicks.set(body.p_click_id, {
        id: body.p_click_id,
        user_id: body.p_user_id,
        trip_id: body.p_trip_id,
        item_id: body.p_item_id,
        item_type: "activity",
        item_name: body.p_item_name,
        affiliate_partner: "viator",
        affiliate_url: body.p_url,
        source: "itinerary",
        converted: false,
        conversion_value: null,
        clicked_at: new Date().toISOString(),
        trip_revision: body.p_revision,
      });
    }
    const row = affiliateClicks.get(body.p_click_id);
    return send(
      row.user_id === body.p_user_id &&
        row.trip_id === body.p_trip_id &&
        row.item_id === body.p_item_id &&
        row.item_type === "activity" &&
        row.affiliate_partner === "viator" &&
        row.trip_revision === body.p_revision,
    );
  }

  // Supabase tables
  if (url.pathname === "/rest/v1/trips") {
    const matches = [...trips.values()].filter((row) =>
      matchesSearchParams(row, url.searchParams),
    );
    if (req.headers.accept?.includes("vnd.pgrst.object")) {
      return matches[0] ? send(matches[0]) : send({ code: "PGRST116" }, 406);
    }
    return send(matches);
  }

  if (url.pathname === "/rest/v1/affiliate_clicks") {
    if (req.method === "POST") {
      const items = Array.isArray(body) ? body : [body];
      const inserted = items.map((item) => {
        const row = {
          converted: false,
          conversion_value: null,
          trip_revision: null,
          ...item,
        };
        affiliateClicks.set(row.id, row);
        return row;
      });
      return send(Array.isArray(body) ? inserted : inserted[0], 201);
    }
    const matches = [...affiliateClicks.values()].filter((row) =>
      matchesSearchParams(row, url.searchParams),
    );
    if (req.method === "PATCH") {
      for (const row of matches) Object.assign(row, body);
      res.setHeader(
        "Content-Range",
        `0-${Math.max(0, matches.length - 1)}/${matches.length}`,
      );
      return send(matches);
    }
    const orderParam = url.searchParams.get("order");
    if (orderParam === "clicked_at.desc") {
      matches.sort((a, b) =>
        String(b.clicked_at).localeCompare(String(a.clicked_at)),
      );
    }
    const limitParam = Number(url.searchParams.get("limit"));
    const limited =
      Number.isFinite(limitParam) && limitParam > 0
        ? matches.slice(0, limitParam)
        : matches;
    const selectParam = url.searchParams.get("select");
    const projected = limited.map((row) => projectSelect(row, selectParam));

    if (req.headers.accept?.includes("vnd.pgrst.object")) {
      return projected[0]
        ? send(projected[0])
        : send({ code: "PGRST116" }, 406);
    }
    return send(projected);
  }

  if (url.pathname === "/rest/v1/affiliate_conversions") {
    if (req.method === "POST") {
      const items = Array.isArray(body) ? body : [body];
      const prefer = String(req.headers.prefer || "");
      const isUpsert =
        prefer.includes("resolution=merge-duplicates") ||
        url.searchParams.has("on_conflict");
      const saved = items.map((item) => {
        const conversionKey =
          (typeof item.order_id === "string" && item.order_id) ||
          (typeof item.booking_reference === "string" &&
            item.booking_reference) ||
          (typeof item.click_id === "string" && item.click_id) ||
          randomUUID();
        const compositeKey = `${item.partner}::${conversionKey}`;
        const existing = affiliateConversions.get(compositeKey);
        if (existing && isUpsert) {
          Object.assign(existing, item, { conversion_key: conversionKey });
          return existing;
        }
        const row = {
          id: existing?.id ?? randomUUID(),
          ...item,
          conversion_key: conversionKey,
        };
        affiliateConversions.set(compositeKey, row);
        return row;
      });
      return send(Array.isArray(body) ? saved : saved[0], 201);
    }
    const matches = [...affiliateConversions.values()].filter((row) =>
      matchesSearchParams(row, url.searchParams),
    );
    return send(matches);
  }

  if (url.pathname.startsWith("/rest/v1/")) {
    return send([]);
  }

  return send({ error: "Unhandled fixture request" }, 404);
});

server.on("error", (err) => {
  console.error("[monetization-server] Loopback server error:", err);
  cleanup();
  process.exit(1);
});

server.listen(4411, "127.0.0.1");

// Copy into isolated tmpdir to compile & serve real Next.js app without modifying repo
const fixtureRoot = mkdtempSync(
  path.join(tmpdir(), "faroway-monetization-app-"),
);
const repoRoot = path.resolve("../..");
let child = null;
let building = true;
let stopping = false;
let shuttingDown = false;
let forceStop;

const killChildGroup = (signal) => {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    /* Already stopped. */
  }
};

const cleanup = () => {
  try {
    server.closeAllConnections();
    server.close();
  } catch (err) {
    console.error("[monetization-server] Failed closing loopback server:", err);
  }
  if (!existsSync(fixtureRoot)) return;
  try {
    rmSync(fixtureRoot, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 150,
    });
  } catch (err) {
    console.error(
      "[monetization-server] rmSync cleanup failed, falling back to rm -rf:",
      err,
    );
    try {
      execFileSync("rm", ["-rf", fixtureRoot]);
    } catch (fallbackErr) {
      console.error(
        `[monetization-server] Fallback rm -rf failed for ${fixtureRoot}:`,
        fallbackErr,
      );
    }
  }
  if (existsSync(fixtureRoot)) {
    console.error(
      `[monetization-server] fixtureRoot still exists after cleanup: ${fixtureRoot}`,
    );
  }
};

const waitForGroupGone = async (pid, timeoutMs) => {
  if (!pid) return;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      process.kill(-pid, 0);
    } catch {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
};

const shutdown = async (exitCode) => {
  if (shuttingDown) return;
  shuttingDown = true;
  if (forceStop) clearTimeout(forceStop);
  const pid = child?.pid;
  if (pid) {
    killChildGroup("SIGTERM");
    await waitForGroupGone(pid, 1_500);
    killChildGroup("SIGKILL");
    await waitForGroupGone(pid, 1_000);
    // Brief settle wait so OS releases any remaining .next file descriptors
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  cleanup();
  process.exit(exitCode);
};

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    void shutdown(0);
  });
}

process.on("uncaughtException", (err) => {
  console.error("[monetization-server] uncaughtException:", err);
  stopping = true;
  void shutdown(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("[monetization-server] unhandledRejection:", reason);
  stopping = true;
  void shutdown(1);
});

process.on("exit", () => {
  killChildGroup("SIGKILL");
  cleanup();
});

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

try {
  cpSync(path.join(repoRoot, "apps/web"), path.join(fixtureRoot, "apps/web"), {
    recursive: true,
    filter: copyFilter,
  });
  cpSync(path.join(repoRoot, "packages"), path.join(fixtureRoot, "packages"), {
    recursive: true,
    filter: copyFilter,
  });
  for (const directory of [
    "scripts/fixtures",
    "scripts/uat/lib",
    "apps/mobile/lib",
  ]) {
    cpSync(path.join(repoRoot, directory), path.join(fixtureRoot, directory), {
      recursive: true,
      filter: copyFilter,
    });
  }
  cpSync(
    path.join(repoRoot, "package.json"),
    path.join(fixtureRoot, "package.json"),
  );

  const dependencies = realpathSync(path.join(repoRoot, "node_modules"));
  const fixtureModules = path.join(fixtureRoot, "node_modules");
  mkdirSync(fixtureModules);
  for (const entry of readdirSync(dependencies)) {
    if (entry !== "@faroway") {
      symlinkSync(
        path.join(dependencies, entry),
        path.join(fixtureModules, entry),
      );
    }
  }
  mkdirSync(path.join(fixtureModules, "@faroway"));
  for (const entry of readdirSync(path.join(dependencies, "@faroway"))) {
    const installed = realpathSync(path.join(dependencies, "@faroway", entry));
    const isApp = entry === "web" || entry === "mobile";
    const snapshot = isApp
      ? path.join(fixtureRoot, "apps", entry)
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
  const rawConfig = readFileSync(fixtureConfig, "utf8");
  const withCpus = rawConfig.replace(
    "const nextConfig: NextConfig = {",
    "const nextConfig: NextConfig = { experimental: { cpus: 2 },",
  );
  const patchedConfig = withCpus.replace(
    "export default ",
    `const __origWebpack = nextConfig.webpack;
nextConfig.webpack = (config, ...args) => {
  const resolved = typeof __origWebpack === "function" ? __origWebpack(config, ...args) : config;
  if (resolved && typeof resolved === "object") {
    resolved.cache = false;
  }
  return resolved;
};

export default `,
  );
  if (
    patchedConfig === rawConfig ||
    !patchedConfig.includes("resolved.cache = false")
  ) {
    throw new Error("Failed to patch fixture next.config.ts");
  }
  writeFileSync(fixtureConfig, patchedConfig);
} catch (setupErr) {
  console.error("[monetization-server] Fixture setup failed:", setupErr);
  cleanup();
  process.exit(1);
}

const preloadPath = path.join(
  fixtureRoot,
  "apps/web/e2e/fixtures/monetization-fetch.mjs",
);

const fixtureEnv = {
  PATH: process.env.PATH,
  HOME: path.join(fixtureRoot, "home"),
  NODE_ENV: "production",
  IP_HASH_SALT: "isolated-fixture-rate-limit-salt",
  NODE_OPTIONS: `--max-old-space-size=3072 --import=${preloadPath}`,
  WORKFLOW_TARGET_WORLD: "local",
  WORKFLOW_LOCAL_DATA_DIR: path.join(fixtureRoot, "workflow-data"),
  WORKFLOW_LOCAL_BASE_URL: "http://127.0.0.1:4410",
  NEXT_TELEMETRY_DISABLED: "1",
  NEXT_FONT_GOOGLE_MOCKED_RESPONSES: path.join(
    fixtureRoot,
    "apps/web/e2e/fixtures/fonts.cjs",
  ),
  NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:4411",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "fixture-anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key",
  NEXT_PUBLIC_BASE_URL: "http://127.0.0.1:4410",
  VIATOR_API_KEY: "fixture-viator-key",
  VIATOR_PARTNER_ID: "P12345678",
  VIATOR_CONTENT_ENABLED: "true",
  VIATOR_CONTENT_APPROVAL_REF: "fixture-approval-ref",
  VIATOR_HOSTED_CHECKOUT_ENABLED: "true",
  VIATOR_SANDBOX: "false",
  VIATOR_WEBHOOK_SECRET: "fixture-viator-webhook-secret",
  GYG_WEBHOOK_SECRET: "fixture-gyg-webhook-secret",
  KLOOK_WEBHOOK_SECRET: "fixture-klook-webhook-secret",
};

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

child = launch(["build", "--webpack"]);

const onExit = (code, signal) => {
  if (building && !stopping && code === 0 && !signal) {
    building = false;
    child = launch(["start", "--hostname", "127.0.0.1", "--port", "4410"]);
    child.on("exit", onExit);
    return;
  }
  void shutdown(stopping ? 0 : code || 1);
};

child.on("exit", onExit);
