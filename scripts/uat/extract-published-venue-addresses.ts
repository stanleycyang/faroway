/** Offline extraction from explicitly approved local page receipts. Never fetches URLs. */
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  statSync,
  existsSync,
} from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import { extractPublishedVenueAddresses } from "./lib/published-venue-addresses";
const [input, output] = process.argv.slice(2);
if (!input || !output || existsSync(output))
  throw new Error(
    "Usage: extract-published-venue-addresses.ts APPROVED_MANIFEST NEW_OUTPUT",
  );
const bytes = readFileSync(input);
const manifest = JSON.parse(bytes.toString());
if (
  !Array.isArray(manifest.approvedSourceUrls) ||
  !manifest.approvedSourceUrls.every((s: unknown) => typeof s === "string") ||
  !Array.isArray(manifest.pages) ||
  !manifest.pages.length ||
  manifest.pages.length > 20 ||
  !manifest.pages.every((page: unknown) => {
    if (!page || typeof page !== "object") return false;
    const row = page as Record<string, unknown>;
    return (
      ["url", "file", "sha256", "observedAt"].every(
        (field) => typeof row[field] === "string",
      ) && /^[a-f0-9]{64}$/.test(String(row.sha256))
    );
  }) ||
  new Set(manifest.pages.map((page: { url?: unknown }) => page?.url)).size !==
    manifest.pages.length
)
  throw new Error("Invalid bounded source manifest");
const rows = manifest.pages.map(
  (page: { url: string; file: string; sha256: string; observedAt: string }) => {
    try {
      const file = resolve(dirname(resolve(input)), page.file);
      if (statSync(file).size > 2_000_000)
        throw new Error("Source exceeds byte limit");
      const body = readFileSync(file);
      const hash = createHash("sha256").update(body).digest("hex");
      if (hash !== page.sha256) throw new Error("Source content hash mismatch");
      return {
        sourceUrl: page.url,
        sourceSha256: hash,
        ...extractPublishedVenueAddresses({
          html: body.toString("utf8"),
          sourceUrl: page.url,
          observedAt: page.observedAt,
          approvedSourceUrls: manifest.approvedSourceUrls,
        }),
      };
    } catch (error) {
      return {
        sourceUrl: page.url,
        error: error instanceof Error ? error.message : "Extraction failed",
      };
    }
  },
);
const report = {
  modelCalls: 0,
  qualityAccepted: false,
  reviewRequired: true,
  manifestSha256: createHash("sha256").update(bytes).digest("hex"),
  extractorSha256: createHash("sha256")
    .update(
      readFileSync(
        resolve(import.meta.dirname, "lib/published-venue-addresses.ts"),
      ),
    )
    .digest("hex"),
  sourcesExpected: manifest.pages.length,
  rows,
};
mkdirSync(dirname(resolve(output)), { recursive: true, mode: 0o700 });
writeFileSync(output, JSON.stringify(report, null, 2), {
  mode: 0o600,
  flag: "wx",
});
console.log(
  JSON.stringify({
    sourcesExpected: report.sourcesExpected,
    sourcesExtracted: rows.filter(
      (row: { addresses?: unknown[] }) => row.addresses?.length,
    ).length,
    modelCalls: 0,
    qualityAccepted: false,
  }),
);
if (
  rows.some(
    (row: { error?: string; addresses?: unknown[] }) =>
      row.error || !row.addresses?.length,
  )
)
  process.exitCode = 1;
