/** Credential-free itinerary and affiliate rubric. --live generates one brief only when a model key and budget are set. */
import {
  liveQualityGate,
  runGenerationQualityEval,
} from "./lib/generation-quality";
import { runGeneratedItineraryEval } from "./lib/generated-itinerary-eval";

const report = await runGenerationQualityEval();
const generated = runGeneratedItineraryEval();
const accepted = report.accepted && generated.accepted;
console.log(
  JSON.stringify(
    { ...report, generated_itinerary: generated, accepted },
    null,
    2,
  ),
);
if (!accepted) process.exit(1);

const live = process.argv.includes("--live");
if (!live) process.exit(0);

const gate = liveQualityGate();
console.log(JSON.stringify({ live_gate: gate }, null, 2));
if (!gate.allowed) process.exit(2);

const { runLiveGeneratedSample } = await import("./lib/live-generation");
const liveReport = await runLiveGeneratedSample(gate.budgetUsd);
console.log(JSON.stringify(liveReport, null, 2));
if (!liveReport.live_model_quality_measured || liveReport.accepted !== true)
  process.exit(1);
