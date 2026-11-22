import { describe, expect, test } from "bun:test";
import {
  AFFILIATE_PARTNER_IDS,
  injectAffiliateSubId,
  isAllowedAffiliateUrl,
  normalizeAffiliatePartner,
  resolveAffiliatePartnerByUrl,
  type AffiliatePartnerId,
} from "../../packages/constants/src/affiliates";
import {
  conversionWebhookSchema,
  trackClickSchema,
} from "../../packages/validation/src/index";
import {
  affiliateClickInsert,
  affiliateClickLedgerFailures,
} from "../../apps/web/lib/affiliates/click-record";
import { runMonetizationEval } from "../uat/eval-monetization";
import {
  evaluateMultiPartnerVendors,
  evaluateVendorExperiences,
  validatePartnerHandoffUrl,
} from "../uat/lib/vendor-quality";

interface PartnerTestCase {
  partner: AffiliatePartnerId;
  partnerId: string;
  url: string;
  slot: "activity" | "hotel" | "transport" | "meal" | "essential";
  requirePhoto: boolean;
}

const PARTNER_MATRIX: readonly PartnerTestCase[] = [
  {
    partner: "getyourguide",
    partnerId: "GYG42",
    url: "https://www.getyourguide.com/activity-t98765/?partner_id=GYG42&cmp=clk-gyg",
    slot: "activity",
    requirePhoto: true,
  },
  {
    partner: "stay22",
    partnerId: "s22-1",
    url: "https://www.stay22.com/embed/gm?aid=s22-1&address=Tokyo&campaign=clk-s22",
    slot: "hotel",
    requirePhoto: true,
  },
  {
    partner: "booking",
    partnerId: "221100",
    url: "https://www.booking.com/hotel/jp/park-hyatt.html?aid=221100&label=clk-bk",
    slot: "hotel",
    requirePhoto: true,
  },
  {
    partner: "duffel",
    partnerId: "duf-1",
    url: "https://links.duffel.com/flights/sfo-nrt?reference=duf-1&click_id=clk-duf",
    slot: "transport",
    requirePhoto: false,
  },
  {
    partner: "airalo",
    partnerId: "air-1",
    url: "https://www.airalo.com/japan-esim?ref=air-1&sub_id=clk-air",
    slot: "essential",
    requirePhoto: false,
  },
  {
    partner: "safetywing",
    partnerId: "sw-1",
    url: "https://safetywing.com/nomad-insurance?referenceID=sw-1&click_id=clk-sw",
    slot: "essential",
    requirePhoto: false,
  },
  {
    partner: "discovercars",
    partnerId: "dc-1",
    url: "https://www.discovercars.com/portugal/lisbon?a_aid=dc-1&sub_id=clk-dc",
    slot: "transport",
    requirePhoto: false,
  },
  {
    partner: "klook",
    partnerId: "klk-1",
    url: "https://www.klook.com/activity/1234-tokyo/?aid=klk-1&sub_id=clk-klk",
    slot: "activity",
    requirePhoto: true,
  },
  {
    partner: "hostelworld",
    partnerId: "hw-1",
    url: "https://www.hostelworld.com/pwa/hosteldetails.php/Home/Lisbon/123?source=hw-1&sub_id=clk-hw",
    slot: "hotel",
    requirePhoto: true,
  },
  {
    partner: "opentable",
    partnerId: "ot-1",
    url: "https://www.opentable.com/r/narisawa-tokyo?rid=ot-1&sub_id=clk-ot",
    slot: "meal",
    requirePhoto: false,
  },
  {
    partner: "skyscanner",
    partnerId: "sky-1",
    url: "https://www.skyscanner.com/transport/flights/sfo/tyoa/?associateid=sky-1&sub_id=clk-sky",
    slot: "transport",
    requirePhoto: false,
  },
  {
    partner: "ivisa",
    partnerId: "iv-1",
    url: "https://www.ivisa.com/japan-visa?affid=iv-1&sub_id=clk-iv",
    slot: "essential",
    requirePhoto: false,
  },
  {
    partner: "wise",
    partnerId: "wise-1",
    url: "https://wise.com/gb/currency-converter/usd-to-jpy-rate?irclickid=wise-1&sub_id=clk-wise",
    slot: "essential",
    requirePhoto: false,
  },
  {
    partner: "travelpayouts",
    partnerId: "tp-1",
    url: "https://tp.media/r?marker=tp-1&u=https%3A%2F%2Fwww.klook.com%2Factivity%2F1234-tokyo%2F&sub_id=clk-tp",
    slot: "activity",
    requirePhoto: false,
  },
  {
    partner: "expedia",
    partnerId: "exp-1",
    url: "https://www.expedia.com/Tokyo-Hotels.h1.Hotel-Information?affcid=exp-1&click_id=clk-exp",
    slot: "hotel",
    requirePhoto: true,
  },
  {
    partner: "tripadvisor",
    partnerId: "ta-1",
    url: "https://www.tripadvisor.com/Attraction_Review-g298184-d1.html?m=ta-1&sub_id=clk-ta",
    slot: "activity",
    requirePhoto: true,
  },
];

