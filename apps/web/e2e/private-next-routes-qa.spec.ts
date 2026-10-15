import { test, expect, type BrowserContext } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

async function saveEvidence(path: string, body: Buffer) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
}

test.skip(
  process.env.PRIVATE_ROUTE_QA !== "true",
  "Requires the dedicated loopback-only Next/provider QA runtime.",
);

// Run against the actual Next app with the loopback-only read fixture on4017.
// Synthetic provider responses do not prove production RLS or live authentication.
const owner = "11111111-1111-4111-8111-111111111111";
const brokenOwner = "22222222-2222-4222-8222-222222222222";
const tripId = "33333333-3333-4333-8333-333333333333";
const origin = "http://localhost:3124";
async function signIn(context: BrowserContext, id = owner) {
  const encode = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: id, aud: "authenticated", exp })}.synthetic-signature`;
  const session = {
    access_token: token,
    refresh_token: "synthetic-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    user: {
      id,
      email: "qa@example.invalid",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
    },
  };
  await context.addCookies([
    {
      name:
        process.env.PRIVATE_ROUTE_SYNTHETIC_HOST === "true"
          ? "sb-faroway-private-route-fixture-auth-token"
          : "sb-localhost-auth-token",
      value: `base64-${encode(session)}`,
      url: origin,
      sameSite: "Lax",
    },
  ]);
}
test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\//, (route) => route.abort());
  await page.route("**/api/weather?*", (route) =>
    route.fulfill({ json: { status: "outside_forecast" } }),
  );
});

test("full-schema creation survives a lost reply, reopens and saves an edited brief", async ({
  page,
  context,
  request,
}) => {
  const flowExpect = expect.configure({ timeout: 30_000 });
  test.skip(
    process.env.PRIVATE_ROUTE_CREATION_QA !== "true",
    "Requires dedicated full-schema disposable creation mode.",
  );
  flowExpect(
    (await request.post("http://127.0.0.1:4017/__qa/creation/reset")).ok(),
  ).toBe(true);
  await signIn(context);
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("qa-draft-seeded")) {
      sessionStorage.setItem("qa-draft-seeded", "true");
      sessionStorage.setItem(
        "faroway-create-editor-draft",
        JSON.stringify({
          version: 1,
          savedAt: Date.now(),
          draft: {
            selectedPlace: { name: "Paris", source: "user" },
            startDate: "2099-06-01",
            endDate: "2099-06-02",
            travelers: 2,
            travelerType: "couple",
            selectedVibes: ["foodie"],
          },
        }),
      );
    }
  });
  let consent = false;
  page.on("dialog", (dialog) => (consent ? dialog.accept() : dialog.dismiss()));
  const commands: Array<{ requestId: string }> = [];
  let loseReply = true;
  await page.route("**/api/trips", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    commands.push(route.request().postDataJSON());
    const response = await route.fetch();
    flowExpect(response.status()).toBe(commands.length === 1 ? 201 : 200);
    if (loseReply) {
      loseReply = false;
      return route.abort("failed");
    }
    return route.fulfill({ response });
  });
  await page.goto(`${origin}/create`);
  const generate = page.getByRole("button", {
    name: "Generate itinerary",
    exact: true,
  });
  await flowExpect(generate).toBeEnabled();
  await generate.click();
  await flowExpect(
    page.getByRole("alert").filter({ hasText: "AI sharing declined" }),
  ).toBeVisible({ timeout: 20_000 });
  flowExpect(commands).toHaveLength(0);
  consent = true;
  await generate.click();
  const resume = page.getByRole("button", {
    name: "Resume saved trip",
    exact: true,
  });
  await flowExpect(resume).toBeEnabled();
  flowExpect(commands).toHaveLength(1);
  const id = commands[0].requestId;
  await page.reload();
  await flowExpect(resume).toBeEnabled();
  await resume.click();
  await flowExpect(page).toHaveURL(`${origin}/trips/${id}`, {
    timeout: 60_000,
  });
  flowExpect(commands).toHaveLength(2);
  flowExpect(commands[1].requestId).toBe(id);
  await flowExpect(
    page.getByRole("heading", { name: "Paris", exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await page.goto(`${origin}/dashboard`, { timeout: 90_000 });
  await flowExpect(page.locator(`a[href="/trips/${id}"]`)).toHaveCount(1);
  await page.locator(`a[href="/trips/${id}"]`).click();
  const brief = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "Your trip brief" }) })
    .first();
  await brief.locator("summary").click();
  await brief.getByLabel("Start date", { exact: true }).fill("2099-07-01");
  await brief.getByLabel("End date", { exact: true }).fill("2099-07-03");
  await brief
    .getByRole("button", { name: "Save trip brief", exact: true })
    .click();
  await flowExpect(
    page.getByRole("status").filter({ hasText: "Brief saved." }),
  ).toBeVisible();
  await page.reload();
  await brief.locator("summary").click();
  await flowExpect(brief.getByLabel("Start date", { exact: true })).toHaveValue(
    "2099-07-01",
  );
  await flowExpect(brief.getByLabel("End date", { exact: true })).toHaveValue(
    "2099-07-03",
  );
  const listResponse = await context.request.get(`${origin}/api/trips`);
  flowExpect(listResponse.status()).toBe(200);
  const list = await listResponse.json();
  flowExpect(
    list.trips.map((trip: { id: string; user_id: string }) => ({
      id: trip.id,
      owner: trip.user_id,
    })),
  ).toEqual([{ id, owner }]);
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = page.waitForResponse(
      (response) =>
        response.url() === `${origin}/api/trips/${id}/generate` &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Start planning", exact: true })
      .click();
    const response = await reply;
    flowExpect(response.status()).toBe(503);
    flowExpect((await response.json()).code).toBe("PLANNING_PAUSED");
    const paused = page
      .getByRole("alert")
      .filter({ hasText: "Planning is temporarily paused" });
    await flowExpect(paused).toBeVisible();
    await flowExpect(
      page.getByRole("heading", { name: "Paris", exact: true }),
    ).toBeVisible();
    await paused
      .getByRole("button", { name: "Refresh trip", exact: true })
      .click();
    await flowExpect(paused).toHaveCount(0);
    flowExpect(commands).toHaveLength(2);
  }
  if (!(await brief.evaluate((node) => (node as HTMLDetailsElement).open)))
    await brief.locator("summary").click();
  await context.setOffline(true);
  await brief.getByLabel("Start date", { exact: true }).fill("2099-08-01");
  await brief.getByLabel("End date", { exact: true }).fill("2099-08-03");
  await brief
    .getByRole("button", { name: "Save trip brief", exact: true })
    .click();
  const offlineError = brief
    .getByRole("alert")
    .filter({ hasText: "Your edits are still here" });
  await flowExpect(offlineError).toBeVisible();
  await flowExpect(
    page.getByRole("heading", { name: "Paris", exact: true }),
  ).toBeVisible();
  await flowExpect(brief.getByLabel("Start date", { exact: true })).toHaveValue(
    "2099-08-01",
  );
  await flowExpect(brief.getByLabel("End date", { exact: true })).toHaveValue(
    "2099-08-03",
  );
  await context.setOffline(false);
  await offlineError
    .getByRole("button", { name: "Load latest brief", exact: true })
    .click();
  await flowExpect(offlineError).toHaveCount(0);
  await flowExpect(brief.getByLabel("Start date", { exact: true })).toHaveValue(
    "2099-07-01",
  );
  await flowExpect(brief.getByLabel("End date", { exact: true })).toHaveValue(
    "2099-07-03",
  );
  await flowExpect(
    brief.getByLabel("Destination", { exact: true }),
  ).toBeFocused();
  flowExpect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("real signed-in dashboard renders server card slots and opens a saved itinerary", async ({
  page,
  context,
}) => {
  await signIn(context);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${origin}/dashboard`, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Your journeys" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Paris", exact: true }),
  ).toBeVisible();
  await page.locator(`a[href="/trips/${tripId}"]`).click();
  await expect(
    page.getByRole("heading", { name: "Paris", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("tab", { name: /Day 2/ })).toBeVisible();
  await page.getByRole("tab", { name: /Day 2/ }).click();
  await expect(page.getByRole("tabpanel")).toContainText(
    "Art and the Left Bank",
  );
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("private Next read failure focuses recovery and returns to saved trips", async ({
  page,
  context,
}) => {
  await signIn(context);
  await page.goto(`${origin}/trips/read-error`, {
    waitUntil: "domcontentloaded",
  });
  const heading = page.getByRole("heading", {
    name: "Your trip couldn’t load",
  });
  await expect(heading).toBeVisible();
  await expect(heading).toBeFocused();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(heading).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "Back to my trips" }).click();
  await expect(
    page.getByRole("heading", { name: "Your journeys" }),
  ).toBeVisible();
});

