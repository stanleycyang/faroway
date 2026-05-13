/**
 * Marketing pages E2E — verifies critical public pages load correctly
 * and have the right SEO elements.
 */
import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders hero and CTA", async ({ page }) => {
    await page.goto("/");
    // Main heading visible
    await expect(page.locator("h1").first()).toBeVisible();
    // At least one CTA button/link to /create
    const ctaLink = page.locator('a[href*="/create"], button').first();
    await expect(ctaLink).toBeVisible();
  });

  test("has correct OG meta tags", async ({ page }) => {
    await page.goto("/");
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute("content", /Faroway/);
    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute("content", /\/api\/og/);
  });
});

test.describe("Legal pages", () => {
  test("privacy policy is accessible", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page).toHaveTitle(/Privacy/i);
  });

  test("terms of service is accessible", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page).toHaveTitle(/Terms/i);
  });

  test("support page is accessible", async ({ page }) => {
    await page.goto("/support");
    await expect(page.locator("h1").first()).toBeVisible();
  });
});

test.describe("Trip creation page", () => {
  test("loads destination search UI", async ({ page }) => {
    await page.goto("/create");
    // Should have a text input for destination search
    const input = page
      .locator('input[type="text"], input[placeholder*="destina" i], input[placeholder*="where" i]')
      .first();
    await expect(input).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Blog", () => {
  test("blog index loads", async ({ page }) => {
    await page.goto("/blog");
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });
});

test.describe("Tools", () => {
  test("world map tool loads", async ({ page }) => {
    await page.goto("/tools/world-map");
    await expect(page.locator("h1, h2, [data-testid='world-map']").first()).toBeVisible({
      timeout: 15_000,
    });
  });
});
