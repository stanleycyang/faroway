import { test, expect, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";

test.skip(
  process.env.E2E_INTEGRATED_MONETIZATION !== "true",
  "Track B: runs against integrated M2+M3+M4 build in Final Milestone Phase 1",
);

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3000";

const ALL_17_PARTNER_CLICKS: Array<{
  partner: string;
  url: string;
  expectedParam: string;
  preserved: Record<string, string>;
  itemType: "hotel" | "activity" | "restaurant" | "flight" | "transport";
}> = [
  {
    partner: "viator",
    url: "https://www.viator.com/tours/Tokyo/Walk/d334-123P1?pid=P12345678&mcid=42383&medium=api",
    expectedParam: "campaign",
    preserved: { pid: "P12345678", mcid: "42383", medium: "api" },
    itemType: "activity",
  },
  {
    partner: "getyourguide",
    url: "https://www.getyourguide.com/tokyo-l193/tour-t12345/?partner_id=FAROWAY&date=2099-07-10",
    expectedParam: "cmp",
    preserved: { partner_id: "FAROWAY", date: "2099-07-10" },
    itemType: "activity",
  },
  {
    partner: "travelpayouts",
    url: "https://tp.media/r?marker=12345&trs=99&p=4114&u=https%3A%2F%2Fexample.com",
    expectedParam: "sub_id",
    preserved: { marker: "12345", trs: "99", p: "4114" },
    itemType: "activity",
  },
  {
    partner: "stay22",
    url: "https://www.stay22.com/allez/roam?aid=faroway&address=Tokyo",
    expectedParam: "campaign",
    preserved: { aid: "faroway", address: "Tokyo" },
    itemType: "hotel",
  },
  {
    partner: "booking",
    url: "https://www.booking.com/hotel/jp/tokyo.html?aid=12345&checkin=2099-07-10",
    expectedParam: "label",
    preserved: { aid: "12345", checkin: "2099-07-10" },
    itemType: "hotel",
  },
  {
    partner: "expedia",
    url: "https://www.expedia.com/Tokyo-Hotels.h1.Hotel-Information?afflid=lid1",
    expectedParam: "affcid",
    preserved: { afflid: "lid1" },
    itemType: "hotel",
  },
  {
    partner: "safetywing",
    url: "https://safetywing.com/nomad-insurance?ambassador=faroway",
    expectedParam: "referenceID",
    preserved: { ambassador: "faroway" },
    itemType: "activity",
  },
  {
    partner: "airalo",
    url: "https://www.airalo.com/japan-esim?ref=faroway",
    expectedParam: "sub_id",
    preserved: { ref: "faroway" },
    itemType: "activity",
  },
  {
    partner: "klook",
    url: "https://www.klook.com/activity/123-tokyo/?aid=111",
    expectedParam: "sub_id",
    preserved: { aid: "111" },
    itemType: "activity",
  },
  {
    partner: "discovercars",
    url: "https://www.discovercars.com/japan/tokyo?a_aid=faroway",
    expectedParam: "sub_id",
    preserved: { a_aid: "faroway" },
    itemType: "transport",
  },
  {
    partner: "hostelworld",
    url: "https://www.hostelworld.com/hostels/Tokyo?source=faroway",
    expectedParam: "sub_id",
    preserved: { source: "faroway" },
    itemType: "hotel",
  },
  {
    partner: "duffel",
    url: "https://book.duffel.com/flights/SFO-TYO?reference=ref1",
    expectedParam: "click_id",
    preserved: { reference: "ref1" },
    itemType: "transport",
  },
  {
    partner: "tripadvisor",
    url: "https://www.tripadvisor.com/Attraction-g298184-Tokyo.html?m=12345",
    expectedParam: "sub_id",
    preserved: { m: "12345" },
    itemType: "activity",
  },
  {
    partner: "opentable",
    url: "https://www.opentable.com/r/narisawa-tokyo?rid=555",
    expectedParam: "sub_id",
    preserved: { rid: "555" },
    itemType: "restaurant",
  },
  {
    partner: "skyscanner",
    url: "https://www.skyscanner.com/transport/flights/sfo/tyoa/?associateid=assoc1",
    expectedParam: "sub_id",
    preserved: { associateid: "assoc1" },
    itemType: "flight",
  },
  {
    partner: "ivisa",
    url: "https://www.ivisa.com/japan-visa?affid=aff1",
    expectedParam: "sub_id",
    preserved: { affid: "aff1" },
    itemType: "activity",
  },
  {
    partner: "wise",
    url: "https://wise.com/us/currency-converter/?source=USD&target=JPY",
    expectedParam: "sub_id",
    preserved: { source: "USD", target: "JPY" },
    itemType: "activity",
  },
];

const EIGHT_WEBHOOK_PARTNERS = [
  "viator",
  "getyourguide",
  "klook",
  "travelpayouts",
  "stay22",
  "duffel",
  "safetywing",
  "airalo",
] as const;

async function checkNoHorizontalOverflow(page: Page) {
  const ok = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(ok).toBe(true);
}

async function checkNoRawEmojis(page: Page) {
  const emojis = await page.evaluate(() => {
    const text = (document.body.innerText || "").replace(/[©®™]/gu, "");
    return text.match(/\p{Extended_Pictographic}/gu) || [];
  });
  expect(emojis).toEqual([]);
}

async function auditContrastAndBrandTokens(page: Page) {
  const audit = await page.evaluate(() => {
    type Rgba = [number, number, number, number];
    const parseColor = (css: string): Rgba => {
      const m = css.match(
        /rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?))?\s*\)/,
      );
      if (!m) return [0, 0, 0, 0];
      return [
        Number(m[1]),
        Number(m[2]),
        Number(m[3]),
        m[4] === undefined ? 1 : Number(m[4]),
      ];
    };
    const compositeOver = (fg: Rgba, bg: Rgba): Rgba => {
      const a = fg[3];
      return [
        fg[0] * a + bg[0] * (1 - a),
        fg[1] * a + bg[1] * (1 - a),
        fg[2] * a + bg[2] * (1 - a),
        1,
      ];
    };
    const luminance = ([r, g, b]: Rgba): number => {
      const channel = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const contrastRatio = (fg: Rgba, bg: Rgba): number => {
      const l1 = luminance(fg);
      const l2 = luminance(bg);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    };
    const resolveEffectiveBackground = (el: Element): Rgba => {
      const layers: Rgba[] = [];
      let cur: Element | null = el;
      while (cur) {
        const parsed = parseColor(getComputedStyle(cur).backgroundColor);
        if (parsed[3] > 0) {
          layers.push(parsed);
          if (parsed[3] >= 0.999) break;
        }
        cur = cur.parentElement;
      }
      let bg: Rgba = [255, 255, 255, 1];
      for (let i = layers.length - 1; i >= 0; i--) {
        bg = compositeOver(layers[i], bg);
      }
      return bg;
    };
    const isLargeText = (style: CSSStyleDeclaration): boolean => {
      const sizePx = parseFloat(style.fontSize) || 16;
      const weight = parseInt(style.fontWeight, 10) || 400;
      return sizePx >= 24 || (sizePx >= 18.66 && weight >= 700);
    };
    const rgbHex = ([r, g, b]: Rgba): string =>
      `#${[r, g, b]
        .map((n) => Math.round(n).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()}`;

    const bannedLightTextColors = new Set(["#F97066", "#FA8C84", "#94A3B8"]);
    const failures: Array<{
      tag: string;
      text: string;
      fg: string;
      bg: string;
      ratio: number;
      required: number;
      reason: string;
    }> = [];

    const candidates = Array.from(
      document.querySelectorAll(
        "main a, main button, main p, main h1, main h2, main h3, .glass-card, .glass-card *",
      ),
    );
    let checkedCount = 0;

    for (const el of candidates) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 10 || rect.height < 10) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      if (parseFloat(style.opacity) === 0) continue;
      // Only inspect elements with direct text or primary action controls
      const text = (el.textContent || "").trim();
      if (!text) continue;
      const hasDirectText = Array.from(el.childNodes).some(
        (n) =>
          n.nodeType === Node.TEXT_NODE && (n.textContent || "").trim() !== "",
      );
      const isAction = el.tagName === "A" || el.tagName === "BUTTON";
      if (!hasDirectText && !isAction) continue;
      // Skip gradient-clipped text (transparent text fill)
      if (style.webkitTextFillColor === "rgba(0, 0, 0, 0)") continue;

      const fgRaw = parseColor(style.color);
      const bg = resolveEffectiveBackground(el);
      const fg = compositeOver(fgRaw, bg);
      const ratio = contrastRatio(fg, bg);
      const required = isLargeText(style) ? 3.0 : 4.5;
      checkedCount++;

      const bgLum = luminance(bg);
      const fgHex = rgbHex(fgRaw);
      if (bgLum > 0.7 && bannedLightTextColors.has(fgHex)) {
        failures.push({
          tag: el.tagName,
          text: text.slice(0, 60),
          fg: fgHex,
          bg: rgbHex(bg),
          ratio: Number(ratio.toFixed(2)),
          required,
          reason: `Banned low-contrast text color ${fgHex} on light background`,
        });
      } else if (ratio < required) {
        failures.push({
          tag: el.tagName,
          text: text.slice(0, 60),
          fg: fgHex,
          bg: rgbHex(bg),
          ratio: Number(ratio.toFixed(2)),
          required,
          reason: `Contrast ${ratio.toFixed(2)} below WCAG AA ${required}:1`,
        });
      }
    }

    return { checkedCount, failures };
  });

  expect(audit.checkedCount).toBeGreaterThan(0);
  expect(audit.failures).toEqual([]);
}

