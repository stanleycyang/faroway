import type { RetrievedVenuePage } from "./grounding-evidence";

export interface HotelFactClaim {
  id: string;
  sourceUrl: string;
  value: number | boolean | null;
  scope: string;
  room: string | null;
  evidenceQuote: string;
}
export interface HotelFactCase {
  id: string;
  sourceUrl: string;
  expectedValue: number | boolean | null;
  expectedScope: string;
  expectedRoom: string | null;
  quoteAnchors: string[];
  quoteAnchorAlternatives?: string[][];
}
const normalize = (s: string) =>
  s.normalize("NFKC").replace(/\s+/g, " ").trim();

/** Scores reviewed development answers. This is not a general semantic verifier. */
export function evaluateHotelFacts(
  claims: HotelFactClaim[],
  cases: HotelFactCase[],
  pages: RetrievedVenuePage[],
) {
  const unexpectedIds = claims
    .filter((c) => !cases.some((f) => f.id === c.id))
    .map((c) => c.id);
  const results = cases.map((fact) => {
    const matches = claims.filter((c) => c.id === fact.id);
    const claim = matches.length === 1 ? matches[0] : undefined;
    const sources = pages.filter((p) => p.url === fact.sourceUrl);
    const source = sources.length === 1 ? sources[0] : undefined;
    const issues: string[] = [];
    if (!claim)
      issues.push(matches.length ? "duplicate_claim" : "missing_claim");
    if (!source?.text || source.error) issues.push("source_not_retrieved");
    if (claim) {
      if (claim.sourceUrl !== fact.sourceUrl) issues.push("unapproved_source");
      if (claim.value !== fact.expectedValue) issues.push("wrong_value");
      if (claim.scope !== fact.expectedScope) issues.push("wrong_scope");
      if (claim.room !== fact.expectedRoom) issues.push("wrong_room");
      const quote = normalize(claim.evidenceQuote);
      if (fact.expectedValue === null) {
        if (quote) issues.push("unknown_should_not_invent_evidence");
      } else {
        if (
          quote.length < 12 ||
          quote.length > 600 ||
          !source?.text ||
          !normalize(source.text).includes(quote)
        )
          issues.push("quote_not_in_source");
        const anchorGroups = [
          fact.quoteAnchors,
          ...(fact.quoteAnchorAlternatives ?? []),
        ];
        if (
          !anchorGroups.some(
            (anchors) =>
              anchors.length > 0 &&
              anchors.every((anchor) =>
                quote.toLowerCase().includes(normalize(anchor).toLowerCase()),
              ),
          )
        )
          issues.push("missing_scope_or_identity_evidence");
      }
    }
    return { id: fact.id, passed: issues.length === 0, issues };
  });
  return {
    passed:
      unexpectedIds.length === 0 &&
      results.length > 0 &&
      results.every((r) => r.passed),
    results,
    unexpectedIds,
    productionPolicyVerified: false as const,
    futureAvailabilityVerified: false as const,
  };
}
