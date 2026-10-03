import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

let server: Server;
let fixtureUrl: string;
let directory: string;
test.beforeAll(async () => {
  directory = mkdtempSync(path.join(tmpdir(), "faroway-places-ui-"));
  const output = path.join(directory, "places.js");
  execFileSync("bun", [
    "build",
    "e2e/fixtures/places.tsx",
    "--target=browser",
    `--outfile=${output}`,
  ]);
  const bundle = readFileSync(output);
  server = createServer((request, response) => {
    if (request.url === "/places.js") {
      response.setHeader("Content-Type", "application/javascript");
      response.end(bundle);
    } else {
      response.setHeader("Content-Type", "text/html");
      response.end(
        '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script src="/places.js"></script></body></html>',
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

// All API traffic is mocked; no provider requests or credentials are used.
test("attributes Google predictions and preserves selected coordinates", async ({
  page,
}) => {
  await page.route("**/api/places/autocomplete?*", (route) =>
    route.fulfill({
      json: {
        predictions: [
          { placeId: "tokyo", mainText: "Tokyo", secondaryText: "Japan" },
        ],
      },
    }),
  );
  await page.route("**/api/places/details?*", (route) =>
    route.fulfill({ json: { name: "Tokyo", lat: 35.6, lng: 139.7 } }),
  );
  await page.goto(fixtureUrl);
  await page.getByRole("combobox").fill("Tok");
  await expect(page.getByText("Google Maps", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tokyo Japan" }).click();
  await expect(page.locator("output")).toContainText('"lat":35.6');
  await expect(page.locator("output")).toContainText('"placeId":"tokyo"');
});

test("keeps local selection usable without provider credentials or attribution", async ({
  page,
}) => {
  await page.route("**/api/places/autocomplete?*", (route) =>
    route.fulfill({ status: 501, json: { predictions: [] } }),
  );
  await page.goto(fixtureUrl);
  await page.getByRole("combobox").fill("Tok");
  await page.getByRole("button", { name: "Tokyo Japan" }).click();
  await expect(page.locator("output")).toContainText('"placeId":""');
  await expect(page.getByText("Google Maps", { exact: true })).toHaveCount(0);
});

test("clears old provider predictions while a different query is loading", async ({
  page,
}) => {
  await page.route("**/api/places/autocomplete?*", (route) =>
    route.fulfill({
      json: {
        predictions: [
          { placeId: "tokyo", mainText: "Tokyo", secondaryText: "Japan" },
        ],
      },
    }),
  );
  await page.goto(fixtureUrl);
  await page.getByRole("combobox").fill("Tok");
  await expect(page.getByText("Google Maps", { exact: true })).toBeVisible();
  await page.getByRole("combobox").fill("P");
  await expect(page.getByRole("button", { name: "Tokyo Japan" })).toHaveCount(
    0,
  );
  await expect(page.getByText("Google Maps", { exact: true })).toHaveCount(0);
});
