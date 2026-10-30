// Real staging Auth -> API -> RLS. Only --live dispatches one paid plan.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const profile = JSON.parse(readFileSync(resolve(root, "apps/mobile/eas.json")))
  .build.qa;
const api = profile.env.EXPO_PUBLIC_API_URL;
const auth = profile.env.EXPO_PUBLIC_SUPABASE_URL;
assert.equal(auth, "https://omovikloadpvzijoaqus.supabase.co");
assert.equal(
  api,
  "https://faroway-git-verify-staging-readiness-20261018-testimonio.vercel.app",
);
const anon = process.env.EXPO_PUBLIC_QA_SUPABASE_ANON_KEY;
assert.ok(anon, "Run with the EAS QA environment");
const payload = JSON.parse(Buffer.from(anon.split(".")[1], "base64url"));
assert.equal(payload.ref, "omovikloadpvzijoaqus");
assert.equal(payload.role, "anon");
const accounts = JSON.parse(
  readFileSync(resolve(homedir(), ".local/share/faroway-uat/accounts.json")),
);
assert.equal(accounts.length, 2, "Two dedicated QA accounts are required");
assert.ok(accounts.every((a) => a.email.endsWith("@faroway-test.invalid")));
const report = {
  startedAt: new Date().toISOString(),
  api,
  checks: [],
  live: process.argv.includes("--live"),
};
const output = resolve(root, "artifacts/uat");
mkdirSync(output, { recursive: true, mode: 0o700 });
function passed(name) {
  report.checks.push(name);
  console.log("PASS " + name);
}
async function request(route, method = "GET", token, body) {
  const response = await fetch(api + route, {
    method,
    redirect: "manual",
    signal: AbortSignal.timeout(60000),
    headers: {
      "Content-Type": "application/json",
      "x-faroway-ai-disclosure": "planning-google-v1",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  return { status: response.status, data };
}
let created;
let owner;
try {
  const health = await request("/api/health");
  assert.equal(health.status, 200);
  assert.equal(health.data.status, "ok");
  passed("Direct native API access");
  const tokens = [];
  for (const account of accounts) {
    const response = await fetch(auth + "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: anon, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: account.email,
        password: account.password,
      }),
    });
    assert.equal(response.status, 200, "Staging password authentication");
    tokens.push((await response.json()).access_token);
  }
  [owner] = tokens;
  passed("Two real staging sessions");
  assert.equal((await request("/api/trips")).status, 401);
  passed("Guest rejection");
  const input = {
    requestId: randomUUID(),
    destination: report.live ? "Lisbon, Portugal" : "QA Harbor — automated UAT",
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
  if (process.argv.includes("--family")) {
    input.destination = "Copenhagen, Denmark";
    input.travelers = 3;
    input.preferences = {
      travelerType: "family",
      adults: 2,
      children: 1,
      interests: ["culture", "food"],
      budget: "moderate",
      requirements: {
        allergies: [],
        dietaryPreferences: ["vegetarian"],
        accessibility: ["step_free_entrance"],
        mobilityNotes:
          "Slow pace, short walks, frequent seated breaks; confirm accessibility before visiting.",
      },
    };
    report.scenario = "family-vegetarian-step-free";
  } else report.scenario = report.live ? "city-break" : "no-ai";
  const create = await request("/api/trips", "POST", owner, input);
  assert.equal(create.status, 201, JSON.stringify(create));
  created = create.data.trip.id;
  report.tripId = created;
  assert.equal(
    (await request("/api/trips", "POST", owner, input)).data.trip.id,
    created,
  );
  passed("Trip creation and idempotent replay");
  const route = `/api/trips/${created}`;
  for (const method of ["GET", "PATCH", "DELETE"]) {
    const body =
      method === "PATCH"
        ? { expectedUpdatedAt: create.data.trip.updated_at, travelers: 3 }
        : undefined;
    assert.equal(
      (await request(route, method, tokens[1], body)).status,
      404,
      method + " ownership",
    );
  }
  const rls = await fetch(`${auth}/rest/v1/trips?id=eq.${created}&select=id`, {
    headers: { apikey: anon, Authorization: `Bearer ${tokens[1]}` },
  });
  assert.equal(rls.status, 200);
  assert.deepEqual(await rls.json(), []);
  passed("Cross-account read/write/delete denial and direct database RLS");
  const current = (await request(route, "GET", owner)).data.trip;
  const edit = { expectedUpdatedAt: current.updated_at, budget_tier: "budget" };
  assert.equal((await request(route, "PATCH", owner, edit)).status, 200);
  assert.equal((await request(route, "PATCH", owner, edit)).status, 409);
  passed("Versioned editing and stale-writer conflict");
  if (report.live) {
    const dispatch = await request(route + "/generate", "POST", owner);
    assert.equal(dispatch.status, 200, JSON.stringify(dispatch));
    passed("One live planning dispatch accepted");
    let finished = false;
    for (let i = 0; i < 120; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5000));
      const progress = await request(route + "/generate", "GET", owner);
      console.log("Planning status: " + progress.data?.status);
      if (progress.data?.status === "completed") {
        finished = true;
        break;
      }
      assert.ok(
        !["failed", "error"].includes(progress.data?.status),
        "Live planning failed",
      );
    }
    assert.ok(finished, "Live planning must finish within ten minutes");
    const saved = await request(route, "GET", owner);
    assert.equal(saved.data.trip.status, "planned");
    report.plan = saved.data;
    const days = saved.data.itinerary?.days;
    assert.equal(days?.length, 3, "All requested calendar days are saved");
    assert.deepEqual(
      days.map((day) => day.date),
      ["2026-12-07", "2026-12-08", "2026-12-09"],
    );
    report.qualityReview =
      "Required: inspect the saved plan and runtime agent logs; pipeline completion alone does not establish model quality.";
    passed("Live plan completed and persisted");
  }
  const share = await request(route + "/share", "POST", owner, {
    publicConsent: true,
  });
  assert.equal(share.status, 200, JSON.stringify(share));
  const sharedUrl = new URL(share.data.shareUrl);
  assert.equal(sharedUrl.origin, api, "Share links remain in staging");
  assert.equal((await fetch(sharedUrl, { redirect: "manual" })).status, 200);
  assert.equal((await request(route + "/share", "DELETE", owner)).status, 200);
  assert.equal((await fetch(sharedUrl, { redirect: "manual" })).status, 404);
  passed("Public share, guest read and revocation");
  report.passed = true;
} catch (error) {
  report.passed = false;
  report.error = error.message;
  console.error(error.message);
  process.exitCode = 1;
} finally {
  // Keep a real generated plan for device review; remove only this probe's draft.
  if (created && !report.live) {
    const removal = await request(`/api/trips/${created}`, "DELETE", owner);
    report.cleanupStatus = removal.status;
    if (removal.status !== 200) process.exitCode = 1;
  }
  report.finishedAt = new Date().toISOString();
  const file = resolve(output, `api-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2), { mode: 0o600 });
  console.log("Evidence: " + file);
}
