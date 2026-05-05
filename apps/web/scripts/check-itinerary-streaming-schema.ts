#!/usr/bin/env bun

import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const REQUIRED_MIGRATIONS = [
  "supabase/migrations/20260217100000_json_render_spec.sql",
  "supabase/migrations/20260223000000_add_intermediate_results.sql",
] as const;

const RPC_PROBE_KEY = "__itinerary_streaming_schema_check__";

type CheckState = "ok" | "failed";

export interface SchemaError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

interface SchemaCheck {
  name: string;
  state: CheckState;
  detail: string;
}

interface ColumnProbe {
  name: string;
  select: string;
  member: string;
  migration: (typeof REQUIRED_MIGRATIONS)[number];
}

function configured(value: string | undefined): value is string {
  return Boolean(value && value.trim().length > 0);
}

function formatError(error: SchemaError): string {
  const code = error.code ? `${error.code}: ` : "";
  return `${code}${error.message ?? "unknown database error"}`;
}

export function isMissingSchemaMember(
  error: SchemaError | null | undefined,
  member: string,
): boolean {
  if (!error) return false;

  const text = [error.code, error.message, error.details, error.hint]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
  const normalizedMember = member.toLowerCase();

  return (
    text.includes(normalizedMember) &&
    (text.includes("42703") ||
      text.includes("pgrst202") ||
      text.includes("pgrst204") ||
      text.includes("does not exist") ||
      text.includes("schema cache"))
  );
}

async function checkSearchesTable(db: SupabaseClient): Promise<SchemaCheck> {
  const { error } = await db.from("searches").select("id").limit(1);

  return error
    ? {
        name: "searches table",
        state: "failed",
        detail: `service role cannot read searches: ${formatError(error)}`,
      }
    : {
        name: "searches table",
        state: "ok",
        detail: "service role can read searches",
      };
}

async function checkColumn(
  db: SupabaseClient,
  probe: ColumnProbe,
): Promise<SchemaCheck> {
  const { error } = await db.from("searches").select(probe.select).limit(1);

  if (!error) {
    return {
      name: probe.name,
      state: "ok",
      detail: "column is readable",
    };
  }

  const migrationHint = isMissingSchemaMember(error, probe.member)
    ? `; apply ${probe.migration}`
    : "";

  return {
    name: probe.name,
    state: "failed",
    detail: `${formatError(error)}${migrationHint}`,
  };
}

async function checkMergeRpc(db: SupabaseClient): Promise<SchemaCheck> {
  const { error } = await db.rpc("merge_intermediate_results", {
    p_key: RPC_PROBE_KEY,
    p_search_id: randomUUID(),
    p_value: {},
  });

  if (!error) {
    return {
      name: "merge_intermediate_results RPC",
      state: "ok",
      detail: "non-destructive zero-row probe succeeded",
    };
  }

  const migrationHint =
    isMissingSchemaMember(error, "merge_intermediate_results") ||
    isMissingSchemaMember(error, "intermediate_results")
      ? `; apply ${REQUIRED_MIGRATIONS[1]}`
      : "";

  return {
    name: "merge_intermediate_results RPC",
    state: "failed",
    detail: `${formatError(error)}${migrationHint}`,
  };
}

export async function checkItineraryStreamingSchema(
  db: SupabaseClient,
): Promise<SchemaCheck[]> {
  const columnProbes: ColumnProbe[] = [
    {
      name: "searches.json_render_spec",
      select: "id,json_render_spec",
      member: "json_render_spec",
      migration: REQUIRED_MIGRATIONS[0],
    },
    {
      name: "searches.intermediate_results",
      select: "id,intermediate_results",
      member: "intermediate_results",
      migration: REQUIRED_MIGRATIONS[1],
    },
  ];

  const tableCheck = await checkSearchesTable(db);
  if (tableCheck.state === "failed") return [tableCheck];

  const columnChecks = await Promise.all(
    columnProbes.map((probe) => checkColumn(db, probe)),
  );
  const rpcCheck = await checkMergeRpc(db);

  return [tableCheck, ...columnChecks, rpcCheck];
}

function printResults(results: SchemaCheck[]): void {
  for (const result of results) {
    const marker = result.state === "ok" ? "OK" : "FAIL";
    console.log(`${marker} ${result.name}: ${result.detail}`);
  }
}

async function main(): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!configured(url) || !configured(serviceRoleKey)) {
    console.error(
      "FAIL environment: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required",
    );
    process.exitCode = 1;
    return;
  }

  const db = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const results = await checkItineraryStreamingSchema(db);

  printResults(results);

  if (results.some((result) => result.state === "failed")) {
    console.error(`Required migrations: ${REQUIRED_MIGRATIONS.join(", ")}`);
    process.exitCode = 1;
  }
}

const invokedPath = process.argv[1];
if (invokedPath && import.meta.url === pathToFileURL(invokedPath).href) {
  await main();
}
