import { test, expect } from "@playwright/test";

const reportPath = "/report?type=shared_trip&token=synthetic_report_token";

test("a stalled report recovers with its details intact and ignores a late confirmation", async ({
  page,
}) => {
  test.setTimeout(40_000);
  let release = () => {};
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/content-reports", async (route) => {
    await wait;
    await route
      .fulfill({ status: 200, json: { success: true } })
      .catch(() => {});
  });
  try {
    await page.goto(reportPath);
    await page
      .getByLabel("Details", { exact: true })
      .fill("These details must survive a timeout.");
    await page
      .getByRole("button", { name: "Submit Report", exact: true })
      .click();
    await expect(page.locator("form").getByRole("alert")).toContainText(
      "took too long",
      { timeout: 25_000 },
    );
    await expect(page.getByLabel("Details", { exact: true })).toHaveValue(
      "These details must survive a timeout.",
    );
    await expect(
      page.getByRole("button", { name: "Submit Report", exact: true }),
    ).toBeEnabled();
    release();
    await expect(
      page.getByRole("status").filter({ hasText: "Thanks." }),
    ).toHaveCount(0);
  } finally {
    release();
  }
});

test("report freezes its submitted details, blocks duplicate dispatch and focuses confirmation", async ({
  page,
}) => {
  let release = () => {};
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const payloads: unknown[] = [];
  await page.route("**/api/content-reports", async (route) => {
    payloads.push(route.request().postDataJSON());
    await wait;
    await route.fulfill({ status: 200, json: { success: true } });
  });
  await page.goto(reportPath);
  await page.getByLabel("Reason", { exact: true }).selectOption("privacy");
  await page
    .getByLabel("Details", { exact: true })
    .fill("The plan contains private information.");
  await page
    .getByLabel("Email", { exact: true })
    .fill("reporter@example.invalid");
  await page
    .getByRole("button", { name: "Submit Report", exact: true })
    .click();
  await expect(page.getByLabel("Details", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Reason", { exact: true })).toBeDisabled();
  await expect(page.getByLabel("Email", { exact: true })).toBeDisabled();
  await page.locator("form").evaluate((form) => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  expect(payloads).toHaveLength(1);
  expect(payloads[0]).toMatchObject({
    reason: "privacy",
    details: "The plan contains private information.",
    reporterEmail: "reporter@example.invalid",
    token: "synthetic_report_token",
  });
  release();
  const confirmation = page.getByRole("status").filter({ hasText: "Thanks." });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toBeFocused();
});

for (const response of [
  {
    name: "server rejection",
    status: 500,
    body: { error: "Reports are temporarily unavailable." },
  },
  { name: "unconfirmed success", status: 200, body: {} },
]) {
  test(`report keeps details after ${response.name} and allows a deliberate retry`, async ({
    page,
  }) => {
    let requests = 0;
    await page.route("**/api/content-reports", (route) => {
      requests++;
      return route.fulfill({
        status: requests === 1 ? response.status : 200,
        json: requests === 1 ? response.body : { success: true },
      });
    });
    await page.goto(reportPath);
    await page
      .getByLabel("Details", { exact: true })
      .fill("Keep these report details.");
    await page
      .getByRole("button", { name: "Submit Report", exact: true })
      .click();
    await expect(page.locator("form").getByRole("alert")).toBeVisible();
    await expect(page.getByLabel("Details", { exact: true })).toHaveValue(
      "Keep these report details.",
    );
    await expect(page.getByLabel("Details", { exact: true })).toBeEnabled();
    await page
      .getByRole("button", { name: "Submit Report", exact: true })
      .click();
    await expect(
      page.getByRole("status").filter({ hasText: "Thanks." }),
    ).toBeVisible();
    expect(requests).toBe(2);
  });
}

test("invalid report links explain how to reopen the report without dispatching", async ({
  page,
}) => {
  let writes = 0;
  await page.route("**/api/content-reports", (route) => {
    writes++;
    return route.abort();
  });
  await page.goto("/report?type=shared_trip&token=bad");
  await expect(
    page.getByText("Open this page from a shared itinerary report link", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Submit Report", exact: true }),
  ).toHaveCount(0);
  expect(writes).toBe(0);
});
