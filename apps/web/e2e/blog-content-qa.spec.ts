import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  test.skip(
    !process.env.E2E_BLOG_FIXTURE_SLUG,
    "Requires a published synthetic article in an independently verified, read-only staging project.",
  );
  await page.route("**/api/blog/views", (route) =>
    route.fulfill({ status: 204 }),
  );
});

test("featured story stays inside its card on a small phone and opens the published article", async ({
  page,
  request,
}) => {
  // Compile the dynamic route before measuring browser navigation in dev.
  const article = await request.get(
    `/blog/${process.env.E2E_BLOG_FIXTURE_SLUG}`,
  );
  expect(article.ok()).toBe(true);
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/blog");
  const story = page
    .locator(`article`)
    .filter({
      has: page.locator(`a[href="/blog/${process.env.E2E_BLOG_FIXTURE_SLUG}"]`),
    })
    .first();
  const title = story.getByRole("heading", { level: 2 });
  await expect(title).toBeVisible();
  const cardBounds = await story.boundingBox();
  const titleBounds = await title.boundingBox();
  expect(titleBounds!.y).toBeGreaterThanOrEqual(cardBounds!.y);
  expect(titleBounds!.y + titleBounds!.height).toBeLessThanOrEqual(
    cardBounds!.y + cardBounds!.height,
  );
  await expect(story.locator("img")).toHaveJSProperty("complete", true);
  expect(
    await story
      .locator("img")
      .evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const name = await title.textContent();
  await story.getByRole("link").click();
  await expect(page).toHaveURL(
    new RegExp(`/blog/${process.env.E2E_BLOG_FIXTURE_SLUG}$`),
  );
  await expect(
    page
      .getByRole("heading", { level: 1, name: name!.trim(), exact: true })
      .first(),
  ).toBeVisible();
});

test("newsletter locks the submitted address and confirms the saved subscription without promising an unsent email", async ({
  page,
}) => {
  let release: () => void = () => undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const emails: string[] = [];
  await page.route("**/api/blog/newsletter", async (route) => {
    emails.push(route.request().postDataJSON().email);
    await pending;
    await route.fulfill({ status: 200, json: { success: true } });
  });
  await page.goto("/blog");
  const input = page.getByRole("textbox", { name: "Email address" });
  await input.fill("reader@example.invalid");
  await page.getByRole("button", { name: "Subscribe Free" }).click();
  await expect(input).toBeDisabled();
  await page
    .locator("form")
    .evaluate((form) =>
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
  await expect.poll(() => emails.length).toBe(1);
  release();
  const result = page
    .getByRole("status")
    .filter({ hasText: "You’re subscribed" });
  await expect(result).toBeFocused();
  await expect(result).toContainText("reader@example.invalid");
  await expect(page.getByText("welcome email", { exact: false })).toHaveCount(
    0,
  );
});

test("newsletter failure preserves the address and supports an explicit retry", async ({
  page,
}) => {
  let attempts = 0;
  await page.route("**/api/blog/newsletter", (route) => {
    attempts++;
    return route.fulfill({
      status: attempts === 1 ? 503 : 200,
      json: { success: attempts > 1 },
    });
  });
  await page.goto("/blog");
  const input = page.getByRole("textbox", { name: "Email address" });
  await input.fill("reader@example.invalid");
  await page.getByRole("button", { name: "Subscribe Free" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "couldn’t confirm your subscription" }),
  ).toBeVisible();
  await expect(input).toHaveValue("reader@example.invalid");
  await page.getByRole("button", { name: "Subscribe Free" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "You’re subscribed" }),
  ).toBeVisible();
  expect(attempts).toBe(2);
});

test("a broken cover switches to the local illustration without hiding the story", async ({
  page,
}) => {
  const errors: string[] = [];
  let injected = 0;
  let brokenImageRequests = 0;
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("missing-cover-for-qa.png"))
      brokenImageRequests++;
  });
  // Change this browser's category RSC data, preserving the real document's
  // startup and network origin. No application or database records are changed.
  await page.route("**/blog/category/travel-tips?**", async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const replacement = body.replaceAll(
      "/images/journal-cover.svg",
      "/images/missing-cover-for-qa.png",
    );
    if (replacement !== body) injected++;
    const headers = response.headers();
    for (const name of [
      "content-length",
      "content-encoding",
      "transfer-encoding",
    ])
      delete headers[name];
    await route.fulfill({
      status: response.status(),
      headers,
      body: replacement,
    });
  });
  await page.goto("/blog");
  await expect(
    page.getByRole("button", { name: "Subscribe Free" }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "Travel Tips", exact: true }).click();
  await expect(page).toHaveURL(/\/blog\/category\/travel-tips$/);
  await expect.poll(() => injected).toBeGreaterThan(0);
  await expect.poll(() => brokenImageRequests).toBeGreaterThan(0);
  const story = page.locator("article").first();
  const image = story.locator("img").first();
  await expect(image).toHaveAttribute("src", /\/images\/journal-cover\.svg$/);
  expect(new URL((await image.getAttribute("src"))!, page.url()).origin).toBe(
    new URL(page.url()).origin,
  );
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await expect(story.getByRole("heading")).toBeVisible();
  expect(errors).toEqual([]);
});

test("category navigation keeps the published story accessible and returns to the journal", async ({
  page,
}) => {
  await page.goto("/blog");
  await page.getByRole("link", { name: "Travel Tips", exact: true }).click();
  await expect(page).toHaveURL(/\/blog\/category\/travel-tips$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Travel Tips",
  );
  await expect(
    page
      .locator(`a[href="/blog/${process.env.E2E_BLOG_FIXTURE_SLUG}"]`)
      .first(),
  ).toBeVisible();
  await page.getByRole("link", { name: "All", exact: true }).click();
  await expect(page).toHaveURL(/\/blog$/);
  await expect(
    page.getByRole("heading", { name: "Travel Blog", exact: true }),
  ).toBeVisible();
});
