import { isValidDateOnly } from "@/lib/api/date-range";
import { isLiteApiConfigured } from "./liteapi";
import {
  buildTravelpayoutsLink,
  isTravelpayoutsConfigured,
} from "./travelpayouts";
import {
  envTrim,
  finalizeAffiliateLink,
  type AffiliateLinkResult,
} from "./types";

export interface HotelDeepLinkParams {
  hotelName?: string;
  destination: string;
  checkIn?: string;
  checkOut?: string;
  adults?: number;
  children?: number;
  rooms?: number;
  lat?: number;
  lng?: number;
  campaign?: string;
  budgetTier?: "budget" | "moderate" | "luxury" | string;
}

function validStayDates(checkIn?: string, checkOut?: string) {
  const validIn = checkIn && isValidDateOnly(checkIn) ? checkIn : undefined;
  const validOut = checkOut && isValidDateOnly(checkOut) ? checkOut : undefined;
  if (validIn && validOut && validOut <= validIn) {
    return { checkIn: validIn, checkOut: undefined };
  }
  return { checkIn: validIn, checkOut: validOut };
}

function clampPositiveInt(
  value: number | undefined,
  max: number,
): number | undefined {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    return undefined;
  }
  return Math.min(max, value);
}

function hotelSearchQuery(
  params: HotelDeepLinkParams,
  separator = ", ",
): string {
  const hotel = params.hotelName?.trim();
  const dest = params.destination.trim();
  if (hotel && dest) return `${hotel}${separator}${dest}`;
  return hotel || dest;
}

export function buildStay22Url(
  params: HotelDeepLinkParams,
): AffiliateLinkResult {
  const aid = envTrim("STAY22_AID");
  const query = hotelSearchQuery(params);
  if (!aid || !query) {
    return finalizeAffiliateLink({
      partner: "stay22",
      label: "Compare stays on Stay22",
      vertical: "hotels",
      url: null,
      configured: false,
      isSearchFallback: true,
    });
  }

  const url = new URL("https://www.stay22.com/allez/roam");
  url.searchParams.set("aid", aid);
  url.searchParams.set("address", query);

  if (
    typeof params.lat === "number" &&
    typeof params.lng === "number" &&
    Number.isFinite(params.lat) &&
    Number.isFinite(params.lng) &&
    !(params.lat === 0 && params.lng === 0)
  ) {
    url.searchParams.set("lat", String(params.lat));
    url.searchParams.set("lng", String(params.lng));
  }

  const { checkIn, checkOut } = validStayDates(params.checkIn, params.checkOut);
  if (checkIn) url.searchParams.set("checkin", checkIn);
  if (checkOut) url.searchParams.set("checkout", checkOut);

  const adults = clampPositiveInt(params.adults, 20);
  if (adults) url.searchParams.set("adults", String(adults));
  if (
    typeof params.children === "number" &&
    Number.isInteger(params.children) &&
    params.children > 0
  ) {
    url.searchParams.set("children", String(Math.min(10, params.children)));
  }
  const rooms = clampPositiveInt(params.rooms, 10);
  if (rooms) url.searchParams.set("rooms", String(rooms));
  if (params.campaign?.trim()) {
    url.searchParams.set("campaign", params.campaign.trim().slice(0, 100));
  }

  return finalizeAffiliateLink({
    partner: "stay22",
    label: "Check rates on Stay22",
    vertical: "hotels",
    url: url.toString(),
    configured: true,
    isSearchFallback: true,
  });
}

export function buildBookingUrl(
  params: HotelDeepLinkParams,
  options?: { allowDirectSearchFallback?: boolean },
): AffiliateLinkResult {
  const aid = envTrim("BOOKING_AFFILIATE_ID");
  const query = hotelSearchQuery(params, " ");
  if (!query || (!aid && options?.allowDirectSearchFallback === false)) {
    return finalizeAffiliateLink({
      partner: "booking",
      label: "Search on Booking.com",
      vertical: "hotels",
      url: null,
      configured: false,
      isSearchFallback: true,
    });
  }

  const url = new URL("https://www.booking.com/searchresults.html");
  url.searchParams.set("ss", query);
  if (aid) {
    url.searchParams.set("aid", aid);
  }

  const { checkIn, checkOut } = validStayDates(params.checkIn, params.checkOut);
  if (checkIn) url.searchParams.set("checkin", checkIn);
  if (checkOut) url.searchParams.set("checkout", checkOut);

  const adults = clampPositiveInt(params.adults, 30);
  if (adults) url.searchParams.set("group_adults", String(adults));
  if (
    typeof params.children === "number" &&
    Number.isInteger(params.children) &&
    params.children > 0
  ) {
    url.searchParams.set(
      "group_children",
      String(Math.min(10, params.children)),
    );
  }
  const rooms = clampPositiveInt(params.rooms, 10);
  if (rooms) url.searchParams.set("no_rooms", String(rooms));

  return finalizeAffiliateLink({
    partner: "booking",
    label: "Check availability on Booking.com",
    vertical: "hotels",
    url: url.toString(),
    configured: Boolean(aid),
    isSearchFallback: true,
  });
}

