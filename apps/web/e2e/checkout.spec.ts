import { test, expect, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

let server: Server;
let fixtureUrl: string;
let directory: string;
const attemptId = "00000000-0000-4000-8000-000000000002";
const redirect = `https://www.viator.com/tours/Paris/Walk/d479-123P1?pid=P12345678&mcid=42383&medium=api&campaign=checkout-${attemptId}`;

test.beforeAll(async () => {
  directory = mkdtempSync(path.join(tmpdir(), "faroway-checkout-ui-"));
  const output = path.join(directory, "checkout.js");
  execFileSync("bun", [
    "build",
    "e2e/fixtures/checkout.tsx",
    "--target=browser",
    `--outfile=${output}`,
  ]);
  const bundle = readFileSync(output);
  const css = (
    await postcss([tailwind()]).process(
      readFileSync("app/globals.css", "utf8"),
      { from: path.resolve("app/globals.css") },
    )
  ).css;
  server = createServer((request, response) => {
    if (request.url === "/checkout.css") {
      response.setHeader("Content-Type", "text/css");
      response.end(css);
    } else if (request.url === "/checkout.js") {
      response.setHeader("Content-Type", "application/javascript");
      response.end(bundle);
    } else {
      response.setHeader("Content-Type", "text/html");
      response.end(
        '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/checkout.css"></head><body><div id="root"></div><script src="/checkout.js"></script></body></html>',
      );
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("No fixture port");
  fixtureUrl = `http://127.0.0.1:${address.port}`;
});
test.afterAll(async () => {
  if (server)
    await new Promise<void>((resolve) => server.close(() => resolve()));
  if (directory) rmSync(directory, { recursive: true, force: true });
});

async function mockHistory(
  page: Page,
  options: { enabled?: boolean; saved?: boolean; fail?: boolean } = {},
) {
  const posts: Array<Record<string, string>> = [];
  await page.route("**/api/trips/*/checkout", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: {
          enabled: options.enabled !== false,
          attempts: options.saved
            ? [
                {
                  id: `checkout-${attemptId}`,
                  item_id: "activity_v_123P1@2099-06-01",
                  item_name: "Paris walking tour",
                  clicked_at: "2099-01-01",
                },
              ]
            : [],
        },
      });
    } else {
      const body = route.request().postDataJSON();
      posts.push(body);
      await route.fulfill(
        options.fail
          ? {
              status: 503,
              json: { error: "Could not save this booking step." },
            }
          : {
              json: {
                redirectUrl: redirect.replace(attemptId, body.attemptId),
                status: "handoff_prepared",
              },
            },
      );
    }
  });
  // Never contact the provider, even if the UI navigates successfully.
  await page.route(/^https:\/\//, (route) =>
    route.fulfill({ contentType: "text/html", body: "Mock provider checkout" }),
  );
  await page.goto(fixtureUrl);
  return posts;
}

test("requires explicit handoff consent and handles Escape with restored focus", async ({
  page,
}) => {
  const posts = await mockHistory(page);
  const button = page.getByRole("button", { name: "Review experience" });
  await button.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByText("Continuing does not reserve", { exact: false }),
  ).toBeVisible();
  expect(posts).toHaveLength(0);
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden");
  const dialog = page.getByRole("dialog");
  expect(
    await dialog.evaluate((el) => el.getBoundingClientRect().width),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({
    path: `/tmp/faroway-checkout-${test.info().project.name}.png`,
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(button).toBeFocused();
});

test("navigates only after a successful saved handoff", async ({ page }) => {
  const posts = await mockHistory(page);
  await page.getByRole("button", { name: "Review experience" }).click();
  await page.getByRole("button", { name: "Continue to Viator" }).click();
  await expect(page).toHaveURL(/https:\/\/www.viator.com\/tours\//);
  expect(posts).toHaveLength(1);
  expect(posts[0]).toMatchObject({
    activityId: "activity_v_123P1",
    date: "2099-06-01",
  });
});

test("keeps the plan and same idempotency key on a failed attempt and retry", async ({
  page,
}) => {
  const posts = await mockHistory(page, { fail: true });
  await page.getByRole("button", { name: "Review experience" }).click();
  await page.getByRole("button", { name: "Continue to Viator" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Your plan is still saved",
  );
  await expect(page).toHaveURL(fixtureUrl + "/");
  await page.getByRole("button", { name: "Continue to Viator" }).click();
  await expect.poll(() => posts.length).toBe(2);
  expect(posts[1].attemptId).toBe(posts[0].attemptId);
});

test("recovers saved steps after refresh without treating a return as confirmed", async ({
  page,
}) => {
  const posts = await mockHistory(page, { saved: true });
  await page.reload();
  await expect(
    page.getByText("Confirmation not verified", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Review step" }).click();
  await expect(page.getByText("Already paid?", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Continue to Viator" }).click();
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0].attemptId).toBe(attemptId);
});

test("disables handoff when provider capability is not enabled", async ({
  page,
}) => {
  const posts = await mockHistory(page, { enabled: false });
  await expect(
    page.getByRole("button", { name: "Review experience" }),
  ).toBeDisabled();
  expect(posts).toHaveLength(0);
});
