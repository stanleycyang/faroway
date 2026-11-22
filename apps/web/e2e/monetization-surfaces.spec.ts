import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

let server: Server;
let fixtureUrl: string;
let directory: string;

test.beforeAll(async () => {
  directory = mkdtempSync(
    path.join(tmpdir(), "faroway-monetization-surfaces-"),
  );
  const output = path.join(directory, "monetization-surfaces.js");
  execFileSync("bun", [
    "run",
    "e2e/fixtures/build-monetization.mjs",
    "e2e/fixtures/monetization-surfaces.tsx",
    output,
  ]);
  const bundle = readFileSync(output);
  const css = (
    await postcss([tailwind()]).process(
      readFileSync("app/globals.css", "utf8"),
      { from: path.resolve("app/globals.css") },
    )
  ).css;

  server = createServer((request, response) => {
    if (request.url === "/monetization-surfaces.css") {
      response.setHeader("Content-Type", "text/css; charset=utf-8");
      response.end(css);
    } else if (request.url === "/monetization-surfaces.js") {
      response.setHeader(
        "Content-Type",
        "application/javascript; charset=utf-8",
      );
      response.end(bundle);
    } else {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(
        '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/monetization-surfaces.css"><style>body{--font-playfair:Georgia;--font-plus-jakarta:Arial}</style></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"development"}};</script><script src="/monetization-surfaces.js"></script></body></html>',
      );
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("No fixture port");
  }
  fixtureUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  if (directory) {
    rmSync(directory, { recursive: true, force: true });
  }
});

async function setupSharedTripPage(page: Page, query = "") {
  const reactionPosts: Array<Record<string, unknown>> = [];
  const clickPosts: Array<Record<string, unknown>> = [];
  const checkoutRequests: string[] = [];

  await page.route("**/api/trips/*/checkout", async (route) => {
    checkoutRequests.push(route.request().url());
    await route.fulfill({ status: 401, json: { error: "Unauthorized" } });
  });

  await page.route("**/api/track/click", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    clickPosts.push(body);
    const parsed = new URL(String(body.affiliateUrl));
    const partner = String(body.affiliatePartner || "viator");
    const param =
      partner === "viator" || partner === "stay22"
        ? "campaign"
        : partner === "getyourguide"
          ? "cmp"
          : "sub_id";
    parsed.searchParams.set(param, `e2e-clk-${clickPosts.length}`);
    await route.fulfill({
      json: {
        clickId: `e2e-clk-${clickPosts.length}`,
        partner,
        redirectUrl: parsed.toString(),
        trackingUrl: parsed.toString(),
      },
    });
  });

  await page.route("**/api/trips/shared/*/reactions", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: { counts: {}, persisted: true },
      });
      return;
    }
    const body = route.request().postDataJSON() as Record<string, unknown>;
    reactionPosts.push(body);
    await route.fulfill({
      json: {
        counts: {
          [String(body.stopKey)]: {
            thumbs_up: body.reaction === "thumbs_up" ? 1 : 0,
            heart: body.reaction === "heart" ? 1 : 0,
          },
        },
        persisted: true,
      },
    });
  });

  await page
    .context()
    .route(/^https:\/\//, (route) =>
      route.fulfill({ contentType: "text/html", body: "Mock provider" }),
    );

  await page.goto(`${fixtureUrl}${query}`);
  return { reactionPosts, clickPosts, checkoutRequests };
}

test("SharedTripView renders itinerary, preserves clone/customize href params, and records stop reactions", async ({
  page,
}) => {
  const { reactionPosts } = await setupSharedTripPage(page);

  await expect(
    page.getByRole("heading", { name: "Tokyo, Japan", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Day-by-Day Itinerary")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Senso-ji Morning Cultural Walk" }),
  ).toBeVisible();

  const cloneLinks = page.getByRole("link", {
    name: /Clone & customize this trip/i,
  });
  await expect(cloneLinks.first()).toBeVisible();
  const href = await cloneLinks.first().getAttribute("href");
  expect(href).toBeTruthy();
  const parsed = new URL(href!, "http://127.0.0.1");
  expect(parsed.pathname).toBe("/create");
  expect(parsed.searchParams.get("destination")).toBe("Tokyo, Japan");
  expect(parsed.searchParams.get("travelers")).toBe("3");
  expect(parsed.searchParams.get("budget")).toBe("moderate");
  expect(parsed.searchParams.get("vibes")).toBe("culture,foodie");

  const voteSection = page.getByRole("region", {
    name: "Vote on Day 1 stops",
  });
  await expect(voteSection).toBeVisible();
  const upvoteBtn = voteSection
    .getByRole("button", { name: /Thumbs up Senso-ji Morning Cultural Walk/i })
    .first();
  await upvoteBtn.click();
  await expect.poll(() => reactionPosts.length).toBeGreaterThanOrEqual(1);
  expect(reactionPosts[0]).toMatchObject({
    reaction: "thumbs_up",
    action: "add",
  });
});