export function buildExpediaHotelUrl(
  params: HotelDeepLinkParams,
): AffiliateLinkResult {
  const affcid = envTrim("EXPEDIA_AFFCID");
  const camref = envTrim("EXPEDIA_CAMREF");
  const query = hotelSearchQuery(params);
  if (!query) {
    return finalizeAffiliateLink({
      partner: "expedia",
      label: "Search on Expedia",
      vertical: "hotels",
      url: null,
      configured: false,
      isSearchFallback: true,
    });
  }

  const url = new URL("https://www.expedia.com/Hotel-Search");
  url.searchParams.set("destination", query);

  const { checkIn, checkOut } = validStayDates(params.checkIn, params.checkOut);
  if (checkIn) url.searchParams.set("startDate", checkIn);
  if (checkOut) url.searchParams.set("endDate", checkOut);

  const adults = clampPositiveInt(params.adults, 20);
  if (adults) url.searchParams.set("adults", String(adults));
  const rooms = clampPositiveInt(params.rooms, 8);
  if (rooms) url.searchParams.set("rooms", String(rooms));

  if (affcid) url.searchParams.set("affcid", affcid);
  if (camref) url.searchParams.set("camref", camref);

  return finalizeAffiliateLink({
    partner: "expedia",
    label: "Check availability on Expedia",
    vertical: "hotels",
    url: url.toString(),
    configured: Boolean(affcid || camref),
    isSearchFallback: true,
  });
}

export function buildHostelworldUrl(
  params: HotelDeepLinkParams,
): AffiliateLinkResult {
  const sourceId = envTrim("HOSTELWORLD_AFFILIATE_ID");
  const query = params.destination.trim();
  if (!query) {
    return finalizeAffiliateLink({
      partner: "hostelworld",
      label: "Search on Hostelworld",
      vertical: "hotels",
      url: null,
      configured: false,
      isSearchFallback: true,
    });
  }

  const url = new URL("https://www.hostelworld.com/s");
  url.searchParams.set("q", query);

  const { checkIn, checkOut } = validStayDates(params.checkIn, params.checkOut);
  if (checkIn) url.searchParams.set("dateFrom", checkIn);
  if (checkOut) url.searchParams.set("dateTo", checkOut);

  const guests = clampPositiveInt(params.adults, 20);
  if (guests) url.searchParams.set("number_of_guests", String(guests));
  if (sourceId) url.searchParams.set("source", sourceId);

  return finalizeAffiliateLink({
    partner: "hostelworld",
    label: "Browse hostels on Hostelworld",
    vertical: "hotels",
    url: url.toString(),
    configured: Boolean(sourceId),
    isSearchFallback: true,
  });
}

export function buildHotelPartnerLinks(params: HotelDeepLinkParams): {
  primary: AffiliateLinkResult | null;
  alternatives: AffiliateLinkResult[];
  liteapiLiveCheckoutEnabled: boolean;
} {
  const stay22 = buildStay22Url(params);
  const booking = buildBookingUrl(params);
  const expedia = buildExpediaHotelUrl(params);
  const hostelworld = buildHostelworldUrl(params);

  const hotellookTarget = params.destination.trim()
    ? `https://search.hotellook.com/?destination=${encodeURIComponent(params.destination.trim())}`
    : "";
  const hotellook =
    hotellookTarget && isTravelpayoutsConfigured()
      ? buildTravelpayoutsLink({
          targetUrl: hotellookTarget,
          programId: envTrim("TRAVELPAYOUTS_HOTELLOOK_PROGRAM_ID") ?? "4115",
          subId: params.campaign,
          label: "Compare hotel deals via Travelpayouts",
          vertical: "hotels",
        })
      : null;

  const isBudget = params.budgetTier?.toLowerCase() === "budget";
  const candidates: AffiliateLinkResult[] = isBudget
    ? [hostelworld, stay22, booking, expedia, ...(hotellook ? [hotellook] : [])]
    : [
        stay22,
        booking,
        expedia,
        ...(hotellook ? [hotellook] : []),
        hostelworld,
      ];

  const available = candidates.filter((item) => item.url !== null);
  const configured = available.filter((item) => item.configured);
  const unconfigured = available.filter((item) => !item.configured);

  const ordered = [...configured, ...unconfigured];
  const primary = ordered[0] ?? null;
  const alternatives = ordered.slice(1);

  return {
    primary,
    alternatives,
    liteapiLiveCheckoutEnabled:
      process.env.VERCEL_ENV === "preview" && isLiteApiConfigured(),
  };
}
