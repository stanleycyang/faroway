import { buildViatorHandoffUrl } from "../../../apps/web/lib/affiliates/viator-link";
import {
  AFFILIATE_PARTNERS,
  isAllowedAffiliateUrl,
  normalizeAffiliatePartner,
  resolveAffiliatePartnerByUrl,
  type AffiliatePartnerId,
} from "../../../packages/constants/src/affiliates";

export interface VendorExpectation {
  partner: AffiliatePartnerId;
  minimumExperiences: number;
  /** Use the configured partner ID when available; never infer it from the result. */
  partnerId?: string;
  /** Override default photo requirement per partner vertical. */
  requirePhoto?: boolean;
  /** Require partner-native subID query param to be present on the URL. */
  requireSubId?: boolean;
  /** Allow Travelpayouts tp.media/tp.st wrapper URLs for partners that support TP. */
  allowTravelpayoutsWrapper?: boolean;
  /** Limit scan to day[period].activities (default true for viator, false for multi-surface). */
  activitiesOnly?: boolean;
}

export type PartnerHandoffValidationResult =
  | { ok: true; dedupeKey: string }
  | { ok: false; reason: string };

export interface VendorExperienceEvaluation {
  failures: string[];
  count: number;
}

export interface MultiPartnerVendorEvaluation {
  ok: boolean;
  totalCount: number;
  byPartner: Record<string, VendorExperienceEvaluation>;
  failures: string[];
}

