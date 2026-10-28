/** Separate consent for sending child ages to the flight supplier. */
export const FLIGHT_SEARCH_CONSENT_VERSION = "flight-search-duffel-v1" as const;
export const FLIGHT_SEARCH_DISCLOSURE =
  "Flight search shares your origin, destination, dates, adult count and each child's age with Duffel and its airline suppliers. Prices and availability can change; searching does not make a booking.";

export const LITEAPI_FLIGHT_CONSENT_VERSION =
  "flight-search-liteapi-v1" as const;
export const LITEAPI_FLIGHT_DISCLOSURE =
  "Flight search shares your origin, destination, dates, adult count and children’s ages with LiteAPI (Nuitée) and its flight suppliers. Prices and availability can change; searching does not make a booking.";
export type FlightSearchProvider = "duffel" | "liteapi";
export function flightSearchProvider(
  value: unknown,
): FlightSearchProvider | undefined {
  if (!validateFlightSearchDetails(value)) return undefined;
  return value.consentVersion === LITEAPI_FLIGHT_CONSENT_VERSION
    ? "liteapi"
    : "duffel";
}

export interface FlightSearchDetails {
  childAges: number[];
  consentVersion:
    | typeof FLIGHT_SEARCH_CONSENT_VERSION
    | typeof LITEAPI_FLIGHT_CONSENT_VERSION;
}

export function validateFlightSearchDetails(
  value: unknown,
  children?: number,
): value is FlightSearchDetails {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return (
    Object.keys(item).every((key) =>
      ["childAges", "consentVersion"].includes(key),
    ) &&
    (item.consentVersion === FLIGHT_SEARCH_CONSENT_VERSION ||
      item.consentVersion === LITEAPI_FLIGHT_CONSENT_VERSION) &&
    Array.isArray(item.childAges) &&
    item.childAges.length <= 49 &&
    (children === undefined || item.childAges.length === children) &&
    item.childAges.every(
      (age: unknown) =>
        typeof age === "number" &&
        Number.isInteger(age) &&
        age >= 0 &&
        age <= 17,
    )
  );
}
