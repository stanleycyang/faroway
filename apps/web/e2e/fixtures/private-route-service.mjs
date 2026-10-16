// Loopback-only synthetic Supabase protocol fixture. No upstream forwarding.
// Mutations are opt-in and affect only memory or the verified disposable SQL fixture.
import { createServer } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { createPrivateSqlStore } from "./private-route-sql.mjs";
import { createPrivateCreationStore } from "./private-creation-sql.mjs";

const allowCreationQa = process.env.PRIVATE_ROUTE_CREATION_QA === "true";
if (
  allowCreationQa &&
  ["SQL", "GENERATION", "NATIVE", "LIST"].some(
    (mode) => process.env[`PRIVATE_ROUTE_${mode}_QA`] === "true",
  )
)
  throw new Error("Creation SQL QA must run as a separate fixture mode");
const creationStore = allowCreationQa ? createPrivateCreationStore() : null;

if (
  process.env.PRIVATE_ROUTE_GENERATION_QA === "true" &&
  process.env.PRIVATE_ROUTE_SQL_QA === "true"
)
  throw new Error(
    "Synthetic generation and SQL mutation modes must run separately",
  );

export const owner = "11111111-1111-4111-8111-111111111111";
const brokenOwner = "22222222-2222-4222-8222-222222222222";
const tripId = "33333333-3333-4333-8333-333333333333";
const user = (id) => ({
  id,
  aud: "authenticated",
  role: "authenticated",
  email: "qa@example.invalid",
  app_metadata: { provider: "email" },
  user_metadata: {},
  created_at: "2026-01-01T00:00:00Z",
});
const days = [1, 2].map((dayNumber) => ({
  dayNumber,
  date: `2099-06-0${dayNumber}`,
  title: dayNumber === 1 ? "A first taste of Paris" : "Art and the Left Bank",
  summary: "An unhurried day with room to explore.",
  morning: {
    activities:
      process.env.PRIVATE_ROUTE_SQL_QA === "true"
        ? [
            {
              id: `synthetic-activity-${dayNumber}`,
              name: dayNumber === 1 ? "Museum" : "Gallery",
              description:
                "A synthetic activity for isolated interaction checks.",
              duration: 60,
              estimatedCost: { amount: 0, status: "unknown", currency: "EUR" },
              timeOfDay: "morning",
              category: "cultural",
              location: { name: "Paris" },
            },
          ]
        : [],
    meals: [],
  },
  afternoon: { activities: [], meals: [] },
  evening: { activities: [], meals: [] },
  tips: [],
}));
const trip = {
  id: tripId,
  user_id: owner,
  destination: "Paris",
  start_date: "2099-06-01",
  end_date: "2099-06-02",
  travelers: 2,
  budget_tier: "moderate",
  status: "planned",
  preferences: {},
  vibes: [],
  interests: [],
  is_shared: false,
  share_token: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  itineraries: [
    {
      days,
      overview: "Two days of neighborhood discoveries.",
      total_cost: null,
      packing_list: [],
      general_tips: [],
      generated_at: "2026-01-02T00:00:00Z",
    },
  ],
};
const requests = [];
const initialTrip = structuredClone(trip);
const sqlStore =
  process.env.PRIVATE_ROUTE_SQL_QA === "true"
    ? createPrivateSqlStore(initialTrip)
    : null;
