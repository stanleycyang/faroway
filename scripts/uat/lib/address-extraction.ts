import type { VenueAddressEvidence } from "./venue-address-evidence";
import type { RetrievedVenuePage } from "./grounding-evidence";

export type AddressExtractionRequest = Pick<
  VenueAddressEvidence,
  "id" | "destination" | "aliases" | "sourceUrl"
> & { sourceAddress?: string };

export function validateAddressRequests(
  value: unknown,
): AddressExtractionRequest[] {
  if (!Array.isArray(value) || !value.length || value.length > 8)
    throw new Error("Requires 1–8 address requests");
  const ids = new Set<string>();
  for (const row of value) {
    if (
      !row ||
      typeof row !== "object" ||
      typeof row.id !== "string" ||
      !row.id.trim() ||
      row.id.length > 100 ||
      ids.has(row.id) ||
      typeof row.destination !== "string" ||
      !row.destination.trim() ||
      row.destination.length > 200 ||
      !Array.isArray(row.aliases) ||
      !row.aliases.length ||
      row.aliases.length > 5 ||
      !row.aliases.every(
        (name: unknown) =>
          typeof name === "string" && name.trim() && name.length <= 200,
      ) ||
      typeof row.sourceUrl !== "string" ||
      row.sourceUrl.length > 2048 ||
      (row.sourceAddress !== undefined &&
        (typeof row.sourceAddress !== "string" ||
          !row.sourceAddress.trim() ||
          row.sourceAddress.length > 500))
    )
      throw new Error("Invalid or duplicate address request");
    const url = new URL(row.sourceUrl);
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error("Approved source must be HTTPS without credentials");
    ids.add(row.id);
  }
  return value.map(
    ({ id, destination, aliases, sourceUrl, sourceAddress }) => ({
      id,
      destination,
      aliases,
      sourceUrl,
      ...(sourceAddress === undefined ? {} : { sourceAddress }),
    }),
  );
}

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
  facts: AddressExtractionRequest[],
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
        fact.sourceAddress === undefined
          ? null
          : issues.length === 0 && address === normalize(fact.sourceAddress),
      referenceAddressProvided: fact.sourceAddress !== undefined,
      branchIdentityVerified: false as const,
      coordinatesVerified: false as const,
      issues,
    };
  });
}