test("SharedTripView renders revoked/empty itinerary fallback cleanly", async ({
  page,
}) => {
  await setupSharedTripPage(page, "?screen=revoked");
  await expect(
    page.getByRole("heading", { name: "Tokyo, Japan", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Day-by-Day Itinerary")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: /Clone & customize this trip/i }).first(),
  ).toBeVisible();
});

test("SharedTripView has zero horizontal overflow at desktop and 320x568 mobile", async ({
  page,
}) => {
  await setupSharedTripPage(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await page.setViewportSize({ width: 320, height: 568 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("in-browser @faroway/constants contract: all 17 partner subIDs, preservedParams, prototype pollution, and SSRF rejections", async ({
  page,
}) => {
  await setupSharedTripPage(page);

  const report = await page.evaluate(() => {
    const api = window.__MONETIZATION_CONTRACTS__!;
    const sampleUrls: Record<string, string> = {
      viator:
        "https://www.viator.com/tours/Paris/Walk/d479-123P1?pid=P12345678&mcid=42383&medium=api",
      getyourguide:
        "https://www.getyourguide.com/paris-l16/louvre-t12345/?partner_id=FAROWAY&date=2099-06-01",
      travelpayouts:
        "https://tp.media/r?marker=12345&trs=99&p=4114&shmarker=sh1&u=https%3A%2F%2Fexample.com&campaign_id=100",
      stay22:
        "https://www.stay22.com/allez/roam?aid=faroway&address=Tokyo&lat=35.68&lng=139.76&checkin=2099-07-10&checkout=2099-07-13&adults=2&children=1&rooms=1",
      booking:
        "https://www.booking.com/hotel/jp/tokyo.html?aid=999999&checkin=2099-07-10&checkout=2099-07-13&group_adults=2&group_children=0&no_rooms=1&ss=Tokyo",
      expedia:
        "https://www.expedia.com/Tokyo-Hotels.h1.Hotel-Information?afflid=lid1&camref=cam1&pubref=pub1",
      safetywing: "https://safetywing.com/nomad-insurance?ambassador=faroway",
      airalo: "https://www.airalo.com/japan-esim?ref=faroway&irclickid=ir123",
      klook:
        "https://www.klook.com/activity/123-tokyo/?aid=111&aff_adid=222&k_source=faroway",
      discovercars:
        "https://www.discovercars.com/japan/tokyo?a_aid=faroway&a_bid=bid1",
      hostelworld:
        "https://www.hostelworld.com/hostels/Tokyo?source=faroway_partner",
      duffel: "https://book.duffel.com/flights/SFO-NRT?reference=ref_999",
      tripadvisor:
        "https://www.tripadvisor.com/Attraction-g298184-Tokyo.html?m=12345",
      opentable:
        "https://www.opentable.com/r/narisawa-tokyo?rid=555&restref=666&aid=777",
      skyscanner:
        "https://www.skyscanner.com/transport/flights/sfo/tyoa/?associateid=assoc1&irclickid=ir_sky",
      ivisa:
        "https://www.ivisa.com/japan-visa?affid=aff_ivisa&irclickid=ir_ivisa",
      wise: "https://wise.com/us/currency-converter/?irclickid=ir_wise&source=USD&target=JPY",
    };

    const partnerResults = api.AFFILIATE_PARTNER_IDS.map((partnerId) => {
      const meta = api.AFFILIATE_PARTNERS[partnerId];
      const inputUrl = sampleUrls[partnerId];
      const inputParsed = new URL(inputUrl);
      const injected = api.injectAffiliateSubId(
        inputUrl,
        partnerId,
        "clk_test_123",
        { itemType: meta.defaultItemType },
      );
      const parsed = injected ? new URL(injected) : null;
      const preservedChecks: Record<
        string,
        { expected: string; actual: string | null }
      > = {};
      for (const param of meta.preservedParams) {
        if (inputParsed.searchParams.has(param)) {
          preservedChecks[param] = {
            expected: inputParsed.searchParams.get(param)!,
            actual: parsed?.searchParams.get(param) ?? null,
          };
        }
      }
      return {
        partnerId,
        allowed: api.isAllowedAffiliateUrl(inputUrl),
        resolved: api.resolveAffiliatePartnerByUrl(inputUrl),
        injected,
        appendUtm: meta.appendUtm,
        subIdValue: parsed?.searchParams.get(meta.subIdParam) ?? null,
        utmSource: parsed?.searchParams.get("utm_source") ?? null,
        utmMedium: parsed?.searchParams.get("utm_medium") ?? null,
        preservedChecks,
      };
    });

    // SafetyWing & Expedia preserve existing subIdParam without clobbering
    const safetywingExistingRef = api.injectAffiliateSubId(
      "https://safetywing.com/nomad-insurance?referenceID=existing_ref",
      "safetywing",
      "clk_sw_99",
    );
    const expediaExistingAffcid = api.injectAffiliateSubId(
      "https://www.expedia.com/Tokyo-Hotels.h1.Hotel-Information?affcid=existing_affcid",
      "expedia",
      "clk_exp_99",
    );

    const protoKeys = [
      "__proto__",
      "constructor",
      "toString",
      "valueOf",
      "hasOwnProperty",
    ];
    const protoPartnerRejects = protoKeys.map((key) =>
      api.normalizeAffiliatePartner(key),
    );
    const protoVibeRejects = api.normalizeVibeList(protoKeys);
    const protoBudgetRejects = protoKeys.map((key) =>
      api.normalizeBudgetTier(key),
    );

    const rejectedUrls = [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "http://www.viator.com/tours/Paris/Walk/d479-123P1",
      "https://user:pass@www.viator.com/tours/Paris/Walk/d479-123P1",
      "https://www.booking.com:8443/hotel/jp/tokyo.html",
      "https://viator.com.evil.test/tours/123",
      "https://evilgetyourguide.com/activity",
      "https://127.0.0.1/admin",
      "",
    ].map((url) => ({
      url,
      allowed: api.isAllowedAffiliateUrl(url),
      injected: api.injectAffiliateSubId(url, "viator", "clk_1"),
    }));

    return {
      partnerCount: api.AFFILIATE_PARTNER_IDS.length,
      partnerResults,
      safetywingExistingRef,
      expediaExistingAffcid,
      protoPartnerRejects,
      protoVibeRejects,
      protoBudgetRejects,
      rejectedUrls,
      cultureNormalized: api.normalizeVibeList(["cultural", "foodie"]),
      comfortNormalized: api.normalizeBudgetTier("Comfort"),
      disclosureShort: api.AFFILIATE_DISCLOSURE_SHORT,
    };
  });

  expect(report.partnerCount).toBe(17);
  for (const res of report.partnerResults) {
    expect(res.allowed).toBe(true);
    expect(res.resolved).toBe(res.partnerId);
    expect(res.subIdValue).toBe("clk_test_123");
    if (res.appendUtm) {
      expect(res.utmSource).toBe("faroway");
      expect(res.utmMedium).toBe("affiliate");
    } else {
      expect(res.utmSource).toBeNull();
      expect(res.utmMedium).toBeNull();
    }
    const preservedEntries = Object.entries(res.preservedChecks);
    expect(preservedEntries.length).toBeGreaterThan(0);
    for (const [, check] of preservedEntries) {
      expect(check.actual).toBe(check.expected);
    }
  }

  expect(report.safetywingExistingRef).toContain("referenceID=existing_ref");
  expect(report.safetywingExistingRef).toContain("click_id=clk_sw_99");
  expect(report.expediaExistingAffcid).toContain("affcid=existing_affcid");
  expect(report.expediaExistingAffcid).toContain("click_id=clk_exp_99");
  expect(report.protoPartnerRejects.every((v) => v === undefined)).toBe(true);
  expect(report.protoVibeRejects).toEqual([]);
  expect(report.protoBudgetRejects.every((v) => v === undefined)).toBe(true);
  expect(
    report.rejectedUrls.every(
      (r) => r.allowed === false && r.injected === null,
    ),
  ).toBe(true);
  expect(report.cultureNormalized).toEqual(["culture", "foodie"]);
  expect(report.comfortNormalized).toBe("moderate");
  expect(report.disclosureShort).toBe(
    "We may earn a commission at no extra cost to you.",
  );
});

test("in-browser @faroway/validation boundaries & WCAG AA contrast ratio check", async ({
  page,
}) => {
  await setupSharedTripPage(page);

  const validation = await page.evaluate(() => {
    const api = window.__MONETIZATION_CONTRACTS__!;
    const validConversion = api.validateConversionWebhook({
      partner: "stay22",
      clickId: "clk_stay22_1",
      externalTransactionId: "txn_001",
      status: "confirmed",
      bookingAmount: 240.5,
      commissionAmount: 19.24,
      currency: "USD",
      occurredAt: "2026-06-15T10:30:00Z",
    });
    const invalidNegativeAmount = api.validateConversionWebhook({
      partner: "stay22",
      clickId: "clk_stay22_1",
      externalTransactionId: "txn_001",
      bookingAmount: -0.01,
    });
    const invalidLowerCurrency = api.validateConversionWebhook({
      partner: "stay22",
      clickId: "clk_stay22_1",
      externalTransactionId: "txn_001",
      currency: "usd",
    });
    const invalidShortCurrency = api.validateConversionWebhook({
      partner: "stay22",
      clickId: "clk_stay22_1",
      externalTransactionId: "txn_001",
      currency: "US",
    });
    const invalidCalendarDate = api.validateConversionWebhook({
      partner: "stay22",
      clickId: "clk_stay22_1",
      externalTransactionId: "txn_001",
      occurredAt: "2026-02-30",
    });
    const invalidInfinityAmount = api.validateConversionWebhook({
      partner: "stay22",
      clickId: "clk_stay22_1",
      externalTransactionId: "txn_001",
      bookingAmount: Infinity,
    });
    const invalidNaNCommission = api.validateConversionWebhook({
      partner: "stay22",
      clickId: "clk_stay22_1",
      externalTransactionId: "txn_001",
      commissionAmount: Number.NaN,
    });
    const budgetComfort = api.parseBudgetTierInput("Comfort");
    const budgetInvalid = api.parseBudgetTierInput("super-ultra");
    const vibeCultural = api.parseNormalizedTravelVibe("cultural");
    const vibeInvalid = api.parseNormalizedTravelVibe("__proto__");
    const validClick = api.validateTrackClick({
      itemType: "hotel",
      itemId: "hotel_1",
      itemName: "Hotel Recamier",
      affiliatePartner: "stay22",
      affiliateUrl: "https://www.stay22.com/allez/roam?aid=faroway",
      source: "shared_trip",
    });
    const invalidClickUrl = api.validateTrackClick({
      itemType: "hotel",
      itemId: "hotel_1",
      itemName: "Hotel Recamier",
      affiliatePartner: "stay22",
      affiliateUrl: "not-a-url",
    });

    return {
      validConversion,
      invalidNegativeAmount,
      invalidLowerCurrency,
      invalidShortCurrency,
      invalidCalendarDate,
      invalidInfinityAmount,
      invalidNaNCommission,
      budgetComfort,
      budgetInvalid,
      vibeCultural,
      vibeInvalid,
      validClick,
      invalidClickUrl,
    };
  });

  expect(validation.validConversion).toBe(true);
  expect(validation.invalidNegativeAmount).toBe(false);
  expect(validation.invalidLowerCurrency).toBe(false);
  expect(validation.invalidShortCurrency).toBe(false);
  expect(validation.invalidCalendarDate).toBe(false);
  expect(validation.invalidInfinityAmount).toBe(false);
  expect(validation.invalidNaNCommission).toBe(false);
  expect(validation.budgetComfort).toEqual({ success: true, data: "moderate" });
  expect(validation.budgetInvalid).toEqual({ success: false });
  expect(validation.vibeCultural).toEqual({ success: true, data: "culture" });
  expect(validation.vibeInvalid).toEqual({ success: false });
  expect(validation.validClick).toBe(true);
  expect(validation.invalidClickUrl).toBe(false);

  // Measure actual rendered WCAG AA contrast ratios via compiled Tailwind CSS classes
  const contrastRatios = await page.evaluate(() => {
    function parseRgb(cssColor: string): [number, number, number] {
      const m = cssColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (!m) throw new Error(`Unexpected color: ${cssColor}`);
      return [Number(m[1]), Number(m[2]), Number(m[3])];
    }
    function luminance([r, g, b]: [number, number, number]): number {
      const channel = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    }
    function ratio(fg: string, bg: string): number {
      const l1 = luminance(parseRgb(fg));
      const l2 = luminance(parseRgb(bg));
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    }

    const ids = [
      "swatch-primary-700-solid",
      "swatch-primary-800-solid",
      "swatch-primary-700-white",
      "swatch-primary-800-paper",
      "swatch-ocean-teal-solid",
    ];
    return ids.map((id) => {
      const el = document.querySelector(`[data-testid="${id}"]`)!;
      const style = getComputedStyle(el);
      return {
        id,
        hasInlineStyle: el.hasAttribute("style"),
        color: style.color,
        bg: style.backgroundColor,
        ratio: ratio(style.color, style.backgroundColor),
      };
    });
  });

  for (const entry of contrastRatios) {
    expect(entry.hasInlineStyle).toBe(false);
    expect(entry.bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(entry.ratio).toBeGreaterThanOrEqual(4.5);
  }
});

test("SharedTripView interactive monetization: Book on Viator, Book this trip sheet, and essentials strip use /api/track/click with source='shared_trip' and ZERO /checkout calls", async ({
  page,
}) => {
  const { clickPosts, checkoutRequests } = await setupSharedTripPage(page);

  // 1. Click "Book on Viator" on activity_v_TOKYO1 inside SharedTripView
  const bookViatorBtn = page.getByRole("button", { name: "Book on Viator" });
  await expect(bookViatorBtn).toBeVisible();
  await bookViatorBtn.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Your next step, with Viator");
  await expect(dialog).toContainText("Senso-ji Morning Cultural Walk");

  await dialog.getByRole("button", { name: "Continue to Viator" }).click();
  await expect.poll(() => clickPosts.length).toBe(1);

  expect(clickPosts[0]).toMatchObject({
    affiliatePartner: "viator",
    itemId: "activity_v_TOKYO1",
    source: "shared_trip",
    placement: "activity_card",
  });
  expect(checkoutRequests).toHaveLength(0);
  await expect(page).toHaveURL(/viator\.com.*campaign=e2e-clk-1/);

  // 2. Return to shared trip, open "Book this trip" (BookingsSheet), and trigger an item inside it
  await page.goto(fixtureUrl);
  const bookTripBtn = page.getByRole("button", { name: /Book this trip/i });
  await expect(bookTripBtn).toBeVisible();
  await bookTripBtn.click();

  const sheetDialog = page.getByRole("dialog", {
    name: /Book your Tokyo, Japan trip/i,
  });
  await expect(sheetDialog).toBeVisible();
  await sheetDialog
    .getByRole("button", { name: "Review & book" })
    .first()
    .click();

  // Sheet closes and TripCheckout modal opens
  await expect(sheetDialog).toHaveCount(0);
  const checkoutModal = page.getByRole("dialog");
  await expect(checkoutModal).toBeVisible();

  await checkoutModal.getByRole("button", { name: /^Continue to / }).click();
  await expect.poll(() => clickPosts.length).toBe(2);

  expect(clickPosts[1]).toMatchObject({
    source: "shared_trip",
    placement: "bookings_sheet",
  });
  expect(checkoutRequests).toHaveLength(0);

  // 3. Return to shared trip and trigger a SharedTripEssentialsStrip CTA
  await page.goto(fixtureUrl);
  const essentialsRegion = page.getByRole("region", {
    name: "Stays, flights & trip essentials",
  });
  await expect(essentialsRegion).toBeVisible();
  const airaloBtn = essentialsRegion.getByRole("button", {
    name: /Airalo/i,
  });
  await expect(airaloBtn).toBeVisible();
  await airaloBtn.click();

  await expect(page.getByRole("dialog")).toContainText(
    "Your next step, with Airalo",
  );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Continue to Airalo" })
    .click();
  await expect.poll(() => clickPosts.length).toBe(3);

  expect(clickPosts[2]).toMatchObject({
    affiliatePartner: "airalo",
    source: "shared_trip",
    placement: "shared_trip_essentials",
  });
  expect(checkoutRequests).toHaveLength(0);
  await expect(page).toHaveURL(/airalo\.com.*sub_id=e2e-clk-3/);
});
