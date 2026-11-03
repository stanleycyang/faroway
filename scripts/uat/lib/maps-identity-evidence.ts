const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** Provider metadata only. Never parse place IDs from generated prose or web chunks. */
export function auditMapsIdentityEvidence(
  metadata: unknown,
  generatedText?: string,
) {
  const grounding = object(object(object(metadata).google).groundingMetadata);
  const chunks = grounding.groundingChunks;
  const places = new Map<
    string,
    {
      placeId: string;
      sources: Array<{ url: string; title: string; kind: "place" | "review" }>;
    }
  >();
  let rejectedMapChunks = 0;
  if (Array.isArray(chunks))
    for (const chunk of chunks) {
      const raw = object(chunk);
      if (!raw.maps) continue;
      const maps = object(raw.maps);
      try {
        if (
          typeof maps.placeId !== "string" ||
          typeof maps.uri !== "string" ||
          maps.uri.length > 4096 ||
          typeof maps.title !== "string" ||
          !maps.title.trim() ||
          maps.title.length > 1000
        )
          throw Error();
        const placeId = maps.placeId.replace(/^places\//, "");
        if (!/^[A-Za-z0-9_-]{10,255}$/.test(placeId)) throw Error();
        const url = new URL(maps.uri);
        if (
          url.protocol !== "https:" ||
          url.username ||
          url.password ||
          url.port ||
          !["maps.google.com", "www.google.com"].includes(url.hostname) ||
          !(
            url.pathname === "/maps" ||
            url.pathname.startsWith("/maps/") ||
            (url.hostname === "maps.google.com" && url.pathname === "/")
          )
        )
          throw Error();
        const review =
          url.pathname === "/maps/reviews" ||
          url.pathname.startsWith("/maps/reviews/");
        const direct =
          ((url.pathname === "/maps" || url.pathname === "/") &&
            /^\d+$/.test(url.searchParams.get("cid") ?? "")) ||
          url.pathname.startsWith("/maps/place/") ||
          url.searchParams.get("query_place_id") === placeId;
        if (!review && !direct) throw Error();
        const kind = review ? "review" : "place";
        const place = places.get(placeId) ?? { placeId, sources: [] };
        if (!place.sources.some((s) => s.url === maps.uri))
          place.sources.push({ url: maps.uri, title: maps.title, kind });
        places.set(placeId, place);
      } catch {
        rejectedMapChunks++;
      }
    }
  const candidates = [...places.values()];
  const sourceIds = new Map<string, Set<string>>();
  for (const place of candidates)
    for (const source of place.sources) {
      const ids = sourceIds.get(source.url) ?? new Set<string>();
      ids.add(place.placeId);
      sourceIds.set(source.url, ids);
    }
  const conflictingSourceUrls = [...sourceIds]
    .filter(([, ids]) => ids.size > 1)
    .map(([url]) => url);
  const directPlaceCandidates = candidates.filter((place) =>
    place.sources.some((s) => s.kind === "place"),
  );
  const backedUrls = new Set(
    candidates.flatMap((place) => place.sources.map((source) => source.url)),
  );
  const modelMapUrls = [
    ...new Set(
      (
        generatedText?.match(
          /https:\/\/(?:maps\.google\.com|www\.google\.com)\/[^\s<>"`)]*/g,
        ) ?? []
      )
        .map((url) => url.replace(/[.,;!]+$/, ""))
        .filter((url) => {
          try {
            const parsed = new URL(url);
            return (
              parsed.hostname === "maps.google.com" ||
              parsed.pathname.startsWith("/maps")
            );
          } catch {
            return false;
          }
        }),
    ),
  ];
  const unbackedModelMapUrls = modelMapUrls.filter(
    (url) => !backedUrls.has(url),
  );
  return {
    candidates,
    citationCoverageChecked: generatedText !== undefined,
    modelMapCitationCount: modelMapUrls.length,
    unbackedModelMapUrls,
    backedModelMapUrls: modelMapUrls.filter((url) => backedUrls.has(url)),
    uniquePlaceCount: candidates.length,
    directPlaceCount: directPlaceCandidates.length,
    retrievalEvidencePresent:
      directPlaceCandidates.length > 0 && conflictingSourceUrls.length === 0,
    conflictingSourceUrls,
    rejectedMapChunks,
    inputIdentityVerified: false as const,
    addressVerified: false as const,
    qualityAccepted: false as const,
  };
}
