/** Retrieved public-page attribution; not a booking or verification certificate. */
export interface VenueSource {
  url: string;
  retrievedOn: string;
}

export interface DiningReviewOption {
  id: string;
  name: string;
  address: string;
  source: VenueSource;
}

/** Small public review collection, never converted into scheduled meals. */
export function readDiningReviewOptions(value: unknown): DiningReviewOption[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.slice(0, 6).flatMap((raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
    const row = raw as Record<string, unknown>;
    const source = readVenueSource(row.source);
    if (
      !source ||
      typeof row.id !== "string" ||
      !row.id.trim() ||
      row.id.length > 100 ||
      seen.has(row.id) ||
      typeof row.name !== "string" ||
      !row.name.trim() ||
      row.name.length > 200 ||
      typeof row.address !== "string" ||
      !row.address.trim() ||
      row.address.length > 500
    )
      return [];
    seen.add(row.id);
    return [{ id: row.id, name: row.name, address: row.address, source }];
  });
}

export function readVenueSource(value: unknown): VenueSource | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const row = value as Record<string, unknown>;
  if (
    typeof row.url !== "string" ||
    row.url.length > 2048 ||
    typeof row.retrievedOn !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(row.retrievedOn)
  )
    return;
  const date = new Date(`${row.retrievedOn}T00:00:00Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== row.retrievedOn
  )
    return;
  try {
    const url = new URL(row.url);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !url.hostname.includes(".") ||
      /\s/.test(row.url)
    )
      return;
    return { url: row.url, retrievedOn: row.retrievedOn };
  } catch {
    return;
  }
}
