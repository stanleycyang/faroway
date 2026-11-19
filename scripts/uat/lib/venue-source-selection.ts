import { parallelVenueSources } from "./venue-source-discovery";

const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** Frozen retrieval is candidate-bound. A saved receipt is not an authority certificate. */
export function prepareVenueSourceSelection(
  receipt: unknown,
  inputSha256: string,
) {
  const row = object(receipt);
  if (
    row.status !== "completed" ||
    object(row.provenance).inputSha256 !== inputSha256 ||
    !/^[a-f0-9]{64}$/.test(inputSha256) ||
    !Array.isArray(row.retrievalResults) ||
    row.retrievalResults.length > 10
  )
    throw Error(
      "Completed retrieval bound to this exact candidate input required",
    );
  const sources = parallelVenueSources(row.retrievalResults);
  if (
    !sources.length ||
    sources.length > 10 ||
    sources.reduce((total, source) => total + source.excerpt.length, 0) > 40000
  )
    throw Error("Requires 1–10 bounded retained source excerpts");
  return sources.map((source, index) => ({
    ...source,
    selectionId: `source_${index + 1}`,
  }));
}

export type SelectableVenueSource = ReturnType<
  typeof prepareVenueSourceSelection
>[number];

/** Only code supplies URLs. Unknown references or model-authored URLs are rejected. */
export function bindVenueSourceSelection(
  value: unknown,
  expectedId: string,
  sources: readonly SelectableVenueSource[],
) {
  const root = object(value);
  const venues = root.venues;
  const issues: string[] = [];
  if (
    Object.keys(root).some((key) => key !== "venues") ||
    !Array.isArray(venues) ||
    venues.length !== 1
  )
    return {
      issues: ["Expected one source selection"],
      extracted: undefined,
      selectedSources: [],
    };
  const lead = object(venues[0]);
  if (
    lead.id !== expectedId ||
    Object.keys(lead).some(
      (key) =>
        ![
          "id",
          "status",
          "sourceId",
          "matchedName",
          "matchedAddress",
          "nameQuote",
          "addressQuote",
          "note",
        ].includes(key),
    )
  )
    issues.push("Unexpected candidate identity or selection fields");
  const matches = sources.filter(
    (source) => source.selectionId === lead.sourceId,
  );
  if (
    lead.status === "candidate" ? matches.length !== 1 : lead.sourceId !== null
  )
    issues.push("Invalid retained source reference");
  if (issues.length)
    return { issues, extracted: undefined, selectedSources: [] };
  const { sourceId: _sourceId, ...fields } = lead;
  return {
    issues,
    extracted: {
      venues: [{ ...fields, officialUrl: matches[0]?.url ?? null }],
    },
    selectedSources: lead.status === "candidate" ? matches : [],
  };
}
