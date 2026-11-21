import { popularDestinations } from "@faroway/constants";
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

interface CountryTravelMeta {
  countryName: string;
  iso2: string;
  airaloSlug: string;
  currency: string;
}

const COUNTRY_META_LIST: CountryTravelMeta[] = [
  {
    countryName: "Japan",
    iso2: "JP",
    airaloSlug: "japan-esim",
    currency: "JPY",
  },
  {
    countryName: "France",
    iso2: "FR",
    airaloSlug: "france-esim",
    currency: "EUR",
  },
  {
    countryName: "United Kingdom",
    iso2: "GB",
    airaloSlug: "united-kingdom-esim",
    currency: "GBP",
  },
  {
    countryName: "Italy",
    iso2: "IT",
    airaloSlug: "italy-esim",
    currency: "EUR",
  },
  {
    countryName: "Spain",
    iso2: "ES",
    airaloSlug: "spain-esim",
    currency: "EUR",
  },
  {
    countryName: "Portugal",
    iso2: "PT",
    airaloSlug: "portugal-esim",
    currency: "EUR",
  },
  {
    countryName: "Germany",
    iso2: "DE",
    airaloSlug: "germany-esim",
    currency: "EUR",
  },
  {
    countryName: "Netherlands",
    iso2: "NL",
    airaloSlug: "netherlands-esim",
    currency: "EUR",
  },
  {
    countryName: "Greece",
    iso2: "GR",
    airaloSlug: "greece-esim",
    currency: "EUR",
  },
  {
    countryName: "Switzerland",
    iso2: "CH",
    airaloSlug: "switzerland-esim",
    currency: "CHF",
  },
  {
    countryName: "Thailand",
    iso2: "TH",
    airaloSlug: "thailand-esim",
    currency: "THB",
  },
  {
    countryName: "Indonesia",
    iso2: "ID",
    airaloSlug: "indonesia-esim",
    currency: "IDR",
  },
  {
    countryName: "Vietnam",
    iso2: "VN",
    airaloSlug: "vietnam-esim",
    currency: "VND",
  },
  {
    countryName: "South Korea",
    iso2: "KR",
    airaloSlug: "south-korea-esim",
    currency: "KRW",
  },
  {
    countryName: "Singapore",
    iso2: "SG",
    airaloSlug: "singapore-esim",
    currency: "SGD",
  },
  {
    countryName: "United States",
    iso2: "US",
    airaloSlug: "united-states-esim",
    currency: "USD",
  },
  {
    countryName: "Canada",
    iso2: "CA",
    airaloSlug: "canada-esim",
    currency: "CAD",
  },
  {
    countryName: "Mexico",
    iso2: "MX",
    airaloSlug: "mexico-esim",
    currency: "MXN",
  },
  {
    countryName: "Australia",
    iso2: "AU",
    airaloSlug: "australia-esim",
    currency: "AUD",
  },
  {
    countryName: "New Zealand",
    iso2: "NZ",
    airaloSlug: "new-zealand-esim",
    currency: "NZD",
  },
  {
    countryName: "United Arab Emirates",
    iso2: "AE",
    airaloSlug: "united-arab-emirates-esim",
    currency: "AED",
  },
  {
    countryName: "Turkey",
    iso2: "TR",
    airaloSlug: "turkey-esim",
    currency: "TRY",
  },
  {
    countryName: "Croatia",
    iso2: "HR",
    airaloSlug: "croatia-esim",
    currency: "EUR",
  },
  {
    countryName: "Iceland",
    iso2: "IS",
    airaloSlug: "iceland-esim",
    currency: "ISK",
  },
  { countryName: "Peru", iso2: "PE", airaloSlug: "peru-esim", currency: "PEN" },
  {
    countryName: "Brazil",
    iso2: "BR",
    airaloSlug: "brazil-esim",
    currency: "BRL",
  },
  {
    countryName: "India",
    iso2: "IN",
    airaloSlug: "india-esim",
    currency: "INR",
  },
  {
    countryName: "Morocco",
    iso2: "MA",
    airaloSlug: "morocco-esim",
    currency: "MAD",
  },
  {
    countryName: "South Africa",
    iso2: "ZA",
    airaloSlug: "south-africa-esim",
    currency: "ZAR",
  },
  {
    countryName: "Austria",
    iso2: "AT",
    airaloSlug: "austria-esim",
    currency: "EUR",
  },
  {
    countryName: "Czech Republic",
    iso2: "CZ",
    airaloSlug: "czech-republic-esim",
    currency: "CZK",
  },
  {
    countryName: "Ireland",
    iso2: "IE",
    airaloSlug: "ireland-esim",
    currency: "EUR",
  },
  {
    countryName: "Denmark",
    iso2: "DK",
    airaloSlug: "denmark-esim",
    currency: "DKK",
  },
  {
    countryName: "Sweden",
    iso2: "SE",
    airaloSlug: "sweden-esim",
    currency: "SEK",
  },
  {
    countryName: "Norway",
    iso2: "NO",
    airaloSlug: "norway-esim",
    currency: "NOK",
  },
];