const DEFAULT_PHOTO_PARTNERS: ReadonlySet<AffiliatePartnerId> = new Set([
  "viator",
  "getyourguide",
  "klook",
  "stay22",
  "booking",
  "expedia",
  "hostelworld",
  "tripadvisor",
]);

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function httpsImage(value: unknown): boolean {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

function paramValue(url: URL, key: string): string {
  return url.searchParams.get(key)?.trim() ?? "";
}

function anyParamValue(url: URL, keys: readonly string[]): string {
  for (const key of keys) {
    const value = paramValue(url, key);
    if (value) return value;
  }
  return "";
}

function matchesExpectedPartnerId(
  url: URL,
  keys: readonly string[],
  partnerId: string | undefined,
): boolean {
  if (!partnerId) return true;
  return keys.some((key) => paramValue(url, key) === partnerId);
}

const ATTRIBUTION_QUERY_PARAMS = [
  "partner_id",
  "aid",
  "marker",
  "shmarker",
  "referenceID",
  "affcid",
  "a_aid",
  "associateid",
  "affid",
  "cmp",
  "sub_id",
  "label",
  "campaign",
  "click_id",
  "u",
  "pid",
  "mcid",
  "medium",
  "camref",
  "ambassador",
  "ref",
  "irclickid",
  "reference",
  "source",
  "rid",
  "restref",
  "m",
] as const;

function isValidViatorCampaign(url: URL): boolean {
  const campaigns = url.searchParams.getAll("campaign");
  return (
    campaigns.length === 1 && /^[a-zA-Z0-9-]{1,100}$/.test(campaigns[0] ?? "")
  );
}

function buildDedupeKey(
  partner: AffiliatePartnerId,
  parsed: URL,
  normPath: string,
): string {
  const host = parsed.hostname.toLowerCase();
  if (partner === "stay22") {
    const stayHost = host.replace(/^www\./, "");
    if (normPath === "/embed/gm" || normPath.startsWith("/allez")) {
      const primary = ["address", "lat", "lng", "ss", "rid", "u"]
        .map((key) => {
          const val = paramValue(parsed, key);
          return val ? `${key}=${val.toLowerCase()}` : "";
        })
        .filter(Boolean);
      const sig =
        primary.length > 0
          ? primary
          : ["city", "q"]
              .map((key) => {
                const val = paramValue(parsed, key);
                return val ? `${key}=${val.toLowerCase()}` : "";
              })
              .filter(Boolean);
      return sig.length > 0
        ? `${stayHost}${normPath}?${sig.join("&")}`
        : `${stayHost}${normPath}`;
    }
    return `${stayHost}${normPath}`;
  }
  if (partner === "getyourguide" && normPath === "/s") {
    const q = paramValue(parsed, "q");
    return q ? `${normPath}?q=${q.toLowerCase()}` : normPath;
  }
  if (partner === "booking" && normPath === "/searchresults.html") {
    const ss = paramValue(parsed, "ss");
    return ss
      ? `${host}${normPath}?ss=${ss.toLowerCase()}`
      : `${host}${normPath}`;
  }
  if (partner === "travelpayouts") {
    const target = paramValue(parsed, "u");
    return target
      ? `${host}${normPath}?u=${target.toLowerCase()}`
      : `${host}${normPath}`;
  }
  if (
    partner === "duffel" &&
    (normPath === "/search" || normPath === "/flights")
  ) {
    const sig = ["origin", "destination", "offer"]
      .map((key) => {
        const val = paramValue(parsed, key);
        return val ? `${key}=${val.toLowerCase()}` : "";
      })
      .filter(Boolean);
    return sig.length > 0
      ? `${host}${normPath}?${sig.join("&")}`
      : `${host}${normPath}`;
  }
  return normPath;
}

function validateTravelpayoutsUrl(
  parsed: URL,
  normPath: string,
  options?: {
    partnerId?: string;
    requireSubId?: boolean;
    wrappedPartner?: AffiliatePartnerId;
  },
): PartnerHandoffValidationResult {
  if (normPath === "/") {
    return {
      ok: false,
      reason: "Travelpayouts URL must have a non-root path",
    };
  }
  const marker = anyParamValue(parsed, ["marker", "shmarker"]);
  if (!marker) {
    return {
      ok: false,
      reason: "Travelpayouts URL is missing marker/shmarker",
    };
  }
  if (
    options?.partnerId &&
    !matchesExpectedPartnerId(parsed, ["marker", "shmarker"], options.partnerId)
  ) {
    return {
      ok: false,
      reason:
        "Travelpayouts URL marker/shmarker does not match configured partnerId",
    };
  }
  if (options?.requireSubId && !paramValue(parsed, "sub_id")) {
    return { ok: false, reason: "Travelpayouts URL is missing sub_id" };
  }

  const hasTargetU = parsed.searchParams.has("u");
  if (options?.wrappedPartner && !hasTargetU) {
    return {
      ok: false,
      reason: `Travelpayouts wrapper URL for ${options.wrappedPartner} is missing target u parameter`,
    };
  }
  if (hasTargetU) {
    const rawTarget = paramValue(parsed, "u");
    if (!rawTarget) {
      return {
        ok: false,
        reason: "Travelpayouts target u parameter is empty",
      };
    }
    let targetParsed: URL;
    try {
      targetParsed = new URL(rawTarget);
    } catch {
      return {
        ok: false,
        reason: "Travelpayouts target u URL is malformed",
      };
    }
    if (targetParsed.protocol !== "https:") {
      return {
        ok: false,
        reason: "Travelpayouts target u URL must use HTTPS",
      };
    }
    if (targetParsed.username || targetParsed.password) {
      return {
        ok: false,
        reason: "Travelpayouts target u URL must not contain credentials",
      };
    }
    if (targetParsed.port) {
      return {
        ok: false,
        reason: "Travelpayouts target u URL must not specify a port",
      };
    }
    if (!targetParsed.hostname || targetParsed.hostname.endsWith(".")) {
      return {
        ok: false,
        reason: "Travelpayouts target u hostname is invalid",
      };
    }
    if (!isAllowedAffiliateUrl(rawTarget)) {
      return {
        ok: false,
        reason: "Travelpayouts target u host is not allowlisted",
      };
    }
    if (
      options?.wrappedPartner &&
      resolveAffiliatePartnerByUrl(rawTarget) !== options.wrappedPartner
    ) {
      return {
        ok: false,
        reason: `Travelpayouts target u URL does not belong to ${options.wrappedPartner}`,
      };
    }
  }

  return {
    ok: true,
    dedupeKey: buildDedupeKey("travelpayouts", parsed, normPath),
  };
}

/** Validate a partner affiliate handoff URL and return a canonical deduplication key. */
export function validatePartnerHandoffUrl(
  partner: AffiliatePartnerId,
  rawUrl: string,
  options?: {
    partnerId?: string;
    requireSubId?: boolean;
    allowTravelpayoutsWrapper?: boolean;
  },
): PartnerHandoffValidationResult {
  if (
    typeof partner !== "string" ||
    !Object.hasOwn(AFFILIATE_PARTNERS, partner)
  ) {
    return { ok: false, reason: "Invalid vendor partner" };
  }
  if (typeof rawUrl !== "string" || !rawUrl.trim()) {
    return { ok: false, reason: "URL is empty" };
  }
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "URL is malformed" };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false, reason: "URL must use HTTPS" };
  }
  if (parsed.username || parsed.password) {
    return { ok: false, reason: "URL must not contain credentials" };
  }
  if (parsed.port) {
    return { ok: false, reason: "URL must not specify a port" };
  }
  if (!parsed.hostname || parsed.hostname.endsWith(".")) {
    return { ok: false, reason: "URL hostname is invalid" };
  }

  for (const key of ATTRIBUTION_QUERY_PARAMS) {
    if (parsed.searchParams.getAll(key).length > 1) {
      return { ok: false, reason: `URL contains duplicate ${key} parameter` };
    }
  }

  const normPath = parsed.pathname.replace(/\/+$/, "") || "/";

  if (partner === "viator") {
    if (options?.requireSubId) {
      if (!paramValue(parsed, "campaign")) {
        return { ok: false, reason: "Viator URL is missing campaign subID" };
      }
      if (!isValidViatorCampaign(parsed)) {
        return { ok: false, reason: "Viator URL has invalid campaign subID" };
      }
    }
    const handoff = buildViatorHandoffUrl(
      rawUrl,
      "qa-verification",
      options?.partnerId,
    );
    if (!handoff) {
      return { ok: false, reason: "invalid attributed Viator handoff" };
    }
    return { ok: true, dedupeKey: normPath };
  }

  const resolved = resolveAffiliatePartnerByUrl(rawUrl);
  if (
    resolved === "travelpayouts" &&
    options?.allowTravelpayoutsWrapper &&
    partner !== "travelpayouts" &&
    AFFILIATE_PARTNERS[partner].verticals.some((vertical) =>
      AFFILIATE_PARTNERS.travelpayouts.verticals.includes(vertical),
    )
  ) {
    return validateTravelpayoutsUrl(parsed, normPath, {
      ...options,
      wrappedPartner: partner,
    });
  }

  if (resolved !== partner) {
    return { ok: false, reason: `URL host does not belong to ${partner}` };
  }

  const isNonRootPath = normPath !== "/";

  switch (partner) {
    case "getyourguide": {
      const pid = paramValue(parsed, "partner_id");
      if (!/^[A-Za-z0-9_-]{1,40}$/.test(pid)) {
        return {
          ok: false,
          reason: "GetYourGuide URL is missing valid partner_id",
        };
      }
      if (options?.partnerId && pid !== options.partnerId) {
        return {
          ok: false,
          reason: "GetYourGuide partner_id does not match configured partnerId",
        };
      }
      if (!isNonRootPath) {
        return { ok: false, reason: "GetYourGuide URL has root-only path" };
      }
      if (options?.requireSubId && !paramValue(parsed, "cmp")) {
        return { ok: false, reason: "GetYourGuide URL is missing cmp subID" };
      }
      return {
        ok: true,
        dedupeKey: buildDedupeKey("getyourguide", parsed, normPath),
      };
    }

    case "stay22": {
      const aid = paramValue(parsed, "aid");
      if (!aid) {
        return { ok: false, reason: "Stay22 URL is missing aid" };
      }
      if (options?.partnerId && aid !== options.partnerId) {
        return {
          ok: false,
          reason: "Stay22 aid does not match configured partnerId",
        };
      }
      if (!isNonRootPath) {
        return { ok: false, reason: "Stay22 URL must have a non-root path" };
      }
      if (options?.requireSubId && !paramValue(parsed, "campaign")) {
        return { ok: false, reason: "Stay22 URL is missing campaign subID" };
      }
      return {
        ok: true,
        dedupeKey: buildDedupeKey("stay22", parsed, normPath),
      };
    }

    case "booking": {
      if (!isNonRootPath) {
        return {
          ok: false,
          reason: "Booking.com URL must have a non-root path",
        };
      }
      if (!paramValue(parsed, "aid")) {
        return { ok: false, reason: "Booking.com URL is missing aid" };
      }
      if (
        options?.partnerId &&
        !matchesExpectedPartnerId(parsed, ["aid"], options.partnerId)
      ) {
        return {
          ok: false,
          reason: "Booking.com aid does not match configured partnerId",
        };
      }
      if (options?.requireSubId && !paramValue(parsed, "label")) {
        return { ok: false, reason: "Booking.com URL is missing label subID" };
      }
      return {
        ok: true,
        dedupeKey: buildDedupeKey("booking", parsed, normPath),
      };
    }

    case "duffel": {
      if (!isNonRootPath) {
        return { ok: false, reason: "Duffel URL must have a non-root path" };
      }
      if (
        options?.partnerId &&
        !matchesExpectedPartnerId(
          parsed,
          ["reference", "partner_id"],
          options.partnerId,
        )
      ) {
        return {
          ok: false,
          reason: "Duffel URL does not match configured partnerId",
        };
      }
      if (options?.requireSubId && !paramValue(parsed, "click_id")) {
        return { ok: false, reason: "Duffel URL is missing click_id subID" };
      }
      return {
        ok: true,
        dedupeKey: buildDedupeKey("duffel", parsed, normPath),
      };
    }

    case "airalo": {
      if (!isNonRootPath) {
        return { ok: false, reason: "Airalo URL must have a non-root path" };
      }
      if (
        options?.partnerId &&
        !matchesExpectedPartnerId(
          parsed,
          ["ref", "irclickid"],
          options.partnerId,
        )
      ) {
        return {
          ok: false,
          reason: "Airalo URL does not match configured partnerId",
        };
      }
      if (options?.requireSubId && !paramValue(parsed, "sub_id")) {
        return { ok: false, reason: "Airalo URL is missing sub_id" };
      }
      return { ok: true, dedupeKey: normPath };
    }

    case "safetywing": {
      if (
        !isNonRootPath &&
        !anyParamValue(parsed, ["referenceID", "ambassador", "click_id"])
      ) {
        return {
          ok: false,
          reason:
            "SafetyWing URL requires a non-root path or attribution parameter",
        };
      }
      if (
        options?.partnerId &&
        !matchesExpectedPartnerId(
          parsed,
          ["referenceID", "ambassador"],
          options.partnerId,
        )
      ) {
        return {
          ok: false,
          reason: "SafetyWing URL does not match configured partnerId",
        };
      }
      if (
        options?.requireSubId &&
        !anyParamValue(parsed, ["referenceID", "click_id"])
      ) {
        return {
          ok: false,
          reason: "SafetyWing URL is missing referenceID/click_id subID",
        };
      }
      return {
        ok: true,
        dedupeKey: `${parsed.hostname.toLowerCase()}${normPath}`,
      };
    }

    case "discovercars": {
      if (!isNonRootPath && !paramValue(parsed, "a_aid")) {
        return {
          ok: false,
          reason: "DiscoverCars URL requires a non-root path or a_aid",
        };
      }
      if (
        options?.partnerId &&
        !matchesExpectedPartnerId(parsed, ["a_aid"], options.partnerId)
      ) {
        return {
          ok: false,
          reason: "DiscoverCars a_aid does not match configured partnerId",
        };
      }
      if (options?.requireSubId && !paramValue(parsed, "sub_id")) {
        return { ok: false, reason: "DiscoverCars URL is missing sub_id" };
      }
      return {
        ok: true,
        dedupeKey: `${parsed.hostname.toLowerCase()}${normPath}`,
      };
    }

    case "klook": {
      if (!isNonRootPath) {
        return { ok: false, reason: "Klook URL must have a non-root path" };
      }
      if (
        options?.partnerId &&
        !matchesExpectedPartnerId(parsed, ["aid"], options.partnerId)
      ) {
        return {
          ok: false,
          reason: "Klook aid does not match configured partnerId",
        };
      }
      if (options?.requireSubId && !paramValue(parsed, "sub_id")) {
        return { ok: false, reason: "Klook URL is missing sub_id" };
      }
      return { ok: true, dedupeKey: normPath };
    }

    case "hostelworld": {
      if (!isNonRootPath) {
        return {
          ok: false,
          reason: "Hostelworld URL must have a non-root path",
        };
      }
      if (
        options?.partnerId &&
        !matchesExpectedPartnerId(parsed, ["source"], options.partnerId)
      ) {
        return {
          ok: false,
          reason: "Hostelworld source does not match configured partnerId",
        };
      }
      if (options?.requireSubId && !paramValue(parsed, "sub_id")) {
        return { ok: false, reason: "Hostelworld URL is missing sub_id" };
      }
      return { ok: true, dedupeKey: normPath };
    }

    case "opentable": {
      const validOpenTablePath =
        normPath.startsWith("/r/") ||
        normPath.startsWith("/restaurant/") ||
        normPath === "/s" ||
        normPath.startsWith("/s/");
      if (!validOpenTablePath) {
        return {
          ok: false,
          reason: "OpenTable URL must target /r/, /restaurant/, or /s",
        };
      }
      if (
        options?.partnerId &&
        !matchesExpectedPartnerId(
          parsed,
          ["aid", "rid", "restref"],
          options.partnerId,
        )
      ) {
        return {
          ok: false,
          reason: "OpenTable URL does not match configured partnerId",
        };
      }
      if (options?.requireSubId && !paramValue(parsed, "sub_id")) {
        return { ok: false, reason: "OpenTable URL is missing sub_id" };
      }
      if (normPath === "/s") {
        const term = paramValue(parsed, "term");
        return {
          ok: true,
          dedupeKey: term ? `${normPath}?term=${term.toLowerCase()}` : normPath,
        };
      }
      return { ok: true, dedupeKey: normPath };
    }

    case "skyscanner": {
      if (!isNonRootPath) {
        return {
          ok: false,
          reason: "Skyscanner URL must have a non-root path",
        };
      }
      if (
        options?.partnerId &&
        !matchesExpectedPartnerId(
          parsed,
          ["associateid", "irclickid"],
          options.partnerId,
        )
      ) {
        return {
          ok: false,
          reason: "Skyscanner URL does not match configured partnerId",
        };
      }
      if (options?.requireSubId && !paramValue(parsed, "sub_id")) {
        return { ok: false, reason: "Skyscanner URL is missing sub_id" };
      }
      return { ok: true, dedupeKey: normPath };
    }

    case "ivisa": {
      if (!isNonRootPath) {
        return { ok: false, reason: "iVisa URL must have a non-root path" };
      }
      if (
        options?.partnerId &&
        !matchesExpectedPartnerId(parsed, ["affid"], options.partnerId)
      ) {
        return {
          ok: false,
          reason: "iVisa affid does not match configured partnerId",
        };
      }
      if (options?.requireSubId && !paramValue(parsed, "sub_id")) {
        return { ok: false, reason: "iVisa URL is missing sub_id" };
      }
      return { ok: true, dedupeKey: normPath };
    }

    case "wise": {
      if (!isNonRootPath) {
        return { ok: false, reason: "Wise URL must have a non-root path" };
      }
      if (
        options?.partnerId &&
        !matchesExpectedPartnerId(
          parsed,
          ["irclickid", "source"],
          options.partnerId,
        )
      ) {
        return {
          ok: false,
          reason: "Wise URL does not match configured partnerId",
        };
      }
      if (options?.requireSubId && !paramValue(parsed, "sub_id")) {
        return { ok: false, reason: "Wise URL is missing sub_id" };
      }
      return { ok: true, dedupeKey: normPath };
    }

    case "travelpayouts": {
      return validateTravelpayoutsUrl(parsed, normPath, options);
    }

    case "expedia": {
      if (!isNonRootPath) {
        return { ok: false, reason: "Expedia URL must have a non-root path" };
      }
      if (
        options?.partnerId &&
        !matchesExpectedPartnerId(
          parsed,
          ["affcid", "camref"],
          options.partnerId,
        )
      ) {
        return {
          ok: false,
          reason: "Expedia URL does not match configured partnerId",
        };
      }
      if (
        options?.requireSubId &&
        !anyParamValue(parsed, ["affcid", "click_id"])
      ) {
        return {
          ok: false,
          reason: "Expedia URL is missing affcid/click_id subID",
        };
      }
      return { ok: true, dedupeKey: normPath };
    }

    case "tripadvisor": {
      if (!isNonRootPath) {
        return {
          ok: false,
          reason: "Tripadvisor URL must have a non-root path",
        };
      }
      if (
        options?.partnerId &&
        !matchesExpectedPartnerId(parsed, ["m"], options.partnerId)
      ) {
        return {
          ok: false,
          reason: "Tripadvisor m parameter does not match configured partnerId",
        };
      }
      if (options?.requireSubId && !paramValue(parsed, "sub_id")) {
        return { ok: false, reason: "Tripadvisor URL is missing sub_id" };
      }
      return { ok: true, dedupeKey: normPath };
    }
  }
}