const allowSharingMutations = process.env.PRIVATE_ROUTE_MUTATIONS_QA === "true";
const allowNativeQa = process.env.PRIVATE_ROUTE_NATIVE_QA === "true";
const allowListQa = process.env.PRIVATE_ROUTE_LIST_QA === "true";
const allowGenerationQa = process.env.PRIVATE_ROUTE_GENERATION_QA === "true";
const searchId = "44444444-4444-4444-8444-444444444444";
const syntheticHotel = {
  id: "qa-stream-hotel",
  name: "A stay in Saint-Germain",
  description: "A synthetic neighborhood base for streaming checks.",
  images: [],
  amenities: ["Central location"],
  location: { name: "Saint-Germain", address: "Paris", lat: 48.85, lng: 2.33 },
  vibeScore: 90,
  vibeMatch: ["culture"],
};
let generationPhase = "idle";
let failGenerationRead = false;
function syntheticSearch() {
  const hasHotels = ["hotels", "itinerary", "complete"].includes(
    generationPhase,
  );
  const hasDays = ["itinerary", "complete"].includes(generationPhase);
  return {
    id: searchId,
    user_id: owner,
    status: generationPhase === "complete" ? "completed" : "running",
    workflow_run_verified: false,
    progress: {
      orchestrator: "done",
      hotels: hasHotels ? "done" : "searching",
      ...(hasDays ? { aggregator: "done" } : {}),
    },
    intermediate_results: {
      ...(hasHotels
        ? { hotels: [syntheticHotel], topHotel: syntheticHotel }
        : {}),
      ...(hasDays ? { days } : {}),
    },
    json_render_spec: null,
    error_message: null,
  };
}
let failNativeProfileRead = false;
let failNativeLogout = false;
const nativeProfile = {
  id: owner,
  email: "qa@example.invalid",
  display_name: "Saved QA traveler",
  avatar_url: null,
  auth_provider: "email",
  subscription_tier: "free",
  preferences: {
    vibes: ["culture"],
    budget: "moderate",
    travelerType: "family",
  },
  notification_settings: {
    trip_reminders: false,
    deals: false,
    itinerary_updates: false,
    app_updates: false,
  },
  notification_consent_version: null,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
};
function tokenOwner(auth) {
  try {
    return JSON.parse(
      Buffer.from(auth.split(" ")[1].split(".")[1], "base64url").toString(),
    ).sub;
  } catch {
    return null;
  }
}
const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost:4017");
  const send = (status, data, extraHeaders = {}) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "http://localhost:3124",
      "Access-Control-Allow-Headers":
        "authorization,apikey,content-type,x-client-info,x-supabase-api-version",
      "Access-Control-Allow-Methods": allowSharingMutations
        ? "GET,PATCH,POST,OPTIONS"
        : "GET,OPTIONS",
      ...extraHeaders,
    });
    res.end(JSON.stringify(data));
  };
  if (req.method === "OPTIONS") return send(204, null);
  if (
    creationStore &&
    url.pathname === "/rest/v1/blog_posts" &&
    req.method === "GET"
  )
    return send(200, []);
  if (
    creationStore &&
    url.pathname === "/__qa/creation/reset" &&
    req.method === "POST"
  ) {
    try {
      creationStore.reset();
    } catch {
      return send(503, { error: "Disposable creation reset unavailable" });
    }
    return send(200, { reset: true, disposableFullSchema: true });
  }
  if (
    creationStore &&
    url.pathname === "/rest/v1/trips" &&
    req.method === "GET"
  ) {
    if (url.searchParams.get("user_id") !== `eq.${owner}`)
      return send(403, { error: "Creation fixture owner filter required" });
    const idFilter = url.searchParams.get("id");
    const row = creationStore.read(idFilter?.replace(/^eq\./, ""));
    if (idFilter && !row) return send(406, { code: "PGRST116" });
    const select = url.searchParams.get("select") || "*";
    const project = (tripRow) =>
      select.includes("*")
        ? tripRow
        : Object.fromEntries(
            select
              .replace(/itineraries\([^)]*\)/g, "itineraries")
              .split(",")
              .map((column) => [column.trim(), tripRow[column.trim()]]),
          );
    requests.push({
      method: req.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
    });
    return send(200, Array.isArray(row) ? row.map(project) : project(row));
  }
  if (
    creationStore &&
    url.pathname.startsWith("/rest/v1/rpc/") &&
    req.method === "POST"
  ) {
    let raw = "";
    for await (const chunk of req) {
      raw += chunk.toString();
      if (raw.length > 16384)
        return send(413, { error: "Fixture body too large" });
    }
    try {
      const result = creationStore.rpc(
        url.pathname.split("/").pop(),
        JSON.parse(raw),
      );
      requests.push({ method: req.method, path: url.pathname, query: {} });
      return send(200, result);
    } catch {
      return send(503, { error: "Disposable creation RPC unavailable" });
    }
  }
  if (
    process.env.PRIVATE_ROUTE_AUTH_DELAY_QA === "true" &&
    req.method === "POST" &&
    url.pathname === "/auth/v1/token" &&
    url.searchParams.get("grant_type") === "pkce"
  ) {
    let raw = "";
    for await (const chunk of req) {
      raw += chunk.toString();
      if (raw.length > 4096)
        return send(413, { error: "Fixture body too large" });
    }
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return send(400, { error: "Invalid synthetic exchange" });
    }
    if (
      body?.auth_code !== "qa-stalled-code" ||
      body?.code_verifier !== "qa-synthetic-verifier"
    )
      return send(400, { error: "Unsupported synthetic exchange" });
    requests.push({
      method: req.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
    });
    await delay(25_000);
    return send(400, {
      error: "invalid_grant",
      error_description: "Synthetic delayed exchange rejected",
    });
  }

  if (
    allowGenerationQa &&
    req.method === "POST" &&
    /^\/__qa\/generation\/read-(fail|recover)$/.test(url.pathname)
  ) {
    failGenerationRead = url.pathname.endsWith("read-fail");
    return send(200, { synthetic: true, failGenerationRead });
  }
  if (
    allowGenerationQa &&
    req.method === "POST" &&
    /^\/__qa\/generation\/(begin|hotels|itinerary|complete)$/.test(url.pathname)
  ) {
    generationPhase = url.pathname.split("/").pop();
    failGenerationRead = false;
    Object.assign(trip, structuredClone(initialTrip), {
      status: generationPhase === "complete" ? "planned" : "generating",
      search_id: searchId,
      itineraries:
        generationPhase === "complete" ? initialTrip.itineraries : [],
    });
    return send(200, { synthetic: true, generationPhase });
  }
  if (
    allowNativeQa &&
    req.method === "POST" &&
    /^\/__qa\/logout\/(fail|recover)$/.test(url.pathname)
  ) {
    failNativeLogout = url.pathname.endsWith("/fail");
    return send(200, { synthetic: true, failNativeLogout });
  }
  if (
    allowNativeQa &&
    req.method === "POST" &&
    ["/__qa/profile-read/fail", "/__qa/profile-read/recover"].includes(
      url.pathname,
    )
  ) {
    failNativeProfileRead = url.pathname.endsWith("/fail");
    return send(200, { synthetic: true, failNativeProfileRead });
  }
  if (
    allowNativeQa &&
    req.method === "POST" &&
    url.pathname === "/auth/v1/logout"
  ) {
    requests.push({
      method: req.method,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
    });
    return failNativeLogout
      ? send(503, { message: "Synthetic sign-out temporarily unavailable" })
      : send(204, null);
  }
  if (
    req.method === "POST" &&
    url.pathname === "/__qa/reset" &&
    allowSharingMutations
  ) {
    if (sqlStore) sqlStore.reset();
    Object.assign(trip, structuredClone(initialTrip));
    return send(200, { reset: true, inMemoryOnly: !sqlStore });
  }
  if (
    req.method !== "GET" &&
    !(
      req.method === "PATCH" &&
      url.pathname === "/rest/v1/trips" &&
      allowSharingMutations
    ) &&
    !(
      allowNativeQa &&
      req.method === "PATCH" &&
      url.pathname === "/rest/v1/users"
    ) &&
    !(
      req.method === "POST" &&
      sqlStore &&
      allowSharingMutations &&
      url.pathname.startsWith("/rest/v1/rpc/")
    )
  )
    return send(405, { error: "Mutation unsupported by local QA fixture" });
  if (url.pathname === "/__qa/requests") return send(200, requests);
  requests.push({
    method: req.method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
  });
  if (url.pathname === "/health")
    return send(200, { status: "ok", fixture: true });
  if (allowGenerationQa && url.pathname === "/rest/v1/searches") {
    if (
      url.searchParams.get("id") !== `eq.${searchId}` ||
      url.searchParams.get("user_id") !== `eq.${owner}`
    )
      return send(403, { error: "Synthetic search owner filters required" });
    if (failGenerationRead)
      return send(503, { error: "Synthetic search temporarily unavailable" });
    return send(200, syntheticSearch());
  }
  if (allowNativeQa && url.pathname === "/rest/v1/users") {
    if (url.searchParams.get("id") !== `eq.${owner}`)
      return send(403, { error: "Synthetic profile owner filter required" });
    if (req.method === "GET" && failNativeProfileRead)
      return send(503, { error: "Synthetic saved profile unavailable" });
    if (req.method === "PATCH") {
      let raw = "";
      for await (const chunk of req) {
        raw += chunk.toString();
        if (raw.length > 8192)
          return send(413, { error: "Fixture body too large" });
      }
      let patch;
      try {
        patch = JSON.parse(raw);
      } catch {
        return send(400, { error: "Invalid JSON" });
      }
      if (
        !patch ||
        Array.isArray(patch) ||
        Object.keys(patch).some(
          (key) =>
            ![
              "display_name",
              "avatar_url",
              "email",
              "preferences",
              "notification_settings",
              "notification_consent_version",
            ].includes(key),
        )
      )
        return send(400, { error: "Unsupported synthetic profile patch" });
      Object.assign(nativeProfile, patch, {
        updated_at: new Date().toISOString(),
      });
    }
    return send(200, nativeProfile);
  }
  if (url.pathname === "/auth/v1/user") {
    const id = tokenOwner(req.headers.authorization || "");
    return [owner, brokenOwner].includes(id)
      ? send(200, user(id))
      : send(401, { message: "No synthetic account" });
  }
  if (
    url.pathname === "/rest/v1/affiliate_clicks" &&
    req.method === "GET" &&
    url.searchParams.get("user_id") === `eq.${owner}`
  )
    return send(200, []);
  if (
    sqlStore &&
    req.method === "GET" &&
    url.pathname === "/rest/v1/trip_plan_revisions"
  ) {
    if (
      url.searchParams.get("trip_id") !== `eq.${tripId}` ||
      url.searchParams.get("user_id") !== `eq.${owner}`
    )
      return send(403, { error: "Owner filters required" });
    return send(200, sqlStore.history());
  }
  if (
    sqlStore &&
    req.method === "POST" &&
    url.pathname.startsWith("/rest/v1/rpc/")
  ) {
    let raw = "";
    for await (const chunk of req) {
      raw += chunk.toString();
      if (raw.length > 100_000)
        return send(413, { error: "Fixture payload too large" });
    }
    try {
      return send(
        200,
        sqlStore.rpc(url.pathname.split("/").pop(), JSON.parse(raw)),
      );
    } catch {
      return send(503, { error: "Local fixture RPC unavailable" });
    }
  }
  if (url.pathname === "/rest/v1/trips") {
    if (sqlStore && !allowGenerationQa && req.method === "GET")
      Object.assign(trip, sqlStore.trip());
    if (req.method === "GET" && url.searchParams.has("share_token")) {
      const unreadable = [
        "eq.qa_unreadable_days_token",
        "eq.qa_unreadable_tips_token",
      ].includes(url.searchParams.get("share_token"));
      if (process.env.PRIVATE_ROUTE_DELAY_QA === "true") await delay(3000);
      if (url.searchParams.get("share_token") === "eq.qa_read_failure_token")
        return send(503, {
          code: "QA_READ_FAILURE",
          message: "Synthetic shared read unavailable",
        });
      if (
        !unreadable &&
        (!trip.is_shared ||
          url.searchParams.get("is_shared") !== "eq.true" ||
          url.searchParams.get("share_token") !== `eq.${trip.share_token}`)
      )
        return send(406, { code: "PGRST116", message: "No active public row" });
      const {
        destination,
        start_date,
        end_date,
        travelers,
        preferences,
        vibes,
        budget_tier,
        itineraries,
      } = trip;
      return send(200, {
        destination,
        start_date,
        end_date,
        travelers,
        preferences,
        vibes,
        budget_tier,
        itineraries: unreadable
          ? [
              {
                ...itineraries[0],
                ...(url.searchParams.get("share_token") ===
                "eq.qa_unreadable_days_token"
                  ? { days: {} }
                  : { general_tips: { length: 1 } }),
              },
            ]
          : itineraries,
      });
    }
    const scopedOwner = url.searchParams.get("user_id");
    if (
      scopedOwner === `eq.${brokenOwner}` ||
      url.searchParams.get("id") === "eq.read-error"
    )
      return send(503, {
        code: "QA_READ_FAILURE",
        message: "Synthetic read unavailable",
      });
    if (scopedOwner !== `eq.${owner}`)
      return send(403, { message: "Owner filter required by fixture" });
    const id = url.searchParams.get("id");
    if (id && id !== `eq.${tripId}`)
      return send(406, { code: "PGRST116", message: "No matching row" });
    if (req.method === "PATCH") {
      if (
        id !== `eq.${tripId}` ||
        (url.searchParams.has("is_shared") &&
          url.searchParams.get("is_shared") !== `eq.${trip.is_shared}`) ||
        (url.searchParams.has("updated_at") &&
          url.searchParams.get("updated_at") !== `eq.${trip.updated_at}`)
      )
        return send(409, { code: "QA_REVISION_CONFLICT" });
      let raw = "";
      for await (const chunk of req) {
        raw += chunk.toString();
        if (raw.length > 4096)
          return send(413, { error: "Fixture body too large" });
      }
      let patch;
      try {
        patch = JSON.parse(raw);
      } catch {
        return send(400, { error: "Malformed fixture patch" });
      }
      if (
        !patch ||
        Array.isArray(patch) ||
        Object.keys(patch).some(
          (key) =>
            !["is_shared", "share_token", "shared_at", "updated_at"].includes(
              key,
            ),
        ) ||
        typeof patch.is_shared !== "boolean" ||
        !(
          patch.share_token === null || typeof patch.share_token === "string"
        ) ||
        !(patch.shared_at === null || typeof patch.shared_at === "string") ||
        typeof patch.updated_at !== "string"
      )
        return send(400, { error: "Unsupported fixture patch" });
      if (sqlStore) sqlStore.patch(patch);
      Object.assign(trip, patch);
      return send(
        200,
        url.searchParams.has("select") ? { id: trip.id } : null,
        { "Content-Range": "0-0/1" },
      );
    }
    if (!id && allowListQa) {
      const before = url.searchParams
        .get("or")
        ?.match(/id\.lt\.([0-9a-f-]{36})/)?.[1];
      const limit = Number(url.searchParams.get("limit") || 1000);
      const rowCount =
        process.env.PRIVATE_ROUTE_LARGE_LIST_QA === "true" ? 1105 : 205;
      const rows = Array.from({ length: rowCount }, (_, index) => ({
        ...trip,
        id: `88888888-8888-4888-8888-${String(rowCount - index).padStart(12, "0")}`,
        itineraries: undefined,
      })).filter((row) => !before || row.id < before);
      return send(200, rows.slice(0, Math.max(0, Math.min(limit, 1000))));
    }
    return send(200, id ? trip : [trip]);
  }
  return send(404, { error: "Endpoint not implemented by read-only fixture" });
});
server.listen(4017, "127.0.0.1", () =>
  console.log("Private-route fixture ready at http://127.0.0.1:4017"),
);
