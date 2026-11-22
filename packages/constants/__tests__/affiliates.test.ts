import { describe, it, expect } from "vitest";
import {
  AFFILIATE_DISCLOSURE_SHORT,
  AFFILIATE_DISCLOSURE_FULL,
  AFFILIATE_PARTNER_IDS,
  AFFILIATE_PARTNERS,
  ALLOWED_AFFILIATE_DOMAINS,
  normalizeAffiliatePartner,
  formatAffiliatePartnerName,
  itemTypeForAffiliatePartner,
  isAllowedAffiliateUrl,
  resolveAffiliatePartnerByUrl,
  injectAffiliateSubId,
} from "../src/index";

describe("affiliate partner registry", () => {
  it("defines all 17 canonical partners with valid metadata and allowlisted hosts", () => {
    expect(AFFILIATE_PARTNER_IDS).toHaveLength(17);
    expect(new Set(AFFILIATE_PARTNER_IDS).size).toBe(17);

    for (const id of AFFILIATE_PARTNER_IDS) {
      const meta = AFFILIATE_PARTNERS[id];
      expect(meta).toBeDefined();
      expect(meta.id).toBe(id);
      expect(meta.name.length).toBeGreaterThan(0);
      expect(meta.allowedHosts.length).toBeGreaterThan(0);
      expect(meta.subIdParam.length).toBeGreaterThan(0);
      expect([
        "hotel",
        "activity",
        "restaurant",
        "flight",
        "transport",
      ]).toContain(meta.defaultItemType);
      for (const host of meta.allowedHosts) {
        expect(ALLOWED_AFFILIATE_DOMAINS).toContain(host);
      }
    }
  });

  it("exports concise and full FTC affiliate disclosure strings", () => {
    expect(AFFILIATE_DISCLOSURE_SHORT).toContain("commission");
    expect(AFFILIATE_DISCLOSURE_FULL).toContain("commission");
  });

  it("normalizes partner names, formats labels, and maps default item types", () => {
    expect(normalizeAffiliatePartner("Booking.com")).toBe("booking");
    expect(normalizeAffiliatePartner("GetYourGuide")).toBe("getyourguide");
    expect(normalizeAffiliatePartner("GYG")).toBe("getyourguide");
    expect(normalizeAffiliatePartner("DiscoverCars")).toBe("discovercars");
    expect(normalizeAffiliatePartner("unknown-partner")).toBeUndefined();

    expect(formatAffiliatePartnerName("booking")).toBe("Booking.com");
    expect(formatAffiliatePartnerName("viator")).toBe("Viator");
    expect(formatAffiliatePartnerName("opentable")).toBe("OpenTable");
    expect(formatAffiliatePartnerName("tripadvisor")).toBe("Tripadvisor");
    expect(formatAffiliatePartnerName("custom")).toBe("custom");

    expect(itemTypeForAffiliatePartner("duffel")).toBe("transport");
    expect(itemTypeForAffiliatePartner("discovercars")).toBe("transport");
    expect(itemTypeForAffiliatePartner("opentable")).toBe("restaurant");
    expect(itemTypeForAffiliatePartner("stay22")).toBe("hotel");
    expect(itemTypeForAffiliatePartner("skyscanner")).toBe("flight");
    expect(itemTypeForAffiliatePartner("safetywing")).toBe("activity");
  });

  it("guards against prototype-property partner lookups without throwing", () => {
    for (const protoKey of [
      "constructor",
      "__proto__",
      "toString",
      "valueOf",
      "hasOwnProperty",
    ]) {
      expect(normalizeAffiliatePartner(protoKey)).toBeUndefined();
      expect(formatAffiliatePartnerName(protoKey)).toBe(protoKey);
      expect(itemTypeForAffiliatePartner(protoKey)).toBe("activity");
    }
  });
});

