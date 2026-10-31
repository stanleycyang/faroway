/** Evidence linkage is necessary, but never sufficient, to verify a venue claim. */
export interface GroundedVenueClaim {
  id: string;
  sourceUrl: string;
  closedWeekdays: number[];
  temporarilyClosed: boolean | null;
  evidenceQuote: string;
}
export interface RetrievedVenuePage {
  url: string;
  text?: string;
  error?: string;
}
const normalize = (text: string) =>
  text.normalize("NFKC").replace(/\s+/g, " ").trim();
export function auditGroundingEvidence(
  claims: GroundedVenueClaim[],
  expectedSources: Record<string, string>,
  pages: RetrievedVenuePage[],
  visitDate: string,
) {
  const date = new Date(visitDate + "T12:00:00Z");
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== visitDate
  )
    throw new Error("Invalid visit date");
  const duplicateIds = new Set(
    claims
      .filter(
        (claim, index) => claims.findIndex((c) => c.id === claim.id) !== index,
      )
      .map((c) => c.id),
  );
  const results = claims.map((claim) => {
    const issues: string[] = [];
    const expected = expectedSources[claim.id];
    const page = pages.find((p) => p.url === expected);
    if (!expected || claim.sourceUrl !== expected)
      issues.push("unapproved_source");
    if (duplicateIds.has(claim.id)) issues.push("duplicate_venue");
    if (!page?.text || page.error) issues.push("source_not_retrieved");
    const quote = normalize(claim.evidenceQuote);
    if (!quote || quote.length < 12) issues.push("missing_evidence_quote");
    else if (!page?.text || !normalize(page.text).includes(quote))
      issues.push("quote_not_in_source");
    if (
      claim.closedWeekdays.some(
        (day) => !Number.isInteger(day) || day < 0 || day > 6,
      )
    )
      issues.push("invalid_weekday");
    // Derived review flags, not availability assertions. Claim meaning still needs validation.
    const reviewFlags: string[] = [];
    if (!issues.length) {
      if (claim.closedWeekdays.includes(date.getUTCDay()))
        reviewFlags.push("reported_closed_weekday_needs_review");
      if (claim.temporarilyClosed === true)
        reviewFlags.push("reopening_confirmation_required");
    }
    return {
      id: claim.id,
      evidenceLinked: issues.length === 0,
      claimVerified: false as const,
      issues,
      reviewFlags,
    };
  });
  for (const id of Object.keys(expectedSources)) {
    if (!claims.some((c) => c.id === id))
      results.push({
        id,
        evidenceLinked: false,
        claimVerified: false,
        issues: ["missing_venue"],
        reviewFlags: [],
      });
  }
  return { results, futureAvailabilityVerified: false as const };
}
