/** Synthetic publisher/meal classification evaluation; never certifies real ownership. */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { prepareDiningReplay } from "./lib/dining-replay";
import { parseDiningDiscovery } from "./lib/dining-discovery";

const [fixturePath, ...paths] = process.argv.slice(2);
if (!fixturePath || !paths.length)
  throw Error("Pass fixture and screening receipts");
const fixtureBytes = readFileSync(fixturePath);
const fixture = JSON.parse(fixtureBytes.toString()) as {
  cases: Array<{
    id: string;
    source: { url: string; title: string; excerpts: string[] };
    expected: { publisherKind: string; mealSupport: string };
  }>;
};
const rows = paths.map((file) => {
  const bytes = readFileSync(file),
    receipt = JSON.parse(bytes.toString());
  const replay = prepareDiningReplay(receipt, true);
  if (
    receipt.provenance?.screenSources !== true ||
    replay.sources.length !== fixture.cases.length ||
    replay.sources.some(
      (s, i) =>
        s.url !== fixture.cases[i]!.source.url ||
        s.title !== fixture.cases[i]!.source.title ||
        JSON.stringify(s.excerptSegments) !==
          JSON.stringify(fixture.cases[i]!.source.excerpts),
    )
  )
    throw Error("Fixture does not match frozen sources");
  const result = parseDiningDiscovery(receipt.text) as {
    screening?: Array<{
      sourceId: string;
      publisherKind: string;
      mealSupport: string;
    }>;
  } | null;
  const predictions = result?.screening;
  if (
    !Array.isArray(predictions) ||
    predictions.length !== fixture.cases.length ||
    new Set(predictions.map((p) => p.sourceId)).size !== fixture.cases.length
  )
    throw Error("Incomplete or duplicate source assessments");
  const cases = fixture.cases.map((c, i) => {
    const actual = predictions.find((p) => p.sourceId === `source-${i}`);
    if (
      !actual ||
      !["operator_page", "third_party", "uncertain"].includes(
        actual.publisherKind,
      ) ||
      !["explicit", "contradicted", "not_established"].includes(
        actual.mealSupport,
      )
    )
      throw Error("Invalid source assessment");
    const accepted =
      actual.publisherKind === "operator_page" &&
      actual.mealSupport === "explicit";
    const expectedAccepted =
      c.expected.publisherKind === "operator_page" &&
      c.expected.mealSupport === "explicit";
    return {
      id: c.id,
      expected: c.expected,
      actual,
      publisherCorrect: actual.publisherKind === c.expected.publisherKind,
      mealCorrect: actual.mealSupport === c.expected.mealSupport,
      falseAcceptance: accepted && !expectedAccepted,
      falseExclusion: !accepted && expectedAccepted,
    };
  });
  return {
    file,
    receiptSha256: createHash("sha256").update(bytes).digest("hex"),
    cases,
    publisherCorrect: cases.filter((c) => c.publisherCorrect).length,
    mealCorrect: cases.filter((c) => c.mealCorrect).length,
    falseAcceptances: cases.filter((c) => c.falseAcceptance).length,
    falseExclusions: cases.filter((c) => c.falseExclusion).length,
  };
});
console.log(
  JSON.stringify(
    {
      fixtureSha256: createHash("sha256").update(fixtureBytes).digest("hex"),
      syntheticOnly: true,
      realVenueOwnershipVerified: false,
      rows,
    },
    null,
    2,
  ),
);
if (
  rows.some((r) => r.cases.some((c) => !c.publisherCorrect || !c.mealCorrect))
)
  process.exitCode = 1;
