import { createHash } from "node:crypto";
import catalog from "../../fixtures/reviewed-activity-supply.json";

export interface RecordedReviewedSupply {
  catalogSha256: string;
  capturedAt: string;
  candidates: unknown[];
}
export const reviewedSupplyCatalogSha256 = createHash("sha256")
  .update(JSON.stringify(catalog))
  .digest("hex");
const object = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
const normalize = (s: string) => s.normalize("NFKC").trim().toLowerCase();
// Compare full candidate data, independent of property insertion order.
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value) ?? "undefined";
};
function expected(record: (typeof catalog)[number]) {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    category: record.category,
    duration: record.durationMinutes,
    proposedVisitType:
      record.proposedVisitType === "event" ? "event" : "ordinary_entry",
    price: 0,
    currency: "",
    priceStatus: "unknown",
    rating: 0,
    reviewCount: 0,
    location: { name: record.name, address: record.address, lat: 0, lng: 0 },
    images: [],
    bestTimeOfDay: "any",
    vibeScore: 60,
    vibeMatch: [],
    bookingRequired: true,
  };
}
/** Separate from runtime admission and aggregator output. Passing proves only
 * consistency with this trusted catalog revision, not accuracy of its sources.
 */
export function evaluateRecordedSupply(
  value: unknown,
  original: unknown[],
  destination: string,
  interests: string[],
  startedAt: string,
) {
  const failures: string[] = [];
  const accepted: ReturnType<typeof expected>[] = [];
  if (value === undefined) return { failures, accepted };
  const input = object(value);
  const captured = typeof input.capturedAt === "string" ? input.capturedAt : "";
  const asOf = captured.slice(0, 10);
  if (
    input.catalogSha256 !== reviewedSupplyCatalogSha256 ||
    !Array.isArray(input.candidates) ||
    !Number.isFinite(Date.parse(captured)) ||
    !Number.isFinite(Date.parse(startedAt)) ||
    Date.parse(captured) < Date.parse(startedAt)
  ) {
    return { failures: ["invalid_reviewed_supply_provenance"], accepted };
  }
  const seen = new Set<unknown>();
  for (const raw of input.candidates) {
    const candidate = object(raw);
    const record = catalog.find((r) => r.id === candidate.id);
    if (
      !record ||
      seen.has(candidate.id) ||
      original.some(
        (v) =>
          object(v).id === candidate.id ||
          (typeof object(v).name === "string" &&
            normalize(object(v).name as string) === normalize(record.name)),
      ) ||
      normalize(record.destination) !== normalize(destination) ||
      !record.interests.some((i) =>
        interests.some((w) => normalize(w) === normalize(i)),
      ) ||
      asOf < record.observedAt ||
      asOf > record.reviewAfter ||
      canonical(candidate) !== canonical(expected(record))
    ) {
      failures.push(
        `invalid_reviewed_supply_candidate:${String(candidate.id)}`,
      );
      continue;
    }
    seen.add(candidate.id);
    accepted.push(expected(record));
  }
  // Atomic provenance boundary: ambiguous/invalid records never legitimize IDs.
  return { failures, accepted: failures.length ? [] : accepted };
}
export function reviewedSupplySelectionFailures(
  raw: unknown,
  date: string,
  slot: string,
): string[] {
  const candidate = object(raw);
  const record = catalog.find((r) => r.id === candidate.id);
  if (!record) return ["unknown_reviewed_supply_selection"];
  const failures: string[] = [];
  if (canonical(candidate) !== canonical(expected(record)))
    failures.push("reviewed_supply_selection_changed");
  const excludedDates: readonly string[] = record.excludedDates;
  if (
    date < record.validFrom ||
    date > record.validThrough ||
    excludedDates.includes(date)
  )
    failures.push("reviewed_supply_date_not_supported");
  const window: Record<string, [number, number]> = {
    morning: [480, 720],
    afternoon: [720, 1080],
    evening: [1080, 1320],
  };
  const interval = window[slot];
  if (
    !interval ||
    record.opens > interval[0] ||
    record.closes < interval[1] ||
    (record.lastEntry ?? record.closes) < interval[1] - record.durationMinutes
  )
    failures.push("reviewed_supply_hours_not_supported");
  return failures;
}
