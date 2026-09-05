import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

// Run the actual Expo checkout helper in real browser engines. Native APIs and
// tracking transport are isolated; no partner or production request is made.
// Native Alert.alert deliberately does nothing, as react-native-web does.
async function installCheckoutHarness(page: Page) {
  const source = await readFile(
    path.resolve(process.cwd(), "../mobile/lib/affiliateCheckout.ts"),
    "utf8",
  );
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  await page.context().route("https://affiliate-checkout.test/**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<h1>Tracked booking handoff</h1>",
    }),
  );
  await page.setContent('<button id="book">Book hotel</button>');
  await page.addScriptTag({
    content: `(() => {
    const exports = {};
    const dependencies = {
      'react-native': { Platform: { OS: 'web' }, Alert: { alert() {} } },
      '../services/api': {
        isAllowedAffiliateUrl: () => true,
        openAffiliateLink: () => { throw new Error('Web must not await native POST tracking'); }
      },
      '../utils/haptics': { hapticFeedback: { light() {}, warning() {} } },
      '../constants/api': { API_BASE_URL: 'https://affiliate-checkout.test' }
    };
    const require = (name) => {
      if (!(name in dependencies)) throw new Error('Unexpected dependency: ' + name);
      return dependencies[name];
    };
    ${compiled}
    document.getElementById('book').onclick = () => exports.confirmAndOpenAffiliateLink({
      itemType: 'hotel', itemId: 'hotel-1', itemName: 'Test Hotel',
      affiliatePartner: 'booking', affiliateUrl: 'https://www.booking.com/hotel/test.html',
      source: 'itinerary', price: 240, currency: 'USD', priceLabel: '$240'
    }, (url) => window.open(url, '_blank', 'noopener,noreferrer'));
  })();`,
  });
}

test("Expo web booking confirmation opens a tracked tab after acceptance", async ({
  page,
}) => {
  await installCheckoutHarness(page);
  page.once("dialog", async (dialog) => {
    expect(dialog.type()).toBe("confirm");
    expect(dialog.message()).toContain("Faroway may earn a commission");
    expect(dialog.message()).toContain("Continue to Booking.com?");
    await dialog.accept();
  });
  const opening = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Book hotel" }).click();
  const popup = await opening;
  await expect(
    popup.getByRole("heading", { name: "Tracked booking handoff" }),
  ).toBeVisible();
  const url = new URL(popup.url());
  expect(url.pathname).toBe("/api/track/click");
  expect(url.searchParams.get("affiliateUrl")).toBe(
    "https://www.booking.com/hotel/test.html",
  );
  expect(url.searchParams.get("itemId")).toBe("hotel-1");
  expect(url.searchParams.get("currency")).toBe("USD");
  expect(url.searchParams.has("priceLabel")).toBe(false);
});

test("Expo web booking confirmation cancellation leaves the trip open", async ({
  page,
}) => {
  await installCheckoutHarness(page);
  page.once("dialog", (dialog) => dialog.dismiss());
  const requests: string[] = [];
  page.context().on("request", (request) => requests.push(request.url()));
  await page.getByRole("button", { name: "Book hotel" }).click();
  expect(page.context().pages()).toHaveLength(1);
  expect(requests).toEqual([]);
  await expect(page.getByRole("button", { name: "Book hotel" })).toBeVisible();
});
