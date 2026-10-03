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
      response.setHeader(
        "Content-Type",
        "application/javascript; charset=utf-8",
      );
      response.end(bundle);
    } else {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
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
test("keeps Google references out of independent catalog selections", async ({
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
  await expect(page.locator("output")).toContainText('"source":"catalog"');
  await expect(page.locator("output")).not.toContainText("placeId");
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
  await expect(page.locator("output")).toContainText('"source":"catalog"');
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

test("live venue references are lazy, attributed, discarded on close, and never selected for a plan", async ({
  page,
}) => {
  const calls: string[] = [];
  const providerPlace = {
    placeId: "abc123",
    name: "Google-only venue",
    address: "Provider-only address",
    mapsUrl: "https://maps.google.com/example",
    attributions: [
      { provider: "Data partner", providerUri: "https://example.com" },
    ],
  };
  await page.route("**/api/places/venues?*", (route) => {
    calls.push(route.request().url());
    return route.fulfill({
      json: route.request().url().includes("placeId=")
        ? { place: providerPlace }
        : { places: [providerPlace] },
    });
  });
  await page.goto(fixtureUrl);
  expect(calls).toHaveLength(0);
  await page.getByRole("button", { name: "Explore live places" }).click();
  expect(calls).toHaveLength(0);
  await page
    .getByRole("textbox", { name: "Venue and city" })
    .fill("Museums in Tokyo");
  await page
    .getByRole("button", { name: "Search places", exact: true })
    .click();
  await page
    .getByRole("button", { name: "View details for Google-only venue" })
    .click();
  await expect(
    page.getByRole("link", { name: "Open on Google Maps" }),
  ).toHaveAttribute("href", providerPlace.mapsUrl);
  await expect(page.getByRole("link", { name: "Data partner" })).toBeVisible();
  await expect(page.locator("output")).toBeEmpty();
  expect(
    await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    ),
  ).not.toContain("Provider-only");
  await page.getByRole("button", { name: "Close live place details" }).click();
  await page.getByRole("button", { name: "Explore live places" }).click();
  await expect(
    page.getByText("Google-only venue", { exact: true }),
  ).toHaveCount(0);
  expect(calls).toHaveLength(2);
  expect(calls[1]).toContain("placeId=abc123");
  expect(calls[1]).not.toContain("Google-only");
});

test("user destination text is preserved independently of Google predictions", async ({
  page,
}) => {
  await page.route("**/api/places/autocomplete?*", (route) =>
    route.fulfill({
      json: {
        predictions: [
          {
            placeId: "providerid",
            mainText: "Provider-derived name",
            secondaryText: "Provider region",
          },
        ],
      },
    }),
  );
  await page.goto(fixtureUrl);
  await page.getByRole("combobox").fill("My destination");
  await expect(
    page.getByText("Provider-derived name", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Plan with “My destination”" })
    .click();
  await expect(page.locator("output")).toHaveText(
    '{"name":"My destination","source":"user"}',
  );
});
