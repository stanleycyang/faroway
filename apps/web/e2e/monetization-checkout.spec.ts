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

const staleAttemptId = "00000000-0000-4000-8000-000000000010";
const generationId = "00000000-0000-4000-8000-000000000099";
const checklistItemId = "item_0123456789abcdef0123456789abcdef";
const reportUuid1 = "00000000-0000-4000-8000-000000000101";
const reportUuid2 = "00000000-0000-4000-8000-000000000102";

test.beforeAll(async () => {
  directory = mkdtempSync(
    path.join(tmpdir(), "faroway-monetization-checkout-"),
  );
  const output = path.join(directory, "monetization-checkout.js");
  execFileSync("bun", [
    "run",
    "e2e/fixtures/build-monetization.mjs",
    "e2e/fixtures/monetization-checkout.tsx",
    output,
  ]);
  const bundle = readFileSync(output);
  const css = (
    await postcss([tailwind()]).process(
      readFileSync("app/globals.css", "utf8"),
      { from: path.resolve("app/globals.css") },
    )
  ).css;

  server = createServer((request, response) => {
    if (request.url === "/monetization-checkout.css") {
      response.setHeader("Content-Type", "text/css; charset=utf-8");
      response.end(css);
    } else if (request.url === "/monetization-checkout.js") {
      response.setHeader(
        "Content-Type",
        "application/javascript; charset=utf-8",
      );
      response.end(bundle);
    } else {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(
        '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/monetization-checkout.css"><style>body{--font-playfair:Georgia;--font-plus-jakarta:Arial}</style></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"development"}};</script><script src="/monetization-checkout.js"></script></body></html>',
      );
    }
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("No fixture port");
  }
  fixtureUrl = `http://127.0.0.1:${address.port}`;
});

test.afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  if (directory) {
    rmSync(directory, { recursive: true, force: true });
  }
});

interface MockOptions {
  checkoutGetSequence?: Array<{ status?: number; json: unknown }>;
  checkoutPostDelayMs?: number;
  checkoutPostFail?: boolean;
  checkoutPostFailCount?: number;
}

async function setupRoutes(page: Page, options: MockOptions = {}) {
  let checkoutGetIndex = 0;
  let checkoutPostIndex = 0;
  let checklistStatus: "needed" | "provider_opened" | "traveler_booked" =
    "needed";
  let currentReportId: string | null = null;
  const bookingPosts: Array<Record<string, unknown>> = [];
  const checkoutPosts: Array<{
    activityId: string;
    date: string;
    attemptId: string;
  }> = [];

  const getResponses = options.checkoutGetSequence ?? [
    { json: { enabled: true, attempts: [] } },
  ];

  await page.route("**/api/trips/*/checkout", async (route) => {
    if (route.request().method() === "GET") {
      const next =
        getResponses[Math.min(checkoutGetIndex, getResponses.length - 1)];
      checkoutGetIndex++;
      await route.fulfill({
        status: next.status ?? 200,
        json: next.json,
      });
      return;
    }

    if (options.checkoutPostDelayMs) {
      await new Promise((resolve) =>
        setTimeout(resolve, options.checkoutPostDelayMs),
      );
    }
    const body = route.request().postDataJSON() as {
      activityId: string;
      date: string;
      attemptId: string;
    };
    checkoutPosts.push(body);
    const shouldFail =
      options.checkoutPostFail ||
      (typeof options.checkoutPostFailCount === "number" &&
        checkoutPostIndex < options.checkoutPostFailCount);
    checkoutPostIndex++;
    if (shouldFail) {
      await route.fulfill({
        status: 503,
        json: { error: "Viator temporarily unavailable." },
      });
      return;
    }
    await route.fulfill({
      json: {
        redirectUrl: `https://www.viator.com/tours/Paris/Walk/d479-123P1?pid=P12345678&mcid=42383&medium=api&campaign=checkout-${body.attemptId}`,
        status: "handoff_prepared",
        attemptId: body.attemptId,
      },
    });
  });

  await page.route("**/api/trips/*/bookings*", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: {
          revision: "2026-10-03T00:00:00.000Z",
          generationId,
          editable: true,
          receipt: false,
          items: [
            {
              id: checklistItemId,
              name: "Louvre Museum Guided Tour",
              date: "2099-06-01",
              status: checklistStatus,
              reportId: currentReportId,
              needsReview: false,
            },
          ],
          earlier: [],
        },
      });
      return;
    }

    const body = route.request().postDataJSON() as {
      requestId: string;
      status: "needed" | "provider_opened" | "traveler_booked";
    };
    bookingPosts.push(body);
    checklistStatus = body.status;
    currentReportId =
      body.status === "provider_opened" ? reportUuid1 : reportUuid2;
    await route.fulfill({
      json: {
        state: "applied",
        reportId: currentReportId,
        requestId: body.requestId,
      },
    });
  });

  await page.route(/^https:\/\//, (route) =>
    route.fulfill({ contentType: "text/html", body: "Mock external provider" }),
  );

  await page.goto(fixtureUrl);
  return { bookingPosts, checkoutPosts };
}

