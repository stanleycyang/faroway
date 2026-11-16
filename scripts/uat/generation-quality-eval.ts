/** Credential-free itinerary and affiliate rubric. Never calls a model or supplier. */
import {
  liveQualityGate,
  runGenerationQualityEval,
} from "./lib/generation-quality";

const live = process.argv.includes("--live");
if (live) {
  const gate = liveQualityGate();
  console.log(
    JSON.stringify(
      { live_gate: gate, live_model_quality_measured: false },
      null,
      2,
    ),
  );
  if (!gate.allowed) process.exit(2);
}

const report = await runGenerationQualityEval();
console.log(JSON.stringify(report, null, 2));
if (!report.accepted) process.exit(1);