test("signed-in dashboard read failure shows recovery instead of an empty trips invitation", async ({
  page,
  context,
}) => {
  await signIn(context, brokenOwner);
  await page.goto(`${origin}/dashboard`, { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Your trips couldn’t load" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Try again", exact: true }),
  ).toBeVisible();
  await expect(page.getByText("No trips yet", { exact: true })).toHaveCount(0);
});

test("share action stays inert until hydration and its first click opens consent", async ({
  page,
  context,
}) => {
  test.skip(
    process.env.PRIVATE_ROUTE_MUTATIONS_QA !== "true",
    "Requires resettable in-memory fixture.",
  );
  await page.request.post("http://127.0.0.1:4017/__qa/reset");
  await signIn(context);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/_next/static/**/*.js*", async (route) => {
    await pending;
    await route.continue();
  });
  try {
    await page.goto(`${origin}/trips/${tripId}`, { waitUntil: "commit" });
    const share = page.getByRole("button", { name: "Share trip", exact: true });
    const loading = page.getByRole("status", {
      name: "Loading trip",
      exact: true,
    });
    await expect(share.or(loading).first()).toBeVisible();
    if (await share.isVisible()) await expect(share).toBeDisabled();
    else {
      await expect(share).toHaveCount(0);
      await expect(loading).toBeVisible();
    }
    release();
    await expect(share).toBeEnabled({ timeout: 20000 });
    await share.click();
    await expect(
      page.getByRole("dialog", { name: "Make this trip public?" }),
    ).toBeVisible();
  } finally {
    release();
  }
});

