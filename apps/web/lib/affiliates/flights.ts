import { isValidDateOnly } from "@/lib/api/date-range";
import {
  buildTravelpayoutsLink,
  isTravelpayoutsConfigured,
} from "./travelpayouts";
import {
  envTrim,
  finalizeAffiliateLink,
  type AffiliateLinkResult,
} from "./types";

const IATA_RE = /^[A-Z]{3}$/;

function toYYMMDD(dateStr?: string): string | undefined {
  if (!dateStr || !isValidDateOnly(dateStr)) return undefined;
  return `${dateStr.slice(2, 4)}${dateStr.slice(5, 7)}${dateStr.slice(8, 10)}`;
}

function toDDMM(dateStr?: string): string | undefined {
  if (!dateStr || !isValidDateOnly(dateStr)) return undefined;
  return `${dateStr.slice(8, 10)}${dateStr.slice(5, 7)}`;
}

function validFlightDates(departureDate?: string, returnDate?: string) {
  const validOut =
    departureDate && isValidDateOnly(departureDate) ? departureDate : undefined;
  const validRet =
    returnDate && isValidDateOnly(returnDate) ? returnDate : undefined;
  if (validOut && validRet && validRet < validOut) {
    return { departureDate: validOut, returnDate: undefined };
  }
  return { departureDate: validOut, returnDate: validRet };
}

export interface FlightFallbackParams {
  originAirport?: string;
  originCity?: string;
  destinationAirport?: string;
  destinationCity?: string;
  departureDate: string;
  returnDate?: string;
  adults?: number;
  cabinClass?: string;
  currency?: string;
  trackingId?: string;
}

export function buildSkyscannerFlightUrl(
  params: FlightFallbackParams,
): AffiliateLinkResult {
  const associateId = envTrim("SKYSCANNER_ASSOCIATE_ID");
  const origin = params.originAirport?.trim().toUpperCase();
  const dest = params.destinationAirport?.trim().toUpperCase();
  const { departureDate, returnDate } = validFlightDates(
    params.departureDate,
    params.returnDate,
  );
  const outYYMMDD = toYYMMDD(departureDate);
  const retYYMMDD = toYYMMDD(returnDate);
  const adults =
    typeof params.adults === "number" &&
    Number.isInteger(params.adults) &&
    params.adults >= 1
      ? Math.min(8, params.adults)
      : 1;

  let url: URL;
  if (
    origin &&
    dest &&
    IATA_RE.test(origin) &&
    IATA_RE.test(dest) &&
    outYYMMDD
  ) {
    const path = retYYMMDD
      ? `/transport/flights/${origin.toLowerCase()}/${dest.toLowerCase()}/${outYYMMDD}/${retYYMMDD}/`
      : `/transport/flights/${origin.toLowerCase()}/${dest.toLowerCase()}/${outYYMMDD}/`;
    url = new URL(path, "https://www.skyscanner.com");
    url.searchParams.set("adults", String(adults));
    if (params.cabinClass) {
      url.searchParams.set("cabinclass", params.cabinClass);
    }
    if (params.currency && /^[A-Z]{3}$/.test(params.currency)) {
      url.searchParams.set("currency", params.currency);
    }
  } else {
    url = new URL("https://www.skyscanner.com/flights");
  }

  if (associateId) {
    url.searchParams.set("associateid", associateId);
  }

  return finalizeAffiliateLink({
    partner: "skyscanner",
    label: "Compare flights on Skyscanner",
    vertical: "flights",
    url: url.toString(),
    configured: Boolean(associateId),
    isSearchFallback: true,
  });
}

export function buildAviasalesFlightUrl(
  params: FlightFallbackParams,
): AffiliateLinkResult {
  const origin = params.originAirport?.trim().toUpperCase();
  const dest = params.destinationAirport?.trim().toUpperCase();
  const { departureDate, returnDate } = validFlightDates(
    params.departureDate,
    params.returnDate,
  );
  const outDDMM = toDDMM(departureDate);
  const retDDMM = toDDMM(returnDate) ?? "";
  const adults =
    typeof params.adults === "number" &&
    Number.isInteger(params.adults) &&
    params.adults >= 1
      ? Math.min(9, params.adults)
      : 1;

  const targetUrl =
    origin && dest && IATA_RE.test(origin) && IATA_RE.test(dest) && outDDMM
      ? `https://www.aviasales.com/search/${origin}${outDDMM}${dest}${retDDMM}${adults}`
      : "https://www.aviasales.com/";

  if (isTravelpayoutsConfigured()) {
    return buildTravelpayoutsLink({
      targetUrl,
      programId: envTrim("TRAVELPAYOUTS_AVIASALES_PROGRAM_ID") ?? "4114",
      subId: params.trackingId,
      label: "Compare flights on Aviasales",
      vertical: "flights",
    });
  }

  return finalizeAffiliateLink({
    partner: "travelpayouts",
    label: "Compare flights on Aviasales",
    vertical: "flights",
    url: targetUrl,
    configured: false,
    isSearchFallback: true,
  });
}

export function buildFlightFallbackLinks(
  params: FlightFallbackParams,
): AffiliateLinkResult[] {
  const links = [
    buildSkyscannerFlightUrl(params),
    buildAviasalesFlightUrl(params),
  ].filter((link) => link.url !== null);

  // Configured affiliate links first
  return [
    ...links.filter((link) => link.configured),
    ...links.filter((link) => !link.configured),
  ];
}
