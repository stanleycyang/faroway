/** Credential-free 4-tier offline monetization, attribution & security eval. Never calls fetch or reads .env secrets. */
import {
  AFFILIATE_DISCLOSURE_FULL,
  AFFILIATE_DISCLOSURE_SHORT,
  AFFILIATE_PARTNER_IDS,
  AFFILIATE_PARTNERS,
  ALLOWED_AFFILIATE_DOMAINS,
  formatAffiliatePartnerName,
  injectAffiliateSubId,
  isAllowedAffiliateUrl,
  itemTypeForAffiliatePartner,
  normalizeAffiliatePartner,
  resolveAffiliatePartnerByUrl,
  type AffiliatePartnerId,
} from "../../packages/constants/src/affiliates";
import {
  CANONICAL_TRAVEL_VIBE_IDS,
  normalizeVibeId,
  normalizeVibeList,
  travelVibes,
} from "../../packages/constants/src/destinations";
import {
  BUDGET_LABELS,
  BUDGET_TIERS,
  formatBudgetLabel,
  normalizeBudgetTier,
} from "../../packages/constants/src/search";
import {
  affiliateClickItemTypeSchema,
  affiliateClickSourceSchema,
  affiliatePartnerIdSchema,
  budgetTierInputSchema,
  conversionWebhookSchema,
  normalizedTravelVibeSchema,
  trackClickSchema,
} from "../../packages/validation/src/index";
import {
  affiliateClickInsert,
  affiliateClickLedgerFailures,
} from "../../apps/web/lib/affiliates/click-record";
import { buildGYGAffiliateUrl } from "../../apps/web/lib/affiliates/getyourguide";
import { buildViatorHandoffUrl } from "../../apps/web/lib/affiliates/viator-link";
import { evaluateSavedPlan } from "./lib/plan-quality";
import {
  evaluateMultiPartnerVendors,
  evaluateVendorExperiences,
  validatePartnerHandoffUrl,
} from "./lib/vendor-quality";

export interface TierReport {
  passed: boolean;
  checks: number;
  failures: string[];
  controlsCaught: number;
  controlsTotal: number;
  missedControls: string[];
}

export interface MonetizationEvalReport {
  mode: "offline-monetization-eval";
  live_network_called: false;
  accepted: boolean;
  total_checks: number;
  total_controls: number;
  total_controls_caught: number;
  missed_controls: string[];
  failures: string[];
  tier1_security: TierReport;
  tier2_attribution: TierReport;
  tier3_payloads: TierReport;
  tier4_itineraries: TierReport;
}

class TierTracker {
  checks = 0;
  failures: string[] = [];
  controlsTotal = 0;
  controlsCaught = 0;
  missedControls: string[] = [];

  check(id: string, condition: boolean, detail?: string): void {
    this.checks += 1;
    if (!condition) {
      this.failures.push(detail ? `${id}: ${detail}` : id);
    }
  }

  control(id: string, caught: boolean): void {
    this.checks += 1;
    this.controlsTotal += 1;
    if (caught) {
      this.controlsCaught += 1;
    } else {
      this.missedControls.push(id);
      this.failures.push(`missed_control:${id}`);
    }
  }

  toReport(): TierReport {
    return {
      passed: this.failures.length === 0 && this.missedControls.length === 0,
      checks: this.checks,
      failures: this.failures,
      controlsCaught: this.controlsCaught,
      controlsTotal: this.controlsTotal,
      missedControls: this.missedControls,
    };
  }
}

interface PartnerSample {
  partnerId: string;
  baseUrl: string;
  attributedUrl: string;
  preservedChecks: ReadonlyArray<[string, string]>;
}

