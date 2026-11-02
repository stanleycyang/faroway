import { createHash } from "node:crypto";

export interface AvailabilityVisit {
  key: string;
  destination: string;
  date: string;
  slot: "morning" | "afternoon" | "evening";
  activity: {
    id: string;
    name: string;
    duration: number;
    location: { address: string };
  };
}
/** Separately adjudicated receipt, NOT an LLM extraction schema.
 * The reviewer establishes operator identity, ordinary-entry scope, completeness
 * of the hours section and applicability to the date range. Hashes bind that
 * review to retained excerpt bytes and the exact candidate; they do not confer
 * authority on an arbitrary page. Search leads alone cannot populate this type.
 */
export interface AdjudicatedHoursEvidence {
  sourceUrl: string;
  excerpt: string;
  excerptSha256: string;
  candidateSha256: string;
  hoursQuote: string;
  visitType: "ordinary_entry" | "other";
  observedAt: string;
  reviewAfter: string;
  appliesFrom: string;
  appliesThrough: string;
  identityAndScopeReview: string;
}
export const evidenceTextSha256 = (text: string) =>
  createHash("sha256").update(text).digest("hex");
export const availabilityCandidateSha256 = (visit: AvailabilityVisit) =>
  evidenceTextSha256(
    JSON.stringify({
      destination: visit.destination,
      id: visit.activity.id,
      name: visit.activity.name,
      address: visit.activity.location.address,
    }),
  );
const validDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
const clock = (text: string) => {
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/.exec(text);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  return ((hour % 12) + (match[3] === "pm" ? 12 : 0)) * 60 + minute;
};

/** Intentionally small grammar; unsupported semantics stay unknown. */
export function parseOrdinaryDailyHours(quote: string) {
  const text = quote
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  const match =
    /^open daily (?:from )?(\d{1,2}(?::\d{2})?\s*(?:am|pm))\s*(?:–|—|-|to)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm))(?:,? last entry (\d{1,2}(?::\d{2})?\s*(?:am|pm)))?\.?$/.exec(
      text,
    );
  if (!match) return null;
  const opens = clock(match[1]);
  const closes = clock(match[2]);
  const lastEntry = match[3] ? clock(match[3]) : null;
  if (
    opens === null ||
    closes === null ||
    (Boolean(match[3]) && lastEntry === null) ||
    opens >= closes ||
    (lastEntry !== null && (lastEntry < opens || lastEntry > closes))
  )
    return null;
  return { opens, closes, lastEntry };
}

/** Offline evidence checker for the repair prototype. No fetching, paid calls or
 * production integration. Compatible means whole-slot ordinary-hours fit only;
 * prices, reservations, routes, queues and accessibility remain unverified.
 */
export function assessOrdinaryHoursEvidence(
  visit: AvailabilityVisit,
  evidence: readonly AdjudicatedHoursEvidence[],
  asOf: string,
) {
  const unknown = (reason: string) => ({
    key: visit.key,
    status: "unknown" as const,
    reason,
    sourceUrls: [] as string[],
  });
  if (
    !validDate(asOf) ||
    !validDate(visit.date) ||
    !Number.isInteger(visit.activity.duration) ||
    visit.activity.duration < 1 ||
    visit.activity.duration > 1440 ||
    !["morning", "afternoon", "evening"].includes(visit.slot)
  )
    return unknown("invalid_visit_or_review_date");
  if (!evidence.length || evidence.length > 6)
    return unknown("missing_or_excessive_evidence");
  const windows: NonNullable<ReturnType<typeof parseOrdinaryDailyHours>>[] = [];
  for (const receipt of evidence) {
    try {
      const url = new URL(receipt.sourceUrl);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        !receipt.identityAndScopeReview.trim() ||
        receipt.visitType !== "ordinary_entry" ||
        receipt.candidateSha256 !== availabilityCandidateSha256(visit) ||
        !receipt.excerpt ||
        receipt.excerpt.length > 12000 ||
        receipt.excerptSha256 !== evidenceTextSha256(receipt.excerpt) ||
        !receipt.hoursQuote ||
        !receipt.excerpt.includes(receipt.hoursQuote) ||
        ![
          receipt.observedAt,
          receipt.reviewAfter,
          receipt.appliesFrom,
          receipt.appliesThrough,
        ].every(validDate) ||
        receipt.observedAt > asOf ||
        receipt.reviewAfter < asOf ||
        receipt.appliesFrom > visit.date ||
        receipt.appliesThrough < visit.date
      )
        return unknown("invalid_stale_or_out_of_scope_evidence");
    } catch {
      return unknown("invalid_stale_or_out_of_scope_evidence");
    }
    // A shorter extracted quote must not hide a visible exception in the
    // retained context. Unsupported exceptions need a richer checker.
    if (
      /\b(?:except|holidays?|by appointment|seasonal|special opening|closed for)\b/i.test(
        receipt.excerpt,
      )
    )
      return unknown("exception_context_requires_review");
    const hours = parseOrdinaryDailyHours(receipt.hoursQuote);
    if (!hours) return unknown("unsupported_hours_statement");
    windows.push(hours);
  }
  const first = windows[0];
  if (
    windows.some((window) => JSON.stringify(window) !== JSON.stringify(first))
  )
    return unknown("inconsistent_source_hours");
  const slots = {
    morning: [480, 720],
    afternoon: [720, 1080],
    evening: [1080, 1320],
  } as const;
  const [start, end] = slots[visit.slot];
  const duration = visit.activity.duration;
  const earliest = Math.max(start, first.opens);
  const latest = Math.min(
    end - duration,
    first.closes - duration,
    first.lastEntry ?? first.closes,
  );
  const conflict = earliest > latest;
  const entireSlotFits =
    first.opens <= start &&
    first.closes >= end &&
    first.lastEntry !== null &&
    first.lastEntry >= end - duration &&
    duration <= end - start;
  if (!conflict && first.lastEntry === null)
    return unknown("missing_last_entry_evidence");
  if (!conflict && !entireSlotFits)
    return unknown("partial_window_requires_exact_start_time");
  return {
    key: visit.key,
    status: conflict
      ? ("conflict" as const)
      : ("ordinary_hours_compatible" as const),
    reason: conflict
      ? "no_ordinary_start_fits_slot_and_duration"
      : "ordinary_hours_cover_entire_slot",
    evidenceSha256: evidenceTextSha256(
      JSON.stringify({ visit, evidence, asOf }),
    ),
    sourceUrls: [...new Set(evidence.map((receipt) => receipt.sourceUrl))],
  };
}
