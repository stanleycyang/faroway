import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildViatorHandoffUrl } from "../../../apps/web/lib/affiliates/viator-link";
import { UAT_BRIEFS, type UatBrief } from "./briefs";
import { evaluateSavedPlan } from "./plan-quality";
import {
  assertStagingTarget,
  type StagingTargetInput,
} from "./staging-project";

export type CheckStatus =
  | "passed"
  | "failed"
  | "skipped"
  | "planned"
  | "blocked";

export interface CheckResult {
  tier: 0 | 1 | 2;
  name: string;
  status: CheckStatus;
  detail?: string;
}

export interface UatAccount {
  email: string;
  password: string;
}

export interface SmokeOptions {
  tiers: Array<0 | 1 | 2>;
  dryRun?: boolean;
  liveAi?: boolean;
  rateLimitProbe?: boolean;
  briefIds?: string[];
  target: StagingTargetInput;
  accounts?: UatAccount[];
  fetchImpl?: typeof fetch;
  env?: Record<string, string | undefined>;
  imagePaths?: string[];
  expectedImageCount?: number;
  repoRoot?: string;
  pollIntervalMs?: number;
}

export interface SmokeReport {
  ok: boolean;
  projectRef: string;
  checks: CheckResult[];
}

interface HttpResult {
  status: number;
  data: unknown;
  contentType: string | null;
}

const TIER0 = [
  "health",
  "destinations",
  "images",
  "osm-tile",
  "guest-401",
  "consent-409",
  "planning-paused-contract",
  "rate-limit-contract",
  "places",
  "weather",
  "cron-unauthorized",
  "sign-in",
  "create-idempotent",
  "cross-account",
  "edit-409",
  "share-revoke",
  "cleanup",
  "rate-limit-probe",
];
const TIER1 = [
  "liteapi-hotels-sandbox",
  "liteapi-flights-sandbox",
  "viator-sandbox",
  "duffel-test",
  "tavily",
  "tripadvisor",
  "getyourguide",
];

function check(
  tier: 0 | 1 | 2,
  name: string,
  status: CheckStatus,
  detail?: string,
): CheckResult {
  return { tier, name, status, ...(detail ? { detail } : {}) };
}

function planned(tier: 0 | 1 | 2, names: string[]): CheckResult[] {
  return names.map((name) => check(tier, name, "planned"));
}