const PARTNER_SAMPLES: Record<AffiliatePartnerId, PartnerSample> = {
  viator: {
    partnerId: "P123",
    baseUrl:
      "https://www.viator.com/tours/Tokyo/Food-Tour/d334-123P1?pid=P123&mcid=42383&medium=api",
    attributedUrl:
      "https://www.viator.com/tours/Tokyo/Food-Tour/d334-123P1?pid=P123&mcid=42383&medium=api&campaign=clk-viator",
    preservedChecks: [
      ["pid", "P123"],
      ["mcid", "42383"],
      ["medium", "api"],
    ],
  },
  getyourguide: {
    partnerId: "GYG42",
    baseUrl:
      "https://www.getyourguide.com/activity-t98765/?partner_id=GYG42&date=2027-04-06",
    attributedUrl:
      "https://www.getyourguide.com/activity-t98765/?partner_id=GYG42&date=2027-04-06&cmp=clk-gyg",
    preservedChecks: [
      ["partner_id", "GYG42"],
      ["date", "2027-04-06"],
    ],
  },
  travelpayouts: {
    partnerId: "394812",
    baseUrl:
      "https://tp.media/r?marker=394812&trs=201111&p=4110&shmarker=faroway&u=https%3A%2F%2Fwww.klook.com%2Factivity%2F1234-lisbon-sail%2F&campaign_id=101",
    attributedUrl:
      "https://tp.media/r?marker=394812&trs=201111&p=4110&shmarker=faroway&u=https%3A%2F%2Fwww.klook.com%2Factivity%2F1234-lisbon-sail%2F&campaign_id=101&sub_id=clk-tp",
    preservedChecks: [
      ["marker", "394812"],
      ["trs", "201111"],
      ["p", "4110"],
      ["shmarker", "faroway"],
      ["campaign_id", "101"],
    ],
  },
  stay22: {
    partnerId: "faroway-s22",
    baseUrl:
      "https://www.stay22.com/embed/gm?aid=faroway-s22&address=Shinjuku%2C%20Tokyo&lat=35.6938&lng=139.7034&checkin=2027-04-06&checkout=2027-04-09&adults=2&children=0&rooms=1",
    attributedUrl:
      "https://www.stay22.com/embed/gm?aid=faroway-s22&address=Shinjuku%2C%20Tokyo&lat=35.6938&lng=139.7034&checkin=2027-04-06&checkout=2027-04-09&adults=2&children=0&rooms=1&campaign=clk-stay22",
    preservedChecks: [
      ["aid", "faroway-s22"],
      ["address", "Shinjuku, Tokyo"],
      ["checkin", "2027-04-06"],
      ["checkout", "2027-04-09"],
      ["adults", "2"],
    ],
  },
  booking: {
    partnerId: "221100",
    baseUrl:
      "https://www.booking.com/hotel/jp/park-hyatt-tokyo.html?aid=221100&checkin=2027-04-06&checkout=2027-04-09&group_adults=2&group_children=0&no_rooms=1&ss=Tokyo",
    attributedUrl:
      "https://www.booking.com/hotel/jp/park-hyatt-tokyo.html?aid=221100&checkin=2027-04-06&checkout=2027-04-09&group_adults=2&group_children=0&no_rooms=1&ss=Tokyo&label=clk-booking",
    preservedChecks: [
      ["aid", "221100"],
      ["checkin", "2027-04-06"],
      ["ss", "Tokyo"],
    ],
  },
  expedia: {
    partnerId: "exp-110",
    baseUrl:
      "https://www.expedia.com/Tokyo-Hotels-Park-Hyatt.h1234.Hotel-Information?afflid=faroway&camref=1100l55&pubref=web",
    attributedUrl:
      "https://www.expedia.com/Tokyo-Hotels-Park-Hyatt.h1234.Hotel-Information?affcid=exp-110&afflid=faroway&camref=1100l55&pubref=web",
    preservedChecks: [
      ["afflid", "faroway"],
      ["camref", "1100l55"],
      ["pubref", "web"],
    ],
  },
  safetywing: {
    partnerId: "26012345",
    baseUrl: "https://safetywing.com/nomad-insurance?ambassador=faroway",
    attributedUrl:
      "https://safetywing.com/nomad-insurance?ambassador=faroway&referenceID=26012345",
    preservedChecks: [["ambassador", "faroway"]],
  },
  airalo: {
    partnerId: "faroway-air",
    baseUrl:
      "https://www.airalo.com/japan-esim?ref=faroway-air&irclickid=ir-100",
    attributedUrl:
      "https://www.airalo.com/japan-esim?ref=faroway-air&irclickid=ir-100&sub_id=clk-airalo",
    preservedChecks: [
      ["ref", "faroway-air"],
      ["irclickid", "ir-100"],
    ],
  },
  klook: {
    partnerId: "klk-77",
    baseUrl:
      "https://www.klook.com/activity/1234-tokyo-teamlab/?aid=klk-77&aff_adid=99&k_source=faroway",
    attributedUrl:
      "https://www.klook.com/activity/1234-tokyo-teamlab/?aid=klk-77&aff_adid=99&k_source=faroway&sub_id=clk-klook",
    preservedChecks: [
      ["aid", "klk-77"],
      ["aff_adid", "99"],
      ["k_source", "faroway"],
    ],
  },
  discovercars: {
    partnerId: "dc-88",
    baseUrl:
      "https://www.discovercars.com/portugal/lisbon-airport?a_aid=dc-88&a_bid=b1",
    attributedUrl:
      "https://www.discovercars.com/portugal/lisbon-airport?a_aid=dc-88&a_bid=b1&sub_id=clk-dc",
    preservedChecks: [
      ["a_aid", "dc-88"],
      ["a_bid", "b1"],
    ],
  },
  hostelworld: {
    partnerId: "hw-55",
    baseUrl:
      "https://www.hostelworld.com/pwa/hosteldetails.php/Home-Lisbon-Hostel/Lisbon/123?source=hw-55",
    attributedUrl:
      "https://www.hostelworld.com/pwa/hosteldetails.php/Home-Lisbon-Hostel/Lisbon/123?source=hw-55&sub_id=clk-hw",
    preservedChecks: [["source", "hw-55"]],
  },
  duffel: {
    partnerId: "duf-ref-1",
    baseUrl: "https://links.duffel.com/flights/sfo-nrt?reference=duf-ref-1",
    attributedUrl:
      "https://links.duffel.com/flights/sfo-nrt?reference=duf-ref-1&click_id=clk-duffel",
    preservedChecks: [["reference", "duf-ref-1"]],
  },
  tripadvisor: {
    partnerId: "ta-654",
    baseUrl:
      "https://www.tripadvisor.com/Hotel_Review-g298184-d304290-Reviews-Park_Hyatt_Tokyo.html?m=ta-654",
    attributedUrl:
      "https://www.tripadvisor.com/Hotel_Review-g298184-d304290-Reviews-Park_Hyatt_Tokyo.html?m=ta-654&sub_id=clk-ta",
    preservedChecks: [["m", "ta-654"]],
  },
  opentable: {
    partnerId: "ot-91",
    baseUrl: "https://www.opentable.com/r/narisawa-tokyo?rid=ot-91&aid=ot-aid",
    attributedUrl:
      "https://www.opentable.com/r/narisawa-tokyo?rid=ot-91&aid=ot-aid&sub_id=clk-ot",
    preservedChecks: [
      ["rid", "ot-91"],
      ["aid", "ot-aid"],
    ],
  },
  skyscanner: {
    partnerId: "sky-31",
    baseUrl:
      "https://www.skyscanner.com/transport/flights/sfo/tyoa/?associateid=sky-31&irclickid=ir-sky",
    attributedUrl:
      "https://www.skyscanner.com/transport/flights/sfo/tyoa/?associateid=sky-31&irclickid=ir-sky&sub_id=clk-sky",
    preservedChecks: [
      ["associateid", "sky-31"],
      ["irclickid", "ir-sky"],
    ],
  },
  ivisa: {
    partnerId: "iv-19",
    baseUrl: "https://www.ivisa.com/japan-visa?affid=iv-19&irclickid=ir-iv",
    attributedUrl:
      "https://www.ivisa.com/japan-visa?affid=iv-19&irclickid=ir-iv&sub_id=clk-ivisa",
    preservedChecks: [
      ["affid", "iv-19"],
      ["irclickid", "ir-iv"],
    ],
  },
  wise: {
    partnerId: "wise-22",
    baseUrl:
      "https://wise.com/gb/currency-converter/usd-to-jpy-rate?irclickid=wise-22&source=USD&target=JPY",
    attributedUrl:
      "https://wise.com/gb/currency-converter/usd-to-jpy-rate?irclickid=wise-22&source=USD&target=JPY&sub_id=clk-wise",
    preservedChecks: [
      ["irclickid", "wise-22"],
      ["source", "USD"],
      ["target", "JPY"],
    ],
  },
};