test.describe("Track B Tier 1: 17-partner click attribution, SSRF & 8-partner conversion webhooks", () => {
  test("POST /api/track/click emits partner-native subIDs, preserves params across 17 partners, preserves SafetyWing referenceID, and blocks SSRF", async ({
    request,
  }) => {
    for (const entry of ALL_17_PARTNER_CLICKS) {
      const res = await request.post(`${BASE_URL}/api/track/click`, {
        data: {
          itemType: entry.itemType,
          itemId: `integrated-${entry.partner}`,
          itemName: `Integrated ${entry.partner}`,
          affiliatePartner: entry.partner,
          affiliateUrl: entry.url,
          source: "shared_trip",
        },
      });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as {
        clickId: string;
        redirectUrl: string;
      };
      const redirect = new URL(body.redirectUrl);
      expect(redirect.searchParams.get(entry.expectedParam)).toBe(body.clickId);
      for (const [k, v] of Object.entries(entry.preserved)) {
        expect(redirect.searchParams.get(k)).toBe(v);
      }
    }

    // SafetyWing existing referenceID non-clobber fallback
    const swRes = await request.post(`${BASE_URL}/api/track/click`, {
      data: {
        itemType: "activity",
        itemId: "integrated-safetywing-existing",
        itemName: "SafetyWing Existing Ref",
        affiliatePartner: "safetywing",
        affiliateUrl:
          "https://safetywing.com/nomad-insurance?referenceID=existing_ref",
        source: "tool",
      },
    });
    expect(swRes.status()).toBe(200);
    const swBody = (await swRes.json()) as {
      clickId: string;
      redirectUrl: string;
    };
    const swRedirect = new URL(swBody.redirectUrl);
    expect(swRedirect.searchParams.get("referenceID")).toBe("existing_ref");
    expect(swRedirect.searchParams.get("click_id")).toBe(swBody.clickId);

    // SSRF / lookalike domain rejection
    const ssrfRes = await request.post(`${BASE_URL}/api/track/click`, {
      data: {
        itemType: "activity",
        itemId: "integrated-ssrf",
        itemName: "Lookalike URL",
        affiliatePartner: "viator",
        affiliateUrl: "https://viator.com.evil.test/tours/123",
        source: "shared_trip",
      },
    });
    expect(ssrfRes.status()).toBe(400);
  });

  test("POST /api/track/conversion supports 8 partners with conversionWebhookSchema & HMAC-SHA256 verification", async ({
    request,
  }) => {
    for (const partner of EIGHT_WEBHOOK_PARTNERS) {
      const envKey = `${partner === "getyourguide" ? "GYG" : partner.toUpperCase()}_WEBHOOK_SECRET`;
      const secret = process.env[envKey];
      const payload = JSON.stringify({
        partner,
        clickId: `clk_int_${partner}`,
        externalTransactionId: `txn_int_${partner}`,
        status: "confirmed",
        bookingAmount: 120,
        commissionAmount: 10,
        currency: "USD",
        occurredAt: "2026-06-15T10:30:00Z",
      });
      if (!secret) {
        const unauth = await request.post(`${BASE_URL}/api/track/conversion`, {
          headers: { "Content-Type": "application/json" },
          data: payload,
        });
        expect(unauth.status()).toBe(401);
        continue;
      }
      const sig = createHmac("sha256", secret).update(payload).digest("hex");
      const res = await request.post(`${BASE_URL}/api/track/conversion`, {
        headers: {
          "Content-Type": "application/json",
          "x-webhook-signature": sig,
        },
        data: payload,
      });
      expect(res.status()).toBe(200);
    }
  });
});

