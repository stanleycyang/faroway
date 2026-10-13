/**
 * Marketing pages E2E — verifies critical public pages load correctly
 * and have the right SEO elements.
 */
import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("renders hero and CTA", async ({ page }) => {
    await page.goto("/");
    // Main heading visible
    await expect(page.locator("h1").first()).toBeVisible();
    // At least one visible CTA button/link to /create (not hidden sm:inline-flex nav items)
    const ctaLink = page
      .locator('a[href*="/create"]:visible, button:visible')
      .first();
    await expect(ctaLink).toBeVisible();
  });

  test("has correct OG meta tags", async ({ page }) => {
    await page.goto("/");
    const ogTitle = page.locator('meta[property="og:title"]');
    await expect(ogTitle).toHaveAttribute("content", /Faroway/);
    const ogImage = page.locator('meta[property="og:image"]');
    await expect(ogImage).toHaveAttribute("content", /\/api\/og/);
  });
});

test.describe("Legal pages", () => {
  test("privacy policy is accessible", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page).toHaveTitle(/Privacy/i);
  });

  test("terms of service is accessible", async ({ page }) => {
    await page.goto("/terms");
    await expect(page.locator("h1").first()).toBeVisible();
    await expect(page).toHaveTitle(/Terms/i);
  });

  test("support page is accessible", async ({ page }) => {
    await page.goto("/support");
    await expect(page.locator("h1").first()).toBeVisible();
  });
});

test.describe("Trip creation page", () => {
  test("loads destination search UI", async ({ page }) => {
    await page.goto("/create");
    // Should have a text input for destination search
    const input = page
      .locator(
        'input[type="text"], input[placeholder*="destina" i], input[placeholder*="where" i]',
      )
      .first();
    await expect(input).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Blog", () => {
  test("blog index loads", async ({ page }) => {
    const browserErrors: string[] = [];
    page.on("console", (message) => {
      const isExpectedDevelopmentCspError = message
        .text()
        .includes("eval() is not supported in this environment");
      if (message.type() === "error" && !isExpectedDevelopmentCspError) {
        browserErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      browserErrors.push(error.message);
    });

    await page.goto("/blog");
    await expect(page.locator("h1, h2").first()).toBeVisible();
    expect(browserErrors).toEqual([]);
  });
});

test.describe("Tools", () => {
  test("world map tool loads", async ({ page }) => {
    await page.goto("/tools/world-map");
    await expect(
      page.locator("h1, h2, [data-testid='world-map']").first(),
    ).toBeVisible({
      timeout: 15_000,
    });
  });
});

test("trip brief preserves choices through edits, reload and sign-in", async ({
  page,
}) => {
  // Flow assertions do not depend on remote photography; visual tests cover it.
  await page.route("**/_next/image?*", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN3sAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
  await page.goto("/create", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".trip-planner")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(
    page.getByRole("button", {
      name: "Sign in & generate itinerary",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Select Paris, France", exact: true })
    .click();

  await expect(
    page
      .getByRole("region", { name: "Choose destination" })
      .getByRole("heading", { name: "Paris", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: "Trip dates" })).toBeVisible();
  await page
    .getByRole("button", { name: "Select start date", exact: true })
    .click();
  const start = new Date();
  start.setDate(start.getDate() + 14);
  const end = new Date(start);
  end.setDate(end.getDate() + 4);
  const dateName = (date: Date) =>
    new RegExp(
      `${date.toLocaleString("en-US", { month: "long" })} ${date.getDate()}(?:st|nd|rd|th), ${date.getFullYear()}`,
    );
  await page
    .getByRole("dialog")
    .getByRole("button", { name: dateName(start) })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: dateName(end) })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Confirm dates", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Increase travelers", exact: true })
    .click();

  for (const name of [
    "Adventure",
    "Relaxation",
    "Cultural",
    "Foodie",
    "Nature",
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
  }
  await expect(
    page.getByRole("button", { name: "Shopping", exact: true }),
  ).toBeDisabled();

  await expect(page.getByRole("region", { name: "Travelers" })).toContainText(
    "3",
  );
  await expect(
    page.getByRole("button", { name: "Select start date", exact: true }),
  ).toHaveCount(0);

  await expect(
    page.getByRole("button", { name: "Adventure", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", {
      name: "Sign in & generate itinerary",
      exact: true,
    }),
  ).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Luxury Exceptional stays", exact: true })
    .click();
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await page.getByRole("button", { name: "Keep Paris", exact: true }).click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("region", { name: "Choose destination" }),
  ).toContainText("Paris");
  await expect(
    page.getByRole("button", { name: "Adventure", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Luxury Exceptional stays", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  // Optional hotel details can be edited without losing the rest of the brief.
  await page.getByText("Hotel search preferences", { exact: false }).click();
  await page.getByRole("checkbox").check();
  await expect(
    page.getByRole("button", {
      name: "Sign in & generate itinerary",
      exact: true,
    }),
  ).toBeDisabled();

  await page.getByRole("checkbox").uncheck();
  // Exercise the draft handoff without contacting an authentication provider.
  await page.route("**/auth/login?**", (route) =>
    route.fulfill({ contentType: "text/html", body: "<h1>Sign in</h1>" }),
  );
  await page
    .getByRole("button", { name: "Sign in & generate itinerary", exact: true })
    .click();
  await expect(page).toHaveURL(/\/auth\/login\?redirectTo=/);
  const returnPath = new URL(page.url()).searchParams.get("redirectTo")!;
  const draftId = new URL(returnPath, page.url()).searchParams.get("draft")!;
  expect(
    await page.evaluate(
      (id) =>
        JSON.parse(localStorage.getItem(`faroway-create-draft:${id}`)!).draft
          .budget,
      draftId,
    ),
  ).toBe("luxury");
  await page.goto(returnPath, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "What’s your travel vibe?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Adventure", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", {
      name: "Sign in & generate itinerary",
      exact: true,
    }),
  ).toBeEnabled();
});

test("calendar behaves as a sheet on a small phone and restores focus", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto("/create?destination=paris");
  await page
    .getByRole("button", { name: "Select start date", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Select dates" });
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBe(0);
  expect(bounds!.y + bounds!.height).toBeCloseTo(568, 0);
  expect(await page.evaluate(() => document.body.style.overflow)).toBe(
    "hidden",
  );
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Select start date", exact: true }),
  ).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).toBe("");
  const action = await page
    .getByRole("button", { name: "Sign in & generate itinerary", exact: true })
    .boundingBox();
  expect(action!.y + action!.height).toBeLessThanOrEqual(568);
});