describe("isAllowedAffiliateUrl and resolveAffiliatePartnerByUrl", () => {
  it("accepts allowlisted HTTPS partner URLs across all 17 partners", () => {
    const validUrls: Array<[string, string]> = [
      ["https://www.viator.com/tours/Paris/Louvre", "viator"],
      ["https://www.getyourguide.com/paris-l16/", "getyourguide"],
      ["https://tp.media/r?marker=12345&p=4114", "travelpayouts"],
      ["https://tp.st/abc123", "travelpayouts"],
      ["https://www.stay22.com/embed/gm?aid=faroway", "stay22"],
      ["https://www.booking.com/hotel/fr/ritzy.html", "booking"],
      ["https://www.expedia.com/Paris-Hotels.d179898.Travel", "expedia"],
      ["https://safetywing.com/nomad-insurance", "safetywing"],
      ["https://www.airalo.com/japan-esim", "airalo"],
      ["https://www.klook.com/en-US/activity/123/", "klook"],
      ["https://www.discovercars.com/spain/barcelona", "discovercars"],
      ["https://www.hostelworld.com/hostels/Lisbon", "hostelworld"],
      ["https://links.duffel.com/offer/123", "duffel"],
      ["https://book.duffel.com/checkout/456", "duffel"],
      ["https://www.tripadvisor.com/Attraction_Review-g187147", "tripadvisor"],
      ["https://www.opentable.com/r/septime-paris", "opentable"],
      ["https://www.skyscanner.net/transport/flights/jfk/cdg/", "skyscanner"],
      ["https://www.ivisa.com/japan-visa", "ivisa"],
      ["https://wise.com/us/currency-converter/", "wise"],
    ];

    for (const [url, expectedPartner] of validUrls) {
      expect(isAllowedAffiliateUrl(url)).toBe(true);
      expect(resolveAffiliatePartnerByUrl(url)).toBe(expectedPartner);
    }
  });

  it("rejects non-HTTPS, credentials, ports, control characters, malformed URLs, and lookalike domains", () => {
    const invalidUrls = [
      "http://www.viator.com/tours/Paris",
      "javascript:alert(1)",
      "not-a-url",
      "https://user:pass@www.viator.com/tours/Paris",
      "https://www.viator.com:8443/tours/Paris",
      "https://viator.com.evil.example/tours/Paris",
      "https://evilviator.com/tours/Paris",
      "https://opentable.com.evil.example/r/test",
      "https://retired-supplier.example/hotel/1",
      "https://www.booking.com/hotel\r\nSet-Cookie: a=b",
      "https://www.viator.com/tours/Paris\t",
      "https://www.stay22.com/embed/gm\u0000?aid=1",
      "https://www.booking.com/\u007fhotel",
    ];

    for (const url of invalidUrls) {
      expect(isAllowedAffiliateUrl(url)).toBe(false);
      expect(resolveAffiliatePartnerByUrl(url)).toBeUndefined();
      expect(injectAffiliateSubId(url, "booking", "clk-ctrl")).toBeNull();
    }
  });

  it("rejects Travelpayouts u= open-redirects, unsafe schemes, HPP multi-u bypasses, and nested wrappers while allowing valid wrapped targets", () => {
    const maliciousTpUrls = [
      "https://tp.media/r?marker=12345&p=4110&u=https%3A%2F%2Fevil.com%2Fphish",
      "https://tp.st/r?marker=12345&u=https%3A%2F%2Fevil.com%2Fphish",
      "https://tp.media/r?marker=12345&p=4110&u=javascript%3Aalert(1)",
      "https://tp.media/r?marker=12345&p=4110&u=http%3A%2F%2F169.254.169.254%2Flatest%2Fmeta-data",
      "https://tp.media/r?marker=12345&u=http%3A%2F%2Fwww.klook.com%2F",
      "https://tp.media/r?marker=12345&u=https%3A%2F%2Fuser%3Apass%40www.klook.com%2F",
      "https://tp.media/r?marker=12345&u=https%3A%2F%2Fwww.klook.com%3A8443%2F",
      "https://tp.media/r?marker=12345&u=https%3A%2F%2Fwww.klook.com.%2F",
      "https://tp.media/r?marker=12345&u=",
      "https://tp.media/r?marker=12345&u=https%3A%2F%2Fwww.klook.com%2F&u=https%3A%2F%2Fevil.com%2Fphish",
      "https://tp.media/r?marker=12345&u=https%3A%2F%2Ftp.media%2Fr%3Fu%3Dhttps%253A%252F%252Fevil.com",
      "https://tp.media/r?marker=12345&u=https%3A%2F%2Ftp.st%2Fr%3Fu%3Dhttps%253A%252F%252Fwww.klook.com",
      "https://tp.media/r?marker=12345&u=https%3A%2F%2Fwww.travelpayouts.com%2F%3Fmarker%3D999",
    ];

    for (const badTpUrl of maliciousTpUrls) {
      expect(isAllowedAffiliateUrl(badTpUrl), badTpUrl).toBe(false);
      expect(resolveAffiliatePartnerByUrl(badTpUrl), badTpUrl).toBeUndefined();
      expect(injectAffiliateSubId(badTpUrl, "travelpayouts", "clk-tp")).toBeNull();
    }

    const validTpUrls = [
      "https://tp.media/r?marker=12345&p=4110&u=https%3A%2F%2Fwww.klook.com%2Fsearch%2F%3Fquery%3DTokyo",
      "https://tp.media/r?marker=12345&p=4114&u=https%3A%2F%2Fwww.aviasales.com%2Fsearch%2FSFO0107NRT10072",
      "https://tp.media/r?marker=12345&u=https%3A%2F%2Fwww.tiqets.com%2Fen%2Fsearch%3Fq%3DRome",
      "https://tp.media/r?marker=12345&p=4115&u=https%3A%2F%2Fsearch.hotellook.com%2F%3Fdestination%3DParis",
      "https://tp.media/r?marker=12345&u=https%3A%2F%2Fapply.joinsherpa.com%2Ftravel-restrictions",
      "https://tp.st/abc123",
    ];

    for (const goodTpUrl of validTpUrls) {
      expect(isAllowedAffiliateUrl(goodTpUrl), goodTpUrl).toBe(true);
      expect(resolveAffiliatePartnerByUrl(goodTpUrl), goodTpUrl).toBe(
        "travelpayouts",
      );
      expect(injectAffiliateSubId(goodTpUrl, "travelpayouts", "clk-ok")).toContain(
        "sub_id=clk-ok",
      );
    }
  });
});

