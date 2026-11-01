/** Offline application-boundary replay of the frozen hotel trials. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { createHash } from "node:crypto";
import { screenHotelCandidates } from "../lib/search/hotel-policy-screen";
import { mapSearchResultsToItinerary } from "../lib/search/bridge";
import { evaluateHotelConstraints } from "../../../scripts/uat/lib/hotel-constraints";
import facts from "../../../scripts/fixtures/agentic-hotel-constraints.json";
import type {
  SearchPlan,
  HotelResult,
  SuggestedDay,
} from "../lib/search/types";

const [directory, out] = process.argv.slice(2);
if (!directory || !out || existsSync(out))
  throw new Error("Input trial directory and new output required");
const root = resolve(import.meta.dirname, "../../..");
const sha = (bytes: string | Buffer) =>
  createHash("sha256").update(bytes).digest("hex");
const manifest = JSON.parse(
  readFileSync(join(directory, "manifest.json"), "utf8"),
);
if (!manifest.trials.length) throw new Error("Nonempty trial set required");
const rows = manifest.trials.map(
  (trial: { brief: string; thinking: string; repeat: number }) => {
    const id = `${trial.brief}--${trial.thinking}--${trial.repeat}`;
    const bytes = readFileSync(join(directory, id + ".json"));
    const receipt = JSON.parse(bytes.toString());
    const sourceBytes = readFileSync(
      resolve(root, manifest.inputs[trial.brief].path),
    );
    const source = JSON.parse(sourceBytes.toString()).trace;
    const plan = source.steps[0].output as SearchPlan;
    if (
      receipt.status !== "completed" ||
      receipt.briefId !== trial.brief ||
      receipt.provenance.frozenInputSha256 !== sha(sourceBytes) ||
      receipt.provenance.planSha256 !== sha(JSON.stringify(plan))
    )
      throw new Error("Completed matching frozen hotel input required");
    const hotels = receipt.hotels as HotelResult[];
    const original = JSON.stringify(hotels);
    const review = screenHotelCandidates(plan, hotels, facts);
    const score = (hotel: HotelResult) =>
      Number.isFinite(hotel.vibeScore) ? hotel.vibeScore : 0;
    const topHotel =
      [...review.candidates].sort((a, b) => score(b) - score(a))[0] ?? null;
    const sourceDays = source.steps[4].output.days as SuggestedDay[];
    const days = sourceDays.map((day) => ({
      ...day,
      hotel: topHotel ?? undefined,
    }));
    const mapped = mapSearchResultsToItinerary(
      {
        searchId: id,
        hotels: review.candidates,
        activities: source.steps[2].output,
        dining: source.steps[3].output,
        transport: [],
        itinerary: days,
      },
      topHotel,
    );
    const after = evaluateHotelConstraints(plan, mapped.hotels, facts);
    if (
      after.findings.length ||
      JSON.stringify(hotels) !== original ||
      mapped.hotels.some((hotel) =>
        review.withheld.some((item) => item.hotelId === hotel.id),
      )
    )
      throw new Error("Screened conflict leaked or original inventory mutated");
    return {
      id,
      inputSha256: sha(bytes),
      before: evaluateHotelConstraints(plan, hotels, facts),
      after,
      withheld: review.withheld,
      remainingCount: mapped.hotels.length,
      topHotel: mapped.topHotel?.name ?? null,
      mappedItinerary: mapped,
    };
  },
);
const implementation = createHash("sha256");
for (const file of [
  "apps/web/scripts/hotel-policy-replay.ts",
  "apps/web/lib/search/hotel-policy-screen.ts",
  "scripts/uat/lib/hotel-constraints.ts",
  "scripts/fixtures/agentic-hotel-constraints.json",
  "apps/web/lib/search/bridge.ts",
  "apps/web/lib/location-coordinates.ts",
])
  implementation.update(file).update(readFileSync(resolve(root, file)));
mkdirSync(dirname(resolve(out)), { recursive: true, mode: 0o700 });
writeFileSync(
  out,
  JSON.stringify(
    {
      modelCalls: 0,
      qualityAccepted: false,
      implementationSha256: implementation.digest("hex"),
      limitations:
        "Frozen hotel-policy and saved-mapping replay only. Other hotel facts, routes, availability and traveler usefulness remain unverified. Original visit selections are reused; no live app workflow or browser acceptance.",
      rows,
    },
    null,
    2,
  ),
  { flag: "wx", mode: 0o600 },
);
console.log(
  JSON.stringify({
    trials: rows.length,
    withheldCandidates: rows.reduce(
      (sum: number, row: { withheld: unknown[] }) => sum + row.withheld.length,
      0,
    ),
    modelCalls: 0,
    qualityAccepted: false,
  }),
);
