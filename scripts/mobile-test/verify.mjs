// Real local Auth → application API → database smoke test, with no AI/provider keys.
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
const stack = path.join(tmpdir(), "faroway-mobile-test-stack");
const result = spawnSync(
  "bunx",
  ["supabase@2.76.15", "status", "--workdir", stack, "-o", "json"],
  { encoding: "utf8", env: { PATH: process.env.PATH, HOME: process.env.HOME } },
);
assert.equal(result.status, 0, "Dedicated local Supabase must be running");
const status = JSON.parse(result.stdout);
assert.equal(status.API_URL, "http://127.0.0.1:55421");
const accounts = JSON.parse(readFileSync(path.join(stack, "accounts.json")));
const tokens = [];
for (const account of accounts) {
  const client = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email: account.email,
    password: account.password,
  });
  assert.equal(error, null, "Real local email authentication");
  tokens.push(data.session.access_token);
}
const api = "http://127.0.0.1:3011";
async function request(route, method = "GET", token, body) {
  const response = await fetch(api + route, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-faroway-ai-disclosure": "planning-google-v1",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  return { response, data };
}
assert.equal((await request("/api/trips")).response.status, 401);
const { response, data } = await request("/api/trips", "POST", tokens[0], {
  destination: "QA Harbor — LOCAL TEST",
  start_date: "2099-06-01",
  end_date: "2099-06-03",
  travelers: 2,
  preferences: { travelerType: "friends" },
});
assert.ok(response.ok, JSON.stringify(data));
const trip = data.trip || data.data || data;
assert.ok(trip.id, "Created trip identity");
const foreign = await request(`/api/trips/${trip.id}`, "GET", tokens[1]);
assert.equal(
  foreign.response.status,
  404,
  "Other account cannot read private trip",
);
assert.equal(
  (await request(`/api/trips/${trip.id}/generate`, "POST")).response.status,
  401,
);
assert.equal(
  (await request(`/api/trips/${trip.id}/generate`, "POST", tokens[1])).response
    .status,
  404,
);
const generation = await request(
  `/api/trips/${trip.id}/generate`,
  "POST",
  tokens[0],
);
assert.ok(generation.response.ok, JSON.stringify(generation.data));
assert.equal(
  generation.data.testFixture,
  true,
  "Deterministic fixture path used",
);
const progress = await request(
  `/api/trips/${trip.id}/generate`,
  "GET",
  tokens[0],
);
assert.equal(progress.data.status, "completed", JSON.stringify(progress.data));
const saved = await request(`/api/trips/${trip.id}`, "GET", tokens[0]);
assert.equal(saved.data.trip.status, "planned");
assert.match(JSON.stringify(saved.data), /Synthetic neighborhood walk/);
// Direct Data API must also enforce ownership, independent of the server's checks.
const other = createClient(status.API_URL, status.ANON_KEY, {
  global: { headers: { Authorization: `Bearer ${tokens[1]}` } },
  auth: { persistSession: false, autoRefreshToken: false },
});
const foreignRows = await other.from("trips").select("id").eq("id", trip.id);
assert.equal(foreignRows.error, null);
assert.deepEqual(foreignRows.data, []);
console.log(
  "PASS real local email sessions, guest rejection, API ownership, database RLS, creation, fixture generation and saved itinerary",
);
console.log(`Seeded local trip for native review: ${trip.id}`);
