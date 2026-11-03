import { createHash } from "node:crypto";
import type { HotelConstraint } from "./hotel-constraints";

export interface HotelSourcePage {
  url: string;
  observedAt: string;
  text?: string;
  error?: string;
}

const normalize = (value: string) =>
  value.normalize("NFKC").replace(/\s+/g, " ").trim();

function timestamp(value: string) {
  if (
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    )
  )
    return NaN;
  const date = value.slice(0, 10);
  const day = Date.parse(date + "T00:00:00Z");
  if (
    !Number.isFinite(day) ||
    new Date(day).toISOString().slice(0, 10) !== date
  )
    return NaN;
  return Date.parse(value);
}

/** A review packet, never a renewal. Presence of snippets cannot establish scope
 * or exclude a contradictory policy elsewhere in the page.
 */
export function reviewHotelSourceRefresh(
  facts: readonly HotelConstraint[],
  pages: readonly HotelSourcePage[],
  checkedAt: string,
) {
  const now = timestamp(checkedAt);
  if (!Number.isFinite(now))
    throw new Error("Valid refresh check time required");
  if (!facts.length) throw new Error("Nonempty hotel evidence required");
  if (new Set(facts.map((fact) => fact.id)).size !== facts.length)
    throw new Error("Duplicate hotel evidence IDs");
  const rows = facts.map((fact) => {
    const matches = pages.filter((page) => page.url === fact.sourceUrl);
    const issues: string[] = [];
    const page = matches.length === 1 ? matches[0] : undefined;
    if (matches.length !== 1)
      issues.push(
        matches.length ? "ambiguous_source_receipts" : "source_not_retrieved",
      );
    else if (page?.error || !page?.text?.trim())
      issues.push("source_not_retrieved");
    const fetchedAt = timestamp(page?.observedAt ?? "");
    if (
      page &&
      (!Number.isFinite(fetchedAt) ||
        fetchedAt > now ||
        now - fetchedAt > 24 * 60 * 60 * 1000)
    )
      issues.push("retrieval_outside_review_window");
    const anchors = fact.reviewChecks ?? [];
    if (
      !anchors.length ||
      anchors.some((anchor) => normalize(anchor).length < 10)
    )
      issues.push("review_anchors_missing_or_invalid");
    const text = page?.text && !page.error ? normalize(page.text) : "";
    const missingAnchors = anchors.filter(
      (anchor) => !text.includes(normalize(anchor)),
    );
    if (missingAnchors.length)
      issues.push("review_anchors_missing_from_source");
    return {
      evidenceId: fact.id,
      propertyName: fact.name,
      sourceUrl: fact.sourceUrl,
      priorObservedAt: fact.observedAt,
      priorReviewAfter: fact.reviewAfter ?? null,
      retrievedAt: page?.observedAt ?? null,
      sourceTextSha256: text
        ? createHash("sha256").update(text).digest("hex")
        : null,
      status: issues.length ? "needs_investigation" : "ready_for_policy_review",
      issues,
      missingAnchors,
      canRenewAutomatically: false,
    };
  });
  return {
    checkedAt,
    retrievalReviewWindowHours: 24,
    rows,
    policyVerified: false,
    evidenceUpdated: false,
    nextAction:
      "Review the retrieved page for exact property identity, policy scope and contradictory text before recording a new observation/deadline. A successful fetch or matching snippet is insufficient.",
  };
}