export function evaluateTier1Security(): TierReport {
  const t = new TierTracker();

  t.check(
    "registry:count-17",
    AFFILIATE_PARTNER_IDS.length === 17 &&
      new Set(AFFILIATE_PARTNER_IDS).size === 17,
    `expected 17 unique partners, found ${AFFILIATE_PARTNER_IDS.length}`,
  );

  t.check(
    "registry:schema-parity",
    JSON.stringify([...AFFILIATE_PARTNER_IDS].sort()) ===
      JSON.stringify([...affiliatePartnerIdSchema.options].sort()),
    "AFFILIATE_PARTNER_IDS must match affiliatePartnerIdSchema.options",
  );

  const allowlistSet = new Set(ALLOWED_AFFILIATE_DOMAINS);
  for (const id of AFFILIATE_PARTNER_IDS) {
    const meta = AFFILIATE_PARTNERS[id];
    t.check(`registry:${id}:meta`, meta !== undefined && meta.id === id);
    t.check(`registry:${id}:name`, meta.name.trim().length > 0);
    t.check(`registry:${id}:verticals`, meta.verticals.length > 0);
    t.check(`registry:${id}:subIdParam`, meta.subIdParam.trim().length > 0);
    t.check(
      `registry:${id}:hosts-in-allowlist`,
      meta.allowedHosts.length > 0 &&
        meta.allowedHosts.every((host) => allowlistSet.has(host)),
    );
    t.check(
      `registry:${id}:zod-valid`,
      affiliatePartnerIdSchema.safeParse(id).success,
    );

    const probeUrl = `https://${meta.allowedHosts[0]}/offer/1`;
    t.check(`allowlist:${id}:allowed`, isAllowedAffiliateUrl(probeUrl));
    t.check(
      `allowlist:${id}:resolved`,
      resolveAffiliatePartnerByUrl(probeUrl) === id,
    );
  }

  for (const [alias, expected] of [
    ["  Viator  ", "viator"],
    ["GYG", "getyourguide"],
    ["Booking.com", "booking"],
    ["TP", "travelpayouts"],
    ["aviasales", "travelpayouts"],
  ] as const) {
    t.check(
      `alias:${alias}`,
      normalizeAffiliatePartner(alias) === expected &&
        formatAffiliatePartnerName(alias) === AFFILIATE_PARTNERS[expected].name,
    );
  }
  t.check(
    "itemType:opentable",
    itemTypeForAffiliatePartner("opentable") === "restaurant",
  );
  t.check(
    "itemType:skyscanner",
    itemTypeForAffiliatePartner("skyscanner") === "flight",
  );

  const prototypeKeys = [
    "__proto__",
    "constructor",
    "toString",
    "valueOf",
    "hasOwnProperty",
    "",
    "   ",
  ];
  for (const key of prototypeKeys) {
    t.control(
      `proto-partner:${JSON.stringify(key)}`,
      normalizeAffiliatePartner(key) === undefined &&
        !affiliatePartnerIdSchema.safeParse(key).success,
    );
    t.control(
      `proto-validate-handoff:${JSON.stringify(key)}`,
      !validatePartnerHandoffUrl(
        key as AffiliatePartnerId,
        "https://tp.media/r?marker=394812&u=https%3A%2F%2Fsafetywing.com&sub_id=clk1",
        { allowTravelpayoutsWrapper: true },
      ).ok,
    );
    t.control(
      `proto-multi-partner:${JSON.stringify(key)}`,
      !evaluateMultiPartnerVendors(
        [],
        [{ partner: key as AffiliatePartnerId, minimumExperiences: 1 }],
      ).ok,
    );
    t.control(
      `proto-vibe:${JSON.stringify(key)}`,
      normalizeVibeId(key) === undefined,
    );
    t.control(
      `proto-budget:${JSON.stringify(key)}`,
      normalizeBudgetTier(key) === undefined,
    );
  }

  const unsafeSchemes = [
    "http://www.viator.com/tours/Paris/d479-1",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "ftp://viator.com/tours/1",
    "file:///etc/passwd",
  ];
  for (const url of unsafeSchemes) {
    t.control(
      `scheme-reject:${url.slice(0, 24)}`,
      !isAllowedAffiliateUrl(url) &&
        resolveAffiliatePartnerByUrl(url) === undefined &&
        injectAffiliateSubId(url, "viator", "clk-1") === null,
    );
  }

  const credsAndPorts = [
    "https://user:pass@www.viator.com/tours/Paris/d479-1",
    "https://user@www.booking.com/hotel/fr/ritzy.html",
    "https://www.booking.com:8443/hotel/fr/ritzy.html",
    "https://www.stay22.com:8080/embed/gm?aid=1",
  ];
  for (const url of credsAndPorts) {
    t.control(
      `cred-port-reject:${url}`,
      !isAllowedAffiliateUrl(url) &&
        resolveAffiliatePartnerByUrl(url) === undefined &&
        injectAffiliateSubId(url, "booking", "clk-1") === null,
    );
  }

  const lookalikesAndSsrf = [
    "https://viator.com.evil.test/tours/Paris/d479-1",
    "https://evilviator.com/tours/Paris/d479-1",
    "https://booking.com.phisher.invalid/hotel/1",
    "https://duffel.com.attacker.example/offer/1",
    "https://airalo.evil.com/esim",
    "https://evilgetyourguide.com/activity-t123/",
    "https://stay22.evil.com/embed/gm",
    "https://127.0.0.1/tours/1",
    "https://169.254.169.254/latest/meta-data",
  ];
  for (const url of lookalikesAndSsrf) {
    t.control(
      `lookalike-reject:${url}`,
      !isAllowedAffiliateUrl(url) &&
        resolveAffiliatePartnerByUrl(url) === undefined &&
        injectAffiliateSubId(url, "viator", "clk-1") === null,
    );
  }

  t.control(
    "empty-clickid-reject",
    injectAffiliateSubId(PARTNER_SAMPLES.viator.baseUrl, "viator", "") ===
      null &&
      injectAffiliateSubId(PARTNER_SAMPLES.viator.baseUrl, "viator", "   ") ===
        null,
  );

  return t.toReport();
}