async function http(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit = {},
): Promise<HttpResult> {
  const response = await fetchImpl(url, {
    ...init,
    redirect: "manual",
    signal: AbortSignal.timeout(60_000),
  });
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  return {
    status: response.status,
    data,
    contentType: response.headers.get("content-type"),
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function sourceHas(
  root: string,
  path: string,
  needles: string[],
): string | null {
  const source = readFileSync(resolve(root, path), "utf8");
  const missing = needles.filter((needle) => !source.includes(needle));
  return missing.length ? `missing ${missing.join(", ")}` : null;
}

function envFlag(
  env: Record<string, string | undefined>,
  name: string,
): boolean {
  return env[name] === "true" || env[name] === "1";
}

async function signIn(
  fetchImpl: typeof fetch,
  supabaseUrl: string,
  anonKey: string,
  account: UatAccount,
): Promise<string> {
  const response = await http(
    fetchImpl,
    `${supabaseUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: account.email,
        password: account.password,
      }),
    },
  );
  const token = record(response.data)?.access_token;
  if (response.status !== 200 || typeof token !== "string") {
    throw new Error(
      `Staging password authentication failed (${response.status})`,
    );
  }
  return token;
}

export async function runSmoke(options: SmokeOptions): Promise<SmokeReport> {
  const target = assertStagingTarget(options.target);
  const env = options.env ?? process.env;
  const fetchImpl = options.fetchImpl ?? fetch;
  const repoRoot = options.repoRoot ?? resolve(import.meta.dirname, "../../..");
  const apiUrl = options.target.apiUrl?.replace(/\/$/, "");
  const checks: CheckResult[] = [];
  const tiers = [...new Set(options.tiers)].sort() as Array<0 | 1 | 2>;

  if (options.dryRun) {
    if (tiers.includes(0)) checks.push(...planned(0, TIER0));
    if (tiers.includes(1)) {
      checks.push(
        ...planned(1, TIER1.slice(0, 4)),
        check(1, "tavily", "skipped", "live quota; set FAROWAY_UAT_TAVILY=1"),
        check(
          1,
          "tripadvisor",
          "skipped",
          "live quota; set FAROWAY_UAT_TRIPADVISOR=1",
        ),
        check(1, "getyourguide", "skipped", "no sandbox; left manual"),
      );
    }
    if (tiers.includes(2)) {
      const briefs = selectedBriefs(options.briefIds);
      if (!options.liveAi) {
        checks.push(
          check(
            2,
            "live-plan",
            "planned",
            `requires --live; briefs ${briefs.map((brief) => brief.id).join(",")}`,
          ),
        );
      } else {
        for (const brief of briefs) {
          checks.push(check(2, `live-plan:${brief.id}`, "planned"));
        }
      }
    }
    return finish(target.projectRef, checks);
  }

  if (tiers.includes(0)) {
    checks.push(
      ...(await runTier0(
        options,
        env,
        fetchImpl,
        repoRoot,
        apiUrl,
        target.supabaseUrl,
      )),
    );
  }
  if (tiers.includes(1)) checks.push(...(await runTier1(env, fetchImpl)));
  if (tiers.includes(2)) {
    checks.push(
      ...(await runTier2(options, fetchImpl, apiUrl, target.supabaseUrl)),
    );
  }
  return finish(target.projectRef, checks);
}

function finish(projectRef: string, checks: CheckResult[]): SmokeReport {
  const ok = checks.every(
    (item) =>
      item.status === "passed" ||
      item.status === "skipped" ||
      item.status === "planned",
  );
  return { ok, projectRef, checks };
}

function selectedBriefs(ids?: string[]): UatBrief[] {
  if (!ids?.length) return UAT_BRIEFS;
  const briefs = UAT_BRIEFS.filter((brief) => ids.includes(brief.id));
  if (briefs.length !== ids.length) {
    throw new Error(
      `Unknown brief. Known briefs: ${UAT_BRIEFS.map((b) => b.id).join(", ")}`,
    );
  }
  return briefs;
}

async function runTier0(
  options: SmokeOptions,
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
  repoRoot: string,
  apiUrl: string | undefined,
  supabaseUrl: string | undefined,
): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];
  const api = apiUrl;
  if (!api) {
    for (const name of [
      "health",
      "destinations",
      "guest-401",
      "cron-unauthorized",
      "places",
      "weather",
    ]) {
      checks.push(check(0, name, "blocked", "FAROWAY_UAT_API_URL is required"));
    }
  } else {
    const health = await http(fetchImpl, `${api}/api/health`);
    checks.push(
      health.status === 200 && record(health.data)?.status === "ok"
        ? check(0, "health", "passed")
        : check(0, "health", "failed", `status ${health.status}`),
    );
    const destinations = await http(
      fetchImpl,
      `${api}/api/destinations/popular?limit=1`,
    );
    const list = record(destinations.data)?.destinations;
    checks.push(
      destinations.status === 200 && Array.isArray(list)
        ? check(0, "destinations", "passed")
        : check(0, "destinations", "failed", `status ${destinations.status}`),
    );
    const guest = await http(fetchImpl, `${api}/api/trips`);
    checks.push(
      guest.status === 401
        ? check(0, "guest-401", "passed")
        : check(0, "guest-401", "failed", `status ${guest.status}`),
    );
    const cron = await http(fetchImpl, `${api}/api/cron/cleanup`);
    checks.push(
      cron.status === 401
        ? check(0, "cron-unauthorized", "passed")
        : check(0, "cron-unauthorized", "failed", `status ${cron.status}`),
    );
    const places = await http(
      fetchImpl,
      `${api}/api/places/venues?query=Lisbon`,
    );
    const placesError = record(places.data)?.error;
    if (envFlag(env, "FAROWAY_UAT_PLACES_LIVE")) {
      checks.push(
        places.status !== 501
          ? check(0, "places", "passed", "live places enabled")
          : check(0, "places", "failed", "expected live places, got 501"),
      );
    } else {
      checks.push(
        places.status === 501 &&
          typeof placesError === "string" &&
          placesError.toLowerCase().includes("not available")
          ? check(0, "places", "passed", "disabled state is explicit")
          : check(0, "places", "failed", `status ${places.status}`),
      );
    }
    const weather = await http(
      fetchImpl,
      `${api}/api/weather?destinationId=lisbon&start=2026-12-07&end=2026-12-09`,
    );
    const weatherStatus = record(weather.data)?.status;
    checks.push(
      envFlag(env, "FAROWAY_UAT_MET_ENABLED")
        ? weatherStatus !== "disabled"
          ? check(0, "weather", "passed", String(weatherStatus))
          : check(0, "weather", "failed", "expected MET to be enabled")
        : weatherStatus === "disabled"
          ? check(0, "weather", "passed", "disabled")
          : check(0, "weather", "failed", `status ${String(weatherStatus)}`),
    );
  }
  checks.push(...localContracts(repoRoot));
  checks.push(...(await imageAndTile(options, fetchImpl, supabaseUrl)));
  checks.push(...(await accountFlow(options, fetchImpl, apiUrl, supabaseUrl)));
  if (!options.rateLimitProbe) {
    checks.push(
      check(
        0,
        "rate-limit-probe",
        "skipped",
        "set --rate-limit to send invalid search bodies until 429; this writes rate-limit buckets",
      ),
    );
  } else if (apiUrl && options.accounts?.[0] && options.target.anonKey) {
    checks.push(await rateLimitProbe(options, fetchImpl, apiUrl, supabaseUrl));
  } else {
    checks.push(
      check(
        0,
        "rate-limit-probe",
        "blocked",
        "needs API, anon key and an account",
      ),
    );
  }
  return checks;
}

function localContracts(repoRoot: string): CheckResult[] {
  const pause = sourceHas(repoRoot, "apps/web/lib/trips/planning-pause.ts", [
    "PLANNING_PAUSED",
    "status: 503",
    'Retry-After": "300"',
  ]);
  const limit = sourceHas(
    repoRoot,
    "apps/web/app/api/trips/[id]/generate/route.ts",
    ["status: 429", "Retry-After"],
  );
  return [
    pause
      ? check(0, "planning-paused-contract", "failed", pause)
      : check(0, "planning-paused-contract", "passed", "503 PLANNING_PAUSED"),
    limit
      ? check(0, "rate-limit-contract", "failed", limit)
      : check(0, "rate-limit-contract", "passed", "generate route returns 429"),
  ];
}

async function imageAndTile(
  options: SmokeOptions,
  fetchImpl: typeof fetch,
  supabaseUrl: string | undefined,
): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];
  const paths = options.imagePaths ?? [];
  const expected = options.expectedImageCount ?? 79;
  if (!supabaseUrl) {
    checks.push(
      check(0, "images", "blocked", "staging Supabase URL is required"),
    );
  } else if (paths.length !== expected) {
    checks.push(
      check(
        0,
        "images",
        "failed",
        `catalog has ${paths.length}, expected ${expected}`,
      ),
    );
  } else {
    let failed = 0;
    for (const path of paths) {
      const result = await http(
        fetchImpl,
        `${supabaseUrl}/storage/v1/object/public/images/${path}`,
        { method: "HEAD" },
      );
      if (result.status !== 200 || !result.contentType?.startsWith("image/"))
        failed += 1;
    }
    checks.push(
      failed === 0
        ? check(0, "images", "passed", `${paths.length} HEADs`)
        : check(0, "images", "failed", `${failed} image HEADs failed`),
    );
  }
  const tile = await http(
    fetchImpl,
    "https://tile.openstreetmap.org/0/0/0.png",
    {
      method: "HEAD",
    },
  );
  checks.push(
    tile.status === 200 && tile.contentType?.startsWith("image/")
      ? check(0, "osm-tile", "passed")
      : check(0, "osm-tile", "failed", `status ${tile.status}`),
  );
  return checks;
}

async function accountFlow(
  options: SmokeOptions,
  fetchImpl: typeof fetch,
  apiUrl: string | undefined,
  supabaseUrl: string | undefined,
): Promise<CheckResult[]> {
  const names = [
    "sign-in",
    "consent-409",
    "create-idempotent",
    "cross-account",
    "edit-409",
    "share-revoke",
    "cleanup",
  ];
  if (!apiUrl || !supabaseUrl || !options.target.anonKey) {
    return names.map((name) =>
      check(
        0,
        name,
        "blocked",
        "API URL, staging URL and anon key are required",
      ),
    );
  }
  const accounts = options.accounts ?? [];
  if (
    accounts.length < 2 ||
    accounts.some((account) => !account.email.endsWith("@faroway-test.invalid"))
  ) {
    return names.map((name) =>
      check(
        0,
        name,
        "blocked",
        "two @faroway-test.invalid accounts are required",
      ),
    );
  }
  const checks: CheckResult[] = [];
  let created: string | undefined;
  let owner = "";
  try {
    const tokens = [];
    for (const account of accounts.slice(0, 2)) {
      tokens.push(
        await signIn(fetchImpl, supabaseUrl, options.target.anonKey, account),
      );
    }
    owner = tokens[0];
    checks.push(check(0, "sign-in", "passed"));
    const consent = await http(
      fetchImpl,
      `${apiUrl}/api/trips/uat-consent-probe/generate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${owner}`,
          "Content-Type": "application/json",
        },
      },
    );
    const code = record(consent.data)?.code;
    checks.push(
      consent.status === 409 && code === "ai_consent_required"
        ? check(0, "consent-409", "passed")
        : check(0, "consent-409", "failed", `status ${consent.status}`),
    );
    const input = {
      requestId: crypto.randomUUID(),
      destination: "QA- automated UAT",
      start_date: "2026-12-07",
      end_date: "2026-12-09",
      travelers: 2,
      preferences: {
        travelerType: "friends",
        adults: 2,
        children: 0,
        interests: ["culture", "food"],
        budget: "moderate",
      },
    };
    const headers = {
      Authorization: `Bearer ${owner}`,
      "Content-Type": "application/json",
      "x-faroway-ai-disclosure": "planning-google-v1",
    };
    const create = await http(fetchImpl, `${apiUrl}/api/trips`, {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    });
    created = record(record(create.data)?.trip)?.id as string | undefined;
    const replay = await http(fetchImpl, `${apiUrl}/api/trips`, {
      method: "POST",
      headers,
      body: JSON.stringify(input),
    });
    const replayId = record(record(replay.data)?.trip)?.id;
    checks.push(
      create.status === 201 && created && replayId === created
        ? check(0, "create-idempotent", "passed")
        : check(0, "create-idempotent", "failed", `status ${create.status}`),
    );
    if (!created) return checks;
    const route = `${apiUrl}/api/trips/${created}`;
    const other = {
      Authorization: `Bearer ${tokens[1]}`,
      "Content-Type": "application/json",
      "x-faroway-ai-disclosure": "planning-google-v1",
    };
    const denied = await Promise.all(
      (["GET", "PATCH", "DELETE"] as const).map((method) =>
        http(fetchImpl, route, {
          method,
          headers: other,
          body:
            method === "PATCH"
              ? JSON.stringify({
                  expectedUpdatedAt: record(record(create.data)?.trip)
                    ?.updated_at,
                  travelers: 3,
                })
              : undefined,
        }),
      ),
    );
    const rls = await http(
      fetchImpl,
      `${supabaseUrl}/rest/v1/trips?id=eq.${created}&select=id`,
      {
        headers: {
          apikey: options.target.anonKey,
          Authorization: `Bearer ${tokens[1]}`,
        },
      },
    );
    checks.push(
      denied.every((item) => item.status === 404) &&
        rls.status === 200 &&
        Array.isArray(rls.data) &&
        rls.data.length === 0
        ? check(0, "cross-account", "passed")
        : check(0, "cross-account", "failed"),
    );
    const current = await http(fetchImpl, route, { headers });
    const updatedAt = record(record(current.data)?.trip)?.updated_at;
    const editBody = JSON.stringify({
      expectedUpdatedAt: updatedAt,
      budget_tier: "budget",
    });
    const edit = await http(fetchImpl, route, {
      method: "PATCH",
      headers,
      body: editBody,
    });
    const conflict = await http(fetchImpl, route, {
      method: "PATCH",
      headers,
      body: editBody,
    });
    checks.push(
      edit.status === 200 && conflict.status === 409
        ? check(0, "edit-409", "passed")
        : check(0, "edit-409", "failed", `${edit.status}/${conflict.status}`),
    );
    const share = await http(fetchImpl, `${route}/share`, {
      method: "POST",
      headers,
      body: JSON.stringify({ publicConsent: true }),
    });
    const shareUrl = record(share.data)?.shareUrl;
    const shared =
      typeof shareUrl === "string"
        ? await http(fetchImpl, shareUrl)
        : { status: 0, data: null, contentType: null };
    const revoked = await http(fetchImpl, `${route}/share`, {
      method: "DELETE",
      headers,
    });
    const hidden =
      typeof shareUrl === "string"
        ? await http(fetchImpl, shareUrl)
        : { status: 0, data: null, contentType: null };
    checks.push(
      share.status === 200 &&
        typeof shareUrl === "string" &&
        new URL(shareUrl).origin === apiUrl &&
        shared.status === 200 &&
        revoked.status === 200 &&
        hidden.status === 404
        ? check(0, "share-revoke", "passed")
        : check(0, "share-revoke", "failed", `status ${share.status}`),
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    for (const name of names) {
      if (!checks.some((item) => item.name === name)) {
        checks.push(check(0, name, "failed", detail));
      }
    }
  } finally {
    if (created && apiUrl && owner) {
      const removal = await http(fetchImpl, `${apiUrl}/api/trips/${created}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${owner}`,
          "Content-Type": "application/json",
          "x-faroway-ai-disclosure": "planning-google-v1",
        },
      });
      checks.push(
        removal.status === 200
          ? check(0, "cleanup", "passed")
          : check(0, "cleanup", "failed", `status ${removal.status}`),
      );
    }
  }
  return checks;
}

async function rateLimitProbe(
  options: SmokeOptions,
  fetchImpl: typeof fetch,
  apiUrl: string,
  supabaseUrl: string | undefined,
): Promise<CheckResult> {
  if (!supabaseUrl || !options.target.anonKey || !options.accounts?.[0]) {
    return check(0, "rate-limit-probe", "blocked", "missing credentials");
  }
  const token = await signIn(
    fetchImpl,
    supabaseUrl,
    options.target.anonKey,
    options.accounts[0],
  );
  let saw429 = false;
  for (let attempt = 0; attempt < 8 && !saw429; attempt += 1) {
    const response = await http(fetchImpl, `${apiUrl}/api/search/start`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "x-faroway-ai-disclosure": "planning-google-v1",
      },
      body: "{}",
    });
    if (response.status === 429) saw429 = true;
  }
  return saw429
    ? check(0, "rate-limit-probe", "passed", "429 from invalid search bodies")
    : check(
        0,
        "rate-limit-probe",
        "failed",
        "no 429 within 8 invalid requests",
      );
}

async function runTier1(
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
): Promise<CheckResult[]> {
  return [
    await liteApiHotels(env, fetchImpl),
    await liteApiFlights(env, fetchImpl),
    await viatorSandbox(env, fetchImpl),
    await duffelTest(env, fetchImpl),
    await optionalLiveRead(
      env,
      fetchImpl,
      "tavily",
      "FAROWAY_UAT_TAVILY",
      "TAVILY_API_KEY",
    ),
    await optionalLiveRead(
      env,
      fetchImpl,
      "tripadvisor",
      "FAROWAY_UAT_TRIPADVISOR",
      "TRIPADVISOR_API_KEY",
    ),
    check(1, "getyourguide", "skipped", "no sandbox; left manual"),
  ];
}

function sandboxKey(env: Record<string, string | undefined>): string | null {
  const key = env.LITEAPI_API_KEY?.trim() || "";
  return /^sand_[A-Za-z0-9_-]+$/.test(key) ? key : null;
}

async function liteApiHotels(
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
): Promise<CheckResult> {
  if (env.LITEAPI_SANDBOX_ENABLED !== "true" || !sandboxKey(env)) {
    return check(
      1,
      "liteapi-hotels-sandbox",
      "blocked",
      "needs LITEAPI_SANDBOX_ENABLED and a sand_ key",
    );
  }
  const result = await http(
    fetchImpl,
    "https://api.liteapi.travel/v3.0/hotels/rates",
    {
      method: "POST",
      headers: {
        "X-API-Key": sandboxKey(env)!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cityName: "Lisbon",
        countryCode: "PT",
        checkin: "2026-12-07",
        checkout: "2026-12-09",
        guestNationality: "US",
        currency: "USD",
        occupancies: [{ adults: 2, children: [] }],
        sandbox: true,
      }),
    },
  );
  return record(result.data)?.sandbox === true
    ? check(1, "liteapi-hotels-sandbox", "passed")
    : check(1, "liteapi-hotels-sandbox", "failed", `status ${result.status}`);
}

async function liteApiFlights(
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
): Promise<CheckResult> {
  if (env.LITEAPI_FLIGHTS_SANDBOX_ENABLED !== "true" || !sandboxKey(env)) {
    return check(
      1,
      "liteapi-flights-sandbox",
      "blocked",
      "needs LITEAPI_FLIGHTS_SANDBOX_ENABLED and a sand_ key",
    );
  }
  const result = await http(
    fetchImpl,
    "https://api.liteapi.travel/v3.0/flights/rates",
    {
      method: "POST",
      headers: {
        "X-API-Key": sandboxKey(env)!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        origin: "LIS",
        destination: "OPO",
        departureDate: "2026-12-07",
        adults: 1,
        currency: "USD",
      }),
    },
  );
  return record(result.data)?.sandbox === true
    ? check(1, "liteapi-flights-sandbox", "passed")
    : check(1, "liteapi-flights-sandbox", "failed", `status ${result.status}`);
}

async function viatorSandbox(
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
): Promise<CheckResult> {
  if (env.VIATOR_SANDBOX !== "true" || !env.VIATOR_API_KEY) {
    return check(
      1,
      "viator-sandbox",
      "blocked",
      "needs VIATOR_SANDBOX=true and VIATOR_API_KEY",
    );
  }
  const url = "https://api.sandbox.viator.com/partner/products/search";
  const result = await http(fetchImpl, url, {
    method: "POST",
    headers: {
      Accept: "application/json;version=2.0",
      "Content-Type": "application/json",
      "exp-api-key": env.VIATOR_API_KEY,
    },
    body: JSON.stringify({
      filtering: { destination: "538" },
      pagination: { start: 1, count: 1 },
      currency: "USD",
    }),
  });
  if (!url.startsWith("https://api.sandbox.viator.com/")) {
    return check(
      1,
      "viator-sandbox",
      "failed",
      "refusing non-sandbox Viator host",
    );
  }
  if (result.status !== 200) {
    return check(1, "viator-sandbox", "failed", `status ${result.status}`);
  }
  const products = record(result.data)?.products;
  const productUrl = Array.isArray(products)
    ? record(products[0])?.productUrl
    : undefined;
  const handoff =
    typeof productUrl === "string"
      ? buildViatorHandoffUrl(productUrl, "uat-sandbox", env.VIATOR_PARTNER_ID)
      : null;
  return check(
    1,
    "viator-sandbox",
    "passed",
    handoff
      ? "sandbox search and hosted handoff URL; no purchase"
      : "sandbox search; no purchase",
  );
}

async function duffelTest(
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
): Promise<CheckResult> {
  const token = env.DUFFEL_API_TOKEN?.trim() || "";
  if (!token.startsWith("duffel_test_")) {
    return check(
      1,
      "duffel-test",
      "blocked",
      "needs a duffel_test_ token; live tokens are refused",
    );
  }
  const offers = await http(
    fetchImpl,
    "https://api.duffel.com/air/offer_requests?return_offers=true",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Duffel-Version": "v2",
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        data: {
          slices: [
            {
              origin: "LIS",
              destination: "OPO",
              departure_date: "2026-12-07",
            },
          ],
          passengers: [{ type: "adult" }],
          cabin_class: "economy",
        },
      }),
    },
  );
  const offerId = record(
    (record(record(offers.data)?.data)?.offers as unknown[] | undefined)?.[0],
  )?.id;
  if (offers.status !== 200 && offers.status !== 201) {
    return check(1, "duffel-test", "failed", `offer status ${offers.status}`);
  }
  if (typeof offerId !== "string") {
    return check(
      1,
      "duffel-test",
      "passed",
      "test offer search returned no offer; no order created",
    );
  }
  const link = await http(fetchImpl, "https://api.duffel.com/links/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Duffel-Version": "v2",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: {
        reference: offerId,
        flights: { enabled: "true" },
        stays: { enabled: "false" },
      },
    }),
  });
  return link.status === 200 || link.status === 201
    ? check(
        1,
        "duffel-test",
        "passed",
        "test offer and links session; no order",
      )
    : check(1, "duffel-test", "failed", `links status ${link.status}`);
}

async function optionalLiveRead(
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch,
  name: "tavily" | "tripadvisor",
  flag: string,
  keyName: string,
): Promise<CheckResult> {
  if (!envFlag(env, flag)) {
    return check(1, name, "skipped", `live quota; set ${flag}=1`);
  }
  const key = env[keyName];
  if (!key) return check(1, name, "blocked", `${keyName} is required`);
  if (name === "tavily") {
    const result = await http(fetchImpl, "https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query: "Lisbon time zone",
        search_depth: "basic",
        max_results: 1,
      }),
    });
    return result.status === 200
      ? check(1, name, "passed", "one basic search")
      : check(1, name, "failed", `status ${result.status}`);
  }
  const url = new URL(
    "https://api.content.tripadvisor.com/api/v1/location/search",
  );
  url.searchParams.set("searchQuery", "Lisbon");
  url.searchParams.set("category", "attractions");
  url.searchParams.set("language", "en");
  url.searchParams.set("key", key);
  const result = await http(fetchImpl, url.toString(), {
    headers: { Accept: "application/json" },
  });
  return result.status === 200
    ? check(1, name, "passed", "one location search")
    : check(1, name, "failed", `status ${result.status}`);
}

async function runTier2(
  options: SmokeOptions,
  fetchImpl: typeof fetch,
  apiUrl: string | undefined,
  supabaseUrl: string | undefined,
): Promise<CheckResult[]> {
  const briefs = selectedBriefs(options.briefIds);
  if (!options.liveAi) {
    return [
      check(
        2,
        "live-plan",
        "failed",
        "tier 2 spends AI budget; pass --live to dispatch",
      ),
    ];
  }
  if (
    !apiUrl ||
    !supabaseUrl ||
    !options.target.anonKey ||
    !options.accounts?.[0]
  ) {
    return briefs.map((brief) =>
      check(
        2,
        `live-plan:${brief.id}`,
        "blocked",
        "needs API, anon key and a QA account",
      ),
    );
  }
  const checks: CheckResult[] = [];
  const token = await signIn(
    fetchImpl,
    supabaseUrl,
    options.target.anonKey,
    options.accounts[0],
  );
  for (const brief of briefs) {
    checks.push(
      await liveBrief(
        fetchImpl,
        apiUrl,
        token,
        brief,
        options.pollIntervalMs ?? 5_000,
      ),
    );
  }
  return checks;
}

async function liveBrief(
  fetchImpl: typeof fetch,
  apiUrl: string,
  token: string,
  brief: UatBrief,
  pollIntervalMs: number,
): Promise<CheckResult> {
  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "x-faroway-ai-disclosure": "planning-google-v1",
  };
  const created = await http(fetchImpl, `${apiUrl}/api/trips`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      requestId: crypto.randomUUID(),
      destination: brief.destination,
      start_date: brief.startDate,
      end_date: brief.endDate,
      travelers: brief.travelers,
      preferences: {
        travelerType: brief.travelerType,
        adults: brief.adults,
        children: brief.children,
        interests: brief.interests,
        budget: brief.budget,
        vibes: brief.vibes,
        dietaryRestrictions: brief.dietaryRestrictions,
        mobilityNeeds: brief.mobilityNeeds,
        requirements: brief.requirements,
      },
    }),
  });
  const tripId = record(record(created.data)?.trip)?.id;
  if (created.status !== 201 || typeof tripId !== "string") {
    return check(
      2,
      `live-plan:${brief.id}`,
      "failed",
      `create ${created.status}`,
    );
  }
  const route = `${apiUrl}/api/trips/${tripId}`;
  try {
    const dispatch = await http(fetchImpl, `${route}/generate`, {
      method: "POST",
      headers,
    });
    if (dispatch.status !== 200) {
      return check(
        2,
        `live-plan:${brief.id}`,
        "failed",
        `dispatch ${dispatch.status}`,
      );
    }
    let finished = false;
    for (let attempt = 0; attempt < 120 && !finished; attempt += 1) {
      if (pollIntervalMs > 0) {
        await new Promise((resolveWait) =>
          setTimeout(resolveWait, pollIntervalMs),
        );
      }
      const progress = await http(fetchImpl, `${route}/generate`, { headers });
      const status = record(progress.data)?.status;
      if (status === "completed") finished = true;
      if (status === "failed" || status === "error") {
        return check(
          2,
          `live-plan:${brief.id}`,
          "failed",
          `planning ${String(status)}`,
        );
      }
    }
    if (!finished)
      return check(2, `live-plan:${brief.id}`, "failed", "timed out");
    const saved = await http(fetchImpl, route, { headers });
    const quality = evaluateSavedPlan(saved.data, brief);
    for (const url of quality.reservationUrls) {
      const head = await http(fetchImpl, url, { method: "HEAD" });
      if (head.status < 200 || head.status >= 400) {
        quality.failures.push(
          `reservation URL did not resolve (${head.status})`,
        );
      }
    }
    return quality.failures.length
      ? check(2, `live-plan:${brief.id}`, "failed", quality.failures.join("; "))
      : check(2, `live-plan:${brief.id}`, "passed", quality.notes.join("; "));
  } finally {
    await http(fetchImpl, route, { method: "DELETE", headers });
  }
}