const EXPLICIT_COUNTRY_ALIASES: Record<string, string> = {
  uk: "United Kingdom",
  gb: "United Kingdom",
  england: "United Kingdom",
  scotland: "United Kingdom",
  wales: "United Kingdom",
  usa: "United States",
  us: "United States",
  america: "United States",
  uae: "United Arab Emirates",
  korea: "South Korea",
  czechia: "Czech Republic",
};

const CITY_COUNTRY_ALIASES: Record<string, string> = {
  dubai: "United Arab Emirates",
  bali: "Indonesia",
};

const US_STATE_NAMES = [
  "alabama",
  "alaska",
  "arizona",
  "arkansas",
  "california",
  "colorado",
  "connecticut",
  "delaware",
  "florida",
  "georgia",
  "hawaii",
  "idaho",
  "illinois",
  "indiana",
  "iowa",
  "kansas",
  "kentucky",
  "louisiana",
  "maine",
  "maryland",
  "massachusetts",
  "michigan",
  "minnesota",
  "mississippi",
  "missouri",
  "montana",
  "nebraska",
  "nevada",
  "new hampshire",
  "new jersey",
  "new mexico",
  "new york",
  "north carolina",
  "north dakota",
  "ohio",
  "oklahoma",
  "oregon",
  "pennsylvania",
  "rhode island",
  "south carolina",
  "south dakota",
  "tennessee",
  "texas",
  "utah",
  "vermont",
  "virginia",
  "washington",
  "west virginia",
  "wisconsin",
  "wyoming",
  "district of columbia",
] as const;

const US_STATE_ABBR_SET = new Set([
  "al",
  "ak",
  "az",
  "ar",
  "ca",
  "co",
  "ct",
  "de",
  "fl",
  "ga",
  "hi",
  "id",
  "il",
  "in",
  "ia",
  "ks",
  "ky",
  "la",
  "me",
  "md",
  "ma",
  "mi",
  "mn",
  "ms",
  "mo",
  "mt",
  "ne",
  "nv",
  "nh",
  "nj",
  "nm",
  "ny",
  "nc",
  "nd",
  "oh",
  "ok",
  "or",
  "pa",
  "ri",
  "sc",
  "sd",
  "tn",
  "tx",
  "ut",
  "vt",
  "va",
  "wa",
  "wv",
  "wi",
  "wy",
  "dc",
]);

const CANADIAN_PROVINCE_NAMES = [
  "ontario",
  "quebec",
  "british columbia",
  "alberta",
  "manitoba",
  "saskatchewan",
  "nova scotia",
  "new brunswick",
  "newfoundland",
  "newfoundland and labrador",
  "prince edward island",
  "northwest territories",
  "nunavut",
  "yukon",
] as const;

const CANADIAN_PROVINCE_ABBR_SET = new Set([
  "on",
  "qc",
  "bc",
  "ab",
  "mb",
  "sk",
  "ns",
  "nb",
  "nl",
  "pe",
  "nt",
  "nu",
  "yt",
]);

