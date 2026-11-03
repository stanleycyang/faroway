import { createHash } from "node:crypto";

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const text = (value: unknown, max: number): value is string =>
  typeof value === "string" && !!value.trim() && value.length <= max;

/** Match whitespace only, returning offsets into the original UTF-16 string. */
function sourceSpan(source: string, requested: string) {
  let normalized = "";
  const starts: number[] = [];
  const ends: number[] = [];
  for (let i = 0; i < source.length; i++) {
    const char = /\s/u.test(source[i]!) ? " " : source[i]!;
    if (char === " " && normalized.endsWith(" ")) {
      ends[ends.length - 1] = i + 1;
      continue;
    }
    normalized += char;
    starts.push(i);
    ends.push(i + 1);
  }
  const needle = requested.replace(/\s+/gu, " ").trim();
  const index = needle ? normalized.indexOf(needle) : -1;
  if (index < 0) return undefined;
  const startUtf16 = starts[index]!;
  const endUtf16 = ends[index + needle.length - 1]!;
  return {
    startUtf16,
    endUtf16,
    sourceText: source.slice(startUtf16, endUtf16),
  };
}

/** Copy evidence only. A page can describe multiple branches or be unauthoritative. */
export function auditVenueIdentityExcerpts(
  rawLeads: readonly unknown[],
  rawSources: readonly unknown[],
) {
  return rawLeads.map((raw) => {
    const lead = object(raw);
    const issues: string[] = [];
    const bindings: Array<{
      field: string;
      sourceField: "title" | "excerpt";
      /** -1 for title evidence; otherwise an original excerpt segment index. */
      segmentIndex: number;
      startUtf16: number;
      endUtf16: number;
      sourceText: string;
      sourceValue: string;
    }> = [];
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
      const excerptMatch =
        text(quote, 1000) && validSegments
          ? segments
              .map((segment, segmentIndex) => ({
                sourceField: "excerpt" as const,
                segmentIndex,
                span: sourceSpan(segment, quote),
              }))
              .find((row) => row.span)
          : undefined;
      // Search titles are retained metadata, not page-body excerpts. Only names
      // may use them, and the binding makes that weaker evidence explicit.
      const titleSpan =
        field === "matchedName" &&
        source &&
        text(source.title, 2000) &&
        text(quote, 1000)
          ? sourceSpan(source.title, quote)
          : undefined;
      const match =
        excerptMatch ??
        (titleSpan
          ? { sourceField: "title" as const, segmentIndex: -1, span: titleSpan }
          : undefined);
      if (!match?.span) issues.push(`${quoteField}_not_in_source_segment`);
      const valueSpan =
        text(value, max) && text(quote, 1000)
          ? sourceSpan(quote, value)
          : undefined;
      if (!valueSpan) issues.push(`${field}_not_in_quote`);
      if (match?.span && valueSpan && text(value, max)) {
        const originalValue = sourceSpan(match.span.sourceText, value);
        if (originalValue)
          bindings.push({
            field,
            sourceField: match.sourceField,
            segmentIndex: match.segmentIndex,
            ...match.span,
            sourceValue: originalValue.sourceText,
          });
        else issues.push(`${field}_not_in_original_quote`);
      }
    }
    return {
      id: typeof lead.id === "string" ? lead.id : null,
      copiedIdentityTextLinked: issues.length === 0,
      bindings,
      sourceContentSha256:
        source && validSegments
          ? createHash("sha256")
              .update(
                JSON.stringify({
                  url: source.url,
                  title: text(source.title, 2000) ? source.title : null,
                  segments,
                }),
              )
              .digest("hex")
          : null,
      issues,
      sourceAuthorityVerified: false as const,
      branchIdentityVerified: false as const,
      qualityAccepted: false as const,
    };
  });
}
