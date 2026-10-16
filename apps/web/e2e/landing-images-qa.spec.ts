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

test("planner photos recover across selected destination, recommendations and summary", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.route("**/_next/image?**", (route) => route.abort());
  await page.goto("/create?destination=Tokyo", {
    waitUntil: "domcontentloaded",
  });
  const selected = page.getByRole("region", { name: "Choose destination" });
  const tokyo = selected.getByRole("img", {
    name: "Illustrated travel route for Tokyo",
  });
  await expect(tokyo).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(() =>
      tokyo.evaluate((node) => (node as HTMLImageElement).naturalWidth),
    )
    .toBeGreaterThan(0);
  const summary = page.getByRole("complementary", {
    name: "Your trip summary",
  });
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    await expect(summary).toBeVisible();
    const cover = summary.getByRole("img", {
      name: "Illustrated travel route for Tokyo",
    });
    await expect(cover).toBeVisible();
    await expect
      .poll(() =>
        cover.evaluate((node) => (node as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
  } else {
    await expect(summary).toBeHidden();
  }
  await selected.getByRole("button", { name: "Change", exact: true }).click();
  const paris = selected.getByRole("button", { name: "Select Paris, France" });
  await paris.scrollIntoViewIfNeeded();
  const recommendation = paris.getByRole("img", {
    name: "Illustrated travel route for Paris",
  });
  await expect(recommendation).toBeVisible();
  await expect
    .poll(() =>
      recommendation.evaluate(
        (node) => (node as HTMLImageElement).naturalWidth,
      ),
    )
    .toBeGreaterThan(0);
  await paris.click();
  await expect(
    selected.getByRole("heading", { name: "Paris", exact: true }),
  ).toBeVisible();
  await expect(
    selected.getByRole("img", {
      name: "Illustrated travel route for Paris",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Select start date" }),
  ).toBeEnabled();
});
