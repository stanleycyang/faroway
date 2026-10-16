import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\//, (route) => route.abort());
  await page.goto("/tools/world-map");
  await expect(page.locator(".rsm-geography").first()).toBeVisible();
  await page.clock.install();
});

test("panning a country cancels its touch long press", async ({ page }) => {
  // Load the lazy drawer first so a negative assertion cannot pass while its
  // JavaScript is still arriving after an accidental long press.
  const warmupCountry = page.locator(".rsm-geography").first();
  await warmupCountry.dispatchEvent("contextmenu", { bubbles: true });
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const country = page.locator(".rsm-geography").first();
  await country.dispatchEvent("pointerdown", {
    pointerType: "touch",
    pointerId: 1,
    clientX: 100,
    clientY: 100,
    bubbles: true,
  });
  await country.dispatchEvent("pointermove", {
    pointerType: "touch",
    pointerId: 1,
    clientX: 125,
    clientY: 100,
    bubbles: true,
  });
  await page.clock.runFor(600);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await country.dispatchEvent("pointerup", {
    pointerType: "touch",
    pointerId: 1,
    bubbles: true,
  });
});

test("a stationary touch opens country details and closing restores keyboard access", async ({
  page,
}) => {
  const country = page.locator(".rsm-geography").first();
  await country.dispatchEvent("pointerdown", {
    pointerType: "touch",
    pointerId: 1,
    clientX: 100,
    clientY: 100,
    bubbles: true,
  });
  await page.clock.runFor(600);
  await expect(page.getByRole("dialog")).toBeVisible();
  await country.dispatchEvent("pointerup", {
    pointerType: "touch",
    pointerId: 1,
    bubbles: true,
  });
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.clock.runFor(50);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByLabel("Search countries (keyboard shortcut slash)"),
  ).toBeFocused();
});