test("public consent, canceled share sheet and revocation use real Next APIs", async ({
  page,
  context,
  browser,
}, testInfo) => {
  // This journey now compiles/loads three image endpoints as well as two pages.
  // Keep UI assertions strict while allowing the isolated dev server's cold build.
  test.setTimeout(90_000);
  test.skip(
    process.env.PRIVATE_ROUTE_MUTATIONS_QA !== "true",
    "Requires opt-in in-memory sharing fixture.",
  );
  // Read the reset fixture, rather than Next's development HMR fetch cache.
  await context.setExtraHTTPHeaders({ "Cache-Control": "no-cache" });
  const reset = await page.request.post("http://127.0.0.1:4017/__qa/reset");
  expect(reset.status()).toBe(200);
  expect(await reset.json()).toMatchObject({ reset: true });
  await signIn(context);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        throw new DOMException("Canceled", "AbortError");
      },
    });
  });
  await page.goto(`${origin}/trips/${tripId}`, {
    waitUntil: "domcontentloaded",
  });
  const privatePreviewMeta = page.locator('meta[property="og:image"]').first();
  await expect(
    page.getByRole("heading", { name: "Paris", exact: true }),
  ).toBeVisible();
  await expect(privatePreviewMeta).toHaveAttribute(
    "content",
    /opengraph-image/,
  );
  const privatePreviewUrl = (await privatePreviewMeta.getAttribute("content"))!;
  const privatePreview = await page.request.get(privatePreviewUrl);
  expect(privatePreview.status()).toBe(200);
  expect(privatePreview.headers()["content-type"]).toContain("image/png");
  expect(privatePreview.headers()["cache-control"]).toContain("no-store");
  if (testInfo.project.name === "chromium")
    await saveEvidence(
      "../../artifacts/full-flow-ux-qa-2026-10-13/private-owner-trip-preview.png",
      await privatePreview.body(),
    );
  await page.getByRole("button", { name: "Share trip", exact: true }).click();
  const consent = page.getByRole("dialog", { name: "Make this trip public?" });
  await expect(consent).toBeVisible();
  await page.getByRole("button", { name: "Keep private", exact: true }).click();
  await expect(consent).not.toBeVisible();
  await page.getByRole("button", { name: "Share trip", exact: true }).click();
  const shared = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/trips/${tripId}/share`) &&
      response.request().method() === "POST",
  );
  await page
    .getByRole("button", { name: "Create public link", exact: true })
    .click();
  const response = await shared;
  expect(response.status()).toBe(200);
  const payload = await response.json();
  expect(payload.shareUrl).toBe(`${origin}/s/${payload.shareToken}`);
  await expect(
    page.getByRole("status").filter({ hasText: "Share sheet canceled" }),
  ).toBeVisible();
  const guest = await browser.newContext({
    viewport: page.viewportSize(),
    extraHTTPHeaders: { "Cache-Control": "no-cache" },
  });
  try {
    const publicPage = await guest.newPage();
    await publicPage.route(/^https:\/\//, (route) => route.abort());
    await publicPage.goto(payload.shareUrl, { waitUntil: "domcontentloaded" });
    await expect(
      publicPage.getByRole("heading", { name: "Paris", exact: true }),
    ).toBeVisible();
    await expect(
      publicPage.getByRole("heading", { name: /A first taste of Paris/ }),
    ).toBeVisible();
    await expect(
      publicPage.getByText("qa@example.invalid", { exact: true }),
    ).toHaveCount(0);
    const guestPrivatePreview = await guest.request.get(privatePreviewUrl, {
      maxRedirects: 0,
    });
    expect(guestPrivatePreview.status()).toBe(307);
    expect(guestPrivatePreview.headers().location).toContain("/auth/login");
    const publicPreviewMeta = publicPage
      .locator('meta[property="og:image"]')
      .first();
    await expect(publicPreviewMeta).toHaveAttribute(
      "content",
      /opengraph-image/,
    );
    const publicPreviewUrl = (await publicPreviewMeta.getAttribute("content"))!;
    const publicPreview = await guest.request.get(publicPreviewUrl);
    expect(publicPreview.status()).toBe(200);
    expect(publicPreview.headers()["content-type"]).toContain("image/png");
    expect(publicPreview.headers()["cache-control"]).toContain("no-store");
    const activeImage = await publicPreview.body();
    if (testInfo.project.name === "chromium")
      await saveEvidence(
        "../../artifacts/full-flow-ux-qa-2026-10-13/active-shared-trip-preview.png",
        activeImage,
      );
    const revoked = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/trips/${tripId}/share`) &&
        response.request().method() === "DELETE",
    );
    await page
      .getByRole("button", { name: "Turn off public access", exact: true })
      .click();
    expect((await revoked).status()).toBe(200);
    await expect(
      page
        .getByRole("status")
        .filter({ hasText: "Public access has been turned off" }),
    ).toBeVisible();
    const revokedPreview = await guest.request.get(publicPreviewUrl);
    expect(revokedPreview.status()).toBe(200);
    expect(revokedPreview.headers()["cache-control"]).toContain("no-store");
    const revokedImage = await revokedPreview.body();
    expect(revokedImage.equals(activeImage)).toBe(false);
    if (testInfo.project.name === "chromium")
      await saveEvidence(
        "../../artifacts/full-flow-ux-qa-2026-10-13/revoked-shared-trip-preview.png",
        revokedImage,
      );
    await publicPage.reload({ waitUntil: "domcontentloaded" });
    await expect(
      publicPage.getByRole("heading", { name: "Paris", exact: true }),
    ).toHaveCount(0);
    await expect(
      publicPage.getByRole("heading", {
        name: "This shared trip isn’t available",
      }),
    ).toBeVisible();
    await expect(
      publicPage.getByRole("link", {
        name: "Plan your own journey",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await publicPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (testInfo.project.name === "Mobile Chrome") {
      await publicPage.screenshot({
        path: "../../artifacts/full-flow-ux-qa-2026-10-13/shared-link-unavailable-phone.png",
      });
    }
    await publicPage
      .getByRole("link", { name: "Plan your own journey", exact: true })
      .click();
    await expect(publicPage).toHaveURL(`${origin}/create`, { timeout: 20_000 });
    await expect(
      publicPage.getByRole("region", {
        name: "Choose destination",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      publicPage.getByRole("heading", { name: "This page couldn’t load" }),
    ).toHaveCount(0);
  } finally {
    await guest.close();
  }
});

test("weather rejects malformed available data without losing the real itinerary", async ({
  page,
  context,
}) => {
  await signIn(context);
  let calls = 0;
  await page.route("**/api/weather?*", (route) =>
    route.fulfill({
      json: {
        status: "available",
        forecast:
          ++calls === 1
            ? { points: "broken" }
            : {
                updatedAt: "2099-06-01T08:00:00Z",
                deprecated: false,
                points: [
                  {
                    time: "2099-06-01T09:00:00Z",
                    temperatureC: 18,
                    windMetersPerSecond: 3,
                    precipitationMm: null,
                    precipitationHours: null,
                  },
                ],
              },
      },
    }),
  );
  const hydrated = page.waitForResponse((response) =>
    response.url().endsWith(`/api/trips/${tripId}/checkout`),
  );
  await page.goto(`${origin}/trips/${tripId}`, {
    waitUntil: "domcontentloaded",
  });
  await hydrated;
  const weather = page.getByRole("region", {
    name: "Trip weather",
    exact: true,
  });
  await weather
    .getByRole("button", { name: "Check trip forecast", exact: true })
    .click();
  await expect(weather.getByRole("status")).toContainText(
    "Weather is unavailable",
  );
  await expect(
    page.getByRole("heading", { name: "Paris", exact: true }),
  ).toBeVisible();
  await weather
    .getByRole("button", { name: "Check trip forecast", exact: true })
    .click();
  await expect(weather.getByRole("table")).toContainText("18 °C");
});

test("stalled weather recovers and a deliberate retry works in the real trip", async ({
  page,
  context,
}) => {
  await signIn(context);
  await page.clock.install();
  let release = () => {};
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route("**/api/weather?*", async (route) => {
    if (++calls === 1) await wait;
    await route
      .fulfill({
        json: {
          status: "available",
          forecast: {
            updatedAt: "2099-06-01T08:00:00Z",
            deprecated: false,
            points: [
              {
                time: "2099-06-01T09:00:00Z",
                temperatureC: 18,
                windMetersPerSecond: 3,
                precipitationMm: null,
                precipitationHours: null,
              },
            ],
          },
        },
      })
      .catch(() => {});
  });
  try {
    const hydrated = page.waitForResponse((response) =>
      response.url().endsWith(`/api/trips/${tripId}/checkout`),
    );
    await page.goto(`${origin}/trips/${tripId}`, {
      waitUntil: "domcontentloaded",
    });
    await hydrated;
    const weather = page.getByRole("region", {
      name: "Trip weather",
      exact: true,
    });
    await weather
      .getByRole("button", { name: "Check trip forecast", exact: true })
      .click();
    await expect.poll(() => calls).toBe(1);
    await page.clock.fastForward(16_000);
    await expect(weather.getByRole("status")).toContainText(
      "Weather is taking too long",
    );
    await weather
      .getByRole("button", { name: "Check trip forecast", exact: true })
      .click();
    await expect(weather.getByRole("table")).toContainText("18 °C");
    await expect(
      page.getByRole("heading", { name: "Paris", exact: true }),
    ).toBeVisible();
  } finally {
    release();
  }
});

test("SQL-backed private editor persists locks and swaps across reloads", async ({
  page,
  context,
  request,
}) => {
  test.skip(
    process.env.PRIVATE_ROUTE_SQL_QA !== "true",
    "Requires isolated PostgreSQL fixture and editing enabled.",
  );
  test.setTimeout(90_000);
  expect((await request.post("http://127.0.0.1:4017/__qa/reset")).ok()).toBe(
    true,
  );
  await signIn(context);
  await page.goto(`${origin}/trips/${tripId}`);
  const editor = page
    .locator("details")
    .filter({
      has: page.locator("summary", { hasText: "Make this plan yours" }),
    })
    .first();
  await editor.locator("summary").first().click();
  await editor
    .getByRole("button", { name: "Lock Museum", exact: true })
    .click();
  await expect(
    editor.getByRole("button", { name: "Unlock Museum", exact: true }),
  ).toBeEnabled({ timeout: 20_000 });
  await page.reload();
  await editor.locator("summary").first().click();
  await expect(
    editor.getByRole("button", { name: "Unlock Museum", exact: true }),
  ).toBeEnabled({ timeout: 20_000 });
  await editor
    .getByRole("button", { name: "Unlock Museum", exact: true })
    .click();
  await expect(
    editor.getByRole("button", { name: "Lock Museum", exact: true }),
  ).toBeEnabled({ timeout: 20_000 });
  const first = editor.getByLabel("First activity");
  const second = editor.getByLabel("Swap with");
  const museum = await first
    .locator("option")
    .filter({ hasText: "Museum" })
    .getAttribute("value");
  const gallery = await second
    .locator("option")
    .filter({ hasText: "Gallery" })
    .getAttribute("value");
  expect(museum).toBeTruthy();
  expect(gallery).toBeTruthy();
  await first.selectOption(museum!);
  await second.selectOption(gallery!);
  await editor
    .getByRole("button", { name: "Review swap", exact: true })
    .click();
  await expect(
    editor.getByRole("region", { name: "Review activity swap" }),
  ).toContainText("Your public link will be turned off");
  await editor
    .getByRole("button", { name: "Confirm swap", exact: true })
    .click();
  await expect(
    editor.getByRole("region", { name: "Review activity swap" }),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("tabpanel")).toContainText("Gallery");
  await page.getByRole("tab", { name: /Day 2/ }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Museum");
});

test("SQL-backed booking report requires review and survives reload", async ({
  page,
  context,
  request,
}) => {
  test.skip(
    process.env.PRIVATE_ROUTE_SQL_QA !== "true",
    "Requires isolated PostgreSQL fixture and checklist enabled.",
  );
  expect((await request.post("http://127.0.0.1:4017/__qa/reset")).ok()).toBe(
    true,
  );
  await signIn(context);
  await page.goto(`${origin}/trips/${tripId}`);
  const checklist = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", {
        name: "Booking checklist",
        exact: true,
      }),
    })
    .last();
  const museum = checklist.getByRole("listitem").filter({
    has: page.getByRole("heading", { name: "Museum", exact: true }),
  });
  await museum
    .getByRole("button", { name: "I booked this", exact: true })
    .click();
  const review = checklist.getByRole("region", {
    name: "Review booking report",
  });
  await expect(review).toContainText(
    "It does not make, change or cancel a reservation",
  );
  await expect(museum).not.toContainText("Booked · reported by you");
  await review
    .getByRole("button", { name: "Save my report", exact: true })
    .click();
  await expect(museum).toContainText("Booked · reported by you");
  await page.reload();
  await expect(museum).toContainText("Booked · reported by you");
  await expect(checklist).toContainText("none are independently verified");
});