test("ActivityCard opens Viator consent modal with FTC disclosure and renders safe non-Viator fallback", async ({
  page,
}) => {
  await setupRoutes(page);

  await expect(
    page.getByText(
      "Booking isn’t available in Faroway for this stop. Check the provider for price and availability.",
    ),
  ).toBeVisible();

  const reviewBtn = page.getByRole("button", { name: "Review on Viator" });
  await expect(reviewBtn).toBeVisible();
  await reviewBtn.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Your next step, with Viator");
  await expect(dialog).toContainText("Louvre Museum Guided Tour");
  await expect(dialog).toContainText(
    "Faroway may earn a commission when you book. Continuing does not reserve a place or charge you.",
  );
});

test("stale plan attempt with canResume=false disables Review step and explains previous plan", async ({
  page,
}) => {
  await setupRoutes(page, {
    checkoutGetSequence: [
      {
        json: {
          enabled: true,
          attempts: [
            {
              id: `checkout-${staleAttemptId}`,
              item_id: "activity_v_123P1@2099-06-01",
              item_name: "Louvre Museum Guided Tour",
              clicked_at: "2099-01-01T12:00:00Z",
              canResume: false,
            },
          ],
        },
      },
    ],
  });

  const savedSection = page.getByRole("region", {
    name: "Saved booking steps",
  });
  await expect(savedSection).toBeVisible();
  await expect(savedSection).toContainText(
    "From a previous plan; review the current choices instead.",
  );
  await expect(
    savedSection.getByRole("button", { name: "Review step" }),
  ).toBeDisabled();
});

test("GET /checkout failure shows role=status and recovers cleanly via Try again", async ({
  page,
}) => {
  await setupRoutes(page, {
    checkoutGetSequence: [
      { status: 503, json: { error: "Temporary outage" } },
      { status: 200, json: { enabled: true, attempts: [] } },
    ],
  });

  const statusBanner = page.getByRole("status").filter({
    hasText: "Your booking steps could not be loaded.",
  });
  await expect(statusBanner).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review on Viator" }),
  ).toHaveCount(0);

  await statusBanner.getByRole("button", { name: "Try again" }).click();
  await expect(statusBanner).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Review on Viator" }),
  ).toBeVisible();
});

