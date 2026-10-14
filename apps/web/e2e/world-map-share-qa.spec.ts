import { test, expect } from "@playwright/test";
import LZString from "lz-string";

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\//, (route) => route.abort());
});

test("unsupported shared map offers an exit to a fresh map", async ({
  page,
}) => {
  const d = LZString.compressToEncodedURIComponent(
    JSON.stringify({ v: 99, d: [["JPN"]] }),
  );
  await page.goto(`/tools/world-map/view?d=${encodeURIComponent(d)}`);
  await expect(
    page.getByRole("heading", { name: "Couldn't read this map" }),
  ).toBeVisible();
  await expect(
    page.getByText("This link is invalid or has been truncated.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Start your own map" }).click();
  await expect(
    page.getByRole("button", { name: "Share and export" }),
  ).toBeVisible();
});

test("legacy shared map retains a real country and ignores unknown entries", async ({
  page,
}) => {
  const d = LZString.compressToEncodedURIComponent(
    JSON.stringify({
      v: 1,
      n: "Legacy traveler",
      d: [
        ["JPN", 0, "2015-03-01", 4, "Kyoto"],
        ["XXX", 4],
        ["constructor", 1],
      ],
    }),
  );
  await page.goto(`/tools/world-map/view?d=${encodeURIComponent(d)}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("1/ 197");
  await expect(
    page.getByText("Legacy traveler's World Map", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/1\/6 continents/)).toBeVisible();
  await expect(page.getByText("JPN", { exact: true })).toBeVisible();
  await expect(page.getByText("XXX", { exact: true })).toHaveCount(0);
  await expect(page).toHaveTitle(/Legacy traveler's World Map — 1 country/);
});
