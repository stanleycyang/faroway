/** Retrieved public-page attribution; not a booking or verification certificate. */
export interface VenueSource {
  url: string;
  retrievedOn: string;
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
