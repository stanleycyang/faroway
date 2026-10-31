/** Isolated public-venue grounding probe. Not connected to product planning. */
import { createGateway, generateText } from "ai";
import { google } from "@ai-sdk/google";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { assertStagingTarget } from "../../../scripts/uat/lib/staging-project";
function arg(name: string) {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
}
async function main() {
  if (!process.argv.includes("--live"))
    throw new Error("Explicit --live required");
  assertStagingTarget({
    supabaseUrl: arg("--supabase-url"),
    projectRef: process.env.FAROWAY_STAGING_SUPABASE_PROJECT_REF,
  });
  const key = process.env.FAROWAY_STAGING_AI_GATEWAY_KEY?.trim();
  if (!key) throw new Error("Dedicated staging key required");
  const out = arg("--out");
  if (!out || existsSync(out)) throw new Error("A new --out file is required");
  const prompt = `Today is ${new Date().toISOString().slice(0, 10)}. Use Google Search to investigate two Lisbon venues for a possible visit on 2026-12-07: Jerónimos Monastery interior and National Tile Museum (Museu Nacional do Azulejo). For each, report current closure or reopening notices and usual closed weekdays. Prioritize official venue or government sources and cite the source URL for each claim. Distinguish current status from confirmed future availability. If reopening or future availability cannot be established, say unknown. Do not infer that search-result absence means open. Do not make reservations or propose an itinerary.`;
  const started = Date.now();
  mkdirSync(dirname(resolve(out)), { recursive: true, mode: 0o700 });
  writeFileSync(
    out,
    JSON.stringify({
      status: "started",
      prompt,
      startedAt: new Date().toISOString(),
    }),
    { mode: 0o600, flag: "wx" },
  );
  try {
    const result = await generateText({
      model: createGateway({ apiKey: key })("google/gemini-3-flash"),
      providerOptions: {
        gateway: { only: ["google"] },
        google: { thinkingConfig: { thinkingLevel: "low" } },
      },
      tools: { google_search: google.tools.googleSearch({}) },
      prompt,
      maxOutputTokens: 2500,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(60000),
    });
    writeFileSync(
      out,
      JSON.stringify(
        {
          status: "completed",
          prompt,
          latencyMs: Date.now() - started,
          text: result.text,
          sources: result.sources,
          usage: result.usage,
          providerMetadata: result.providerMetadata,
          warnings: result.warnings,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    console.log(
      JSON.stringify({
        status: "completed",
        sourceCount: result.sources.length,
        latencyMs: Date.now() - started,
        usage: result.usage,
      }),
    );
  } catch (error) {
    writeFileSync(
      out,
      JSON.stringify({
        status: "failed",
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : "unknown",
        billing: "unknown; reconcile gateway before retry",
      }),
      { mode: 0o600 },
    );
    console.error(
      "Grounding probe failed; private receipt saved. Reconcile gateway billing before retry.",
    );
    process.exitCode = 3;
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Probe failed");
  process.exitCode = 1;
});
