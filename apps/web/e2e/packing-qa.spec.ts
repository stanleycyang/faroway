import { test, expect, type Page } from "@playwright/test";

async function generate(page: Page, destination?: string) {
  const picker = page.getByLabel("Where are you going?");
  const slug =
    destination ??
    (await picker.locator("option").nth(1).getAttribute("value"));
  await picker.selectOption(slug!);
  await page.getByRole("button", { name: "Beach", exact: false }).click();
  await page.getByRole("button", { name: "Generate My Packing List" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "progress saves" }),
  ).toBeVisible();
  return slug!;
}

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\//, (route) => route.abort());
});

test("packing progress restores by destination without leaking into another list", async ({
  page,
}) => {
  await page.goto("/tools/packing-list");
  const slugs = await page
    .getByLabel("Where are you going?")
    .locator("option")
    .evaluateAll((options) =>
      options.slice(1, 3).map((option) => (option as HTMLOptionElement).value),
    );
  await generate(page, slugs[0]);
  const firstItem = page
    .getByRole("button", { pressed: false })
    .filter({ hasText: "Essential" })
    .first();
  await firstItem.click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "1",
  );
  await page.getByRole("button", { name: "New list" }).click();
  await generate(page, slugs[1]);
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await page.getByRole("button", { name: "New list" }).click();
  await generate(page, slugs[0]);
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "1",
  );
  await page.reload();
  await generate(page, slugs[0]);
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "1",
  );
});

test("malformed and obsolete saved packing items cannot crash or inflate progress", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tools/packing-list");
  const slug = await page
    .getByLabel("Where are you going?")
    .locator("option")
    .nth(1)
    .getAttribute("value");
  for (const saved of [
    "{}",
    "not json",
    JSON.stringify(["obsolete:item", 42, null]),
  ]) {
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
      key: `packing-${slug}-beach`,
      value: saved,
    });
    await generate(page, slug!);
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "0",
    );
    await page
      .getByRole("button", { pressed: false })
      .filter({ hasText: "Essential" })
      .first()
      .click();
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    await page.getByRole("button", { name: "New list" }).click();
  }
  expect(errors).toEqual([]);
});

test("denied browser storage keeps the checklist usable and explains that progress is temporary", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = function () {
      throw new DOMException("Denied", "SecurityError");
    };
    Storage.prototype.setItem = function () {
      throw new DOMException("Denied", "SecurityError");
    };
  });
  await page.goto("/tools/packing-list");
  const picker = page.getByLabel("Where are you going?");
  await picker.selectOption(
    (await picker.locator("option").nth(1).getAttribute("value")) as string,
  );
  await page.getByRole("button", { name: "Beach", exact: false }).click();
  await page.getByRole("button", { name: "Generate My Packing List" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "cannot save" }),
  ).toBeVisible();
  await page
    .getByRole("button", { pressed: false })
    .filter({ hasText: "Essential" })
    .first()
    .click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "1",
  );
});