test("modal traps Tab/Shift+Tab focus and blocks Escape while busy", async ({
  page,
}) => {
  await setupRoutes(page, {
    checkoutPostDelayMs: 600,
    checkoutPostFail: true,
  });

  const trigger = page.getByRole("button", { name: "Review on Viator" });
  await trigger.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Tab and Shift+Tab keep focus inside dialog
  await page.keyboard.press("Tab");
  const activeAfterTab = await dialog.evaluate((el) =>
    el.contains(document.activeElement),
  );
  expect(activeAfterTab).toBe(true);

  await page.keyboard.press("Shift+Tab");
  const activeAfterShiftTab = await dialog.evaluate((el) =>
    el.contains(document.activeElement),
  );
  expect(activeAfterShiftTab).toBe(true);

  // Trigger busy state on Continue to Viator
  await dialog.getByRole("button", { name: "Continue to Viator" }).click();
  await expect(
    dialog.getByRole("button", { name: "Preparing your booking step…" }),
  ).toBeDisabled();
  await expect(
    dialog.getByRole("button", { name: "Close checkout review" }),
  ).toBeDisabled();

  // Escape must NOT close while busy
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();

  // Wait for POST failure to release busy state, then Escape closes cleanly
  await expect(dialog.getByRole("alert")).toContainText(
    "Your plan is still saved.",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("BookingChecklist transitions Still needed -> I opened the provider -> I booked this", async ({
  page,
}) => {
  const { bookingPosts } = await setupRoutes(page);
  const checklist = page.getByRole("region", { name: "Booking checklist" });
  await expect(checklist).toBeVisible();
  await expect(checklist).toContainText("Review / still needed");

  // Transition 1: I opened the provider
  await checklist
    .getByRole("button", { name: "I opened the provider" })
    .click();
  const reviewRegion = checklist.getByRole("region", {
    name: "Review booking report",
  });
  await expect(reviewRegion).toBeVisible();
  await expect(reviewRegion).toContainText("Provider opened · reported by you");
  await reviewRegion.getByRole("button", { name: "Save my report" }).click();

  await expect(
    checklist.getByText(
      "Your report is saved. It is not provider confirmation or proof of commission.",
    ),
  ).toBeVisible();
  await expect(
    checklist.getByText("Provider opened · reported by you"),
  ).toBeVisible();
  expect(bookingPosts[0]).toMatchObject({ status: "provider_opened" });

  // Transition 2: I booked this
  await checklist.getByRole("button", { name: "I booked this" }).click();
  await expect(reviewRegion).toContainText("Booked · reported by you");
  await reviewRegion.getByRole("button", { name: "Save my report" }).click();
  await expect(checklist.getByText("Booked · reported by you")).toBeVisible();
  expect(bookingPosts[1]).toMatchObject({ status: "traveler_booked" });
});

test("FeaturedHotelCard and FlightLeg render truthful estimates and expired flight notice", async ({
  page,
}) => {
  await setupRoutes(page);

  const hotelArticle = page.getByRole("article", {
    name: "Suggested stay: Hotel Recamier Saint-Germain",
  });
  await expect(hotelArticle).toBeVisible();
  await expect(hotelArticle).toContainText(/240\.00/);
  await expect(hotelArticle).toContainText("estimated per night");
  await expect(hotelArticle).toContainText(/720\.00 for 3 assigned nights/);
  await expect(hotelArticle).toContainText(
    "Hotel checkout is not available in Faroway yet.",
  );

  const flights = page.getByRole("region", { name: "Flight options" });
  await expect(flights).toContainText("Air France");
  await expect(flights).toContainText("SFO");
  await expect(flights).toContainText("CDG");
  await expect(flights).toContainText(/780\.00/);
  await expect(flights).toContainText("United Airlines");
  await expect(flights).toContainText("Price expired or unavailable");

  const dining = page.getByRole("region", { name: "Dining options" });
  await expect(dining).toContainText("Le Petit Cler");
  await expect(dining).toContainText("Reservations aren’t made in Faroway");
  await expect(dining).toContainText(
    "Confirm availability and cancellation terms with the restaurant.",
  );
});

test("Continue to Viator 200 happy-path handoff navigates with campaign=checkout-attemptId", async ({
  page,
}) => {
  const { checkoutPosts } = await setupRoutes(page);

  await page.getByRole("button", { name: "Review on Viator" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Continue to Viator" }).click();

  await expect.poll(() => checkoutPosts.length).toBe(1);
  const postedAttemptId = checkoutPosts[0].attemptId;
  expect(postedAttemptId).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  );
  expect(checkoutPosts[0]).toMatchObject({
    activityId: "activity_v_123P1",
    date: "2099-06-01",
  });
  await expect(page).toHaveURL(
    new RegExp(
      `^https://www\\.viator\\.com/tours/Paris/Walk/d479-123P1.*campaign=checkout-${postedAttemptId}`,
    ),
  );
});

test("canResume=true Review step opens resume warning and reuses saved attemptId", async ({
  page,
}) => {
  const savedAttemptId = "00000000-0000-4000-8000-000000000022";
  const { checkoutPosts } = await setupRoutes(page, {
    checkoutGetSequence: [
      {
        json: {
          enabled: true,
          attempts: [
            {
              id: `checkout-${savedAttemptId}`,
              item_id: "activity_v_123P1@2099-06-01",
              item_name: "Louvre Museum Guided Tour",
              clicked_at: "2099-01-01T12:00:00Z",
              canResume: true,
            },
          ],
        },
      },
    ],
  });

  const savedSection = page.getByRole("region", {
    name: "Saved booking steps",
  });
  await expect(savedSection).toBeVisible();
  const resumeBtn = savedSection.getByRole("button", { name: "Review step" });
  await expect(resumeBtn).toBeEnabled();
  await resumeBtn.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(
    "Already paid? Check Viator’s confirmation email before continuing.",
  );
  await dialog.getByRole("button", { name: "Continue to Viator" }).click();

  await expect.poll(() => checkoutPosts.length).toBe(1);
  expect(checkoutPosts[0].attemptId).toBe(savedAttemptId);
  await expect(page).toHaveURL(
    new RegExp(`campaign=checkout-${savedAttemptId}`),
  );
});

test("enabled=false disables checkout triggers and saved resume actions", async ({
  page,
}) => {
  const { checkoutPosts } = await setupRoutes(page, {
    checkoutGetSequence: [
      {
        json: {
          enabled: false,
          attempts: [
            {
              id: `checkout-${staleAttemptId}`,
              item_id: "activity_v_123P1@2099-06-01",
              item_name: "Louvre Museum Guided Tour",
              clicked_at: "2099-01-01T12:00:00Z",
              canResume: true,
            },
          ],
        },
      },
    ],
  });

  await expect(
    page.getByText(
      "Viator checkout unavailable. Refresh this trip and try again. Your plan stays saved.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Review on Viator" }),
  ).toHaveCount(0);
  const savedSection = page.getByRole("region", {
    name: "Saved booking steps",
  });
  await expect(
    savedSection.getByRole("button", { name: "Review step" }),
  ).toBeDisabled();
  expect(checkoutPosts).toHaveLength(0);
});

test("failed 503 checkout followed by 200 retry preserves the exact same attemptId", async ({
  page,
}) => {
  const { checkoutPosts } = await setupRoutes(page, {
    checkoutPostFailCount: 1,
  });

  await page.getByRole("button", { name: "Review on Viator" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Continue to Viator" }).click();

  await expect(dialog.getByRole("alert")).toContainText(
    "Your plan is still saved.",
  );
  await expect(page).toHaveURL(fixtureUrl + "/");

  await dialog.getByRole("button", { name: "Continue to Viator" }).click();
  await expect.poll(() => checkoutPosts.length).toBe(2);
  expect(checkoutPosts[1].attemptId).toBe(checkoutPosts[0].attemptId);
  await expect(page).toHaveURL(
    new RegExp(`campaign=checkout-${checkoutPosts[0].attemptId}`),
  );
});

test("checkout and surface cards have zero horizontal overflow on 320x568 and current viewport", async ({
  page,
}) => {
  await setupRoutes(page);

  const initialOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(initialOverflow).toBe(true);

  await page.setViewportSize({ width: 320, height: 568 });
  const smallOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(smallOverflow).toBe(true);

  await page.getByRole("button", { name: "Review on Viator" }).click();
  const dialogWidth = await page
    .getByRole("dialog")
    .evaluate((el) => el.getBoundingClientRect().width);
  expect(dialogWidth).toBeLessThanOrEqual(320);
});
