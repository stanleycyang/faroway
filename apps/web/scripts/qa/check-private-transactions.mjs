import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const repo = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
const name = `faroway-ux-transactions-${randomUUID().slice(0, 8)}`;
const image = "postgres:17.11";
let container;
const sessions = [];
const docker = (args) =>
  execFileSync("docker", args, {
    encoding: "utf8",
    timeout: 30_000,
    stdio: ["pipe", "pipe", "pipe"],
  });
const sql = (input) =>
  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      name,
      "psql",
      "-U",
      "postgres",
      "-X",
      "-A",
      "-t",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    {
      input,
      encoding: "utf8",
      timeout: 30_000,
      stdio: ["pipe", "pipe", "pipe"],
    },
  );
function session() {
  const child = spawn(
    "docker",
    [
      "exec",
      "-i",
      name,
      "psql",
      "-U",
      "postgres",
      "-X",
      "-A",
      "-t",
      "-v",
      "ON_ERROR_STOP=1",
    ],
    { stdio: ["pipe", "pipe", "pipe"] },
  );
  sessions.push(child);
  const record = { child, stdout: "", stderr: "", exitCode: null };
  child.stdout.on("data", (data) => {
    record.stdout += data.toString();
  });
  child.stderr.on("data", (data) => {
    record.stderr += data.toString();
  });
  child.on("exit", (code) => {
    record.exitCode = code;
  });
  child.on("error", (error) => {
    record.stderr += error.message;
    record.exitCode = 1;
  });
  return record;
}
async function until(predicate, label) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (predicate()) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}
try {
  // No published ports or networking; trust authentication is confined to this
  // disposable substrate. No production URL, credential or database is read.
  container = docker([
    "run",
    "-d",
    "--name",
    name,
    "--network",
    "none",
    "--label",
    "faroway.qa=private-transactions",
    "-e",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    image,
  ]).trim();
  await until(() => {
    try {
      // pg_isready can briefly see the entrypoint's temporary init server.
      if (
        !docker(["logs", name]).includes(
          "PostgreSQL init process complete; ready for start up.",
        )
      )
        return false;
      docker(["exec", name, "pg_isready", "-U", "postgres"]);
      return true;
    } catch {
      return false;
    }
  }, "owned PostgreSQL readiness");
  const isolation = JSON.parse(docker(["inspect", name]))[0];
  if (
    isolation.HostConfig.NetworkMode !== "none" ||
    Object.keys(isolation.HostConfig.PortBindings || {}).length
  )
    throw new Error("QA database isolation failed");
  for (const file of [
    "apps/web/scripts/qa/private-transactions-bootstrap.sql",
    "supabase/migrations/20261003005000_version_trip_briefs.sql",
    "supabase/migrations/20261003007000_revision_safe_plan_edits.sql",
    "supabase/migrations/20261003008000_trip_booking_checklist.sql",
    "apps/web/scripts/qa/private-transactions-check.sql",
    "apps/web/scripts/qa/private-transactions-extra.sql",
    "apps/web/scripts/qa/private-brief-check.sql",
  ])
    sql(readFileSync(resolve(repo, file), "utf8"));
  sql(`INSERT INTO public.trips(id,user_id,updated_at) VALUES('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111','2026-01-02T00:00:00Z');
INSERT INTO public.itineraries(trip_id,user_id,days) VALUES('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111','[{"date":"2099-06-01","morning":{"activities":[{"name":"Museum","planItemId":"item_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]}}]');`);
  const edit = (suffix) =>
    `SELECT public.edit_trip_plan('77777777-7777-4777-8777-777777777777','11111111-1111-4111-8111-111111111111','{"requestId":"88888888-8888-4888-8888-88888888888${suffix}","expectedUpdatedAt":"2026-01-02T00:00:00Z","expectedPlanRevision":null,"action":"lock","itemId":"item_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}','[{"date":"2099-06-01","morning":{"activities":[{"name":"Museum","planItemId":"item_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"}]}}]',ARRAY['item_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa']);`;
  const first = session();
  first.child.stdin.write(
    `BEGIN; SET ROLE service_role; ${edit(1)} SELECT '__qa_first_applied__';\n`,
  );
  await until(
    () =>
      first.stdout.includes("__qa_first_applied__") || first.exitCode !== null,
    "first edit",
  );
  if (!first.stdout.includes('"state": "applied"'))
    throw new Error("First concurrent edit failed");
  const second = session();
  second.child.stdin.end(
    `SET ROLE service_role; SET application_name='faroway_ux_plan_b'; ${edit(2)}\n`,
  );
  await until(
    () =>
      sql(
        "SELECT count(*) FROM pg_stat_activity WHERE application_name='faroway_ux_plan_b' AND wait_event_type='Lock';",
      ).trim() === "1",
    "observed second-session row lock",
  );
  first.child.stdin.end("COMMIT;\n");
  await until(
    () => first.exitCode !== null && second.exitCode !== null,
    "both SQL sessions to finish",
  );
  if (
    first.exitCode !== 0 ||
    second.exitCode !== 0 ||
    !second.stdout.includes('"state": "conflict"')
  )
    throw new Error("Concurrent stale edit was not rejected");
  const counts = sql(
    "SELECT count(*) FILTER (WHERE request_id IS NOT NULL),count(*) FROM public.trip_plan_revisions WHERE trip_id='77777777-7777-4777-8777-777777777777';",
  ).trim();
  if (counts !== "1|2")
    throw new Error(`Unexpected persisted revisions: ${counts}`);
  const result = {
    passed: true,
    image,
    network: "none",
    publishedPorts: 0,
    actualMigrations: ["20261003005000", "20261003007000", "20261003008000"],
    assertions: [
      "owner guards",
      "brief revision advances and publication invalidates",
      "stale/stranger/generating brief rejected",
      "lock/unlock/swap persistence",
      "edit revokes public link",
      "exact replay",
      "changed request conflicts",
      "booking receipt/history",
      "stale revision conflict",
      "forged derived plan rejected",
      "unfenced write rejected",
      "anon/authenticated history and RPC grants",
      "observed concurrent row lock",
      "one applied edit and one stale conflict",
    ],
    limits:
      "Minimal QA table substrate; not full migration-chain, hosted Supabase JWT/auth/RLS or browser acceptance.",
  };
  const output = process.argv[2];
  if (output)
    writeFileSync(resolve(output), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result));
} finally {
  for (const child of sessions) if (child.exitCode === null) child.kill();
  if (container) docker(["rm", "--force", "--volumes", container]);
}
