import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\//, (route) => route.abort());
  await page.setViewportSize({ width: 320, height: 700 });
});

test("currency conversion, quick amounts and swapping remain usable on a small phone", async ({
  page,
}) => {
  await page.goto("/tools/currency-converter");
  await page.getByLabel("From", { exact: true }).selectOption("USD");
  await page.getByLabel("To", { exact: true }).selectOption("EUR");
  await page.getByLabel("Amount", { exact: true }).fill("50");
  const result = page
    .getByRole("status")
    .filter({ hasText: "Planning estimate" });
  await expect(result).toContainText("50 USD =");
  await page.getByRole("button", { name: "Swap currencies" }).click();
  await expect(page.getByLabel("From", { exact: true })).toHaveValue("EUR");
  await expect(page.getByLabel("To", { exact: true })).toHaveValue("USD");
  await expect(result).toContainText("50 EUR =");
  await page.getByRole("button", { name: "€100", exact: true }).click();
  await expect(page.getByLabel("Amount", { exact: true })).toHaveValue("100");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("cost categories add up to the entire group's total and inputs survive a new estimate", async ({
  page,
}) => {
  await page.goto("/tools/trip-cost");
  await expect(
    page.getByRole("button", { name: "Calculate My Trip Cost" }),
  ).toBeDisabled();
  await page.getByLabel("Destination", { exact: true }).selectOption("paris");
  await page
    .getByRole("button", { name: "Increase number of travelers" })
    .click();
  await page.getByRole("button", { name: "Calculate My Trip Cost" }).click();
  await expect(
    page.getByRole("heading", { name: "Paris Trip Cost" }),
  ).toBeVisible();
  const breakdown = page.getByRole("region", { name: "Cost Breakdown" });
  await expect(breakdown).toContainText("all 3 travelers");
  const amounts = await breakdown
    .locator("p.text-sm.font-bold")
    .allTextContents();
  expect(amounts).toHaveLength(5);
  const categories = amounts.map((text) => Number(text.replace(/[^\d.]/g, "")));
  const totalText = await page.locator(".text-5xl.font-bold").textContent();
  const total = Number(totalText!.replace(/[^\d.]/g, ""));
  expect(
    Math.abs(categories.reduce((sum, amount) => sum + amount, 0) - total),
  ).toBeLessThanOrEqual(3);
  await page.getByRole("button", { name: "New estimate" }).click();
  await expect(page.getByLabel("Destination", { exact: true })).toHaveValue(
    "paris",
  );
  await expect(page.getByLabel("3 travelers", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("visa guidance waits for both choices and updates its destination", async ({
  page,
}) => {
  await page.goto("/tools/visa-checker");
  await page.getByLabel("Your Passport", { exact: true }).selectOption("US");
  await page.getByLabel("Destination", { exact: true }).selectOption("paris");
  await expect(
    page.getByRole("heading", { name: /United States.*Paris/ }),
  ).toBeVisible();
  await page.getByLabel("Destination", { exact: true }).selectOption("tokyo");
  await expect(
    page.getByRole("heading", { name: /United States.*Tokyo/ }),
  ).toBeVisible();
  await expect(
    page.getByText("general guidance only", { exact: false }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