export function evaluateTier2Attribution(): TierReport {
  const t = new TierTracker();

  for (const id of AFFILIATE_PARTNER_IDS) {
    const sample = PARTNER_SAMPLES[id];
    const meta = AFFILIATE_PARTNERS[id];
    const clickId = `clk-${id}-01`;
    const injected = injectAffiliateSubId(sample.baseUrl, id, clickId, {
      itemType: meta.defaultItemType,
    });
    t.check(`inject:${id}:non-null`, injected !== null);
    if (injected) {
      const parsed = new URL(injected);
      t.check(
        `inject:${id}:subIdParam`,
        parsed.searchParams.get(meta.subIdParam) === clickId,
        `expected ${meta.subIdParam}=${clickId}, got ${parsed.searchParams.get(meta.subIdParam)}`,
      );
      for (const [k, v] of sample.preservedChecks) {
        t.check(
          `inject:${id}:preserved:${k}`,
          parsed.searchParams.get(k) === v,
          `expected ${k}=${v}, got ${parsed.searchParams.get(k)}`,
        );
      }
      if (meta.appendUtm) {
        t.check(
          `inject:${id}:utm`,
          parsed.searchParams.get("utm_source") === "faroway" &&
            parsed.searchParams.get("utm_medium") === "affiliate" &&
            parsed.searchParams.get("utm_campaign") === meta.defaultItemType,
        );
      } else {
        t.check(
          `inject:${id}:no-utm`,
          !parsed.searchParams.has("utm_source") &&
            !parsed.searchParams.has("utm_medium"),
        );
      }
    }

    const valid = validatePartnerHandoffUrl(id, sample.attributedUrl, {
      partnerId: sample.partnerId,
      requireSubId: true,
    });
    t.check(`validate:${id}:ok`, valid.ok, valid.ok ? undefined : valid.reason);
  }

  // SafetyWing existing referenceID must not be clobbered -> falls back to click_id
  const swPreserved = injectAffiliateSubId(
    "https://safetywing.com/nomad-insurance?referenceID=faroway-partner&ambassador=faroway",
    "safetywing",
    "clk-sw-fallback",
  );
  t.check(
    "safetywing:preserve-referenceID-fallback-click_id",
    swPreserved !== null &&
      new URL(swPreserved).searchParams.get("referenceID") ===
        "faroway-partner" &&
      new URL(swPreserved).searchParams.get("click_id") === "clk-sw-fallback",
  );

  // SafetyWing via Travelpayouts wrapper -> uses sub_id
  const swTp = injectAffiliateSubId(
    "https://tp.media/r?marker=394812&p=4110&u=https%3A%2F%2Fsafetywing.com",
    "safetywing",
    "clk-sw-tp",
  );
  t.check(
    "safetywing:travelpayouts-wrapper-sub_id",
    swTp !== null &&
      new URL(swTp).searchParams.get("sub_id") === "clk-sw-tp" &&
      new URL(swTp).searchParams.get("marker") === "394812",
  );

  // Expedia existing affcid preserved -> falls back to click_id
  const expPreserved = injectAffiliateSubId(
    "https://www.expedia.com/Tokyo-Hotels.h1.Hotel-Information?affcid=exp-existing",
    "expedia",
    "clk-exp-fallback",
  );
  t.check(
    "expedia:preserve-affcid-fallback-click_id",
    expPreserved !== null &&
      new URL(expPreserved).searchParams.get("affcid") === "exp-existing" &&
      new URL(expPreserved).searchParams.get("click_id") === "clk-exp-fallback",
  );

  // Host precedence over mismatched partner arg
  const hostPrecedence = injectAffiliateSubId(
    PARTNER_SAMPLES.stay22.baseUrl,
    "booking",
    "clk-host-win",
  );
  t.check(
    "host-precedence:stay22-over-booking-arg",
    hostPrecedence !== null &&
      new URL(hostPrecedence).searchParams.get("campaign") === "clk-host-win" &&
      !new URL(hostPrecedence).searchParams.has("label"),
  );

  // Travelpayouts wrapper validation opt-in vs opt-out and security controls
  const tpWrappedSafetyWing =
    "https://tp.media/r?marker=394812&p=4110&u=https%3A%2F%2Fsafetywing.com&sub_id=clk-tp-sw";
  t.control(
    "tp-wrapper-disallowed-by-default",
    !validatePartnerHandoffUrl("safetywing", tpWrappedSafetyWing, {
      requireSubId: true,
    }).ok,
  );
  t.check(
    "tp-wrapper-allowed-when-enabled",
    validatePartnerHandoffUrl("safetywing", tpWrappedSafetyWing, {
      partnerId: "394812",
      requireSubId: true,
      allowTravelpayoutsWrapper: true,
    }).ok,
  );
  t.control(
    "tp-wrapper-root-path-rejected",
    !validatePartnerHandoffUrl(
      "travelpayouts",
      "https://www.travelpayouts.com/?marker=394812&sub_id=clk-tp",
      { requireSubId: true },
    ).ok,
  );
  t.control(
    "tp-wrapper-javascript-u-rejected",
    !validatePartnerHandoffUrl(
      "safetywing",
      "https://tp.media/r?marker=394812&u=javascript%3Aalert(1)&sub_id=clk1",
      { allowTravelpayoutsWrapper: true },
    ).ok,
  );
  t.control(
    "tp-wrapper-evil-host-u-rejected",
    !validatePartnerHandoffUrl(
      "safetywing",
      "https://tp.media/r?marker=394812&u=https%3A%2F%2Fevil.com%2Fphish&sub_id=clk1",
      { allowTravelpayoutsWrapper: true },
    ).ok,
  );
  t.control(
    "tp-wrapper-cross-partner-u-rejected",
    !validatePartnerHandoffUrl(
      "safetywing",
      "https://tp.media/r?marker=394812&u=https%3A%2F%2Fwww.booking.com%2Fhotel%2Fjp%2Fa.html&sub_id=clk1",
      { allowTravelpayoutsWrapper: true },
    ).ok,
  );
  t.control(
    "tp-wrapper-missing-u-for-wrapped-partner-rejected",
    !validatePartnerHandoffUrl(
      "safetywing",
      "https://tp.media/r?marker=394812&sub_id=clk1",
      { allowTravelpayoutsWrapper: true },
    ).ok,
  );
  t.control(
    "tp-wrapper-trailing-dot-u-rejected",
    !validatePartnerHandoffUrl(
      "safetywing",
      "https://tp.media/r?marker=394812&u=https%3A%2F%2Fsafetywing.com.%2Fnomad-insurance&sub_id=clk1",
      { allowTravelpayoutsWrapper: true },
    ).ok,
  );
  t.control(
    "tp-wrapper-nested-tp-js-rejected",
    !validatePartnerHandoffUrl(
      "travelpayouts",
      `https://tp.media/r?marker=394812&sub_id=clk1&u=${encodeURIComponent("https://tp.media/r?marker=999&u=javascript:alert(1)")}`,
      { partnerId: "394812", requireSubId: true },
    ).ok,
  );
  t.control(
    "tp-wrapper-nested-tp-root-rejected",
    !validatePartnerHandoffUrl(
      "travelpayouts",
      `https://tp.media/r?marker=394812&sub_id=clk1&u=${encodeURIComponent("https://www.travelpayouts.com/?marker=999")}`,
      { partnerId: "394812", requireSubId: true },
    ).ok,
  );
  t.control(
    "tp-wrapper-nested-tp-evil-rejected",
    !validatePartnerHandoffUrl(
      "travelpayouts",
      "https://tp.media/r?marker=394812&u=https%3A%2F%2Ftp.media%2Fr%3Fu%3Dhttps%253A%252F%252Fevil.com&sub_id=clk1",
      { partnerId: "394812", requireSubId: true },
    ).ok,
  );

  // Stay22 /embed/gm dedupe keys: www vs apex equivalence, distinct destinations & city/q fallback
  const s22Tokyo = validatePartnerHandoffUrl(
    "stay22",
    "https://www.stay22.com/embed/gm?aid=faroway-s22&address=Tokyo&campaign=c1",
    { partnerId: "faroway-s22", requireSubId: true },
  );
  const s22TokyoApex = validatePartnerHandoffUrl(
    "stay22",
    "https://stay22.com/embed/gm?aid=faroway-s22&address=Tokyo&campaign=c2",
    { partnerId: "faroway-s22", requireSubId: true },
  );
  const s22Kyoto = validatePartnerHandoffUrl(
    "stay22",
    "https://www.stay22.com/embed/gm?aid=faroway-s22&address=Kyoto&campaign=c3",
    { partnerId: "faroway-s22", requireSubId: true },
  );
  const s22CityTokyo = validatePartnerHandoffUrl(
    "stay22",
    "https://www.stay22.com/embed/gm?aid=faroway-s22&city=Tokyo&campaign=c4",
    { partnerId: "faroway-s22", requireSubId: true },
  );
  const s22CityKyoto = validatePartnerHandoffUrl(
    "stay22",
    "https://www.stay22.com/embed/gm?aid=faroway-s22&city=Kyoto&campaign=c5",
    { partnerId: "faroway-s22", requireSubId: true },
  );
  t.check(
    "stay22:embed-dedupe-distinct-vs-same",
    s22Tokyo.ok &&
      s22TokyoApex.ok &&
      s22Kyoto.ok &&
      s22CityTokyo.ok &&
      s22CityKyoto.ok &&
      s22Tokyo.dedupeKey === s22TokyoApex.dedupeKey &&
      s22Tokyo.dedupeKey !== s22Kyoto.dedupeKey &&
      s22CityTokyo.dedupeKey !== s22CityKyoto.dedupeKey,
  );

  // GYG /s/?q=... dedupe preserves search query term
  const gygSearchTokyo = validatePartnerHandoffUrl(
    "getyourguide",
    "https://www.getyourguide.com/s/?q=Tokyo&partner_id=GYG42&cmp=c1",
    { partnerId: "GYG42", requireSubId: true },
  );
  const gygSearchKyoto = validatePartnerHandoffUrl(
    "getyourguide",
    "https://www.getyourguide.com/s/?q=Kyoto&partner_id=GYG42&cmp=c2",
    { partnerId: "GYG42", requireSubId: true },
  );
  t.check(
    "gyg:search-dedupe-preserves-q",
    gygSearchTokyo.ok &&
      gygSearchKyoto.ok &&
      gygSearchTokyo.dedupeKey !== gygSearchKyoto.dedupeKey,
  );

  // Viator & GYG builder checks + negative controls
  const viatorValid = buildViatorHandoffUrl(
    PARTNER_SAMPLES.viator.baseUrl,
    "qa-tier2",
    "P123",
  );
  t.check(
    "viator:builder-valid",
    viatorValid !== null &&
      new URL(viatorValid).searchParams.get("campaign") === "qa-tier2",
  );
  t.control(
    "viator:duplicate-pid-rejected",
    buildViatorHandoffUrl(
      `${PARTNER_SAMPLES.viator.baseUrl}&pid=P999`,
      "qa-tier2",
      "P123",
    ) === null,
  );
  t.control(
    "viator:wrong-partnerId-rejected",
    buildViatorHandoffUrl(
      PARTNER_SAMPLES.viator.baseUrl,
      "qa-tier2",
      "P999",
    ) === null,
  );
  t.control(
    "viator:overlong-campaign-rejected",
    buildViatorHandoffUrl(
      PARTNER_SAMPLES.viator.baseUrl,
      "c".repeat(101),
      "P123",
    ) === null &&
      !validatePartnerHandoffUrl(
        "viator",
        `${PARTNER_SAMPLES.viator.baseUrl}&campaign=${"c".repeat(101)}`,
        { partnerId: "P123", requireSubId: true },
      ).ok,
  );

  const gygValid = buildGYGAffiliateUrl(
    "98765",
    "trip-01",
    "GYG42",
    "2027-04-06",
  );
  t.check(
    "gyg:builder-valid",
    gygValid.includes("activity-t98765") &&
      gygValid.includes("partner_id=GYG42") &&
      gygValid.includes("cmp=trip-01") &&
      gygValid.includes("date=2027-04-06"),
  );
  t.control(
    "gyg:missing-partnerId-rejected",
    buildGYGAffiliateUrl("98765", "trip-01", undefined) === "" &&
      buildGYGAffiliateUrl("98765", "trip-01", "bad id!") === "",
  );
  t.control(
    "gyg:non-numeric-activityId-rejected",
    buildGYGAffiliateUrl("abc123", "trip-01", "GYG42") === "",
  );
  t.control(
    "hpp:duplicate-partner-id-rejected",
    !validatePartnerHandoffUrl(
      "getyourguide",
      "https://www.getyourguide.com/activity-t123/?partner_id=GYG42&partner_id=EVIL&cmp=c1",
      { partnerId: "GYG42", requireSubId: true },
    ).ok &&
      !validatePartnerHandoffUrl(
        "travelpayouts",
        "https://tp.media/r?marker=394812&marker=999&u=https%3A%2F%2Fwww.klook.com%2Factivity%2F1%2F&sub_id=c1",
        { partnerId: "394812", requireSubId: true },
      ).ok,
  );

  // Partner URL validator negative controls
  t.control(
    "validate:missing-subId-rejected",
    !validatePartnerHandoffUrl("booking", PARTNER_SAMPLES.booking.baseUrl, {
      partnerId: "221100",
      requireSubId: true,
    }).ok,
  );
  // Note: packages/constants/src/affiliates.ts strips trailing dots in parseSafeHttpsUrl /
  // isAllowedAffiliateUrl / resolveAffiliatePartnerByUrl / injectAffiliateSubId, whereas
  // vendor-quality.ts strictly rejects trailing-dot hostnames on both outer and wrapped URLs.
  t.control(
    "validate:trailing-dot-rejected",
    !validatePartnerHandoffUrl(
      "stay22",
      "https://www.stay22.com./embed/gm?aid=faroway-s22&address=Tokyo&campaign=c1",
      { requireSubId: true },
    ).ok &&
      !validatePartnerHandoffUrl(
        "getyourguide",
        "https://www.getyourguide.com./activity-t123/?partner_id=GYG42&cmp=c1",
        { partnerId: "GYG42", requireSubId: true },
      ).ok,
  );
  t.control(
    "validate:http-rejected",
    !validatePartnerHandoffUrl(
      "duffel",
      "http://links.duffel.com/flights/sfo-nrt?click_id=c1",
    ).ok,
  );

  return t.toReport();
}

