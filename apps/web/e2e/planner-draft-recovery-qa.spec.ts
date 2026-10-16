import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\//, (route) => route.abort());
});

test("corrupted draft choices recover without permitting reversed dates", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "faroway-create-editor-draft",
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        draft: {
          selectedPlace: { name: "Kyoto", source: "user" },
          startDate: "2026-11-04",
          endDate: "2026-11-01",
          travelers: 1.5,
          travelerType: "invalid",
          selectedVibes: ["foodie", "foodie", {}, "invalid", "nature"],
          showAdvanced: "false",
        },
      }),
    ),
  );
  await page.goto("/create");
  await expect(
    page
      .getByRole("region", { name: "Travelers", exact: true })
      .getByRole("button", { name: "Couple", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("2 of 5 interests selected")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nov 4, 2026", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Select end date", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: "Sign in & generate itinerary",
      exact: true,
    }),
  ).toBeDisabled();
});

test("valid calendar draft restores the exact dates and permits sign-in continuation", async ({
  page,
}) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      "faroway-create-editor-draft",
      JSON.stringify({
        version: 1,
        savedAt: Date.now(),
        draft: {
          selectedPlace: { name: "Kyoto", source: "user" },
          startDate: "2026-11-01",
          endDate: "2026-11-04",
          travelers: 3,
          travelerType: "friends",
          selectedVibes: ["foodie"],
        },
      }),
    ),
  );
  await page.goto("/create");
  await expect(
    page.getByRole("button", { name: "Nov 1, 2026", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Nov 4, 2026", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Travelers", exact: true })
      .getByRole("button", { name: "Friends", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", {
      name: "Sign in & generate itinerary",
      exact: true,
    }),
  ).toBeEnabled();
});
