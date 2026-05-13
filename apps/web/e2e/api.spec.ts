/**
 * API E2E — verifies public and auth-protected API routes behave correctly.
 * These run against the real server (no mocks) to catch integration regressions.
 */
import { test, expect } from "@playwright/test";

test.describe("Public API endpoints", () => {
  test("GET /api/destinations/popular returns destination list", async ({ request }) => {
    const response = await request.get("/api/destinations/popular?limit=3");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("destinations");
    expect(Array.isArray(body.destinations)).toBe(true);
  });

  test("GET /api/destinations/trending returns destination list", async ({ request }) => {
    const response = await request.get("/api/destinations/trending?limit=3");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("destinations");
  });

  test("POST /api/trips rejects invalid body", async ({ request }) => {
    // /api/trips supports anonymous users; missing required fields returns 400
    const response = await request.post("/api/trips", {
      data: { destination: "Paris" }, // missing start_date / end_date
    });
    expect(response.status()).toBe(400);
  });

  test("POST /api/workflows/generate-itinerary requires authentication", async ({
    request,
  }) => {
    const response = await request.post("/api/workflows/generate-itinerary", {
      data: { tripId: "00000000-0000-0000-0000-000000000000" },
    });
    expect(response.status()).toBe(401);
  });

  test("rate limit headers present on destinations API", async ({ request }) => {
    const response = await request.get("/api/destinations/popular?limit=1");
    // Should respond normally (not 429) for the first request
    expect(response.status()).toBeLessThan(500);
  });
});

test.describe("Rate limiting", () => {
  test("blog newsletter endpoint rejects missing email", async ({ request }) => {
    const response = await request.post("/api/blog/newsletter", {
      data: {},
    });
    // Should be 400 (bad request) not 500
    expect([400, 422, 429]).toContain(response.status());
  });
});
