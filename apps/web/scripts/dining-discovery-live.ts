/** Isolated public-source dining discovery. Never reads traveler data or modifies a trip. */
import { createGateway, generateText } from "ai";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { assertStagingTarget } from "../../../scripts/uat/lib/staging-project";
import {
  validatePublicDiningBrief,
  diningDiscoveryPrompt,
  auditDiningDiscovery,
  parseDiningDiscovery,
} from "../../../scripts/uat/lib/dining-discovery";
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
};
if (!process.argv.includes("--live")) throw Error("Explicit --live required");
assertStagingTarget({
  projectRef: process.env.FAROWAY_STAGING_SUPABASE_PROJECT_REF,
  supabaseUrl: arg("--supabase-url"),
});
const key = process.env.FAROWAY_STAGING_AI_GATEWAY_KEY;
if (!key) throw Error("Dedicated staging key required");
const input = arg("--brief"),
  out = arg("--out");
if (
  !input ||
  input.startsWith("--") ||
  !out ||
  out.startsWith("--") ||
  existsSync(out)
)
  throw Error("Public --brief and new --out required");
const bytes = readFileSync(input);
if (bytes.length > 4000) throw Error("Brief too large");
const brief = validatePublicDiningBrief(JSON.parse(bytes.toString()));
const prompt = diningDiscoveryPrompt(brief);
const hash = (data: string | Buffer) =>
  createHash("sha256").update(data).digest("hex");
const provenance = {
  inputSha256: hash(bytes),
  promptSha256: hash(prompt),
  implementationSha256: hash(readFileSync(import.meta.filename)),
  helpers: Object.fromEntries(
    [
      "dining-discovery",
      "venue-identity-excerpts",
      "venue-source-discovery",
    ].map((name) => [
      name,
      hash(
        readFileSync(
          resolve(import.meta.dirname, `../../../scripts/uat/lib/${name}.ts`),
        ),
      ),
    ]),
  ),
  model: "google/gemini-3-flash",
  clientRequestsMaximum: 1,
  automaticTripEdits: false,
  searchProvider: "parallel",
};
mkdirSync(dirname(resolve(out)), { recursive: true, mode: 0o700 });
writeFileSync(out, JSON.stringify({ status: "started", provenance }), {
  flag: "wx",
  mode: 0o600,
});
const started = Date.now();
try {
  const gateway = createGateway({ apiKey: key });
  const result = await generateText({
    model: gateway(provenance.model),
    prompt,
    tools: {
      parallel_search: gateway.tools.parallelSearch({
        mode: "agentic",
        maxResults: 6,
        excerpts: { maxCharsPerResult: 2500, maxCharsTotal: 12000 },
      }),
    },
    toolChoice: "required",
    providerOptions: {
      gateway: { only: ["google"] },
      google: { thinkingConfig: { thinkingLevel: "low" } },
    },
    maxOutputTokens: 2500,
    maxRetries: 0,
    abortSignal: AbortSignal.timeout(60000),
  });
  const retrievalResults = result.steps.flatMap((step) => step.toolResults);
  const extracted = parseDiningDiscovery(result.text);
  const audit = auditDiningDiscovery(extracted, retrievalResults, brief);
  const billingKnown =
    Number.isFinite(result.usage.inputTokens) &&
    Number.isFinite(result.usage.outputTokens);
  const receipt = {
    status: "completed",
    retrievedAt: new Date().toISOString(),
    provenance,
    prompt,
    brief,
    latencyMs: Date.now() - started,
    billingKnown,
    text: result.text,
    extracted,
    audit,
    retrievalResults,
    steps: result.steps,
    usage: result.usage,
    providerMetadata: result.providerMetadata,
    warnings: result.warnings,
  };
  writeFileSync(out, JSON.stringify(receipt, null, 2), { mode: 0o600 });
  process.exitCode = !billingKnown
    ? 3
    : !audit.shapeValid
      ? 4
      : !audit.options.length || audit.rejected.length
        ? 6
        : 0;
  console.log(
    JSON.stringify({
      status: receipt.status,
      billingKnown,
      latencyMs: receipt.latencyMs,
      options: audit.options.length,
      rejected: audit.rejected,
    }),
  );
} catch {
  writeFileSync(
    out,
    JSON.stringify({
      status: "failed",
      provenance,
      billingKnown: false,
      latencyMs: Date.now() - started,
      error:
        "Request failed; reconcile Gateway billing before another paid call",
    }),
    { mode: 0o600 },
  );
  process.exitCode = 3;
  console.error(
    "Dining discovery failed; reconcile Gateway billing before another paid call",
  );
}
