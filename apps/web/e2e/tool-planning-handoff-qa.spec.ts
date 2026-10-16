import { test, expect } from "@playwright/test";

for (const path of [
  "/tools/trip-cost/tokyo",
  "/tools/visa-checker/tokyo",
  "/tools/best-time-to-visit/tokyo",
]) {
  test(`${path} carries its destination into planning`, async ({ page }) => {
    await page.route(/^https:\/\//, (route) => route.abort());
    await page.goto(path);
    const action = page.getByRole("link", {
      name: "Start planning",
      exact: true,
    });
    await expect(action).toHaveAttribute("href", "/create?destination=Tokyo");
    await action.click();
    await expect(page).toHaveURL(/\/create\?destination=Tokyo$/);
    const selected = page.getByRole("region", { name: "Choose destination" });
    await expect(
      selected.getByRole("heading", { name: "Tokyo", exact: true }),
    ).toBeVisible();
    await expect(
      selected.getByRole("button", { name: "Change", exact: true }),
    ).toBeVisible();
  });
}

test("a generated packing list keeps its destination when planning begins", async ({
  page,
}) => {
  await page.route(/^https:\/\//, (route) => route.abort());
  await page.goto("/tools/packing-list");
  await page.getByLabel("Where are you going?").selectOption("tokyo");
  await page.getByRole("button", { name: "Beach", exact: false }).click();
  await page.getByRole("button", { name: "Generate My Packing List" }).click();
  await page.getByRole("link", { name: "Start planning", exact: true }).click();
  await expect(page).toHaveURL(/\/create\?destination=Tokyo$/);
  await expect(
    page
      .getByRole("region", { name: "Choose destination" })
      .getByRole("heading", { name: "Tokyo", exact: true }),
  ).toBeVisible();
});

test("destination discovery preserves the chosen city from guide to planner", async ({
  page,
}) => {
  await page.route(/^https:\/\//, (route) => route.abort());
  await page.goto("/destinations");
  await page.locator('a[href="/destinations/paris"]').first().click();
  await expect(
    page.getByRole("heading", { name: "Paris", exact: true, level: 1 }),
  ).toBeVisible();
  const action = page.getByRole("link", {
    name: "Plan My Paris Trip",
    exact: true,
  });
  await expect(action).toHaveAttribute("href", "/create?destination=Paris");
  await action.click();
  await expect(page).toHaveURL(/\/create\?destination=Paris$/);
  await expect(
    page
      .getByRole("region", { name: "Choose destination" })
      .getByRole("heading", { name: "Paris", exact: true }),
  ).toBeVisible();
});