interface CandidateItem {
  item: Record<string, unknown>;
  url: unknown;
  partner: AffiliatePartnerId | undefined;
}

function collectDayCandidates(
  day: unknown,
  activitiesOnly: boolean,
): CandidateItem[] {
  const dayRec = record(day);
  if (!dayRec) return [];
  const candidates: CandidateItem[] = [];

  for (const period of ["morning", "afternoon", "evening"] as const) {
    const slot = record(dayRec[period]);
    if (!slot) continue;

    const activities = slot.activities;
    if (Array.isArray(activities)) {
      for (const raw of activities) {
        const activity = record(raw);
        if (!activity || activity.planningIdea === true) continue;
        const booking = record(activity.bookingInfo);
        const url = activity.affiliateUrl ?? booking?.bookingUrl;
        const partnerRaw =
          activity.affiliatePartner ??
          booking?.affiliateId ??
          (!activitiesOnly && typeof url === "string"
            ? resolveAffiliatePartnerByUrl(url)
            : undefined);
        candidates.push({
          item: activity,
          url,
          partner: normalizeAffiliatePartner(partnerRaw),
        });
      }
    }

    if (!activitiesOnly) {
      const mealItems: unknown[] = [];
      if (Array.isArray(slot.meals)) mealItems.push(...slot.meals);
      if (slot.meal) mealItems.push(slot.meal);
      for (const raw of mealItems) {
        const meal = record(raw);
        if (!meal || meal.planningIdea === true) continue;
        const resInfo = record(meal.reservationInfo);
        const url = meal.affiliateUrl ?? meal.reservationUrl ?? resInfo?.url;
        const partner = normalizeAffiliatePartner(
          meal.affiliatePartner ??
            (typeof url === "string"
              ? resolveAffiliatePartnerByUrl(url)
              : undefined),
        );
        candidates.push({ item: meal, url, partner });
      }
    }
  }

  if (!activitiesOnly) {
    const hotels = Array.isArray(dayRec.hotel) ? dayRec.hotel : [dayRec.hotel];
    for (const raw of hotels) {
      const hotel = record(raw);
      if (!hotel || hotel.planningIdea === true) continue;
      const url = hotel.affiliateUrl;
      const partner = normalizeAffiliatePartner(
        hotel.affiliatePartner ??
          (typeof url === "string"
            ? resolveAffiliatePartnerByUrl(url)
            : undefined),
      );
      candidates.push({ item: hotel, url, partner });
    }

    const transports = Array.isArray(dayRec.transport)
      ? dayRec.transport
      : [dayRec.transport];
    for (const raw of transports) {
      const transport = record(raw);
      if (!transport || transport.planningIdea === true) continue;
      const url = transport.affiliateUrl;
      const partner = normalizeAffiliatePartner(
        transport.affiliatePartner ??
          (typeof url === "string"
            ? resolveAffiliatePartnerByUrl(url)
            : undefined),
      );
      candidates.push({ item: transport, url, partner });
    }

    const essentials = Array.isArray(dayRec.essentials)
      ? dayRec.essentials
      : [dayRec.essentials];
    for (const raw of essentials) {
      const essential = record(raw);
      if (!essential || essential.planningIdea === true) continue;
      const url = essential.affiliateUrl;
      const partner = normalizeAffiliatePartner(
        essential.affiliatePartner ??
          (typeof url === "string"
            ? resolveAffiliatePartnerByUrl(url)
            : undefined),
      );
      candidates.push({ item: essential, url, partner });
    }
  }

  return candidates;
}

