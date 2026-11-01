import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import facts from "../fixtures/agentic-hotel-constraints.json";
import { evaluateHotelConstraints } from "./lib/hotel-constraints";

const directory = process.argv[2];
if (!directory) throw new Error("Hotel replay directory required");
const manifest = JSON.parse(
  readFileSync(join(directory, "manifest.json"), "utf8"),
) as {
  inputs: Record<string, { sha256: string }>;
  trials: Array<{ brief: string; thinking: "low" | "minimal"; repeat: number }>;
};
if (!manifest.trials.length)
  throw new Error("Nonempty trial manifest required");
const seen = new Set<string>();
const rows = manifest.trials.map((trial) => {
  const id = `${trial.brief}--${trial.thinking}--${trial.repeat}`;
  if (seen.has(id)) throw new Error("Duplicate trial");
  seen.add(id);
  const receipt = JSON.parse(
    readFileSync(join(directory, id + ".json"), "utf8"),
  );
  if (
    receipt.kind !== "hotel-only-frozen-plan-replay" ||
    receipt.status !== "completed" ||
    receipt.briefId !== trial.brief ||
    !["low", "minimal"].includes(trial.thinking) ||
    receipt.settings.PLANNING_THINKING_HOTELS !== trial.thinking ||
    receipt.settings.PLANNING_MODEL_HOTELS !== "google/gemini-3-flash" ||
    receipt.fallbacks.length ||
    !/^[a-f0-9]{64}$/.test(receipt.provenance.sourceSha256) ||
    receipt.usageRecords.length !== 1 ||
    receipt.usageRecords.some(
      (usage: {
        step: string;
        model: string;
        thinkingLevel: string;
        inputTokens: number | null;
        outputTokens: number | null;
      }) =>
        usage.step !== "hotels" ||
        usage.model !== "google/gemini-3-flash" ||
        usage.thinkingLevel !== trial.thinking ||
        usage.inputTokens == null ||
        usage.outputTokens == null ||
        !Number.isFinite(usage.inputTokens) ||
        !Number.isFinite(usage.outputTokens),
    ) ||
    receipt.hotels.length !== 10 ||
    !Number.isFinite(receipt.estimatedUsd) ||
    receipt.estimatedUsd < 0 ||
    !Number.isFinite(receipt.latencyMs) ||
    receipt.latencyMs <= 0 ||
    receipt.provenance.frozenInputSha256 !==
      manifest.inputs[trial.brief]?.sha256 ||
    receipt.provenance.planSha256 !==
      createHash("sha256")
        .update(JSON.stringify(receipt.provenance.plan))
        .digest("hex")
  )
    throw new Error(`Incomplete or mismatched receipt: ${id}`);
  return {
    ...trial,
    sourceSha256: receipt.provenance.sourceSha256 as string,
    planSha256: receipt.provenance.planSha256 as string,
    estimatedUsd: receipt.estimatedUsd as number,
    latencyMs: receipt.latencyMs as number,
    reasoningTokens: receipt.usageRecords.every(
      (u: { reasoningTokens: number | null }) => u.reasoningTokens != null,
    )
      ? receipt.usageRecords.reduce(
          (sum: number, u: { reasoningTokens: number }) =>
            sum + u.reasoningTokens,
          0,
        )
      : null,
    hotelConstraints: evaluateHotelConstraints(
      receipt.provenance.plan,
      receipt.hotels,
      facts,
    ),
  };
});
if (new Set(rows.map((row) => row.sourceSha256)).size !== 1)
  throw new Error("Implementation differs across trials");
const pairs = rows
  .filter((row) => row.thinking === "low")
  .map((low) => {
    const minimal = rows.find(
      (row) =>
        row.brief === low.brief &&
        row.repeat === low.repeat &&
        row.thinking === "minimal",
    );
    if (!minimal || minimal.planSha256 !== low.planSha256)
      throw new Error("Matched frozen-plan pair required");
    return {
      brief: low.brief,
      repeat: low.repeat,
      lowUsd: low.estimatedUsd,
      minimalUsd: minimal.estimatedUsd,
      lowMs: low.latencyMs,
      minimalMs: minimal.latencyMs,
    };
  });
if (pairs.length * 2 !== rows.length) throw new Error("Unpaired trial");
console.log(
  JSON.stringify(
    {
      evaluationSha256: createHash("sha256")
        .update(readFileSync(import.meta.filename))
        .update(
          readFileSync(join(import.meta.dirname, "lib/hotel-constraints.ts")),
        )
        .update(
          readFileSync(
            join(
              import.meta.dirname,
              "../fixtures/agentic-hotel-constraints.json",
            ),
          ),
        )
        .digest("hex"),
      qualityAccepted: false,
      count: rows.length,
      estimatedTotalUsd: rows.reduce((sum, row) => sum + row.estimatedUsd, 0),
      cheaperMinimalPairs: pairs.filter((pair) => pair.minimalUsd < pair.lowUsd)
        .length,
      fasterMinimalPairs: pairs.filter((pair) => pair.minimalMs < pair.lowMs)
        .length,
      limitations:
        "Small repeated development sample, not statistical or traveler acceptance. Hotel policy evidence covers only listed properties. No booking availability or application latency measured.",
      pairs,
      rows,
    },
    null,
    2,
  ),
);
