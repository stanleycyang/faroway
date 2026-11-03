/** Published structured addresses, not verified venue identities. No network or AI. */
const venueTypes = new Set([
  "LocalBusiness",
  "FoodEstablishment",
  "Restaurant",
  "CafeOrCoffeeShop",
  "Bakery",
  "BarOrPub",
  "Hotel",
  "LodgingBusiness",
  "Museum",
  "TouristAttraction",
]);
const schemaType = (value: string) =>
  value.replace(/^https?:\/\/schema\.org\//, "");
const text = (value: unknown, max = 500) =>
  typeof value === "string" && value.trim() && value.length <= max
    ? value.trim()
    : undefined;
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const types = (node: Record<string, unknown>) =>
  (Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]])
    .filter((value): value is string => typeof value === "string")
    .map(schemaType);
const fields = [
  "streetAddress",
  "addressLocality",
  "addressRegion",
  "postalCode",
  "addressCountry",
] as const;
export interface PublishedVenueAddress {
  venueName: string;
  entityId?: string;
  parentOrganizationId?: string;
  address: Partial<Record<(typeof fields)[number], string>>;
  sourceUrl: string;
  observedAt: string;
  /** JSON pointer within the numbered JSON-LD script; never a fetched reference. */
  sourcePointer: string;
  scriptIndex: number;
  issues: string[];
  branchIdentityVerified: false;
  publishedCoordinates?: { lat: number; lng: number; sourcePointer: string };
  coordinatesVerified: false;
}

