import { readFile } from "node:fs/promises";
import { comparePublishedFlightFees } from "../lib/affiliates/flight-fee-comparison";

// Offline calculation only: no supplier calls, credentials, or transactions.
const path = process.argv[2];
if (!path || path === "--help") {
  console.log(
    'Usage: bun scripts/compare-flight-fees.ts scenario.json\nScenario: {"bookingValueEur":500,"usdToEur":0.9,"duffelManagedContent":true}\nSupply an actual FX rate; the example is illustrative. This compares published fees only.',
  );
} else {
  try {
    console.log(
      JSON.stringify(
        comparePublishedFlightFees(JSON.parse(await readFile(path, "utf8"))),
        null,
        2,
      ),
    );
  } catch {
    console.error(
      "Invalid scenario. Supply a JSON file with nonnegative amounts and a positive USD-to-EUR rate.",
    );
    process.exitCode = 1;
  }
}
