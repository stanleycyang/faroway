/**
 * Health check E2E — always runs, no external deps.
 * Verifies the app is reachable and the health API is green.
 */
import { test, expect } from "@playwright/test";

test("health endpoint returns ok", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.status).toBe("ok");
  expect(typeof body.timestamp).toBe("string");
});

test("home page loads with correct title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Faroway/);
});

test("robots.txt is accessible", async ({ request }) => {
  const response = await request.get("/robots.txt");
  expect(response.status()).toBe(200);
  const text = await response.text();
  expect(text.toLowerCase()).toContain("user-agent");
  expect(text).toContain("Sitemap");
});

test("sitemap.xml is accessible", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const text = await response.text();
  expect(text).toContain("<urlset");
  expect(text).toContain("<loc>");
});

test("OG image endpoint returns an image", async ({ request }) => {
  const response = await request.get("/api/og");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/");
});