export function evaluateTier3Payloads(): TierReport {
  const t = new TierTracker();

  for (const itemType of affiliateClickItemTypeSchema.options) {
    for (const source of affiliateClickSourceSchema.options) {
      const row = affiliateClickInsert({
        clickId: `clk-${itemType}-${source}`,
        userId: source === "shared_trip" ? null : "user-123",
        itemType,
        itemId: `item-${itemType}-1`,
        itemName: `Sample ${itemType}`,
        affiliatePartner: "stay22",
        affiliateUrl: PARTNER_SAMPLES.stay22.attributedUrl,
        tripId: "trip-123",
        price: 120,
        currency: "USD",
        source,
        clickedAt: "2026-11-21T07:00:00Z",
      });
      t.check(
        `ledger:${itemType}:${source}`,
        affiliateClickLedgerFailures(row).length === 0,
      );

      const parsed = trackClickSchema.safeParse({
        itemType,
        itemId: `item-${itemType}-1`,
        itemName: `Sample ${itemType}`,
        affiliatePartner: "stay22",
        affiliateUrl: PARTNER_SAMPLES.stay22.attributedUrl,
        tripId: "trip-123",
        source,
        clickId: `clk-${itemType}-${source}`,
        placement: "card_cta",
        campaign: "launch",
      });
      t.check(`trackClickSchema:${itemType}:${source}`, parsed.success);
    }
  }

  // Ledger negative controls
  const validLedgerRow = affiliateClickInsert({
    clickId: "clk-ok",
    userId: null,
    itemType: "hotel",
    itemId: "hotel-1",
    itemName: "Park Hyatt Tokyo",
    affiliatePartner: "booking",
    affiliateUrl: PARTNER_SAMPLES.booking.attributedUrl,
    clickedAt: "2026-11-21T07:00:00Z",
  });
  t.control(
    "ledger:legacy-column-caught",
    affiliateClickLedgerFailures({
      ...validLedgerRow,
      tracking_id: "x",
    }).includes("legacy:tracking_id"),
  );
  t.control(
    "ledger:non-https-caught",
    affiliateClickLedgerFailures({
      ...validLedgerRow,
      affiliate_url: "http://www.booking.com/hotel/1.html",
    }).includes("affiliate_url"),
  );
  t.control(
    "ledger:converted-true-caught",
    affiliateClickLedgerFailures({
      ...validLedgerRow,
      converted: true,
    }).includes("converted"),
  );

  // trackClickSchema negative controls
  for (const [label, payload] of [
    [
      "bad-url",
      {
        itemType: "activity",
        itemId: "a1",
        itemName: "Tour",
        affiliatePartner: "viator",
        affiliateUrl: "not-a-url",
      },
    ],
    [
      "empty-itemId",
      {
        itemType: "activity",
        itemId: "",
        itemName: "Tour",
        affiliatePartner: "viator",
        affiliateUrl: PARTNER_SAMPLES.viator.attributedUrl,
      },
    ],
    [
      "invalid-itemType",
      {
        itemType: "cruise",
        itemId: "a1",
        itemName: "Cruise",
        affiliatePartner: "viator",
        affiliateUrl: PARTNER_SAMPLES.viator.attributedUrl,
      },
    ],
    [
      "invalid-source",
      {
        itemType: "activity",
        itemId: "a1",
        itemName: "Tour",
        affiliatePartner: "viator",
        affiliateUrl: PARTNER_SAMPLES.viator.attributedUrl,
        source: "unknown_surface",
      },
    ],
    [
      "overlong-clickId",
      {
        itemType: "activity",
        itemId: "a1",
        itemName: "Tour",
        affiliatePartner: "viator",
        affiliateUrl: PARTNER_SAMPLES.viator.attributedUrl,
        clickId: "x".repeat(201),
      },
    ],
  ] as const) {
    t.control(
      `trackClickSchema:${label}`,
      !trackClickSchema.safeParse(payload).success,
    );
  }

  // conversionWebhookSchema positive cases across webhook-capable partners & statuses
  const webhookPartners = AFFILIATE_PARTNER_IDS.filter(
    (id) => AFFILIATE_PARTNERS[id].supportsConversionWebhook,
  );
  const statuses = ["pending", "confirmed", "canceled", "refunded"] as const;
  for (const [idx, partner] of webhookPartners.entries()) {
    const parsed = conversionWebhookSchema.safeParse({
      partner,
      clickId: `clk-${partner}-1`,
      externalTransactionId: `txn-${partner}-99`,
      status: statuses[idx % statuses.length],
      bookingAmount: 199.5,
      commissionAmount: 15.96,
      currency: "USD",
      occurredAt: idx % 2 === 0 ? "2028-02-29" : "2026-11-21T07:22:25Z",
      metadata: { source: "webhook-eval" },
    });
    t.check(`conversionSchema:${partner}`, parsed.success);
  }

  // conversionWebhookSchema boundary negative controls
  const baseConversion = {
    partner: "viator",
    clickId: "clk-1",
    externalTransactionId: "txn-1",
    status: "confirmed",
    bookingAmount: 100,
    commissionAmount: 8,
    currency: "USD",
    occurredAt: "2026-11-21",
  };
  for (const [label, patch] of [
    ["amount:Infinity", { bookingAmount: Infinity }],
    ["amount:-Infinity", { commissionAmount: -Infinity }],
    ["amount:NaN", { bookingAmount: Number.NaN }],
    ["amount:negative", { commissionAmount: -0.01 }],
    ["currency:lowercase", { currency: "usd" }],
    ["currency:2-letter", { currency: "US" }],
    ["currency:4-letter", { currency: "USDX" }],
    ["currency:symbol", { currency: "12$" }],
    ["currency:padded", { currency: " USD " }],
    ["date:feb-30", { occurredAt: "2026-02-30" }],
    ["date:non-leap-feb-29", { occurredAt: "2027-02-29" }],
    ["date:month-13", { occurredAt: "2026-13-01" }],
    ["date:slash-format", { occurredAt: "2026/11/21" }],
    ["date:garbage", { occurredAt: "not-a-date" }],
    ["partner:retired", { partner: "retired-provider" }],
    ["partner:constructor", { partner: "constructor" }],
    ["partner:empty", { partner: "" }],
    ["clickId:empty", { clickId: "" }],
    ["txnId:overlong", { externalTransactionId: "t".repeat(201) }],
  ] as const) {
    t.control(
      `conversionSchema:${label}`,
      !conversionWebhookSchema.safeParse({ ...baseConversion, ...patch })
        .success,
    );
  }

  return t.toReport();
}

