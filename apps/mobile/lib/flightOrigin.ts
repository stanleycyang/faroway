import { FLIGHT_SEARCH_CONSENT_VERSION, type FlightSearchDetails } from '@faroway/constants';

export function normalizeOriginCity(value?: string): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().slice(0, 200);
  return trimmed || undefined;
}

export function normalizeOriginAirport(value?: string): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().toUpperCase().slice(0, 10);
  return trimmed || undefined;
}

export function isValidIataAirportCode(value?: string): boolean {
  if (typeof value !== 'string') return false;
  return /^[A-Z]{3}$/.test(value.trim().toUpperCase());
}

export interface FlightSearchPreferencesInput {
  travelers: number;
  originCity?: string;
  originAirport?: string;
  flightConsent?: boolean;
}

export interface ResolvedFlightSearchPreferences {
  originCity?: string;
  originAirport?: string;
  adults?: number;
  children?: number;
  flightSearch?: FlightSearchDetails | null;
}

/**
 * Build backend-compatible trip `preferences` for flight origin & consent.
 * When `flightConsent === true` with a valid origin, sends `adults`, `children: 0`,
 * and `flightSearch` matching `validBriefComposition` in `apps/web/lib/trips/brief.ts`.
 * When `flightConsent === false`, sends `flightSearch: null` to opt out cleanly.
 */
export function resolveFlightSearchPreferences(
  input: FlightSearchPreferencesInput
): ResolvedFlightSearchPreferences {
  const originCity = normalizeOriginCity(input.originCity);
  const originAirport = normalizeOriginAirport(input.originAirport);

  if (input.flightConsent === true && (originCity || originAirport)) {
    const travelers =
      Number.isInteger(input.travelers) && input.travelers >= 1 ? input.travelers : 1;
    return {
      ...(originCity ? { originCity } : {}),
      ...(originAirport ? { originAirport } : {}),
      adults: travelers,
      children: 0,
      flightSearch: {
        consentVersion: FLIGHT_SEARCH_CONSENT_VERSION,
        childAges: [],
      },
    };
  }

  return {
    ...(originCity ? { originCity } : {}),
    ...(originAirport ? { originAirport } : {}),
    ...(input.flightConsent === false ? { flightSearch: null } : {}),
  };
}

/**
 * Build a light warm-paper & ocean-teal Google Static Maps URL matching brand/BRAND.md.
 */
export function buildDestinationStaticMapUrl(
  destination: string,
  country: string,
  apiKey?: string
): string | null {
  if (!apiKey || !destination.trim()) return null;
  const center = encodeURIComponent(`${destination}${country ? `, ${country}` : ''}`);
  return (
    `https://maps.googleapis.com/maps/api/staticmap?center=${center}` +
    `&zoom=11&size=400x200&scale=2&maptype=roadmap` +
    `&markers=color:0xC03A31|${center}` +
    `&style=feature:all|element:geometry|color:0xFAF8F3` +
    `&style=feature:all|element:labels.text.stroke|color:0xFFFFFF` +
    `&style=feature:all|element:labels.text.fill|color:0x143D46` +
    `&style=feature:water|element:geometry|color:0xCFE6E8` +
    `&style=feature:landscape.natural|element:geometry|color:0xEFF5F3` +
    `&style=feature:poi.park|element:geometry|color:0xDFEDE7` +
    `&style=feature:road|element:geometry|color:0xFFFFFF` +
    `&style=feature:road|element:geometry.stroke|color:0xDCE5E3` +
    `&style=feature:poi|element:geometry|color:0xEFF5F3` +
    `&key=${apiKey}`
  );
}
