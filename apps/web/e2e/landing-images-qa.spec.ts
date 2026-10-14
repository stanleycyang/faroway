import { test, expect } from "@playwright/test";

test("unavailable landing photos load a local illustration with accurate accessible text", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.route("**/_next/image?**", (route) => route.abort());
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const image = page
    .locator('img[alt="Illustrated travel route"]:visible')
    .first();
  await expect(image).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(() => image.evaluate((node) => (node as HTMLImageElement).src))
    .toBe(new URL("/images/journal-cover.svg", page.url()).href);
  await expect
    .poll(() =>
      image.evaluate((node) => (node as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page.getByRole("link", { name: /plan my trip/i }).first(),
  ).toBeVisible();
});
