import { test, expect } from "@playwright/test";

test("landing remains visually complete when configured storage photos are unavailable", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  const images = page.locator("img");
  await expect(images.first()).toBeAttached();
  const count = await images.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const image = images.nth(i);
    if (!(await image.isVisible())) continue;
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(
        () => image.evaluate((node) => (node as HTMLImageElement).naturalWidth),
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);
    if ((await image.getAttribute("src")) === "/images/journal-cover.svg") {
      await expect(image).toHaveAttribute("alt", "Illustrated travel route");
    }
  }
  await page.getByRole("heading", { level: 1 }).scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("link", { name: /plan my trip/i }).first(),
  ).toBeVisible();
});
