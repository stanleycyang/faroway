// Real PostgreSQL tests in a fresh Unix-socket-only cluster. Never accepts a
// database URL and never connects to an existing database or production host.
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const cluster = await mkdtemp(path.join(tmpdir(), "faroway-generation-test-"));
const bin = process.env.PG_TEST_BIN;
const executable = (name) =>
  name === "psql"
    ? process.env.PG_TEST_PSQL || "psql"
    : bin
      ? path.join(bin, name)
      : name;
const dataDir = path.join(cluster, "data");
const connection = [
  "-X",
  "-qAt",
  "-v",
  "ON_ERROR_STOP=1",
  "-h",
  cluster,
  "-p",
  "65432",
  "-U",
  "faroway_test",
  "-d",
  "postgres",
];
const sql = async (query) =>
  (
    await exec(executable("psql"), [...connection, "-c", query], {
      maxBuffer: 8 * 1024 * 1024,
    })
  ).stdout.trim();
const literal = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${literal(JSON.stringify(value))}::jsonb`;
let started = false;
let passed = 0;
async function test(name, run) {
  await run();
  passed++;
  console.log(`PASS ${name}`);
}

async function fixture(userId = randomUUID()) {
  const tripId = randomUUID();
  await sql(`INSERT INTO auth.users(id,email) VALUES('${userId}', '${userId}@example.test') ON CONFLICT (id) DO NOTHING;
    INSERT INTO public.trips(id,user_id,destination,start_date,end_date,travelers)
      VALUES('${tripId}','${userId}','Tokyo','2026-12-01','2026-12-03',2);`);
  const version = await sql(
    `SELECT updated_at FROM trips WHERE id='${tripId}'`,
  );
  return {
    userId,
    tripId,
    version,
    rateKey: createHash("sha256").update(userId).digest("hex"),
  };
}
const input = { travelerType: "couple", vibes: ["foodie"] };
function beginSQL(f, key = "request-1", body = input) {
  return `SELECT public.begin_trip_generation('${f.tripId}','${f.userId}',${literal(key)},${json(body)},'[]',${literal(f.version)},'${f.rateKey}')`;
}
const begin = async (...args) => JSON.parse(await sql(beginSQL(...args)));
const fail = (f, searchId) =>
  sql(`SELECT public.fail_trip_generation('${f.tripId}','${searchId}')`);
const advance = (f, searchId) =>
  sql(
    `SELECT public.advance_trip_generation('${f.tripId}','${searchId}','{"hotels":"searching"}','hotels',25,'Finding hotels')`,
  );
const resultRows = [
  {
    category: "activity",
    name: "City walk",
    data: { id: "provider_walk_1" },
    price_amount: 0,
    price_currency: "JPY",
  },
];
const dayRows = [
  {
    day_number: 1,
    date: "2026-12-01",
    title: "Arrival",
    morning_activities: ["provider_walk_1"],
    afternoon_activities: [],
    evening_activities: [],
    meals: [],
    tips: [],
  },
];
function complete(f, searchId) {
  return sql(
    `SELECT public.complete_trip_generation('${f.tripId}','${searchId}',${json({ overview: "Original", total_cost: 0, days: [{ dayNumber: 1 }], packing_list: [], general_tips: [] })},'[]',${json(resultRows)},${json(dayRows)})`,
  );
}
async function holdTrip(f) {
  const child = spawn(executable("psql"), connection, {
    stdio: ["pipe", "pipe", "pipe"],
  });
  const ready = new Promise((resolve, reject) => {
    child.stdout.on("data", (data) => {
      if (data.toString().includes("locked")) resolve();
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code !== 0) reject(new Error(`Lock holder exited ${code}`));
    });
  });
  child.stdin.write(
    `BEGIN; SELECT id FROM trips WHERE id='${f.tripId}' FOR UPDATE; SELECT 'locked';\n`,
  );
  await ready;
  return () => {
    child.stdin.end("COMMIT;\n");
  };
}
async function waitForLockWaiters(count) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (
      Number(
        await sql(
          "SELECT count(*) FROM pg_stat_activity WHERE wait_event_type='Lock'",
        ),
      ) >= count
    )
      return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Concurrent queries did not reach the database lock");
}

try {
  await exec(executable("initdb"), [
    "-D",
    dataDir,
    "-U",
    "faroway_test",
    "-A",
    "trust",
    "--no-locale",
  ]);
  await exec(executable("pg_ctl"), [
    "-D",
    dataDir,
    "-l",
    path.join(cluster, "postgres.log"),
    "-o",
    `-k ${cluster} -p 65432 -c listen_addresses=''`,
    "-w",
    "start",
  ]);
  started = true;
  await sql(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_app_meta_data jsonb);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';
    CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS 'SELECT current_user::text';
    CREATE PUBLICATION supabase_realtime;`);
  for (const name of [
    "20260202_init_schema.sql",
    "20260203_01_search_schema.sql",
    "20260204_workflow_tables.sql",
    "20260217100000_json_render_spec.sql",
    "20260220250000_add_search_id_to_trips.sql",
    "20260223000000_add_intermediate_results.sql",
    "20260512002000_canonical_planned_trip_status.sql",
    "20260725000000_production_rate_limits.sql",
    "20260904000000_atomic_trip_generation.sql",
  ]) {
    await sql(
      await readFile(path.join(root, "supabase/migrations", name), "utf8"),
    );
  }
  console.log(
    `Database: ${await sql("SHOW server_version")}; isolated cluster: ${cluster}`,
  );

  await test("eight concurrent starts commit exactly one generation", async () => {
    const f = await fixture(),
      release = await holdTrip(f);
    let pending;
    try {
      pending = Promise.all(
        Array.from({ length: 8 }, (_, i) => begin(f, `request-${i}`)),
      );
      await waitForLockWaiters(8);
    } finally {
      release();
    }
    const results = await pending;
    assert.equal(results.filter((r) => r.outcome === "created").length, 1);
    assert.equal(results.filter((r) => r.outcome === "in_progress").length, 7);
    assert.equal(new Set(results.map((r) => r.searchId)).size, 1);
    assert.equal(
      await sql(
        `SELECT count(*) FROM workflow_runs WHERE trip_id='${f.tripId}'`,
      ),
      "1",
    );
  });
  await test("concurrent idempotency replays share one attempt and one rate charge", async () => {
    const f = await fixture(),
      results = await Promise.all(Array.from({ length: 8 }, () => begin(f)));
    assert.equal(results.filter((r) => r.outcome === "created").length, 1);
    assert.equal(results.filter((r) => r.outcome === "replayed").length, 7);
    assert.equal(new Set(results.map((r) => r.searchId)).size, 1);
    assert.equal(
      await sql(
        `SELECT request_count FROM rate_limit_buckets WHERE key='${f.rateKey}'`,
      ),
      "1",
    );
    assert.equal(
      (await begin(f, "request-1", { vibes: ["adventure"] })).outcome,
      "key_conflict",
    );
  });
  await test("ownership and optimistic trip edits are enforced before writes", async () => {
    const f = await fixture();
    assert.equal(
      (await begin({ ...f, userId: randomUUID() })).outcome,
      "not_found",
    );
    await sql(`UPDATE trips SET destination='Kyoto' WHERE id='${f.tripId}'`);
    assert.equal((await begin(f)).outcome, "trip_changed");
    assert.equal(
      await sql(`SELECT count(*) FROM searches WHERE user_id='${f.userId}'`),
      "0",
    );
  });
  await test("concurrent different trips share the per-user generation limit", async () => {
    const userId = randomUUID();
    const trips = await Promise.all(
      Array.from({ length: 6 }, () => fixture(userId)),
    );
    const claims = await Promise.all(trips.map((f) => begin(f)));
    assert.equal(claims.filter((c) => c.outcome === "created").length, 5);
    assert.equal(claims.filter((c) => c.outcome === "rate_limited").length, 1);
    assert.equal(
      await sql(`SELECT count(*) FROM searches WHERE user_id='${userId}'`),
      "5",
    );
    assert.equal(
      await sql(
        `SELECT request_count FROM rate_limit_buckets WHERE key='${trips[0].rateKey}'`,
      ),
      // Denied attempts count too; only five searches may be created.
      "6",
    );
  });
  await test("initialization failure rolls back search, tracking, trip and rate consumption", async () => {
    const f = await fixture();
    await sql(
      "CREATE FUNCTION reject_tracking() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test injected tracking failure'; END; $$; CREATE TRIGGER reject_tracking BEFORE INSERT ON workflow_runs FOR EACH ROW EXECUTE FUNCTION reject_tracking();",
    );
    try {
      await assert.rejects(begin(f), /test injected tracking failure/);
    } finally {
      await sql(
        "DROP TRIGGER reject_tracking ON workflow_runs; DROP FUNCTION reject_tracking();",
      );
    }
    assert.equal(
      await sql(`SELECT status FROM trips WHERE id='${f.tripId}'`),
      "draft",
    );
    assert.equal(
      await sql(`SELECT count(*) FROM searches WHERE user_id='${f.userId}'`),
      "0",
    );
    assert.equal(
      await sql(
        `SELECT count(*) FROM rate_limit_buckets WHERE key='${f.rateKey}'`,
      ),
      "0",
    );
  });
  await test("late success, failure and progress cannot overwrite a newer attempt", async () => {
    const f = await fixture(),
      first = await begin(f);
    assert.equal(await fail(f, first.searchId), "t");
    f.version = await sql(
      `SELECT updated_at FROM trips WHERE id='${f.tripId}'`,
    );
    const second = await begin(f, "request-2");
    assert.equal(second.outcome, "created");
    assert.equal(await advance(f, first.searchId), "f");
    assert.equal(await complete(f, first.searchId), "f");
    assert.equal(await fail(f, first.searchId), "f");
    assert.equal(
      await sql(`SELECT search_id FROM trips WHERE id='${f.tripId}'`),
      second.searchId,
    );
    assert.equal(
      await sql(`SELECT status FROM trips WHERE id='${f.tripId}'`),
      "generating",
    );
    assert.equal(
      await sql(
        `SELECT step FROM workflow_progress WHERE trip_id='${f.tripId}'`,
      ),
      "queued",
    );
  });
  await test("completion is atomic and retry-safe, including notifications and provider IDs", async () => {
    const f = await fixture(),
      started = await begin(f);
    await sql(
      "CREATE FUNCTION reject_notification() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test injected notification failure'; END; $$; CREATE TRIGGER reject_notification BEFORE INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION reject_notification();",
    );
    try {
      await assert.rejects(
        complete(f, started.searchId),
        /test injected notification failure/,
      );
    } finally {
      await sql(
        "DROP TRIGGER reject_notification ON notifications; DROP FUNCTION reject_notification();",
      );
    }
    assert.equal(
      await sql(`SELECT status FROM trips WHERE id='${f.tripId}'`),
      "generating",
    );
    assert.equal(
      await sql(`SELECT count(*) FROM itineraries WHERE trip_id='${f.tripId}'`),
      "0",
    );
    assert.equal(
      await sql(
        `SELECT count(*) FROM search_results WHERE search_id='${started.searchId}'`,
      ),
      "0",
    );
    assert.equal(await complete(f, started.searchId), "t");
    await sql(
      `UPDATE itineraries SET overview='User edit' WHERE trip_id='${f.tripId}'`,
    );
    assert.equal(await complete(f, started.searchId), "t");
    assert.equal(await fail(f, started.searchId), "f");
    assert.equal(
      await sql(`SELECT overview FROM itineraries WHERE trip_id='${f.tripId}'`),
      "User edit",
    );
    assert.equal(
      await sql(`SELECT status FROM trips WHERE id='${f.tripId}'`),
      "planned",
    );
    assert.equal(
      await sql(
        `SELECT count(*) FROM notifications WHERE user_id='${f.userId}'`,
      ),
      "1",
    );
    assert.equal(
      await sql(
        `SELECT morning_activities[1] FROM search_itineraries WHERE search_id='${started.searchId}'`,
      ),
      "provider_walk_1",
    );
    assert.equal((await begin(f)).outcome, "replayed");
  });
  await test("anonymous and authenticated roles cannot execute lifecycle writes", async () => {
    const f = await fixture();
    for (const role of ["anon", "authenticated"]) {
      await assert.rejects(
        sql(`SET ROLE ${role}; ${beginSQL(f)}`),
        /permission denied/,
      );
      await assert.rejects(
        sql(`SET ROLE ${role}; SELECT * FROM trip_generation_requests`),
        /permission denied/,
      );
    }
    const claim = JSON.parse(
      await sql(`SET ROLE service_role; ${beginSQL(f)}`),
    );
    assert.equal(claim.outcome, "created");
  });
  await test("a mismatched trip cannot fail another trip generation", async () => {
    const firstTrip = await fixture(),
      secondTrip = await fixture();
    const first = await begin(firstTrip),
      second = await begin(secondTrip);
    assert.equal(await fail(firstTrip, second.searchId), "f");
    assert.equal(
      await sql(`SELECT status FROM searches WHERE id='${second.searchId}'`),
      "pending",
    );
    assert.equal(
      await sql(`SELECT search_id FROM trips WHERE id='${firstTrip.tripId}'`),
      first.searchId,
    );
  });
  await test("replays compare caller intent even after server-side trip edits", async () => {
    const f = await fixture();
    const first = JSON.parse(
      await sql(beginSQL(f).replace(/\)$/, ", '{}'::jsonb)")),
    );
    await complete(f, first.searchId);
    await sql(`UPDATE trips SET destination='Kyoto' WHERE id='${f.tripId}'`);
    const retry = JSON.parse(
      await sql(
        beginSQL(f, "request-1", { ...input, destination: "Kyoto" }).replace(
          /\)$/,
          ", '{}'::jsonb)",
        ),
      ),
    );
    assert.equal(retry.outcome, "replayed");
    assert.equal(retry.searchId, first.searchId);
  });
  await test("cleanup respects live heartbeats and closes abandoned tracking atomically", async () => {
    const active = await fixture(),
      abandoned = await fixture();
    const running = await begin(active),
      lost = await begin(abandoned);
    await sql(`ALTER TABLE trips DISABLE TRIGGER update_trips_updated_at;
      ALTER TABLE searches DISABLE TRIGGER update_searches_updated_at;
      UPDATE trips SET updated_at=now()-interval '2 hours' WHERE id IN ('${active.tripId}','${abandoned.tripId}');
      UPDATE searches SET updated_at=now()-interval '2 hours' WHERE id='${lost.searchId}';
      ALTER TABLE trips ENABLE TRIGGER update_trips_updated_at;
      ALTER TABLE searches ENABLE TRIGGER update_searches_updated_at;`);
    const repaired = JSON.parse(
      await sql("SELECT public.cleanup_stale_generation_state()"),
    );
    assert.equal(repaired.trips, 1);
    assert.equal(
      await sql(`SELECT status FROM searches WHERE id='${running.searchId}'`),
      "pending",
    );
    assert.equal(
      await sql(`SELECT status FROM workflow_runs WHERE id='${lost.searchId}'`),
      "failed",
    );
    assert.equal(
      await sql(`SELECT status FROM trips WHERE id='${abandoned.tripId}'`),
      "failed",
    );
    assert.equal(await complete(abandoned, lost.searchId), "f");
  });
  await test("cleanup repairs legacy partial state without corrupting completed searches", async () => {
    const noSearch = await fixture(),
      noTracking = await fixture(),
      alreadyFailed = await fixture(),
      completed = await fixture();
    const untracked = await begin(noTracking),
      failed = await begin(alreadyFailed),
      done = await begin(completed);
    await complete(completed, done.searchId);
    await sql(`DELETE FROM workflow_runs WHERE trip_id='${noTracking.tripId}';
      INSERT INTO workflow_runs(id,trip_id,user_id,status) VALUES ('legacy-${noSearch.tripId}','${noSearch.tripId}','${noSearch.userId}','running');
      UPDATE searches SET status='error' WHERE id='${failed.searchId}';
      ALTER TABLE trips DISABLE TRIGGER update_trips_updated_at;
      ALTER TABLE searches DISABLE TRIGGER update_searches_updated_at;
      UPDATE trips SET status='generating',updated_at=now()-interval '2 hours'
        WHERE id IN ('${noSearch.tripId}','${noTracking.tripId}','${alreadyFailed.tripId}','${completed.tripId}');
      UPDATE searches SET updated_at=now()-interval '2 hours' WHERE id IN ('${untracked.searchId}','${failed.searchId}','${done.searchId}');
      ALTER TABLE trips ENABLE TRIGGER update_trips_updated_at;
      ALTER TABLE searches ENABLE TRIGGER update_searches_updated_at;`);
    const repaired = JSON.parse(
      await sql("SELECT public.cleanup_stale_generation_state()"),
    );
    assert.deepEqual(repaired, { trips: 3, searches: 1, unreconciledTrips: 1 });
    for (const f of [noSearch, noTracking, alreadyFailed]) {
      assert.equal(
        await sql(`SELECT status FROM trips WHERE id='${f.tripId}'`),
        "failed",
      );
      assert.equal(
        await sql(
          `SELECT step FROM workflow_progress WHERE trip_id='${f.tripId}'`,
        ),
        "error",
      );
      assert.equal(
        await sql(
          `SELECT count(*) FROM workflow_runs WHERE trip_id='${f.tripId}' AND status='running'`,
        ),
        "0",
      );
    }
    assert.equal(
      await sql(`SELECT status FROM searches WHERE id='${done.searchId}'`),
      "completed",
    );
    assert.equal(
      await sql(
        `SELECT overview FROM itineraries WHERE trip_id='${completed.tripId}'`,
      ),
      "Original",
    );
  });
  console.log(`${passed} PostgreSQL transaction tests passed`);
} finally {
  if (started)
    await exec(executable("pg_ctl"), [
      "-D",
      dataDir,
      "-m",
      "fast",
      "-w",
      "stop",
    ]);
  console.log(
    `${started ? "Stopped isolated test cluster." : "Test cluster did not start."} Diagnostic files retained at ${cluster}`,
  );
}