function buildRealisticTokyoPlan() {
  const photo = (slug: string) => [
    `https://cdn.faroway.example/images/${slug}.jpg`,
  ];
  return {
    trip: { status: "planned" },
    itinerary: {
      days: [
        {
          date: "2027-04-06",
          title: "Arrival in Shinjuku & Shibuya",
          summary: "Check in, evening food tour, and connectivity setup.",
          transport: {
            id: "flight_duffel_1",
            name: "SFO to NRT Nonstop",
            affiliatePartner: "duffel",
            affiliateUrl: PARTNER_SAMPLES.duffel.attributedUrl,
          },
          hotel: {
            id: "hotel_stay22_tokyo",
            name: "Park Hyatt Tokyo (Stay22)",
            affiliatePartner: "stay22",
            affiliateUrl: PARTNER_SAMPLES.stay22.attributedUrl,
            images: photo("stay22-tokyo"),
          },
          morning: {
            activities: [
              {
                id: "activity_v_123P1",
                name: "Tsukiji Outer Market Food Tour",
                affiliatePartner: "viator",
                affiliateUrl: PARTNER_SAMPLES.viator.attributedUrl,
                images: photo("viator-tsukiji"),
              },
            ],
            meals: [{ id: "meal_tokyo_1", name: "Tsukiji Matcha Stand" }],
          },
          afternoon: {
            activities: [
              {
                id: "activity_gyg_98765",
                name: "Meiji Jingu & Harajuku Walk",
                affiliatePartner: "getyourguide",
                affiliateUrl: PARTNER_SAMPLES.getyourguide.attributedUrl,
                images: photo("gyg-meiji"),
              },
            ],
            meals: [{ id: "meal_tokyo_2", name: "Harajuku Ramen" }],
          },
          evening: {
            activities: [
              {
                id: "activity_klook_1234",
                name: "teamLab Planets TOKYO",
                affiliatePartner: "klook",
                affiliateUrl: PARTNER_SAMPLES.klook.attributedUrl,
                images: photo("klook-teamlab"),
              },
            ],
            meals: [
              {
                id: "rest_opentable_narisawa",
                name: "Narisawa Tokyo",
                affiliatePartner: "opentable",
                reservationInfo: {
                  recommended: true,
                  url: PARTNER_SAMPLES.opentable.attributedUrl,
                },
              },
            ],
          },
          essentials: [
            {
              id: "ess_airalo_jp",
              name: "Airalo Japan eSIM",
              affiliatePartner: "airalo",
              affiliateUrl: PARTNER_SAMPLES.airalo.attributedUrl,
            },
            {
              id: "ess_safetywing_jp",
              name: "SafetyWing Travel Insurance",
              affiliatePartner: "safetywing",
              affiliateUrl: PARTNER_SAMPLES.safetywing.attributedUrl,
            },
            {
              id: "ess_ivisa_jp",
              name: "iVisa Japan Entry Check",
              affiliatePartner: "ivisa",
              affiliateUrl: PARTNER_SAMPLES.ivisa.attributedUrl,
            },
            {
              id: "ess_wise_jpy",
              name: "Wise JPY Travel Card",
              affiliatePartner: "wise",
              affiliateUrl: PARTNER_SAMPLES.wise.attributedUrl,
            },
          ],
          tips: ["Pick up Suica card at Narita Terminal 1."],
        },
        {
          date: "2027-04-07",
          title: "Asakusa & Ginza",
          summary: "Historic temples, river cruise, and evening dining.",
          hotel: {
            id: "hotel_booking_tokyo",
            name: "Hoshinoya Tokyo (Booking)",
            affiliatePartner: "booking",
            affiliateUrl: PARTNER_SAMPLES.booking.attributedUrl,
            images: photo("booking-tokyo"),
          },
          morning: {
            activities: [
              {
                id: "activity_v_456P2",
                name: "Senso-ji Morning Rickshaw & Tea",
                affiliatePartner: "viator",
                affiliateUrl: PARTNER_SAMPLES.viator.attributedUrl.replace(
                  "123P1",
                  "456P2",
                ),
                images: photo("viator-sensoji"),
              },
            ],
            meals: [{ id: "meal_tokyo_3", name: "Asakusa Bakery" }],
          },
          afternoon: {
            activities: [
              {
                id: "activity_sky_alt",
                name: "Skyscanner Domestic Hop Check",
                affiliatePartner: "skyscanner",
                affiliateUrl: PARTNER_SAMPLES.skyscanner.attributedUrl,
              },
            ],
            meals: [{ id: "meal_tokyo_4", name: "Ginza Tempura" }],
          },
          evening: {
            activities: [
              {
                id: "activity_idea_1",
                name: "Unbooked evening stroll in Ginza",
                planningIdea: true,
              },
            ],
            meals: [{ id: "meal_tokyo_5", name: "Izakaya Alley" }],
          },
          tips: ["Carry cash for temple incense."],
        },
      ],
    },
  };
}

function buildRealisticLisbonPlan() {
  const photo = (slug: string) => [
    `https://cdn.faroway.example/images/${slug}.jpg`,
  ];
  return {
    trip: { status: "planned" },
    itinerary: {
      days: [
        {
          date: "2027-05-10",
          title: "Lisbon Old Town & Coast",
          summary: "Hostel stay, car rental pickup, and Belem excursion.",
          transport: {
            id: "car_discovercars_lis",
            name: "Lisbon Airport Compact Car",
            affiliatePartner: "discovercars",
            affiliateUrl: PARTNER_SAMPLES.discovercars.attributedUrl,
          },
          hotel: {
            id: "hotel_hostelworld_lis",
            name: "Home Lisbon Hostel",
            affiliatePartner: "hostelworld",
            affiliateUrl: PARTNER_SAMPLES.hostelworld.attributedUrl,
            images: photo("hw-lisbon"),
          },
          morning: {
            activities: [
              {
                id: "activity_tp_lisbon",
                name: "Tagus Sail via Travelpayouts",
                affiliatePartner: "travelpayouts",
                affiliateUrl: PARTNER_SAMPLES.travelpayouts.attributedUrl,
                images: photo("tp-sail"),
              },
            ],
            meals: [{ id: "meal_lis_1", name: "Pasteis de Belem" }],
          },
          afternoon: {
            activities: [
              {
                id: "activity_ta_lisbon",
                name: "Alfama Heritage Tram Experience",
                affiliatePartner: "tripadvisor",
                affiliateUrl: PARTNER_SAMPLES.tripadvisor.attributedUrl,
                images: photo("ta-alfama"),
              },
            ],
            meals: [{ id: "meal_lis_2", name: "Time Out Market" }],
          },
          evening: {
            activities: [
              {
                id: "hotel_expedia_lis",
                name: "Expedia Sintra Day Package",
                affiliatePartner: "expedia",
                affiliateUrl: PARTNER_SAMPLES.expedia.attributedUrl,
                images: photo("exp-sintra"),
              },
            ],
            meals: [{ id: "meal_lis_3", name: "Bairro Alto Seafood" }],
          },
          tips: ["Wear supportive shoes for cobblestones."],
        },
      ],
    },
  };
}