export function extractPublishedVenueAddresses(input: {
  html: string;
  sourceUrl: string;
  observedAt: string;
  approvedSourceUrls: readonly string[];
}) {
  const source = new URL(input.sourceUrl);
  if (
    source.protocol !== "https:" ||
    source.username ||
    source.password ||
    !input.approvedSourceUrls.includes(input.sourceUrl)
  )
    throw new Error("Source is not an approved HTTPS page");
  const date = input.observedAt.slice(0, 10);
  const day = new Date(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:(?:0\d|1[0-3]):[0-5]\d|14:00))$/.test(
      input.observedAt,
    ) ||
    !Number.isFinite(day.getTime()) ||
    day.toISOString().slice(0, 10) !== date ||
    !Number.isFinite(Date.parse(input.observedAt))
  )
    throw new Error("Valid timezone-qualified observation timestamp required");
  if (input.html.length > 2_000_000)
    throw new Error("Source exceeds size limit");
  const addresses: PublishedVenueAddress[] = [];
  const issues: string[] = [];
  const seen = new Set<string>();
  const byId = new Map<string, PublishedVenueAddress[]>();
  const byAddress = new Map<string, PublishedVenueAddress[]>();
  const start = /<script\b/gi;
  const close = /<\/script\s*>/gi;
  let scripts = 0;
  let visited = 0;
  let match: RegExpExecArray | null;
  while ((match = start.exec(input.html))) {
    const endTag = input.html.indexOf(">", start.lastIndex);
    if (endTag < 0) break;
    close.lastIndex = endTag + 1;
    const closing = close.exec(input.html);
    if (!closing) break;
    const attributes = input.html.slice(start.lastIndex, endTag);
    const body = input.html.slice(endTag + 1, closing.index);
    start.lastIndex = close.lastIndex;
    if (!/(?:^|\s)type\s*=\s*["']application\/ld\+json["']/i.test(attributes))
      continue;
    if (++scripts > 32) throw new Error("Too many structured-data scripts");
    let root: unknown;
    try {
      root = JSON.parse(body);
    } catch {
      issues.push("malformed_json_ld");
      continue;
    }
    const queue = [{ value: root, pointer: "", depth: 0 }];
    for (let index = 0; index < queue.length; index++) {
      const { value, pointer, depth } = queue[index];
      if (++visited > 2048 || depth > 20)
        throw new Error("Structured-data traversal limit exceeded");
      if (!value || typeof value !== "object") continue;
      for (const [key, child] of Object.entries(value))
        if (child && typeof child === "object")
          queue.push({
            value: child,
            pointer: `${pointer}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`,
            depth: depth + 1,
          });
      if (Array.isArray(value)) continue;
      const node = object(value);
      if (!types(node).some((type) => venueTypes.has(type))) continue;
      const name = text(node.name, 300);
      const supplied = object(node.address);
      if (!name || !Object.keys(supplied).length) {
        issues.push("venue_missing_name_or_structured_address");
        continue;
      }
      if (supplied["@id"] && !supplied.streetAddress) {
        issues.push("unresolved_address_reference");
        continue;
      }
      if (supplied["@type"] && !types(supplied).includes("PostalAddress")) {
        issues.push("unsupported_address_type");
        continue;
      }
      const address: PublishedVenueAddress["address"] = {};
      const recordIssues: string[] = [];
      for (const field of fields) {
        // Country/region objects are not expanded or inferred from other fields.
        const value = text(supplied[field]);
        if (value) address[field] = value;
        else if (supplied[field] !== undefined)
          recordIssues.push(`unsupported_${field}`);
      }
      if (!address.streetAddress || !address.addressLocality) {
        issues.push("address_missing_street_or_locality");
        continue;
      }
      if (!address.addressCountry)
        recordIssues.push("country_not_reported_as_text");
      const entityId = text(node["@id"]);
      let publishedCoordinates: PublishedVenueAddress["publishedCoordinates"];
      if (node.geo !== undefined) {
        const geo = object(node.geo);
        const number = (value: unknown) =>
          typeof value === "number"
            ? value
            : typeof value === "string" &&
                value.length <= 50 &&
                /^[-+]?\d+(?:\.\d+)?$/.test(value.trim())
              ? Number(value)
              : NaN;
        const lat = number(geo.latitude),
          lng = number(geo.longitude);
        if (
          types(geo).includes("GeoCoordinates") &&
          Number.isFinite(lat) &&
          Math.abs(lat) <= 90 &&
          Number.isFinite(lng) &&
          Math.abs(lng) <= 180 &&
          !(lat === 0 && lng === 0)
        )
          publishedCoordinates = { lat, lng, sourcePointer: `${pointer}/geo` };
        else recordIssues.push("unsupported_or_invalid_published_coordinates");
      }
      // Conflicting coordinate claims must survive address deduplication.
      const identity = JSON.stringify([
        entityId,
        name,
        address,
        publishedCoordinates
          ? [publishedCoordinates.lat, publishedCoordinates.lng]
          : null,
      ]);
      if (seen.has(identity)) {
        issues.push("duplicate_venue_address");
        continue;
      }
      seen.add(identity);
      const record: PublishedVenueAddress = {
        venueName: name,
        entityId,
        parentOrganizationId: text(object(node.parentOrganization)["@id"]),
        address,
        sourceUrl: input.sourceUrl,
        observedAt: input.observedAt,
        sourcePointer: `${pointer}/address`,
        scriptIndex: scripts - 1,
        issues: recordIssues,
        branchIdentityVerified: false,
        publishedCoordinates,
        coordinatesVerified: false,
      };
      addresses.push(record);
      const addressKey = JSON.stringify([name, address]);
      byAddress.set(addressKey, [...(byAddress.get(addressKey) ?? []), record]);
      if (entityId) byId.set(entityId, [...(byId.get(entityId) ?? []), record]);
    }
  }
  for (const records of byId.values())
    if (records.length > 1)
      for (const record of records)
        record.issues.push("conflicting_records_for_entity_id");
  for (const records of byAddress.values()) {
    const points = new Set(
      records.flatMap((record) =>
        record.publishedCoordinates
          ? [
              JSON.stringify([
                record.publishedCoordinates.lat,
                record.publishedCoordinates.lng,
              ]),
            ]
          : [],
      ),
    );
    if (points.size > 1)
      for (const record of records)
        record.issues.push("conflicting_coordinates_for_published_address");
  }
  if (!scripts) issues.push("no_json_ld_scripts");
  if (!addresses.length) issues.push("no_extractable_venue_addresses");
  return {
    addresses,
    issues,
    sourceOwnershipVerified: false as const,
    openingHoursVerified: false as const,
    futureAvailabilityVerified: false as const,
  };
}
