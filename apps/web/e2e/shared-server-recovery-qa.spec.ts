import { test, expect } from "@playwright/test";

// This synthetic link is read-only. QA server uses the disabled privileged-key
// sentinel, so a server database failure exercises the parent Next boundary.
test("shared server failure focuses recovery and retry remains usable", async ({
  page,
}) => {
  await page.route(/^https:\/\//, (route) => route.abort());
  await page.goto("/s/qa_read_failure_token", {
    waitUntil: "domcontentloaded",
  });
  const heading = page.getByRole("heading", {
    name: "This itinerary is taking a moment",
  });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await expect(page.getByRole("heading", { name: /not found/i })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(heading).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "Get help", exact: true }).click();
  await expect(page).toHaveURL(/\/support$/);
  await expect(
    page.getByRole("heading", { name: "This page couldn’t load" }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("help");
});