function evaluateVendorExperiencesInternal(
  days: unknown[],
  expected: VendorExpectation,
): VendorExperienceEvaluation & { acceptedDedupeKeys: Set<string> } {
  const failures: string[] = [];
  const accepted = new Set<string>();
  const acceptedPaths = new Set<string>();

  const targetPartner = normalizeAffiliatePartner(expected.partner);
  if (!targetPartner) {
    return {
      failures: ["invalid vendor partner"],
      count: 0,
      acceptedDedupeKeys: acceptedPaths,
    };
  }
  if (
    !Number.isInteger(expected.minimumExperiences) ||
    expected.minimumExperiences < 1
  ) {
    return {
      failures: ["invalid vendor experience requirement"],
      count: 0,
      acceptedDedupeKeys: acceptedPaths,
    };
  }

  const isViator = targetPartner === "viator";
  const activitiesOnly = expected.activitiesOnly ?? isViator;
  const requirePhoto =
    expected.requirePhoto ?? DEFAULT_PHOTO_PARTNERS.has(targetPartner);

  for (const day of days) {
    for (const candidate of collectDayCandidates(day, activitiesOnly)) {
      if (candidate.partner !== targetPartner) continue;
      const item = candidate.item;

      if (isViator) {
        const id = item.id;
        if (typeof id !== "string" || !/^activity_v_[A-Za-z0-9]+$/.test(id)) {
          failures.push("Viator experience is missing its supplier product ID");
          continue;
        }
        const url = candidate.url;
        let parsedUrl: URL | undefined;
        if (typeof url === "string") {
          try {
            parsedUrl = new URL(url);
          } catch {
            parsedUrl = undefined;
          }
        }
        const hasDuplicateCampaign =
          parsedUrl !== undefined &&
          parsedUrl.searchParams.getAll("campaign").length > 1;
        const validSubId =
          !expected.requireSubId ||
          (parsedUrl !== undefined && isValidViatorCampaign(parsedUrl));
        if (
          typeof url !== "string" ||
          !parsedUrl ||
          !buildViatorHandoffUrl(url, "qa-verification", expected.partnerId) ||
          hasDuplicateCampaign ||
          !validSubId
        ) {
          failures.push(`${id} has no valid attributed Viator handoff`);
          continue;
        }
        if (
          requirePhoto &&
          (!Array.isArray(item.images) || !item.images.some(httpsImage))
        ) {
          failures.push(`${id} has no supplied HTTPS photo`);
          continue;
        }
        if (typeof item.name !== "string" || !item.name.trim()) {
          failures.push(`${id} has no experience name`);
          continue;
        }
        // Tracking parameters or a second saved ID must not turn one product
        // into multiple experiences. Viator's www and apex hosts are equivalent.
        const productPath = parsedUrl.pathname.replace(/\/+$/, "");
        if (accepted.has(id) || acceptedPaths.has(productPath)) continue;
        accepted.add(id);
        acceptedPaths.add(productPath);
        continue;
      }

      const id = item.id;
      if (typeof id !== "string" || !id.trim()) {
        failures.push(`${targetPartner} item is missing its ID`);
        continue;
      }
      if (
        targetPartner === "getyourguide" &&
        id.startsWith("activity_gyg_") &&
        !/^activity_gyg_\d+$/.test(id)
      ) {
        failures.push(`${id} has invalid GetYourGuide activity ID`);
        continue;
      }

      const url = candidate.url;
      if (typeof url !== "string") {
        failures.push(
          `${id} has no valid attributed ${targetPartner} handoff: URL is missing`,
        );
        continue;
      }
      const validation = validatePartnerHandoffUrl(targetPartner, url, {
        partnerId: expected.partnerId,
        requireSubId: expected.requireSubId,
        allowTravelpayoutsWrapper: expected.allowTravelpayoutsWrapper,
      });
      if (!validation.ok) {
        failures.push(
          `${id} has no valid attributed ${targetPartner} handoff: ${validation.reason}`,
        );
        continue;
      }
      if (
        requirePhoto &&
        (!Array.isArray(item.images) || !item.images.some(httpsImage))
      ) {
        failures.push(`${id} has no supplied HTTPS photo`);
        continue;
      }
      if (typeof item.name !== "string" || !item.name.trim()) {
        failures.push(`${id} has no item name`);
        continue;
      }
      if (accepted.has(id) || acceptedPaths.has(validation.dedupeKey)) continue;
      accepted.add(id);
      acceptedPaths.add(validation.dedupeKey);
    }
  }

  if (accepted.size < expected.minimumExperiences) {
    failures.push(
      `expected at least ${expected.minimumExperiences} distinct ${expected.partner} experiences with photos and attributed links, found ${accepted.size}`,
    );
  }
  return {
    failures,
    count: accepted.size,
    acceptedDedupeKeys: acceptedPaths,
  };
}

