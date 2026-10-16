import { test, expect } from "@playwright/test";

test.describe("Readable server content", () => {
  test.use({ javaScriptEnabled: false });

  for (const path of ["/", "/about", "/support"]) {
    test(`${path} stays readable when scripts are unavailable`, async ({
      page,
    }) => {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      const headings = page.locator("h2, h3");
      expect(await headings.count()).toBeGreaterThan(3);
      const invisible = await headings.evaluateAll((elements) =>
        elements
          .filter((element) => {
            // Responsive decorative mockups may intentionally have no layout.
            // Opacity-hidden scroll sections still have layout and must be readable.
            if (element.getClientRects().length === 0) return false;
            for (
              let parent: Element | null = element;
              parent;
              parent = parent.parentElement
            ) {
              const style = getComputedStyle(parent);
              if (
                Number(style.opacity) === 0 ||
                style.visibility === "hidden" ||
                style.display === "none"
              )
                return true;
            }
            return false;
          })
          .map((element) => element.textContent),
      );
      expect(invisible).toEqual([]);
    });
  }

  test("support answers open by keyboard and remain independent without scripts", async ({
    page,
  }) => {
    await page.goto("/support");
    const faq = page
      .locator("details")
      .filter({ has: page.locator("summary") });
    expect(await faq.count()).toBeGreaterThan(3);
    const first = faq.first();
    await first.locator("summary").focus();
    await page.keyboard.press("Enter");
    await expect(first).toHaveAttribute("open", "");
    await expect(first.locator("p")).toBeVisible();
    const second = faq.nth(1);
    await second.locator("summary").click();
    await expect(second).toHaveAttribute("open", "");
    await expect(second.locator("p")).toBeVisible();
    await expect(first).toHaveAttribute("open", "");
    await first.locator("summary").focus();
    await page.keyboard.press("Space");
    await expect(first).not.toHaveAttribute("open", "");
  });
});

test("scroll reveals remain readable with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/about");
  const sections = page.locator('[style*="animation-delay"]');
  expect(await sections.count()).toBeGreaterThan(3);
  for (const section of await sections.all()) {
    await section.scrollIntoViewIfNeeded();
    await expect(section).toHaveCSS("opacity", "1");
    await expect(section).toHaveCSS("transform", "none");
    await expect(section).toHaveCSS("animation-name", "none");
  }
});

test("missing IntersectionObserver preserves content without a browser error", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "IntersectionObserver", {
      value: undefined,
      configurable: true,
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/about");
  const sections = page.locator('[style*="animation-delay"]');
  expect(await sections.count()).toBeGreaterThan(3);
  for (const section of await sections.all()) {
    await section.scrollIntoViewIfNeeded();
    await expect(section).toHaveCSS("opacity", "1");
  }
  expect(errors).toEqual([]);
});
