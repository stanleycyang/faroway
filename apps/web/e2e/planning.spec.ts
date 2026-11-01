import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { sampleDays, sampleHotel } from "./fixtures/planning-data";
import { createServer, type Server, type ServerResponse } from "node:http";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import postcss from "postcss";
import tailwind from "@tailwindcss/postcss";

let server: Server;
let fixtureUrl: string;
let directory: string;
let stream: ServerResponse | undefined;
let completed = false;
function send(type: string, data: unknown) {
  stream?.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
}
test.beforeAll(async () => {
  directory = mkdtempSync(path.join(tmpdir(), "faroway-planning-ui-"));
  const output = path.join(directory, "planning.js");
  execFileSync("bun", ["run", "e2e/fixtures/build-planning.mjs", output]);
  const bundle = readFileSync(output);
  const css = (
    await postcss([tailwind()]).process(
      readFileSync("app/globals.css", "utf8"),
      { from: path.resolve("app/globals.css") },
    )
  ).css;
  server = createServer((request, response) => {
    const url = new URL(request.url || "/", "http://fixture.invalid");
    if (url.pathname === "/api/trips/fixture/stream") {
      stream = response;
      completed = false;
      response.setHeader("Content-Type", "text/event-stream");
      response.setHeader("Cache-Control", "no-cache, no-transform");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("X-Accel-Buffering", "no");
      response.socket?.setNoDelay(true);
      response.flushHeaders();
      send("progress", {
        step: "activities",
        progress: 42,
        message: "Finding places for your days in Paris",
        searchProgress: {
          orchestrator: "done",
          hotels: "searching",
          activities: "searching",
        },
      });
      response.on("close", () => {
        if (stream === response) stream = undefined;
      });
    } else if (url.pathname === "/fixture/stage") {
      const stage = url.searchParams.get("value");
      if (stage === "hotel") send("hotels", { topHotel: sampleHotel });
      if (stage === "chapter-one") {
        send("activities", { count: 8 });
        send("spec-block", {
          blocks: [
            {
              type: "ItineraryDay",
              props: {
                dayNumber: 1,
                date: sampleDays[0].date,
                title: sampleDays[0].title,
                summary: sampleDays[0].summary,
              },
            },
            {
              type: "ActivityCard",
              props: {
                name: "A quiet walk through Saint-Germain",
                time: "morning",
              },
            },
          ],
        });
      }
      if (stage === "chapter-two")
        send("itinerary", { days: sampleDays.slice(0, 2) });
      if (stage === "malformed-error") {
        stream?.write("event: error\ndata: {invalid\n\n");
        stream?.end();
      }
      if (stage === "malformed-complete") {
        stream?.write("event: complete\ndata: {invalid\n\n");
      }
      if (stage === "error") {
        send("error", {
          message: "Live updates disconnected. Your trip is saved.",
        });
        stream?.end();
      }
      if (stage === "transport-drop") stream?.socket?.destroy();
      if (stage === "complete") {
        send("itinerary", { days: sampleDays });
        send("complete", {});
        completed = true;
        stream?.end();
      }
      if (stage === "server-complete") completed = true;
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ ok: true }));
    } else if (url.pathname === "/api/trips/fixture/generate") {
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({ status: completed ? "completed" : "generating" }),
      );
    } else if (request.url === "/planning.js") {
      response.setHeader(
        "Content-Type",
        "application/javascript; charset=utf-8",
      );
      response.end(bundle);
    } else if (request.url === "/planning.css") {
      response.setHeader("Content-Type", "text/css; charset=utf-8");
      response.end(css);
    } else {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(
        '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/planning.css"><style>body{--font-playfair:Georgia;--font-plus-jakarta:Arial}</style></head><body><div id="root"></div><script>window.process={env:{NODE_ENV:"development"}};</script><script src="/planning.js"></script></body></html>',
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

test("day navigation supports touch and keyboard without exposing other days", async ({
  page,
}) => {
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.goto(fixtureUrl);
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await page
    .locator("img")
    .evaluateAll((images) =>
      Promise.all(
        images.map((image) =>
          (image as HTMLImageElement).decode().catch(() => undefined),
        ),
      ),
    );
  await page.screenshot({
    path: `/tmp/faroway-trip-${test.info().project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("tab", { name: /Day 2/ }).click();
  await expect(page.getByRole("tabpanel")).toContainText(
    "Art and the Left Bank",
  );
  await expect(page.getByRole("tabpanel")).not.toContainText(
    "A first taste of Paris",
  );
  await page.getByRole("tab", { name: /Day 2/ }).focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: /Day 3/ })).toBeFocused();
  await expect(page.getByRole("tabpanel")).toContainText(
    "Markets and neighborhood walks",
  );
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("tab", { name: /Day 1/ })).toBeFocused();
  await expect(page.getByRole("tabpanel")).toContainText(
    "A first taste of Paris",
  );
});

test("planning, recovery and ready controls stay usable on short screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.goto(`${fixtureUrl}?screen=generation`);
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "42",
  );
  await page.getByText("Behind the journey", { exact: true }).click();
  await expect(
    page.getByRole("list", { name: "Generation steps" }),
  ).toContainText("Finding activities");
  await page
    .locator("img")
    .evaluateAll((images) =>
      Promise.all(
        images.map((image) =>
          (image as HTMLImageElement).decode().catch(() => undefined),
        ),
      ),
    );
  await page.screenshot({
    path: `/tmp/faroway-generation-${test.info().project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Finish fixture planning" }).click();
  await expect(
    page.getByRole("heading", { name: "Your journey is ready", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await page
    .locator("img")
    .evaluateAll((images) =>
      Promise.all(
        images.map((image) =>
          (image as HTMLImageElement).decode().catch(() => undefined),
        ),
      ),
    );
  await page.locator(".concierge-dossier").evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({
    path: `/tmp/faroway-ready-${test.info().project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Open my trip" }).focus();
  await expect(
    page.getByRole("button", { name: "Open my trip" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("tablist", { name: "Itinerary days" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("real SSE discoveries become stable chapters and completion stays in the dossier", async ({
  page,
  request,
}) => {
  page.on("console", (message) => {
    if (message.type() === "error") console.error(message.text());
  });
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.goto(`${fixtureUrl}?screen=live`);
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "42",
  );
  await expect(page.getByText("Making room for memorable days")).toBeVisible();
  await request.get(`${fixtureUrl}/fixture/stage?value=hotel`);
  await expect(
    page.getByRole("heading", { name: "A stay in Saint-Germain" }),
  ).toBeVisible();
  await request.get(`${fixtureUrl}/fixture/stage?value=chapter-one`);
  await expect(page.getByTestId("stream-state")).toContainText(
    "A first taste of Paris",
  );
  const chapter = page.getByRole("button", { name: /A first taste of Paris/ });
  await expect(chapter).toHaveAttribute("aria-expanded", "true");
  await chapter.click();
  await request.get(`${fixtureUrl}/fixture/stage?value=chapter-two`);
  await expect(
    page.getByRole("button", { name: /Art and the Left Bank/ }),
  ).toBeVisible();
  await expect(chapter).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "42",
  );
  await request.get(`${fixtureUrl}/fixture/stage?value=complete`);
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "100",
  );
  await expect(chapter).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("button", { name: "Open my trip" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open my trip" }).click();
  await expect(
    page.getByRole("tablist", { name: "Itinerary days" }),
  ).toBeVisible();
});

test("an interrupted SSE stream preserves chapters while saved status resolves", async ({
  page,
  request,
}) => {
  page.on("console", (message) => {
    if (message.type() === "error") console.error(message.text());
  });
  page.on("pageerror", (error) => {
    throw error;
  });
  await page.goto(`${fixtureUrl}?screen=live`);
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "42",
  );
  await request.get(`${fixtureUrl}/fixture/stage?value=chapter-one`);
  await expect(
    page.getByRole("button", { name: /A first taste of Paris/ }),
  ).toBeVisible();
  await request.get(`${fixtureUrl}/fixture/stage?value=error`);
  await expect(
    page.getByRole("heading", { name: "Live updates paused" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /A first taste of Paris/ }),
  ).toBeVisible();
  await request.get(`${fixtureUrl}/fixture/stage?value=server-complete`);
  await page.getByRole("button", { name: "Check planning status" }).click();
  await expect(
    page.getByRole("button", { name: "Open my trip" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /A first taste of Paris/ }),
  ).toBeVisible();
});

test("dossier composition remains readable across desktop and phone layouts", async ({
  page,
}) => {
  const phone = test.info().project.name !== "chromium";
  await page.setViewportSize(
    phone ? { width: 390, height: 844 } : { width: 1440, height: 1000 },
  );
  await page.goto(`${fixtureUrl}?screen=generation`);
  await expect(
    page.getByRole("button", { name: /A first taste of Paris/ }),
  ).toBeVisible();
  await page
    .locator("img")
    .evaluateAll((images) =>
      Promise.all(
        images.map((image) =>
          (image as HTMLImageElement).decode().catch(() => undefined),
        ),
      ),
    );
  await page.screenshot({
    path: `/tmp/faroway-luxury-dossier-${test.info().project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Explore your emerging journey" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your days, taking shape" }),
  ).toBeFocused();
  await page.getByRole("button", { name: /Art and the Left Bank/ }).click();
  await expect(
    page.getByRole("button", { name: /Art and the Left Bank/ }),
  ).toHaveAttribute("aria-expanded", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("reconnecting observes the same job and keeps chapter state without a new planning write", async ({
  page,
  request,
}) => {
  const observationMethods: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/trips/fixture/stream")
      observationMethods.push(request.method());
  });
  await page.goto(`${fixtureUrl}?screen=live`);
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "42",
  );
  await request.get(`${fixtureUrl}/fixture/stage?value=chapter-one`);
  const chapter = page.getByRole("button", { name: /A first taste of Paris/ });
  await chapter.click();
  await expect(chapter).toHaveAttribute("aria-expanded", "false");
  await request.get(`${fixtureUrl}/fixture/stage?value=error`);
  await page.getByRole("button", { name: "Reconnect live updates" }).click();
  await expect(
    page.getByRole("heading", { name: "Discovering your destination" }),
  ).toBeVisible();
  await expect(chapter).toHaveAttribute("aria-expanded", "false");
  expect(observationMethods).toEqual(["GET", "GET"]);
  await request.get(`${fixtureUrl}/fixture/stage?value=complete`);
  await expect(
    page.getByRole("button", { name: "Open my trip" }),
  ).toBeVisible();
});

test("a socket disconnect preserves chapters and reconnects the same trip without generation", async ({
  page,
  request,
}) => {
  const observations: string[] = [];
  const generationWrites: string[] = [];
  page.on("request", (req) => {
    const pathname = new URL(req.url()).pathname;
    if (pathname === "/api/trips/fixture/stream")
      observations.push(req.method());
    if (pathname.endsWith("/generate") && req.method() === "POST")
      generationWrites.push(pathname);
  });
  await page.goto(`${fixtureUrl}?screen=live`);
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "42",
  );
  await request.get(`${fixtureUrl}/fixture/stage?value=chapter-one`);
  const chapter = page.getByRole("button", { name: /A first taste of Paris/ });
  await expect(chapter).toBeVisible();
  await chapter.click();
  await expect(chapter).toHaveAttribute("aria-expanded", "false");
  await request.get(`${fixtureUrl}/fixture/stage?value=transport-drop`);
  await expect(
    page.getByRole("heading", { name: "Live updates paused" }),
  ).toBeVisible();
  await expect(chapter).toHaveAttribute("aria-expanded", "false");
  await page.getByRole("button", { name: "Reconnect live updates" }).click();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "42",
  );
  await expect(chapter).toHaveAttribute("aria-expanded", "false");
  expect(observations).toEqual(["GET", "GET"]);
  expect(generationWrites).toEqual([]);
  await request.get(`${fixtureUrl}/fixture/stage?value=complete`);
  await page.getByRole("button", { name: "Open my trip" }).click();
  await expect(page.getByRole("tab", { name: /Day 2/ })).toBeVisible();
});

test("saved journeys expose truthful status and clear return controls", async ({
  page,
}) => {
  await page.goto(`${fixtureUrl}?screen=saved`);
  await expect(
    page.getByText("Planning interrupted", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Plan ready", { exact: true })).toBeVisible();
  await expect(page.getByText("Planning", { exact: true })).toBeVisible();
  await expect(page.getByText("Open trip", { exact: false })).toHaveCount(3);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .locator("img")
    .evaluateAll((images) =>
      Promise.all(
        images.map((image) =>
          (image as HTMLImageElement).decode().catch(() => undefined),
        ),
      ),
    );
  await page.screenshot({
    path: `/tmp/faroway-saved-${test.info().project.name}.png`,
    fullPage: true,
    animations: "disabled",
  });
});

test("malformed terminal updates cannot strand the live observer", async ({
  page,
  request,
}) => {
  await page.goto(`${fixtureUrl}?screen=live`);
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuenow",
    "42",
  );
  await request.get(`${fixtureUrl}/fixture/stage?value=malformed-complete`);
  await request.get(`${fixtureUrl}/fixture/stage?value=chapter-two`);
  await expect(
    page.getByRole("button", { name: /Art and the Left Bank/ }),
  ).toBeVisible();
  await request.get(`${fixtureUrl}/fixture/stage?value=malformed-error`);
  await expect(
    page.getByText("Live updates paused", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Art and the Left Bank/ }),
  ).toBeVisible();
});

test("completed dossier exposes its primary action immediately on a short phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(`${fixtureUrl}?screen=ready`);
  await expect(
    page.getByRole("heading", { name: "Your journey is ready", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Open my trip", exact: true }),
  ).toBeInViewport();
  await expect(
    page.getByRole("button", { name: "Explore your journey", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("No stay suggestion in this plan", { exact: true }),
  ).toBeVisible();
  await page.locator(".concierge-dossier").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  const chapter = page.getByRole("button", { name: /Day 3/ });
  await expect(chapter).toBeInViewport();
  const chapterBox = await chapter.boundingBox();
  const actionBox = await page
    .getByRole("button", { name: "Open my trip", exact: true })
    .boundingBox();
  expect(chapterBox).not.toBeNull();
  expect(actionBox).not.toBeNull();
  expect(chapterBox!.y + chapterBox!.height).toBeLessThanOrEqual(actionBox!.y);
});

test("a generated city-and-country label displays its catalog cover", async ({
  page,
}) => {
  const imagePath =
    "/storage/v1/object/public/images/destinations/lisbon-photo-1585208798174-6cedd86e019a.jpg";
  // Test the real resolver + header boundary without a storage/network dependency.
  await page.route(`**${imagePath}`, (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect width="1200" height="600" fill="#4b7481"/></svg>',
    }),
  );
  await page.goto(`${fixtureUrl}?destination=Lisbon%2C%20Portugal`);
  await expect(
    page.getByRole("heading", { name: "Lisbon, Portugal", exact: true }),
  ).toBeVisible();
  const cover = page.locator(`img[src="${imagePath}"]`);
  await expect(cover).toBeVisible();
  await expect
    .poll(() =>
      cover.evaluate(
        (img: HTMLImageElement) => img.complete && img.naturalWidth > 0,
      ),
    )
    .toBe(true);
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    page.viewportSize()!.width,
  );
});

test("proposed timing shows rest and uncertainty without duplicate notes or overflow", async ({
  page,
}, testInfo) => {
  await page.goto(`${fixtureUrl}/?screen=timing`);
  const panel = page.getByRole("region", { name: "Suggested timing" });
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Midday rest", { exact: true })).toBeVisible();
  await expect(panel.getByText("13:00–14:00", { exact: true })).toBeVisible();
  await expect(
    panel.getByText(
      "Local times, not confirmed bookings. Check opening hours and routes.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Proposed local timing: duplicated legacy text"),
  ).toHaveCount(0);
  await expect(
    page.getByText("Bring water for the garden walk."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await panel.screenshot({ path: testInfo.outputPath("proposed-timing.png") });
  await page.goto(`${fixtureUrl}/?screen=timing-conflict`);
  const conflict = page.getByRole("region", { name: "Timing needs review" });
  await expect(conflict).toBeVisible();
  await expect(conflict.getByRole("listitem")).toHaveCount(0);
  await expect(
    conflict.getByText(/Review the schedule before using it/),
  ).toBeVisible();
  await conflict.screenshot({
    path: testInfo.outputPath("timing-conflict.png"),
  });
});

test("dining review sources stay readable and leave the selected plan intact", async ({
  page,
}, testInfo) => {
  await page.goto(`${fixtureUrl}/?screen=dining-review`);
  await expect(page.getByText("Before you go", { exact: true })).toBeVisible();
  await expect(
    page.getByText(/Breakfast alternative to review: The Bloomhouse/),
  ).toBeVisible();
  await expect(page.getByText(/not a scheduled meal/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Source: littlefarmscafe.com/ }),
  ).toHaveCount(2);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page
    .getByText("Before you go", { exact: true })
    .locator("../..")
    .screenshot({ path: testInfo.outputPath("dining-review.png") });
});