const AUSTRALIAN_STATE_NAMES = [
  "new south wales",
  "victoria",
  "queensland",
  "western australia",
  "south australia",
  "tasmania",
  "australian capital territory",
  "northern territory",
] as const;

const US_REGION_NAMES = ["new england"] as const;

const NON_COUNTRY_SUBREGION_PATTERNS = [
  /\bnew\s+mexico\b/gi,
  /\bnew\s+south\s+wales\b/gi,
  /\bnew\s+england\b/gi,
] as const;

function stripNonCountrySubregions(text: string): string {
  let sanitized = text;
  for (const pattern of NON_COUNTRY_SUBREGION_PATTERNS) {
    sanitized = sanitized.replace(pattern, " ");
  }
  return sanitized;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasWordMatch(haystack: string, term: string): boolean {
  return new RegExp(`\\b${escapeRegex(term)}\\b`, "i").test(haystack);
}

function findCountryMeta(canonicalName: string): CountryTravelMeta | null {
  const lower = canonicalName.toLowerCase();
  const aliasTarget = EXPLICIT_COUNTRY_ALIASES[lower];
  const target = (aliasTarget ?? canonicalName).toLowerCase();
  return (
    COUNTRY_META_LIST.find((c) => c.countryName.toLowerCase() === target) ??
    null
  );
}

function matchCountryOrAlias(text: string): CountryTravelMeta | null {
  const sanitized = stripNonCountrySubregions(text);
  for (const meta of COUNTRY_META_LIST) {
    if (hasWordMatch(sanitized, meta.countryName.toLowerCase())) {
      return meta;
    }
  }
  for (const [alias, canonical] of Object.entries(EXPLICIT_COUNTRY_ALIASES)) {
    if (hasWordMatch(sanitized, alias)) {
      return findCountryMeta(canonical);
    }
  }
  return null;
}

export function resolveDestinationTravelMeta(
  destinationOrCountry?: string,
): CountryTravelMeta | null {
  const input = destinationOrCountry?.trim();
  if (!input) return null;
  const lower = input.toLowerCase();

  // 1. Exact full-string country, ISO2, or alias match
  for (const meta of COUNTRY_META_LIST) {
    if (
      lower === meta.countryName.toLowerCase() ||
      lower === meta.iso2.toLowerCase()
    ) {
      return meta;
    }
  }
  if (Object.hasOwn(EXPLICIT_COUNTRY_ALIASES, lower)) {
    return findCountryMeta(EXPLICIT_COUNTRY_ALIASES[lower]);
  }
  if (Object.hasOwn(CITY_COUNTRY_ALIASES, lower)) {
    return findCountryMeta(CITY_COUNTRY_ALIASES[lower]);
  }

  const segments = lower
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const trailingSegments = segments.slice(1);

  // 2. Trailing-segment explicit country / alias / full state or province disambiguation
  // (checked before full-string country matching so e.g. "Mexico, Missouri" resolves to US)
  for (let i = trailingSegments.length - 1; i >= 0; i--) {
    const seg = trailingSegments[i];
    const isoExact = COUNTRY_META_LIST.find(
      (c) =>
        c.iso2.toLowerCase() === seg &&
        !US_STATE_ABBR_SET.has(seg) &&
        !CANADIAN_PROVINCE_ABBR_SET.has(seg),
    );
    if (isoExact) return isoExact;
    const countryMatch = matchCountryOrAlias(seg);
    if (countryMatch) return countryMatch;
    if (
      US_STATE_NAMES.some((state) => hasWordMatch(seg, state)) ||
      US_REGION_NAMES.some((region) => hasWordMatch(seg, region))
    ) {
      return findCountryMeta("United States");
    }
    if (CANADIAN_PROVINCE_NAMES.some((prov) => hasWordMatch(seg, prov))) {
      return findCountryMeta("Canada");
    }
    if (AUSTRALIAN_STATE_NAMES.some((state) => hasWordMatch(seg, state))) {
      return findCountryMeta("Australia");
    }
  }

  // 3. Trailing-segment 2-letter Canadian province / US state abbreviations
  for (let i = trailingSegments.length - 1; i >= 0; i--) {
    const seg = trailingSegments[i];
    if (CANADIAN_PROVINCE_ABBR_SET.has(seg)) {
      return findCountryMeta("Canada");
    }
    if (US_STATE_ABBR_SET.has(seg)) {
      return findCountryMeta("United States");
    }
  }

  // 4. Full-string word-boundary country/alias match (with subregion phrases guarded), then states/provinces
  const fullCountryMatch = matchCountryOrAlias(lower);
  if (fullCountryMatch) return fullCountryMatch;

  if (
    US_STATE_NAMES.some((state) => hasWordMatch(lower, state)) ||
    US_REGION_NAMES.some((region) => hasWordMatch(lower, region))
  ) {
    return findCountryMeta("United States");
  }
  if (CANADIAN_PROVINCE_NAMES.some((prov) => hasWordMatch(lower, prov))) {
    return findCountryMeta("Canada");
  }
  if (AUSTRALIAN_STATE_NAMES.some((state) => hasWordMatch(lower, state))) {
    return findCountryMeta("Australia");
  }

  // 5. popularDestinations city & country word-boundary match
  for (const dest of popularDestinations) {
    if (
      lower === dest.name.toLowerCase() ||
      hasWordMatch(lower, dest.name.toLowerCase()) ||
      hasWordMatch(lower, dest.country.toLowerCase())
    ) {
      const matched = findCountryMeta(dest.country);
      if (matched) return matched;
    }
  }

  // 6. Remaining city-level aliases (e.g. "Bali, Indonesia" or "Dubai")
  for (const [alias, canonical] of Object.entries(CITY_COUNTRY_ALIASES)) {
    if (hasWordMatch(lower, alias)) {
      return findCountryMeta(canonical);
    }
  }

  return null;
}

export function buildSafetyWingUrl(params?: {
  destination?: string;
  startDate?: string;
  endDate?: string;
  trackingId?: string;
}): AffiliateLinkResult {
  const referenceId = envTrim("SAFETYWING_REFERENCE_ID");
  const ambassadorId = envTrim("SAFETYWING_AMBASSADOR_ID");

  if (referenceId) {
    const url = new URL("https://safetywing.com/nomad-insurance/");
    url.searchParams.set("referenceID", referenceId);
    if (ambassadorId) {
      url.searchParams.set("ambassador", ambassadorId);
    }
    return finalizeAffiliateLink({
      partner: "safetywing",
      label: "Get travel medical insurance with SafetyWing",
      vertical: "insurance",
      url: url.toString(),
      configured: true,
      isSearchFallback: false,
    });
  }

  if (isTravelpayoutsConfigured()) {
    return buildTravelpayoutsLink({
      targetUrl: "https://safetywing.com/nomad-insurance/",
      programId: envTrim("TRAVELPAYOUTS_SAFETYWING_PROGRAM_ID"),
      subId: params?.trackingId,
      label: "Get travel medical insurance with SafetyWing",
      vertical: "insurance",
    });
  }

  // Never emit bare safetywing.com without referenceID because injectAffiliateSubId
  // uses referenceID as SafetyWing's subIdParam and would overwrite it with clickId.
  return finalizeAffiliateLink({
    partner: "safetywing",
    label: "Get travel medical insurance with SafetyWing",
    vertical: "insurance",
    url: null,
    configured: false,
    isSearchFallback: false,
  });
}

export function buildAiraloUrl(params: {
  countryOrDestination?: string;
  trackingId?: string;
}): AffiliateLinkResult {
  const meta = resolveDestinationTravelMeta(params.countryOrDestination);
  const slug = meta?.airaloSlug ?? "global-esim";
  const baseUrl = new URL(`https://www.airalo.com/${slug}`);

  const ref = envTrim("AIRALO_AFFILIATE_ID");
  const irClickId = envTrim("AIRALO_IR_CLICK_ID");

  if (ref || irClickId) {
    if (ref) baseUrl.searchParams.set("ref", ref);
    if (irClickId) baseUrl.searchParams.set("irclickid", irClickId);
    return finalizeAffiliateLink({
      partner: "airalo",
      label: meta
        ? `Get ${meta.countryName} eSIM data on Airalo`
        : "Get global eSIM data on Airalo",
      vertical: "esim",
      url: baseUrl.toString(),
      configured: true,
      isSearchFallback: true,
    });
  }

  if (isTravelpayoutsConfigured()) {
    return buildTravelpayoutsLink({
      targetUrl: baseUrl.toString(),
      programId: envTrim("TRAVELPAYOUTS_AIRALO_PROGRAM_ID"),
      subId: params.trackingId,
      label: meta
        ? `Get ${meta.countryName} eSIM data on Airalo`
        : "Get global eSIM data on Airalo",
      vertical: "esim",
    });
  }

  return finalizeAffiliateLink({
    partner: "airalo",
    label: meta
      ? `Get ${meta.countryName} eSIM data on Airalo`
      : "Get global eSIM data on Airalo",
    vertical: "esim",
    url: baseUrl.toString(),
    configured: false,
    isSearchFallback: true,
  });
}

export function buildDiscoverCarsUrl(params: {
  destination: string;
  startDate?: string;
  endDate?: string;
  trackingId?: string;
}): AffiliateLinkResult {
  const url = new URL("https://www.discovercars.com/");
  const aid = envTrim("DISCOVERCARS_AFFILIATE_ID");
  const bid = envTrim("DISCOVERCARS_BID");

  if (params.destination.trim()) {
    url.searchParams.set("location", params.destination.trim());
  }
  const validStart =
    params.startDate && isValidDateOnly(params.startDate)
      ? params.startDate
      : undefined;
  const validEnd =
    params.endDate && isValidDateOnly(params.endDate)
      ? params.endDate
      : undefined;
  const safeEnd =
    validStart && validEnd && validEnd < validStart ? undefined : validEnd;
  if (validStart) {
    url.searchParams.set("from", validStart);
  }
  if (safeEnd) {
    url.searchParams.set("to", safeEnd);
  }

  if (aid) {
    url.searchParams.set("a_aid", aid);
    if (bid) url.searchParams.set("a_bid", bid);
    return finalizeAffiliateLink({
      partner: "discovercars",
      label: "Compare rental cars on DiscoverCars",
      vertical: "cars",
      url: url.toString(),
      configured: true,
      isSearchFallback: true,
    });
  }

  if (isTravelpayoutsConfigured()) {
    return buildTravelpayoutsLink({
      targetUrl: url.toString(),
      programId: envTrim("TRAVELPAYOUTS_DISCOVERCARS_PROGRAM_ID"),
      subId: params.trackingId,
      label: "Compare rental cars on DiscoverCars",
      vertical: "cars",
    });
  }

  return finalizeAffiliateLink({
    partner: "discovercars",
    label: "Compare rental cars on DiscoverCars",
    vertical: "cars",
    url: url.toString(),
    configured: false,
    isSearchFallback: true,
  });
}

export function buildVisaToolUrl(params: {
  nationality?: string;
  destinationCountry?: string;
  trackingId?: string;
}): AffiliateLinkResult {
  const affid = envTrim("IVISA_AFFILIATE_ID");
  const irClickId = envTrim("IVISA_IR_CLICK_ID");
  const destMeta = resolveDestinationTravelMeta(params.destinationCountry);
  const destValue = destMeta?.countryName ?? params.destinationCountry?.trim();

  const ivisaUrl = new URL("https://www.ivisa.com/apply-online");
  if (params.nationality?.trim()) {
    ivisaUrl.searchParams.set("nationality", params.nationality.trim());
  }
  if (destValue) {
    ivisaUrl.searchParams.set("destination", destValue);
  }

  if (affid || irClickId) {
    if (affid) ivisaUrl.searchParams.set("affid", affid);
    if (irClickId) ivisaUrl.searchParams.set("irclickid", irClickId);
    return finalizeAffiliateLink({
      partner: "ivisa",
      label: "Check entry & visa requirements on iVisa",
      vertical: "visas",
      url: ivisaUrl.toString(),
      configured: true,
      isSearchFallback: true,
    });
  }

  const sherpaProgramId = envTrim("TRAVELPAYOUTS_SHERPA_PROGRAM_ID");
  if (isTravelpayoutsConfigured() && sherpaProgramId) {
    return buildTravelpayoutsLink({
      targetUrl: "https://apply.joinsherpa.com/travel-restrictions",
      programId: sherpaProgramId,
      subId: params.trackingId,
      label: "Check entry & visa requirements via Sherpa",
      vertical: "visas",
    });
  }

  return finalizeAffiliateLink({
    partner: "ivisa",
    label: "Check entry & visa requirements on iVisa",
    vertical: "visas",
    url: ivisaUrl.toString(),
    configured: false,
    isSearchFallback: true,
  });
}

export function buildWiseUrl(params?: {
  sourceCurrency?: string;
  targetCurrency?: string;
  destination?: string;
}): AffiliateLinkResult {
  const irClickId = envTrim("WISE_IR_CLICK_ID") ?? envTrim("WISE_AFFILIATE_ID");
  const destMeta = resolveDestinationTravelMeta(params?.destination);
  const rawSrc = params?.sourceCurrency?.trim().toUpperCase() || "USD";
  const rawTgt =
    params?.targetCurrency?.trim().toUpperCase() || destMeta?.currency;

  const validSrc = /^[A-Z]{3}$/.test(rawSrc) ? rawSrc : "USD";
  const validTgt = rawTgt && /^[A-Z]{3}$/.test(rawTgt) ? rawTgt : undefined;

  const url =
    validTgt && validSrc !== validTgt
      ? new URL(
          `https://wise.com/us/currency-converter/${validSrc.toLowerCase()}-to-${validTgt.toLowerCase()}-rate`,
        )
      : new URL("https://wise.com/us/travel-money/");

  if (validTgt && validSrc !== validTgt) {
    url.searchParams.set("source", validSrc);
    url.searchParams.set("target", validTgt);
  }
  if (irClickId) {
    url.searchParams.set("irclickid", irClickId);
  }

  return finalizeAffiliateLink({
    partner: "wise",
    label: "Spend abroad with Wise multi-currency card",
    vertical: "finance",
    url: url.toString(),
    configured: Boolean(irClickId),
    isSearchFallback: true,
  });
}

export function buildTripEssentials(params: {
  destination: string;
  country?: string;
  startDate?: string;
  endDate?: string;
  sourceCurrency?: string;
  targetCurrency?: string;
  passportCountry?: string;
  trackingId?: string;
}): {
  insurance: AffiliateLinkResult;
  esim: AffiliateLinkResult;
  carRental: AffiliateLinkResult;
  visa: AffiliateLinkResult;
  fx: AffiliateLinkResult;
} {
  const countryOrDest = params.country?.trim() || params.destination;
  return {
    insurance: buildSafetyWingUrl({
      destination: params.destination,
      startDate: params.startDate,
      endDate: params.endDate,
      trackingId: params.trackingId,
    }),
    esim: buildAiraloUrl({
      countryOrDestination: countryOrDest,
      trackingId: params.trackingId,
    }),
    carRental: buildDiscoverCarsUrl({
      destination: params.destination,
      startDate: params.startDate,
      endDate: params.endDate,
      trackingId: params.trackingId,
    }),
    visa: buildVisaToolUrl({
      nationality: params.passportCountry,
      destinationCountry: countryOrDest,
      trackingId: params.trackingId,
    }),
    fx: buildWiseUrl({
      sourceCurrency: params.sourceCurrency,
      targetCurrency: params.targetCurrency,
      destination: countryOrDest,
    }),
  };
}
