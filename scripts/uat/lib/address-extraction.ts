import type { VenueAddressEvidence } from "./venue-address-evidence";
import type { RetrievedVenuePage } from "./grounding-evidence";

export interface ExtractedAddress {
  id: string;
  sourceUrl: string;
  address: string | null;
  evidenceQuote: string;
}
const normalize = (s: string) =>
  s.normalize("NFKC").replace(/\s+/g, " ").trim();

/** Verifies copied text, not branch identity or suitability. No automatic itinerary edits. */
export function auditAddressExtraction(
  claims: ExtractedAddress[],
  facts: VenueAddressEvidence[],
  pages: RetrievedVenuePage[],
) {
  return facts.map((fact) => {
    const matches = claims.filter((c) => c.id === fact.id);
    const claim = matches.length === 1 ? matches[0] : undefined;
    const source = pages.filter((p) => p.url === fact.sourceUrl);
    const page = source.length === 1 ? source[0] : undefined;
    const issues: string[] = [];
    if (!claim)
      issues.push(matches.length ? "duplicate_claim" : "missing_claim");
    if (claim && claim.sourceUrl !== fact.sourceUrl)
      issues.push("unapproved_source");
    if (!page?.text || page.error) issues.push("source_not_retrieved");
    const quote = normalize(claim?.evidenceQuote ?? "");
    const address = normalize(claim?.address ?? "");
    if (!address) issues.push("address_unknown");
    if (
      quote.length < 12 ||
      !page?.text ||
      !normalize(page.text).includes(quote)
    )
      issues.push("quote_not_in_source");
    if (!address || !quote.includes(address))
      issues.push("address_not_in_quote");
    return {
      id: fact.id,
      evidenceLinked: issues.length === 0,
      matchesReviewedAddress:
        issues.length === 0 && address === normalize(fact.sourceAddress),
      branchIdentityVerified: false as const,
      coordinatesVerified: false as const,
      issues,
    };
  });
}
