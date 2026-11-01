/** Identity anchors must come from reviewed sources, never generated aliases.
 * A match links a candidate to those anchors; it does not verify any venue fact.
 */
export interface ReviewedVenueIdentity {
  id: string;
  destination: string;
  aliases: string[];
  addresses: string[];
  country?: "Australia" | "Canada" | "France";
}

export interface VenueIdentityCandidate {
  destination: string;
  name: string;
  address: string;
}

const normalize = (value: string) =>
  value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

function title(value: string, ordinaryVisit: boolean) {
  let result = normalize(value.replace(/[()]/g, " ")).replace(
    /\s+[-–—]\s+/g,
    " ",
  );
  if (ordinaryVisit)
    result = result.replace(
      /\s+(?:(?:morning|afternoon|evening)\s+)?visit$/,
      "",
    );
  return result.trim();
}

function address(value: string, country?: ReviewedVenueIdentity["country"]) {
  let result = normalize(value);
  if (country) {
    const suffix = `, ${country.toLowerCase()}`;
    if (result.endsWith(suffix)) result = result.slice(0, -suffix.length);
  }
  if (country === "France")
    result = result
      .replace(/\bav\.?\s/g, "avenue ")
      .replace(/\bdr\.?\s/g, "docteur ");
  return result;
}

/** Exact anchors after bounded formatting normalization; no fuzzy/subset match.
 * Only the ordinary-visit consumer may strip a day-part/visit suffix. Exterior
 * walks, events, tours, special openings and branch qualifiers remain intact.
 */
export function resolveReviewedVenue<T extends ReviewedVenueIdentity>(
  candidate: VenueIdentityCandidate,
  sources: readonly T[],
  scope: "venue" | "ordinary_visit" = "venue",
): {
  status: "matched" | "ambiguous" | "unresolved";
  reason:
    | "reviewed_name_and_address"
    | "multiple_reviewed_anchors"
    | "missing_identity"
    | "no_joint_match";
  matches: T[];
} {
  if (
    ![candidate.destination, candidate.name, candidate.address].every((v) =>
      normalize(v),
    )
  )
    return { status: "unresolved", reason: "missing_identity", matches: [] };
  const matches = sources.filter(
    (source) =>
      normalize(source.destination) === normalize(candidate.destination) &&
      source.aliases.some(
        (alias) =>
          title(alias, scope === "ordinary_visit") ===
          title(candidate.name, scope === "ordinary_visit"),
      ) &&
      source.addresses.some(
        (anchor) =>
          address(anchor, source.country) ===
          address(candidate.address, source.country),
      ),
  );
  return {
    status:
      matches.length === 1
        ? "matched"
        : matches.length
          ? "ambiguous"
          : "unresolved",
    reason:
      matches.length === 1
        ? "reviewed_name_and_address"
        : matches.length
          ? "multiple_reviewed_anchors"
          : "no_joint_match",
    matches,
  };
}