function buildSinglePartnerDay(tc: PartnerTestCase): Record<string, unknown> {
  const item: Record<string, unknown> = {
    id:
      tc.partner === "getyourguide"
        ? "activity_gyg_98765"
        : `item_${tc.partner}_1`,
    name: `${tc.partner} verified offering`,
    affiliatePartner: tc.partner,
    affiliateUrl: tc.url,
    ...(tc.requirePhoto
      ? { images: ["https://cdn.faroway.example/photo.jpg"] }
      : {}),
  };

  if (tc.slot === "activity") {
    return { morning: { activities: [item] } };
  }
  if (tc.slot === "hotel") {
    return { hotel: item };
  }
  if (tc.slot === "transport") {
    return { transport: item };
  }
  if (tc.slot === "meal") {
    return {
      evening: {
        meals: [
          {
            id: item.id,
            name: item.name,
            affiliatePartner: tc.partner,
            reservationInfo: { url: tc.url },
          },
        ],
      },
    };
  }
  return { essentials: [item] };
}

describe("offline 4-tier monetization eval", () => {
  test("passes all 4 tiers with zero network calls and zero missed controls", () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (() => {
      throw new Error("offline eval must never call fetch");
    }) as typeof fetch;

    try {
      const report = runMonetizationEval();
      expect(report.live_network_called).toBe(false);
      expect(report.missed_controls).toEqual([]);
      expect(report.failures).toEqual([]);
      expect(report.tier1_security.passed).toBe(true);
      expect(report.tier2_attribution.passed).toBe(true);
      expect(report.tier3_payloads.passed).toBe(true);
      expect(report.tier4_itineraries.passed).toBe(true);
      expect(report.total_checks).toBeGreaterThanOrEqual(100);
      expect(report.total_controls).toBeGreaterThanOrEqual(40);
      expect(report.accepted).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe("vendor-quality multi-partner evaluation", () => {
  test.each(PARTNER_MATRIX)(
    "evaluates $partner across its primary itinerary slot",
    (tc) => {
      const day = buildSinglePartnerDay(tc);
      const res = evaluateVendorExperiences([day], {
        partner: tc.partner,
        minimumExperiences: 1,
        partnerId: tc.partnerId,
        requireSubId: true,
        requirePhoto: tc.requirePhoto,
      });
      expect(res.failures).toEqual([]);
      expect(res.count).toBe(1);
    },
  );

  test("preserves exact Viator error strings and activitiesOnly default", () => {
    const missingId = evaluateVendorExperiences(
      [
        {
          morning: {
            activities: [
              {
                id: "bad_id",
                name: "Tour",
                affiliatePartner: "viator",
                affiliateUrl:
                  "https://www.viator.com/tours/Tokyo/Food/d334-123P1?pid=P123&mcid=42383&medium=api",
                images: ["https://cdn.faroway.example/1.jpg"],
              },
            ],
          },
        },
      ],
      { partner: "viator", minimumExperiences: 1, partnerId: "P123" },
    );
    expect(missingId.failures).toContain(
      "Viator experience is missing its supplier product ID",
    );

    const missingPhoto = evaluateVendorExperiences(
      [
        {
          morning: {
            activities: [
              {
                id: "activity_v_123P1",
                name: "Tour",
                affiliatePartner: "viator",
                affiliateUrl:
                  "https://www.viator.com/tours/Tokyo/Food/d334-123P1?pid=P123&mcid=42383&medium=api",
                images: [],
              },
            ],
          },
        },
      ],
      { partner: "viator", minimumExperiences: 1, partnerId: "P123" },
    );
    expect(missingPhoto.failures).toContain(
      "activity_v_123P1 has no supplied HTTPS photo",
    );

    const hotelIgnoredForViator = evaluateVendorExperiences(
      [
        {
          hotel: {
            id: "activity_v_999P1",
            name: "Viator in hotel slot",
            affiliatePartner: "viator",
            affiliateUrl:
              "https://www.viator.com/tours/Tokyo/Food/d334-999P1?pid=P123&mcid=42383&medium=api",
            images: ["https://cdn.faroway.example/1.jpg"],
          },
        },
      ],
      { partner: "viator", minimumExperiences: 1, partnerId: "P123" },
    );
    expect(hotelIgnoredForViator.count).toBe(0);
  });

  test("evaluateMultiPartnerVendors aggregates mixed partners and catches partial failures", () => {
    const day = {
      hotel: {
        id: "hotel_s22_1",
        name: "Stay22 Hotel",
        affiliatePartner: "stay22",
        affiliateUrl:
          "https://www.stay22.com/embed/gm?aid=s22-1&address=Tokyo&campaign=c1",
        images: ["https://cdn.faroway.example/s22.jpg"],
      },
      transport: {
        id: "flight_duf_1",
        name: "Duffel Flight",
        affiliatePartner: "duffel",
        affiliateUrl:
          "https://links.duffel.com/flights/sfo-nrt?reference=duf-1&click_id=c2",
      },
      essentials: [
        {
          id: "esim_air_1",
          name: "Airalo Japan",
          affiliatePartner: "airalo",
          affiliateUrl: "https://www.airalo.com/japan-esim?ref=air-1&sub_id=c3",
        },
      ],
    };

    const passing = evaluateMultiPartnerVendors(
      [day],
      [
        {
          partner: "stay22",
          minimumExperiences: 1,
          partnerId: "s22-1",
          requireSubId: true,
        },
        {
          partner: "duffel",
          minimumExperiences: 1,
          partnerId: "duf-1",
          requireSubId: true,
        },
        {
          partner: "airalo",
          minimumExperiences: 1,
          partnerId: "air-1",
          requireSubId: true,
        },
      ],
    );
    expect(passing.ok).toBe(true);
    expect(passing.totalCount).toBe(3);

    const partialFail = evaluateMultiPartnerVendors(
      [day],
      [
        { partner: "stay22", minimumExperiences: 1, partnerId: "s22-1" },
        { partner: "booking", minimumExperiences: 1, partnerId: "221100" },
      ],
    );
    expect(partialFail.ok).toBe(false);
    expect(partialFail.byPartner.stay22.count).toBe(1);
    expect(partialFail.byPartner.booking.count).toBe(0);

    const emptyExpectations = evaluateMultiPartnerVendors([day], []);
    expect(emptyExpectations.ok).toBe(false);

    const dupExpectations = evaluateMultiPartnerVendors(
      [day],
      [
        {
          partner: "stay22",
          minimumExperiences: 1,
          partnerId: "s22-1",
          requireSubId: true,
        },
        {
          partner: "stay22",
          minimumExperiences: 1,
          partnerId: "s22-1",
          requireSubId: true,
        },
      ],
    );
    expect(dupExpectations.ok).toBe(true);
    expect(dupExpectations.byPartner.stay22.count).toBe(1);
    expect(dupExpectations.totalCount).toBe(1);
  });

  test("extracts meal.reservationUrl and non-Viator activity URL fallback without weakening Viator activitiesOnly", () => {
    const day = {
      morning: {
        activities: [
          {
            id: "activity_gyg_555",
            name: "Inferred GYG Activity",
            affiliateUrl:
              "https://www.getyourguide.com/activity-t555/?partner_id=GYG42&cmp=c1",
            images: ["https://cdn.faroway.example/gyg.jpg"],
          },
          {
            id: "activity_v_123P1",
            name: "Unlabeled Viator Activity",
            affiliateUrl:
              "https://www.viator.com/tours/Tokyo/Food/d334-123P1?pid=P123&mcid=42383&medium=api&campaign=c1",
            images: ["https://cdn.faroway.example/v.jpg"],
          },
        ],
      },
      evening: {
        meals: [
          {
            id: "rest_ot_resurl",
            name: "Reservation URL Diner",
            reservationUrl:
              "https://www.opentable.com/r/narisawa-tokyo?rid=ot-1&sub_id=clk-ot",
          },
        ],
      },
    };

    const gygAndOt = evaluateMultiPartnerVendors(
      [day],
      [
        {
          partner: "getyourguide",
          minimumExperiences: 1,
          partnerId: "GYG42",
          requireSubId: true,
        },
        {
          partner: "opentable",
          minimumExperiences: 1,
          partnerId: "ot-1",
          requireSubId: true,
        },
      ],
    );
    expect(gygAndOt.ok).toBe(true);
    expect(gygAndOt.totalCount).toBe(2);

    const viatorStrict = evaluateVendorExperiences([day], {
      partner: "viator",
      minimumExperiences: 1,
      partnerId: "P123",
    });
    expect(viatorStrict.count).toBe(0);
  });
});

describe("security, prototype-pollution & deduplication boundaries", () => {
  test("rejects prototype-pollution keys and malformed URLs", () => {
    for (const key of [
      "constructor",
      "__proto__",
      "toString",
      "valueOf",
      "hasOwnProperty",
      "",
    ]) {
      expect(normalizeAffiliatePartner(key)).toBeUndefined();
      expect(
        validatePartnerHandoffUrl(
          key as AffiliatePartnerId,
          "https://tp.media/r?marker=394812&u=https%3A%2F%2Fsafetywing.com&sub_id=clk1",
          { allowTravelpayoutsWrapper: true },
        ),
      ).toEqual({ ok: false, reason: "Invalid vendor partner" });

      const multiProto = evaluateMultiPartnerVendors(
        [],
        [{ partner: key as AffiliatePartnerId, minimumExperiences: 1 }],
      );
      expect(multiProto.ok).toBe(false);
      expect(multiProto.totalCount).toBe(0);
      expect(multiProto.byPartner[key]?.count).toBe(0);
    }

    for (const badUrl of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "http://www.viator.com/tours/Paris/d479-1",
      "https://user:pass@www.viator.com/tours/Paris/d479-1",
      "https://www.booking.com:8443/hotel/fr/ritzy.html",
      "https://viator.com.evil.test/tours/Paris/d479-1",
      "https://evilgetyourguide.com/activity-t123/",
      "https://stay22.evil.com/embed/gm?aid=1",
    ]) {
      expect(isAllowedAffiliateUrl(badUrl)).toBe(false);
      expect(resolveAffiliatePartnerByUrl(badUrl)).toBeUndefined();
      expect(injectAffiliateSubId(badUrl, "viator", "clk-1")).toBe(null);
      expect(validatePartnerHandoffUrl("viator", badUrl).ok).toBe(false);
    }
  });

  test("hardens Travelpayouts wrapper against root paths, malicious u targets, and cross-partner mismatches", () => {
    expect(
      validatePartnerHandoffUrl(
        "travelpayouts",
        "https://www.travelpayouts.com/?marker=394812&sub_id=clk1",
        { requireSubId: true },
      ).ok,
    ).toBe(false);

    for (const badWrappedUrl of [
      "https://tp.media/r?marker=394812&u=javascript%3Aalert(1)&sub_id=clk1",
      "https://tp.media/r?marker=394812&u=https%3A%2F%2Fevil.com%2Fphish&sub_id=clk1",
      "https://tp.media/r?marker=394812&u=https%3A%2F%2Fwww.booking.com%2Fhotel%2Fjp%2Fa.html&sub_id=clk1",
      "https://tp.media/r?marker=394812&u=https%3A%2F%2Fsafetywing.com.%2Fnomad&sub_id=clk1",
      "https://tp.media/r?marker=394812&sub_id=clk1",
    ]) {
      expect(
        validatePartnerHandoffUrl("safetywing", badWrappedUrl, {
          allowTravelpayoutsWrapper: true,
          requireSubId: true,
        }).ok,
      ).toBe(false);
    }

    for (const nestedTpUrl of [
      `https://tp.media/r?marker=394812&sub_id=clk1&u=${encodeURIComponent("https://tp.media/r?marker=999&u=javascript:alert(1)")}`,
      `https://tp.media/r?marker=394812&sub_id=clk1&u=${encodeURIComponent("https://www.travelpayouts.com/?marker=999")}`,
      "https://tp.media/r?marker=394812&u=https%3A%2F%2Ftp.media%2Fr%3Fu%3Dhttps%253A%252F%252Fevil.com&sub_id=clk1",
    ]) {
      expect(
        validatePartnerHandoffUrl("travelpayouts", nestedTpUrl, {
          partnerId: "394812",
          requireSubId: true,
        }),
      ).toEqual({
        ok: false,
        reason:
          "Travelpayouts target u URL must not wrap another Travelpayouts redirect",
      });
    }

    expect(
      validatePartnerHandoffUrl(
        "safetywing",
        "https://tp.media/r?marker=394812&u=https%3A%2F%2Fsafetywing.com%2Fnomad-insurance&sub_id=clk1",
        {
          partnerId: "394812",
          allowTravelpayoutsWrapper: true,
          requireSubId: true,
        },
      ).ok,
    ).toBe(true);
  });

  test("rejects HPP duplicate attribution parameters and overlong Viator campaigns", () => {
    expect(
      validatePartnerHandoffUrl(
        "getyourguide",
        "https://www.getyourguide.com/activity-t123/?partner_id=GYG42&partner_id=EVIL&cmp=c1",
        { partnerId: "GYG42", requireSubId: true },
      ).ok,
    ).toBe(false);

    const overlongViatorUrl = `https://www.viator.com/tours/Tokyo/Food/d334-123P1?pid=P123&mcid=42383&medium=api&campaign=${"c".repeat(101)}`;
    expect(
      validatePartnerHandoffUrl("viator", overlongViatorUrl, {
        partnerId: "P123",
        requireSubId: true,
      }).ok,
    ).toBe(false);
    expect(
      evaluateVendorExperiences(
        [
          {
            morning: {
              activities: [
                {
                  id: "activity_v_123P1",
                  name: "Overlong Campaign Tour",
                  affiliatePartner: "viator",
                  affiliateUrl: overlongViatorUrl,
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
      ).failures.length,
    ).toBeGreaterThan(0);
  });

  test("deduplicates Stay22 /embed/gm across www vs apex and preserves city/q and GYG /s/?q= params", () => {
    const day = {
      hotel: [
        {
          id: "s22_tokyo_1",
          name: "Stay22 Tokyo A",
          affiliatePartner: "stay22",
          affiliateUrl:
            "https://www.stay22.com/embed/gm?aid=s22-1&address=Tokyo&campaign=c1",
          images: ["https://cdn.faroway.example/1.jpg"],
        },
        {
          id: "s22_tokyo_2",
          name: "Stay22 Tokyo Duplicate Apex",
          affiliatePartner: "stay22",
          affiliateUrl:
            "https://stay22.com/embed/gm?aid=s22-1&address=Tokyo&campaign=c2",
          images: ["https://cdn.faroway.example/2.jpg"],
        },
        {
          id: "s22_kyoto_1",
          name: "Stay22 Kyoto",
          affiliatePartner: "stay22",
          affiliateUrl:
            "https://www.stay22.com/embed/gm?aid=s22-1&address=Kyoto&campaign=c3",
          images: ["https://cdn.faroway.example/3.jpg"],
        },
        {
          id: "s22_osaka_city",
          name: "Stay22 Osaka City",
          affiliatePartner: "stay22",
          affiliateUrl:
            "https://www.stay22.com/embed/gm?aid=s22-1&city=Osaka&campaign=c4",
          images: ["https://cdn.faroway.example/4.jpg"],
        },
        {
          id: "s22_nara_q",
          name: "Stay22 Nara Query",
          affiliatePartner: "stay22",
          affiliateUrl:
            "https://www.stay22.com/embed/gm?aid=s22-1&q=Nara&campaign=c5",
          images: ["https://cdn.faroway.example/5.jpg"],
        },
      ],
    };

    const res = evaluateVendorExperiences([day], {
      partner: "stay22",
      minimumExperiences: 4,
      partnerId: "s22-1",
      requireSubId: true,
    });
    expect(res.failures).toEqual([]);
    expect(res.count).toBe(4);

    const gygTokyo = validatePartnerHandoffUrl(
      "getyourguide",
      "https://www.getyourguide.com/s/?q=Tokyo&partner_id=GYG42&cmp=c1",
      { partnerId: "GYG42", requireSubId: true },
    );
    const gygKyoto = validatePartnerHandoffUrl(
      "getyourguide",
      "https://www.getyourguide.com/s/?q=Kyoto&partner_id=GYG42&cmp=c2",
      { partnerId: "GYG42", requireSubId: true },
    );
    expect(gygTokyo.ok && gygKyoto.ok).toBe(true);
    if (gygTokyo.ok && gygKyoto.ok) {
      expect(gygTokyo.dedupeKey).not.toBe(gygKyoto.dedupeKey);
    }
  });

  test("covers all 17 canonical affiliate partner IDs", () => {
    expect(AFFILIATE_PARTNER_IDS).toHaveLength(17);
    expect(PARTNER_MATRIX).toHaveLength(16);
  });
});

describe("validation schemas & click ledger contracts", () => {
  test("validates conversionWebhookSchema boundary cases", () => {
    const valid = conversionWebhookSchema.safeParse({
      partner: "safetywing",
      clickId: "clk-123",
      externalTransactionId: "txn-456",
      status: "confirmed",
      bookingAmount: 85.5,
      commissionAmount: 8.55,
      currency: "USD",
      occurredAt: "2026-11-21T07:22:25Z",
    });
    expect(valid.success).toBe(true);

    for (const invalid of [
      { bookingAmount: Infinity },
      { commissionAmount: -0.01 },
      { currency: "usd" },
      { currency: "US" },
      { occurredAt: "2026-02-30" },
      { occurredAt: "2027-02-29" },
      { partner: "retired-partner" },
    ]) {
      const parsed = conversionWebhookSchema.safeParse({
        partner: "viator",
        clickId: "clk-123",
        externalTransactionId: "txn-456",
        ...invalid,
      });
      expect(parsed.success).toBe(false);
    }
  });

  test("validates trackClickSchema and affiliateClickLedgerFailures", () => {
    const parsed = trackClickSchema.safeParse({
      itemType: "hotel",
      itemId: "hotel-1",
      itemName: "Park Hyatt Tokyo",
      affiliatePartner: "stay22",
      affiliateUrl: "https://www.stay22.com/embed/gm?aid=s22-1&address=Tokyo",
      source: "shared_trip",
      clickId: "clk-shared-1",
    });
    expect(parsed.success).toBe(true);

    const row = affiliateClickInsert({
      clickId: "clk-shared-1",
      userId: null,
      itemType: "hotel",
      itemId: "hotel-1",
      itemName: "Park Hyatt Tokyo",
      affiliatePartner: "stay22",
      affiliateUrl:
        "https://www.stay22.com/embed/gm?aid=s22-1&address=Tokyo&campaign=clk-shared-1",
      source: "shared_trip",
      clickedAt: "2026-11-21T07:22:25Z",
    });
    expect(affiliateClickLedgerFailures(row)).toEqual([]);
    expect(
      affiliateClickLedgerFailures({
        ...row,
        affiliate_url: "http://evil.test",
      }),
    ).toContain("affiliate_url");
  });
});