export function evaluateTier4Itineraries(): TierReport {
  const t = new TierTracker();

  const tokyoPlan = buildRealisticTokyoPlan();
  const tokyoSaved = evaluateSavedPlan(tokyoPlan, {
    startDate: "2027-04-06",
    endDate: "2027-04-07",
    requireFullDayMeals: true,
    vendorExpectation: {
      partner: "viator",
      minimumExperiences: 2,
      partnerId: "P123",
    },
  });
  t.check(
    "tokyo:evaluateSavedPlan",
    tokyoSaved.ok,
    tokyoSaved.failures.join("; "),
  );

  const tokyoMulti = evaluateMultiPartnerVendors(tokyoPlan.itinerary.days, [
    { partner: "viator", minimumExperiences: 2, partnerId: "P123" },
    {
      partner: "getyourguide",
      minimumExperiences: 1,
      partnerId: "GYG42",
      requireSubId: true,
    },
    {
      partner: "klook",
      minimumExperiences: 1,
      partnerId: "klk-77",
      requireSubId: true,
    },
    {
      partner: "stay22",
      minimumExperiences: 1,
      partnerId: "faroway-s22",
      requireSubId: true,
    },
    {
      partner: "booking",
      minimumExperiences: 1,
      partnerId: "221100",
      requireSubId: true,
    },
    {
      partner: "duffel",
      minimumExperiences: 1,
      partnerId: "duf-ref-1",
      requireSubId: true,
    },
    {
      partner: "skyscanner",
      minimumExperiences: 1,
      partnerId: "sky-31",
      requireSubId: true,
    },
    {
      partner: "opentable",
      minimumExperiences: 1,
      partnerId: "ot-91",
      requireSubId: true,
    },
    {
      partner: "airalo",
      minimumExperiences: 1,
      partnerId: "faroway-air",
      requireSubId: true,
    },
    {
      partner: "safetywing",
      minimumExperiences: 1,
      partnerId: "26012345",
      requireSubId: true,
    },
    {
      partner: "ivisa",
      minimumExperiences: 1,
      partnerId: "iv-19",
      requireSubId: true,
    },
    {
      partner: "wise",
      minimumExperiences: 1,
      partnerId: "wise-22",
      requireSubId: true,
    },
  ]);
  t.check(
    "tokyo:evaluateMultiPartnerVendors-12-partners",
    tokyoMulti.ok && tokyoMulti.totalCount === 13,
    tokyoMulti.failures.join("; "),
  );

  const lisbonPlan = buildRealisticLisbonPlan();
  const lisbonSaved = evaluateSavedPlan(lisbonPlan, {
    startDate: "2027-05-10",
    endDate: "2027-05-10",
    requireFullDayMeals: true,
  });
  t.check(
    "lisbon:evaluateSavedPlan",
    lisbonSaved.ok,
    lisbonSaved.failures.join("; "),
  );

  const lisbonMulti = evaluateMultiPartnerVendors(lisbonPlan.itinerary.days, [
    {
      partner: "travelpayouts",
      minimumExperiences: 1,
      partnerId: "394812",
      requireSubId: true,
      requirePhoto: true,
    },
    {
      partner: "discovercars",
      minimumExperiences: 1,
      partnerId: "dc-88",
      requireSubId: true,
    },
    {
      partner: "hostelworld",
      minimumExperiences: 1,
      partnerId: "hw-55",
      requireSubId: true,
    },
    {
      partner: "tripadvisor",
      minimumExperiences: 1,
      partnerId: "ta-654",
      requireSubId: true,
    },
    {
      partner: "expedia",
      minimumExperiences: 1,
      partnerId: "exp-110",
      requireSubId: true,
    },
  ]);
  t.check(
    "lisbon:evaluateMultiPartnerVendors-remaining-5-partners",
    lisbonMulti.ok && lisbonMulti.totalCount === 5,
    lisbonMulti.failures.join("; "),
  );

  // Verify duplicate partner expectations in evaluateMultiPartnerVendors do not double-count
  const dupMulti = evaluateMultiPartnerVendors(tokyoPlan.itinerary.days, [
    {
      partner: "stay22",
      minimumExperiences: 1,
      partnerId: "faroway-s22",
      requireSubId: true,
    },
    {
      partner: "stay22",
      minimumExperiences: 1,
      partnerId: "faroway-s22",
      requireSubId: true,
    },
  ]);
  t.check(
    "tokyo:multi-partner-duplicate-expectation-no-double-count",
    dupMulti.ok &&
      dupMulti.totalCount === 1 &&
      dupMulti.byPartner.stay22?.count === 1,
  );

  // Verify meal.reservationUrl and non-Viator activity URL partner fallback are extracted
  const fallbackDay = [
    {
      morning: {
        activities: [
          {
            id: "activity_gyg_777",
            name: "Inferred GYG Activity",
            affiliateUrl: PARTNER_SAMPLES.getyourguide.attributedUrl,
            images: ["https://cdn.faroway.example/gyg.jpg"],
          },
        ],
      },
      evening: {
        meals: [
          {
            id: "rest_opentable_resurl",
            name: "Reservation URL Diner",
            reservationUrl: PARTNER_SAMPLES.opentable.attributedUrl,
          },
        ],
      },
    },
  ];
  const fallbackEval = evaluateMultiPartnerVendors(fallbackDay, [
    {
      partner: "getyourguide",
      minimumExperiences: 1,
      partnerId: "GYG42",
      requireSubId: true,
    },
    {
      partner: "opentable",
      minimumExperiences: 1,
      partnerId: "ot-91",
      requireSubId: true,
    },
  ]);
  t.check(
    "extraction:activity-url-fallback-and-meal-reservationUrl",
    fallbackEval.ok && fallbackEval.totalCount === 2,
    fallbackEval.failures.join("; "),
  );

  // Verify activitiesOnly: true skips hotels/transport/essentials while default scans them
  const stay22ActivitiesOnly = evaluateVendorExperiences(
    tokyoPlan.itinerary.days,
    {
      partner: "stay22",
      minimumExperiences: 1,
      activitiesOnly: true,
    },
  );
  t.control(
    "control:activitiesOnly-excludes-hotel",
    stay22ActivitiesOnly.count === 0,
  );

  // Negative control fixtures (planted quality/security defects)
  t.control(
    "control:viator-missing-photo",
    evaluateVendorExperiences(
      [
        {
          morning: {
            activities: [
              {
                id: "activity_v_123P1",
                name: "No Photo Tour",
                affiliatePartner: "viator",
                affiliateUrl: PARTNER_SAMPLES.viator.baseUrl,
                images: [],
              },
            ],
          },
        },
      ],
      { partner: "viator", minimumExperiences: 1, partnerId: "P123" },
    ).failures.length > 0,
  );

  t.control(
    "control:viator-overlong-campaign-when-requireSubId",
    evaluateVendorExperiences(
      [
        {
          morning: {
            activities: [
              {
                id: "activity_v_123P1",
                name: "Overlong Campaign Tour",
                affiliatePartner: "viator",
                affiliateUrl: `${PARTNER_SAMPLES.viator.baseUrl}&campaign=${"c".repeat(101)}`,
                images: ["https://cdn.faroway.example/1.jpg"],
              },
            ],
          },
        },
      ],
      {
        partner: "viator",
        minimumExperiences: 1,
        partnerId: "P123",
        requireSubId: true,
      },
    ).failures.length > 0,
  );

  t.control(
    "control:stay22-missing-photo",
    evaluateVendorExperiences(
      [
        {
          hotel: {
            id: "hotel_s22_no_photo",
            name: "No Photo Hotel",
            affiliatePartner: "stay22",
            affiliateUrl: PARTNER_SAMPLES.stay22.attributedUrl,
            images: [],
          },
        },
      ],
      { partner: "stay22", minimumExperiences: 1 },
    ).failures.some((f) => f.includes("no supplied HTTPS photo")),
  );

  t.control(
    "control:planningIdea-disguised-as-bookable",
    evaluateVendorExperiences(
      [
        {
          morning: {
            activities: [
              {
                id: "activity_gyg_98765",
                name: "Unbooked Idea",
                planningIdea: true,
                affiliatePartner: "getyourguide",
                affiliateUrl: PARTNER_SAMPLES.getyourguide.attributedUrl,
                images: ["https://cdn.faroway.example/a.jpg"],
              },
            ],
          },
        },
      ],
      { partner: "getyourguide", minimumExperiences: 1 },
    ).count === 0,
  );

  t.control(
    "control:viator-duplicate-path-with-different-campaign",
    evaluateVendorExperiences(
      [
        {
          morning: {
            activities: [
              {
                id: "activity_v_123P1",
                name: "Tour 1",
                affiliatePartner: "viator",
                affiliateUrl: PARTNER_SAMPLES.viator.baseUrl,
                images: ["https://cdn.faroway.example/1.jpg"],
              },
              {
                id: "activity_v_999P9",
                name: "Tour 1 Duplicate",
                affiliatePartner: "viator",
                affiliateUrl: `${PARTNER_SAMPLES.viator.baseUrl}&campaign=other`,
                images: ["https://cdn.faroway.example/2.jpg"],
              },
            ],
          },
        },
      ],
      { partner: "viator", minimumExperiences: 2, partnerId: "P123" },
    ).count === 1,
  );

  t.control(
    "control:opentable-lookalike-rejected",
    evaluateVendorExperiences(
      [
        {
          evening: {
            meals: [
              {
                id: "rest_evil",
                name: "Evil Table",
                affiliatePartner: "opentable",
                reservationInfo: {
                  url: "https://opentable.com.evil.test/r/narisawa-tokyo?sub_id=c1",
                },
              },
            ],
          },
        },
      ],
      { partner: "opentable", minimumExperiences: 1 },
    ).failures.length > 0,
  );

  t.control(
    "control:booking-lookalike-rejected",
    evaluateVendorExperiences(
      [
        {
          hotel: {
            id: "hotel_evil",
            name: "Phish Hotel",
            affiliatePartner: "booking",
            affiliateUrl:
              "https://booking.com.phisher.invalid/hotel/jp/tokyo.html?aid=221100",
            images: ["https://cdn.faroway.example/h.jpg"],
          },
        },
      ],
      { partner: "booking", minimumExperiences: 1 },
    ).failures.length > 0,
  );

  t.control(
    "control:duffel-http-rejected",
    evaluateVendorExperiences(
      [
        {
          transport: {
            id: "flight_http",
            name: "Insecure Flight",
            affiliatePartner: "duffel",
            affiliateUrl: "http://links.duffel.com/flights/sfo-nrt?click_id=c1",
          },
        },
      ],
      { partner: "duffel", minimumExperiences: 1 },
    ).failures.length > 0,
  );

  t.control(
    "control:gyg-missing-partner-id",
    evaluateVendorExperiences(
      [
        {
          morning: {
            activities: [
              {
                id: "activity_gyg_12345",
                name: "Missing Partner ID",
                affiliatePartner: "getyourguide",
                affiliateUrl: "https://www.getyourguide.com/activity-t12345/",
                images: ["https://cdn.faroway.example/g.jpg"],
              },
            ],
          },
        },
      ],
      { partner: "getyourguide", minimumExperiences: 1 },
    ).failures.length > 0,
  );

  // Cross-platform @faroway/constants & @faroway/validation parity
  t.check(
    "parity:vibe-culture-canonical",
    CANONICAL_TRAVEL_VIBE_IDS.includes("culture") &&
      !CANONICAL_TRAVEL_VIBE_IDS.includes("cultural" as never) &&
      travelVibes.some((v) => v.id === "culture") &&
      normalizeVibeId("cultural") === "culture" &&
      normalizedTravelVibeSchema.parse("cultural") === "culture" &&
      JSON.stringify(
        normalizeVibeList(["cultural", "foodie", "culture", "unknown"]),
      ) === JSON.stringify(["culture", "foodie"]),
  );

  t.check(
    "parity:budget-moderate-canonical",
    BUDGET_TIERS.map((tier) => tier.label).join(",") ===
      "Budget,Moderate,Luxury" &&
      BUDGET_LABELS.moderate === "Moderate" &&
      normalizeBudgetTier("Comfort") === "moderate" &&
      formatBudgetLabel("Comfort") === "Moderate" &&
      budgetTierInputSchema.parse("Comfort") === "moderate",
  );

  t.check(
    "parity:ftc-disclosure",
    AFFILIATE_DISCLOSURE_SHORT.toLowerCase().includes("commission") &&
      AFFILIATE_DISCLOSURE_SHORT.toLowerCase().includes("no extra cost") &&
      AFFILIATE_DISCLOSURE_FULL.toLowerCase().includes("commission"),
  );

  return t.toReport();
}

