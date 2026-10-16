import { test, expect } from "@playwright/test";

test("unavailable blog content gives contextual recovery and an accessible destination alternative", async ({
  page,
}) => {
  test.skip(
    process.env.E2E_BLOG_DATA_UNAVAILABLE !== "true",
    "Requires an explicitly isolated server with unavailable content data.",
  );
  await page.goto("/blog");
  const heading = page.getByRole("heading", {
    name: "Stories are taking a moment.",
  });
  await expect(heading).toBeFocused();
  await expect(
    page.getByText("Our travel stories aren’t loading right now.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(heading).toBeVisible();
  await page
    .getByRole("link", { name: "Explore destinations", exact: true })
    .click();
  await expect(page).toHaveURL(/\/destinations$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
