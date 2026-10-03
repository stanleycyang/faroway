/** Transient Google display DTOs. Never attach these to trips, drafts or AI inputs. */
export interface PlaceAttribution {
  provider: string;
  providerUri?: string;
}
export interface PlaceDisplay {
  placeId: string;
  name: string;
  address?: string;
  mapsUrl?: string;
  businessStatus?: string;
  attributions: PlaceAttribution[];
}

export function safeHttpsUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export function normalizePlaceDisplay(value: unknown): PlaceDisplay | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  const name = (p.displayName as { text?: unknown } | undefined)?.text;
  if (typeof p.id !== "string" || typeof name !== "string" || !name)
    return null;
  return {
    placeId: p.id,
    name,
    address:
      typeof p.formattedAddress === "string" ? p.formattedAddress : undefined,
    mapsUrl: safeHttpsUrl(p.googleMapsUri),
    businessStatus:
      typeof p.businessStatus === "string" ? p.businessStatus : undefined,
    attributions: Array.isArray(p.attributions)
      ? p.attributions.flatMap((a: unknown) => {
          if (!a || typeof a !== "object") return [];
          const item = a as Record<string, unknown>;
          return typeof item.provider === "string"
            ? [
                {
                  provider: item.provider,
                  providerUri: safeHttpsUrl(item.providerUri),
                },
              ]
            : [];
        })
      : [],
  };
}