test.describe("Track B Tier 2 & 3: /create, Duffel, Checkout new-tab + BookingsSheet, SharedTripView", () => {
  test("/create exposes visible mobile h1, ?destination=Tokyo prefill, Culture + Moderate selection, flight consent + originAirport, and no premature sign-in copy", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE_URL}/create?destination=Tokyo`);

    // Must have at least one truly visible non-sr-only mobile <h1>
    const h1Count = await page.locator("h1").count();
    let hasVisibleMobileH1 = false;
    for (let i = 0; i < h1Count; i++) {
      const candidate = page.locator("h1").nth(i);
      if (await candidate.isVisible()) {
        const box = await candidate.boundingBox();
        if (box && box.width > 10 && box.height > 10) {
          hasVisibleMobileH1 = true;
          break;
        }
      }
    }
    expect(hasVisibleMobileH1).toBe(true);

    // ?destination=Tokyo prefill
    const destinationInput = page
      .locator(
        'input[placeholder*="Tokyo"], input[placeholder*="destination" i], input[name*="destination" i]',
      )
      .first();
    await expect(destinationInput).toHaveValue(/Tokyo/i);

    // No premature "then sign in" friction copy
    await expect(page.getByText(/then sign in/i)).toHaveCount(0);

    // Interactive vibe & budget selection
    const cultureBtn = page.getByRole("button", { name: /Culture/i }).first();
    await expect(cultureBtn).toBeVisible();
    await cultureBtn.click();

    const moderateBtn = page.getByRole("button", { name: /Moderate/i }).first();
    await expect(moderateBtn).toBeVisible();
    await moderateBtn.click();

    // Toggle flight-search consent if gated behind a switch/checkbox/button before checking originAirport
    const flightConsent = page
      .getByRole("switch", { name: /flight/i })
      .or(page.getByRole("checkbox", { name: /flight/i }))
      .or(
        page.getByRole("button", {
          name: /include flights|flight search|search flights/i,
        }),
      );
    if ((await flightConsent.count()) > 0) {
      const control = flightConsent.first();
      const pressed = await control.getAttribute("aria-pressed");
      const checked = await control.getAttribute("aria-checked");
      if (pressed !== "true" && checked !== "true") {
        await control.click();
      }
    }

    const originInput = page
      .getByLabel(/airport|flying from|origin/i)
      .or(page.getByPlaceholder(/airport|SFO|JFK/i));
    await expect(originInput.first()).toBeVisible();

    await checkNoRawEmojis(page);
    await checkNoHorizontalOverflow(page);
  });

  test("SharedTripView mounts tracked partner handoffs, Customize & book CTA, FTC disclosure, and Lucide reactions (zero raw emojis)", async ({
    page,
  }) => {
    const shareToken = process.env.E2E_SHARED_TRIP_TOKEN;
    test.skip(
      !shareToken,
      "Set E2E_SHARED_TRIP_TOKEN to test live /s/[token] route",
    );

    await page.route(/^https:\/\//, (route) =>
      route.fulfill({ contentType: "text/html", body: "Mock provider" }),
    );

    await page.goto(`${BASE_URL}/s/${shareToken}`);
    await expect(
      page
        .getByRole("link", { name: /Customize & book|Clone & customize/i })
        .first(),
    ).toBeVisible();
    await expect(
      page.getByText(/We may earn a commission/i).first(),
    ).toBeVisible();

    // Exercise Lucide reaction buttons (must contain SVG, no raw emoji)
    const reactionBtn = page
      .locator('button[aria-label*="Thumbs up"], button[aria-label*="Love"]')
      .first();
    await expect(reactionBtn).toBeVisible();
    expect(await reactionBtn.locator("svg").count()).toBeGreaterThan(0);
    await reactionBtn.click();

    // Verify partner handoff control exists on shared view and supports tracked click / _blank
    const partnerLinks = page.locator('a[target="_blank"][rel*="noopener"]');
    const partnerBtns = page.getByRole("button", {
      name: /Review on Viator|Check availability|Book|Find/i,
    });
    expect(
      (await partnerLinks.count()) + (await partnerBtns.count()),
    ).toBeGreaterThan(0);

    await checkNoRawEmojis(page);
    await checkNoHorizontalOverflow(page);
  });

  test("Owned trip detail renders Duffel return target/leg, sticky BookingsSheet, Feature #13/#14 CTAs, _blank + popup-blocked fallback, and monetized .txt/.ics exports", async ({
    page,
  }) => {
    const tripId = process.env.E2E_OWNED_TRIP_ID;
    test.skip(
      !tripId,
      "Set E2E_OWNED_TRIP_ID (with auth cookie) to test owned /trips/[id] route",
    );

    await page.route(/^https:\/\//, (route) =>
      route.fulfill({ contentType: "text/html", body: "Mock provider" }),
    );

    // /trips?duffel=... must not 404
    const duffelRedirectRes = await page.request.get(
      `${BASE_URL}/trips?duffel=return`,
    );
    expect(duffelRedirectRes.status()).toBeLessThan(400);

    await page.goto(`${BASE_URL}/trips/${tripId}`);
    await expect(page).not.toHaveURL(/\/trips\?duffel=/);

    // Verify Duffel return leg is present when flights exist on the trip
    await expect(page.getByText(/Return/i).first()).toBeVisible();

    // Scroll so stickyBookingVisible activates before asserting BookingsSheet sticky bar
    await page.evaluate(() => window.scrollTo(0, 600));
    const stickyRegion = page.getByRole("region", { name: /Booking options/i });
    await expect(stickyRegion).toBeVisible();
    await stickyRegion.getByRole("button").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");

    // Feature #13 & #14 CTAs: Activity / Hotel / Dining / BookingChecklist
    await expect(
      page.getByRole("region", { name: /Booking checklist/i }),
    ).toBeVisible();
    const externalPartnerLinks = page.locator(
      'a[target="_blank"][rel*="noopener"]',
    );
    const trackedPartnerButtons = page.getByRole("button", {
      name: /Review on Viator|Check availability|Book|Reserve|Find/i,
    });
    expect(
      (await externalPartnerLinks.count()) +
        (await trackedPartnerButtons.count()),
    ).toBeGreaterThan(0);

    // Verify _blank checkout handoff AND popup-blocked (window.open = () => null) fallback
    await page.evaluate(() => {
      const opened: Array<{ url: string; target?: string }> = [];
      (
        window as unknown as {
          __OPENED_HANDOFFS__?: Array<{ url: string; target?: string }>;
        }
      ).__OPENED_HANDOFFS__ = opened;
      window.open = ((url?: string | URL, target?: string) => {
        opened.push({ url: String(url ?? ""), target });
        return null; // Simulate popup blocker triggering same-tab fallback
      }) as typeof window.open;
    });

    const reviewBtn = page
      .getByRole("button", { name: /Review on Viator/i })
      .first();
    if ((await reviewBtn.count()) > 0 && (await reviewBtn.isEnabled())) {
      await reviewBtn.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const continueBtn = dialog.getByRole("button", {
        name: /Continue to Viator/i,
      });
      await continueBtn.click();
      await expect
        .poll(async () => {
          const opened = await page.evaluate(
            () =>
              (
                window as unknown as {
                  __OPENED_HANDOFFS__?: Array<{ url: string; target?: string }>;
                }
              ).__OPENED_HANDOFFS__?.length ?? 0,
          );
          return opened > 0 || !page.url().includes(`/trips/${tripId}`);
        })
        .toBe(true);
      await page.goto(`${BASE_URL}/trips/${tripId}`);
    }

    // Text export & ICS export MUST include https:// partner booking URLs
    const txtDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download text/i }).click();
    const txtDownload = await txtDownloadPromise;
    const txtStream = await txtDownload.createReadStream();
    const txtChunks: Buffer[] = [];
    for await (const chunk of txtStream) txtChunks.push(Buffer.from(chunk));
    const txtContent = Buffer.concat(txtChunks).toString("utf8");
    expect(txtContent).toMatch(/https:\/\/[^\s]+/);

    const icsDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: /Download calendar/i }).click();
    const icsDownload = await icsDownloadPromise;
    const icsStream = await icsDownload.createReadStream();
    const icsChunks: Buffer[] = [];
    for await (const chunk of icsStream) icsChunks.push(Buffer.from(chunk));
    const icsRaw = Buffer.concat(icsChunks).toString("utf8");
    const icsUnfolded = icsRaw.replace(/\r\n[ \t]/g, "");
    expect(icsUnfolded).toContain("BEGIN:VCALENDAR");
    expect(icsUnfolded).toMatch(/https:\/\/[^\s\\]+/);
  });
});

test.describe("Track B Tier 4: Public SEO, Tools, Legal & Brand/Contrast Audit", () => {
  test("Public marketing, /blog/[slug], /destinations/[slug], 7 tools, and legal disclosures pass affiliate, brand & contrast checks", async ({
    page,
  }) => {
    const routes = [
      "/",
      "/destinations",
      "/blog",
      "/tools/visa-checker",
      "/tools/trip-cost",
      "/tools/packing-list",
      "/tools/currency-converter",
      "/tools/best-time-to-visit",
      "/tools/travel-quiz",
      "/tools/world-map",
      "/privacy",
      "/terms",
    ];

    for (const route of routes) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`${BASE_URL}${route}`);
      await checkNoHorizontalOverflow(page);

      // Brand logo visible, no mailto: in AppStoreButtons
      await expect(page.locator('header a[href="/"]').first()).toBeVisible();
      await expect(
        page.locator('a[href^="mailto:support@faroway.ai"]'),
      ).toHaveCount(0);

      if (route === "/privacy" || route === "/terms") {
        await expect(page.getByText(/Google Maps/i).first()).toBeVisible();
        await expect(
          page.getByText(/GetYourGuide|Stay22/i).first(),
        ).toBeVisible();
      }
    }

    // Feature #16: Concrete /blog/[slug] (plus financial post if present) affiliate CTAs + FTC disclosure
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`${BASE_URL}/blog`);
    await auditContrastAndBrandTokens(page);

    const blogHrefs = await page
      .locator('a[href^="/blog/"]')
      .evaluateAll((els) =>
        Array.from(
          new Set(
            els
              .map((el) => el.getAttribute("href") || "")
              .filter(
                (href) =>
                  /^\/blog\/[^/?#]+$/.test(href) &&
                  !href.startsWith("/blog/category"),
              ),
          ),
        ),
      );
    expect(blogHrefs.length).toBeGreaterThan(0);

    const financialHref = blogHrefs.find((h) =>
      /budget|cost|money|currency|wise|insurance|card/i.test(h),
    );
    const blogTargets = financialHref
      ? Array.from(new Set([blogHrefs[0], financialHref]))
      : [blogHrefs[0]];
    for (const blogHref of blogTargets) {
      await page.goto(`${BASE_URL}${blogHref}`);
      await expect(
        page.getByText(/We may earn a commission/i).first(),
      ).toBeVisible();
      const partnerCtaCount = await page
        .locator(
          'main a[href*="stay22"], main a[href*="viator"], main a[href*="getyourguide"], main a[href*="safetywing"], main a[href*="airalo"], main a[href*="wise"], main a[target="_blank"][rel*="noopener"]',
        )
        .count();
      expect(partnerCtaCount).toBeGreaterThan(0);
    }

    // Feature #16: Concrete /destinations/[slug] contextual affiliate CTAs + FTC disclosure
    await page.goto(`${BASE_URL}/destinations`);
    const destHref = await page
      .locator('a[href^="/destinations/"]')
      .evaluateAll((els) => {
        const match = els
          .map((el) => el.getAttribute("href") || "")
          .find((href) => /^\/destinations\/[^/?#]+$/.test(href));
        return match || null;
      });
    expect(destHref).toBeTruthy();
    await page.goto(`${BASE_URL}${destHref!}`);
    await expect(
      page.getByText(/We may earn a commission/i).first(),
    ).toBeVisible();
    expect(
      await page
        .locator(
          'main a[href^="/create?destination="], main a[target="_blank"][rel*="noopener"]',
        )
        .count(),
    ).toBeGreaterThan(0);

    // Feature #16: Tool result / detail states expose contextual affiliate CTAs & FTC disclosures
    await page.goto(`${BASE_URL}/tools/visa-checker/japan`);
    await expect(
      page.getByText(/We may earn a commission/i).first(),
    ).toBeVisible();
    expect(
      await page
        .locator(
          'main a[href*="safetywing"], main a[href*="ivisa"], main a[target="_blank"][rel*="noopener"]',
        )
        .count(),
    ).toBeGreaterThan(0);

    await page.goto(`${BASE_URL}/tools/trip-cost/tokyo`);
    await expect(
      page.getByText(/We may earn a commission/i).first(),
    ).toBeVisible();
    expect(
      await page
        .locator(
          'main a[href*="stay22"], main a[href*="viator"], main a[href*="booking"], main a[target="_blank"][rel*="noopener"]',
        )
        .count(),
    ).toBeGreaterThan(0);

    await page.goto(`${BASE_URL}/tools/packing-list`);
    await expect(
      page.getByText(/We may earn a commission/i).first(),
    ).toBeVisible();
    expect(
      await page
        .locator(
          'main a[href*="airalo"], main a[href*="safetywing"], main a[target="_blank"][rel*="noopener"]',
        )
        .count(),
    ).toBeGreaterThan(0);

    await page.goto(`${BASE_URL}/tools/currency-converter`);
    await expect(
      page.getByText(/We may earn a commission/i).first(),
    ).toBeVisible();
    expect(
      await page
        .locator(
          'main a[href*="wise"], main a[target="_blank"][rel*="noopener"]',
        )
        .count(),
    ).toBeGreaterThan(0);

    // Home page WCAG AA contrast (>= 4.5 normal / >= 3.0 large), brand tokens, and zero raw emojis
    await page.goto(`${BASE_URL}/`);
    await auditContrastAndBrandTokens(page);
    await checkNoRawEmojis(page);
  });
});