describe("injectAffiliateSubId", () => {
  it("injects partner-native subIDs while preserving existing partner params", () => {
    const viator = injectAffiliateSubId(
      "https://www.viator.com/tours/Paris/Louvre?pid=P001&mcid=42383&medium=api",
      "viator",
      "clk-1",
    );
    expect(viator).not.toBeNull();
    const viatorUrl = new URL(viator!);
    expect(viatorUrl.searchParams.get("campaign")).toBe("clk-1");
    expect(viatorUrl.searchParams.get("pid")).toBe("P001");
    expect(viatorUrl.searchParams.get("mcid")).toBe("42383");
    expect(viatorUrl.searchParams.get("medium")).toBe("api");
    expect(viatorUrl.searchParams.has("utm_source")).toBe(false);

    const gyg = injectAffiliateSubId(
      "https://www.getyourguide.com/paris-l16/?partner_id=GYG123&date=2026-06-01",
      "getyourguide",
      "clk-2",
    );
    const gygUrl = new URL(gyg!);
    expect(gygUrl.searchParams.get("cmp")).toBe("clk-2");
    expect(gygUrl.searchParams.get("partner_id")).toBe("GYG123");
    expect(gygUrl.searchParams.get("date")).toBe("2026-06-01");

    const stay22 = injectAffiliateSubId(
      "https://www.stay22.com/embed/gm?aid=faroway&checkin=2026-06-01&checkout=2026-06-05",
      "stay22",
      "clk-3",
    );
    const stay22Url = new URL(stay22!);
    expect(stay22Url.searchParams.get("campaign")).toBe("clk-3");
    expect(stay22Url.searchParams.get("aid")).toBe("faroway");
    expect(stay22Url.searchParams.get("checkin")).toBe("2026-06-01");

    const booking = injectAffiliateSubId(
      "https://www.booking.com/searchresults.html?aid=99999&ss=Paris",
      "booking",
      "clk-4",
    );
    const bookingUrl = new URL(booking!);
    expect(bookingUrl.searchParams.get("label")).toBe("clk-4");
    expect(bookingUrl.searchParams.get("aid")).toBe("99999");
  });

  it("handles SafetyWing direct vs preserved referenceID vs Travelpayouts-wrapped links", () => {
    const direct = injectAffiliateSubId(
      "https://safetywing.com/nomad-insurance",
      "safetywing",
      "clk-sw-1",
    );
    const directUrl = new URL(direct!);
    expect(directUrl.searchParams.get("referenceID")).toBe("clk-sw-1");
    expect(directUrl.searchParams.get("utm_source")).toBe("faroway");

    const existingRef = injectAffiliateSubId(
      "https://safetywing.com/nomad-insurance?referenceID=faroway_amb",
      "safetywing",
      "clk-sw-2",
    );
    const existingRefUrl = new URL(existingRef!);
    expect(existingRefUrl.searchParams.get("referenceID")).toBe("faroway_amb");
    expect(existingRefUrl.searchParams.get("click_id")).toBe("clk-sw-2");

    const tpWrapped = injectAffiliateSubId(
      "https://tp.media/r?marker=12345&trs=99&p=4114",
      "safetywing",
      "clk-sw-3",
    );
    const tpWrappedUrl = new URL(tpWrapped!);
    expect(tpWrappedUrl.searchParams.get("sub_id")).toBe("clk-sw-3");
    expect(tpWrappedUrl.searchParams.get("marker")).toBe("12345");
    expect(tpWrappedUrl.searchParams.has("referenceID")).toBe(false);
  });

  it("injects subIdParam and UTM tags for Airalo, DiscoverCars, Duffel, Klook, OpenTable, Skyscanner, iVisa, Wise", () => {
    const cases: Array<[string, string, string, string]> = [
      [
        "https://www.airalo.com/japan-esim?ref=faroway",
        "airalo",
        "sub_id",
        "activity",
      ],
      [
        "https://www.discovercars.com/spain?a_aid=faroway",
        "discovercars",
        "sub_id",
        "transport",
      ],
      ["https://links.duffel.com/offer/123", "duffel", "click_id", "transport"],
      [
        "https://www.klook.com/en-US/activity/123/?aid=100",
        "klook",
        "sub_id",
        "activity",
      ],
      [
        "https://www.opentable.com/r/septime-paris?rid=1",
        "opentable",
        "sub_id",
        "restaurant",
      ],
      [
        "https://www.skyscanner.com/flights-to/tyo/",
        "skyscanner",
        "sub_id",
        "flight",
      ],
      [
        "https://www.ivisa.com/japan-visa?affid=faroway",
        "ivisa",
        "sub_id",
        "activity",
      ],
      ["https://wise.com/us/currency-converter/", "wise", "sub_id", "activity"],
    ];

    for (const [rawUrl, partner, param, itemType] of cases) {
      const injected = injectAffiliateSubId(rawUrl, partner, `clk-${partner}`, {
        itemType,
      });
      expect(injected).not.toBeNull();
      const parsed = new URL(injected!);
      expect(parsed.searchParams.get(param)).toBe(`clk-${partner}`);
      expect(parsed.searchParams.get("utm_source")).toBe("faroway");
      expect(parsed.searchParams.get("utm_medium")).toBe("affiliate");
      expect(parsed.searchParams.get("utm_campaign")).toBe(itemType);
    }
  });

  it("returns null for disallowed URLs or empty/non-string clickId", () => {
    expect(
      injectAffiliateSubId("https://evil.example/deal", "viator", "clk-1"),
    ).toBeNull();
    expect(
      injectAffiliateSubId(
        "https://www.viator.com/tours/Paris",
        "viator",
        "   ",
      ),
    ).toBeNull();
    expect(
      injectAffiliateSubId(
        "https://www.viator.com/tours/Paris",
        "viator",
        null as unknown as string,
      ),
    ).toBeNull();
    expect(
      injectAffiliateSubId(
        "https://www.viator.com/tours/Paris",
        "viator",
        undefined as unknown as string,
      ),
    ).toBeNull();
    expect(
      injectAffiliateSubId(
        "https://www.viator.com/tours/Paris",
        "viator",
        123 as unknown as string,
      ),
    ).toBeNull();
  });

  it("prefers the URL host partner over mismatched or prototype partner inputs", () => {
    const bookingWithMismatchedPartner = injectAffiliateSubId(
      "https://www.booking.com/hotel/fr/ritzy.html?aid=999",
      "viator",
      "clk-mismatch",
    );
    expect(bookingWithMismatchedPartner).not.toBeNull();
    const bookingUrl = new URL(bookingWithMismatchedPartner!);
    expect(bookingUrl.searchParams.get("label")).toBe("clk-mismatch");
    expect(bookingUrl.searchParams.has("campaign")).toBe(false);

    const stay22WithMismatchedPartner = injectAffiliateSubId(
      "https://www.stay22.com/embed/gm?aid=1",
      "booking",
      "clk-stay22",
    );
    const stay22Url = new URL(stay22WithMismatchedPartner!);
    expect(stay22Url.searchParams.get("campaign")).toBe("clk-stay22");
    expect(stay22Url.searchParams.has("label")).toBe(false);

    const viatorWithProtoPartner = injectAffiliateSubId(
      "https://www.viator.com/tours/Paris",
      "constructor",
      "clk-proto",
    );
    expect(viatorWithProtoPartner).not.toBeNull();
    expect(new URL(viatorWithProtoPartner!).searchParams.get("campaign")).toBe(
      "clk-proto",
    );
  });
});
