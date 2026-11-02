import { createHash } from "node:crypto";

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && !!value.trim() && value.length <= max;

/** Copy evidence only. A page can describe multiple branches or be unauthoritative. */
export function auditVenueIdentityExcerpts(
  rawLeads: readonly unknown[],
  rawSources: readonly unknown[],
) {
  return rawLeads.map((raw) => {
    const lead = object(raw);
    const issues: string[] = [];
    if (!text(lead.id, 100) || !text(lead.officialUrl, 2048))
      issues.push("invalid_identity_or_source_reference");
    const sources = rawSources
      .map(object)
      .filter((s) => s.url === lead.officialUrl);
    const source = sources.length === 1 ? sources[0] : undefined;
    // Never turn separate search snippets into a fictitious contiguous quotation.
    const segments = source?.excerptSegments;
    const validSegments =
      Array.isArray(segments) &&
      segments.length > 0 &&
      segments.length <= 20 &&
      segments.every((s) => text(s, 20000));
    if (lead.status !== "candidate") issues.push("identity_unresolved");
    if (!source || !validSegments)
      issues.push("unique_source_excerpt_required");
    for (const [field, quoteField, max] of [
      ["matchedName", "nameQuote", 200],
      ["matchedAddress", "addressQuote", 500],
    ] as const) {
      const value = lead[field];
      const quote = lead[quoteField];
      if (!text(value, max)) issues.push(`${field}_unknown`);
      if (
        !text(quote, 1000) ||
        !validSegments ||
        !segments.some((segment) => segment.includes(quote))
      )
        issues.push(`${quoteField}_not_in_source_segment`);
      if (!text(value, max) || !text(quote, 1000) || !quote.includes(value))
        issues.push(`${field}_not_in_quote`);
    }
    return {
      id: typeof lead.id === "string" ? lead.id : null,
      copiedIdentityTextLinked: issues.length === 0,
      sourceContentSha256:
        source && validSegments
          ? createHash("sha256")
              .update(JSON.stringify({ url: source.url, segments }))
              .digest("hex")
          : null,
      issues,
      sourceAuthorityVerified: false as const,
      branchIdentityVerified: false as const,
      qualityAccepted: false as const,
    };
  });
}