export function runMonetizationEval(): MonetizationEvalReport {
  const tier1 = evaluateTier1Security();
  const tier2 = evaluateTier2Attribution();
  const tier3 = evaluateTier3Payloads();
  const tier4 = evaluateTier4Itineraries();

  const tiers = [tier1, tier2, tier3, tier4];
  const missed_controls = tiers.flatMap((tier) => tier.missedControls);
  const failures = tiers.flatMap((tier) => tier.failures);
  const total_checks = tiers.reduce((sum, tier) => sum + tier.checks, 0);
  const total_controls = tiers.reduce(
    (sum, tier) => sum + tier.controlsTotal,
    0,
  );
  const total_controls_caught = tiers.reduce(
    (sum, tier) => sum + tier.controlsCaught,
    0,
  );

  return {
    mode: "offline-monetization-eval",
    live_network_called: false,
    accepted:
      tiers.every((tier) => tier.passed) &&
      missed_controls.length === 0 &&
      failures.length === 0,
    total_checks,
    total_controls,
    total_controls_caught,
    missed_controls,
    failures,
    tier1_security: tier1,
    tier2_attribution: tier2,
    tier3_payloads: tier3,
    tier4_itineraries: tier4,
  };
}

if (import.meta.main) {
  const report = runMonetizationEval();
  console.log(JSON.stringify(report, null, 2));
  if (!report.accepted) process.exit(1);
}