for (const field of ["days", "tips"]) {
  test(`unreadable shared ${field} reaches focused recovery without an empty itinerary`, async ({
    page,
  }) => {
    await page.goto(`${origin}/s/qa_unreadable_${field}_token`, {
      waitUntil: "domcontentloaded",
    });
    const heading = page.getByRole("heading", {
      name: "This itinerary is taking a moment",
    });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    await expect(
      page.getByRole("heading", { name: "Paris", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Try again", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Get help", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}

test("delayed shared layout shows loading before focused recovery", async ({
  page,
}) => {
  test.skip(
    process.env.PRIVATE_ROUTE_DELAY_QA !== "true",
    "Requires dedicated delayed loopback fixture.",
  );
  await page.goto(`${origin}/s/qa_read_failure_token`, { waitUntil: "commit" });
  await expect(
    page.getByRole("status", { name: "Loading trip", exact: true }),
  ).toBeVisible();
  const heading = page.getByRole("heading", {
    name: "This itinerary is taking a moment",
  });
  await expect(heading).toBeVisible({ timeout: 20000 });
  await expect(heading).toBeFocused();
  await expect(
    page.getByRole("status", { name: "Loading trip", exact: true }),
  ).toHaveCount(0);
});

test("failed sign-out form reaches a usable recovery page", async ({
  page,
  context,
}) => {
  test.skip(
    process.env.PRIVATE_ROUTE_LOGOUT_QA !== "true",
    "Requires read-only fixture rejecting logout calls.",
  );
  await signIn(context);
  await page.goto(`${origin}/dashboard`);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Sign-out wasn’t confirmed" }),
  ).toBeVisible();
  await expect(page).toHaveURL(`${origin}/auth/logout-error`);
  await expect(
    page.getByRole("link", { name: "Check my session", exact: true }),
  ).toHaveAttribute("href", "/dashboard");
  await page
    .getByRole("button", { name: "Try signing out again", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome back", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(`${origin}/auth/login`);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("SQL-backed brief save preserves the old plan and refreshes the saved dates", async ({
  page,
  context,
  request,
}) => {
  test.skip(
    process.env.PRIVATE_ROUTE_SQL_QA !== "true",
    "Requires isolated brief RPC fixture.",
  );
  expect((await request.post("http://127.0.0.1:4017/__qa/reset")).ok()).toBe(
    true,
  );
  await signIn(context);
  await page.goto(`${origin}/trips/${tripId}`);
  const brief = page
    .locator("details")
    .filter({ has: page.locator("summary", { hasText: "Your trip brief" }) })
    .first();
  await brief.locator("summary").first().click();
  await brief.getByLabel("Start date", { exact: true }).fill("2099-07-01");
  await brief.getByLabel("End date", { exact: true }).fill("2099-07-03");
  await brief
    .getByRole("button", { name: "Save trip brief", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Your updated brief is saved" }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Previous plan", exact: true }),
  ).toContainText("Museum");
  await expect(
    page.getByRole("button", { name: "Start planning", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Previous plan", exact: true }),
  ).toContainText("2099-06-01");
  await page.reload();
  await expect(
    page.getByRole("status").filter({ hasText: "Your updated brief is saved" }),
  ).toBeVisible();
  await brief.locator("summary").first().click();
  await expect(brief.getByLabel("Start date", { exact: true })).toHaveValue(
    "2099-07-01",
  );
  await expect(brief.getByLabel("End date", { exact: true })).toHaveValue(
    "2099-07-03",
  );
  await expect(
    page.getByRole("region", { name: "Previous plan", exact: true }),
  ).toContainText("Museum");
});