/** Saved-plan contract only: provider requests, photo decoding and paid attribution
 * still need independent live evidence. Inventory that never reaches a day doesn't count. */
export function evaluateVendorExperiences(
  days: unknown[],
  expected: VendorExpectation,
): VendorExperienceEvaluation {
  const { failures, count } = evaluateVendorExperiencesInternal(days, expected);
  return { failures, count };
}

/** Evaluate multiple partner expectations across a multi-surface itinerary in one pass. */
export function evaluateMultiPartnerVendors(
  days: unknown[],
  expectations: readonly VendorExpectation[],
): MultiPartnerVendorEvaluation {
  if (expectations.length === 0) {
    return {
      ok: false,
      totalCount: 0,
      byPartner: {},
      failures: ["no vendor expectations provided"],
    };
  }
  const byPartner: Record<string, VendorExperienceEvaluation> =
    Object.create(null);
  const acceptedKeysByPartner = new Map<string, Set<string>>();
  const failures: string[] = [];

  for (const expectation of expectations) {
    const partnerKey =
      normalizeAffiliatePartner(expectation.partner) ??
      String(expectation.partner);
    const result = evaluateVendorExperiencesInternal(days, expectation);
    let keySet = acceptedKeysByPartner.get(partnerKey);
    if (!keySet) {
      keySet = new Set<string>();
      acceptedKeysByPartner.set(partnerKey, keySet);
    }
    for (const key of result.acceptedDedupeKeys) {
      keySet.add(key);
    }

    if (Object.hasOwn(byPartner, partnerKey)) {
      const existing = byPartner[partnerKey];
      byPartner[partnerKey] = {
        failures: [...existing.failures, ...result.failures],
        count: keySet.size,
      };
    } else {
      byPartner[partnerKey] = {
        failures: [...result.failures],
        count: keySet.size,
      };
    }
    failures.push(...result.failures);
  }

  let totalCount = 0;
  for (const keySet of acceptedKeysByPartner.values()) {
    totalCount += keySet.size;
  }

  return {
    ok: failures.length === 0,
    totalCount,
    byPartner,
    failures,
  };
}
