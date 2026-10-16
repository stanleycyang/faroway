import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\//, (route) => route.abort());
});

test("country search explains a failed list and retries to a selectable country", async ({
  page,
}) => {
  await page.goto("/tools/world-map");
  await expect(page.locator(".rsm-geography").first()).toBeAttached();
  let calls = 0;
  await page.route("**/world-map/countries-110m.json", async (route) => {
    calls++;
    if (calls === 1)
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: "{}",
      });
    else
      await route.fulfill({
        contentType: "application/json",
        path: "public/world-map/countries-110m.json",
      });
  });
  await page
    .getByRole("button", { name: "Search countries (keyboard shortcut slash)" })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Country search" }),
  ).toContainText("Country search couldn’t load");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Search countries" })
    .fill("United States");
  await expect(
    page.getByRole("button", { name: /United States.*USA/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: /United States.*USA/ }).click();
  await expect(
    page.getByRole("heading", { name: /United States/ }),
  ).toBeVisible();
});

test("poster export recovers inline and the next attempt downloads", async ({
  page,
}) => {
  await page.goto("/tools/world-map");
  let calls = 0;
  await page.route("**/api/og/world-map?**", async (route) => {
    calls++;
    if (calls === 1) await route.fulfill({ status: 503, body: "Unavailable" });
    else
      await route.fulfill({
        contentType: "image/png",
        body: Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aB0sAAAAASUVORK5CYII=",
          "base64",
        ),
      });
  });
  await page.getByRole("button", { name: "Share and export" }).click();
  await page.getByRole("button", { name: /Landscape/ }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Your poster" }),
  ).toContainText("Your poster couldn’t download");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: /Square.*Instagram feed/ }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(
    /^world-map-square-\d{4}-\d{2}-\d{2}\.png$/,
  );
  expect(calls).toBe(2);
  await expect(page.locator("#world-map-export-menu")).toBeHidden();
});
