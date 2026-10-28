import { test, expect } from "@playwright/test";
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "fixture@example.invalid",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
};
const id = "00000000-0000-4000-8000-000000000008";
const payload = {
  requestId: id,
  destination: "Paris",
  start_date: "2099-06-01",
  end_date: "2099-06-03",
  travelers: 2,
  budget: "moderate",
  preferences: { travelerType: "couple", vibes: ["cultural"] },
};
const baseTrip = {
  id,
  user_id: user.id,
  destination: "Paris",
  start_date: payload.start_date,
  end_date: payload.end_date,
  travelers: 2,
  status: "planned",
  preferences: {},
  updated_at: "2026-10-03T00:00:00.000Z",
  is_shared: false,
  share_token: null,
  itineraries: {
    overview: "Saved Paris plan",
    days: [
      {
        dayNumber: 1,
        date: payload.start_date,
        title: "Explore Paris",
        summary: "Saved choices",
        morning: { activities: [], meals: [] },
        afternoon: { activities: [], meals: [] },
        evening: { activities: [], meals: [] },
      },
    ],
    total_cost: null,
  },
};
test.beforeEach(async ({ page, context, request }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await request.post("http://127.0.0.1:4401/fixture/reset");
  const jwt =
    [
      { alg: "HS256", typ: "JWT" },
      { sub: user.id, aud: "authenticated", exp: 4102444800 },
    ]
      .map((value) => Buffer.from(JSON.stringify(value)).toString("base64url"))
      .join(".") + ".fixture";
  const session = {
    access_token: jwt,
    refresh_token: "fixture-refresh",
    expires_at: 4102444800,
    expires_in: 3600,
    token_type: "bearer",
    user,
  };
  await context.addCookies([
    {
      name: "sb-127-auth-token",
      value:
        "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"),
      domain: "127.0.0.1",
      path: "/",
    },
  ]);
  await page.route(/^https:\/\//, (route) => route.abort());
  await page.route("**/_next/image?**", (route) =>
    route.fulfill({
      contentType: "image/png",
      body: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN3sAAAAASUVORK5CYII=",
        "base64",
      ),
    }),
  );
});
test("resumes a lost creation response after reload without a duplicate trip", async ({
  page,
  request,
}) => {
  await page.goto("/create");
  await page.evaluate(
    ({ userId, value }) =>
      localStorage.setItem(
        `faroway:pending-create:${userId}`,
        JSON.stringify(value),
      ),
    { userId: user.id, value: payload },
  );
  await page.reload();
  let loseReply = true;
  await page.route("**/api/trips", async (route) => {
    if (route.request().method() === "POST" && loseReply) {
      loseReply = false;
      await route.fetch();
      await route.abort();
    } else await route.continue();
  });
  await page.route("**/api/trips/*/generate", (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Fixture planner temporarily unavailable" },
    }),
  );
  await page.getByRole("button", { name: "Resume saved trip" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: /fetch/i }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Resume saved trip" }).click();
  await expect(page).toHaveURL(new RegExp(`/trips/${id}$`));
  expect(
    (await (await request.get("http://127.0.0.1:4401/fixture/state")).json())
      .inserts,
  ).toBe(1);
  await expect(
    page.getByRole("button", { name: "Start planning" }),
  ).toBeVisible();
});
test("requires consent, explains canceled sharing, and permanently revokes the old link", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:4401/fixture/trip", { data: baseTrip });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async () => {
        throw new DOMException("Canceled", "AbortError");
      },
    }),
  );
  await page.goto(`/trips/${id}`);
  await page.getByRole("button", { name: "Share trip", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("sharing-consent.png"),
  });
  await page.getByRole("button", { name: "Keep private" }).click();
  expect(
    (await (await request.get("http://127.0.0.1:4401/fixture/state")).json())
      .trips[0].is_shared,
  ).toBe(false);
  await page.getByRole("button", { name: "Share trip", exact: true }).click();
  await page
    .getByRole("button", { name: "Create public link", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Share sheet canceled" }),
  ).toBeVisible();
  const shared = (
    await (await request.get("http://127.0.0.1:4401/fixture/state")).json()
  ).trips[0];
  expect(shared.is_shared).toBe(true);
  const token = shared.share_token;
  const published = await request.get(`/s/${token}`);
  expect(published.status()).toBe(200);
  expect(await published.text()).toContain("Saved Paris plan");
  await page.getByRole("button", { name: "Turn off public access" }).click();
  await expect(
    page.getByText("Public access has been turned off."),
  ).toBeVisible();
  const revoked = await request.get(`/s/${token}`);
  expect(revoked.status()).toBe(404);
  expect(await revoked.text()).not.toContain("Saved Paris plan");
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Create public share link" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Create public share link" }).click();
  await page
    .getByRole("button", { name: "Create public link", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Share sheet canceled" }),
  ).toBeVisible();
  const reshared = (
    await (await request.get("http://127.0.0.1:4401/fixture/state")).json()
  ).trips[0];
  expect(reshared.share_token).not.toBe(token);
  expect((await request.get(`/s/${token}`)).status()).toBe(404);
});

test("keeps the last usable itinerary when refreshing after retry fails", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:4401/fixture/trip", {
    data: { ...baseTrip, status: "failed" },
  });
  await page.goto(`/trips/${id}`);
  await page.route("**/api/trips/*/generate", (route) =>
    route.fulfill({ json: { success: true } }),
  );
  await page.route(`**/api/trips/${id}`, (route) =>
    route.fulfill({
      status: 503,
      json: { error: "Temporary fixture failure" },
    }),
  );
  await page.getByRole("button", { name: "Try Again" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Your last loaded trip" }),
  ).toContainText("Your last loaded trip is still shown");
  await expect(
    page.getByText("Saved Paris plan", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Trip not found", { exact: true })).toHaveCount(
    0,
  );
});

test("retries the trip fetch after terminal progress and a temporary failure", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:4401/fixture/trip", {
    data: {
      ...baseTrip,
      status: "generating",
      search_id: null,
      itineraries: null,
    },
  });
  let tripReads = 0;
  await page.route(`**/api/trips/${id}`, async (route) => {
    tripReads += 1;
    if (tripReads === 1) return route.continue();
    if (tripReads === 2)
      return route.fulfill({
        status: 503,
        json: { error: "Temporary fixture failure" },
      });
    return route.fulfill({
      json: { trip: baseTrip, itinerary: baseTrip.itineraries },
    });
  });
  await page.route("**/api/trips/*/generate", (route) =>
    route.fulfill({ json: { status: "completed" } }),
  );
  await page.goto(`/trips/${id}`);
  await expect(
    page.getByRole("alert").filter({ hasText: "Failed to fetch trip" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Refresh trip" }),
  ).toBeVisible();
  await expect(page.getByText("Saved Paris plan", { exact: true })).toBeVisible(
    { timeout: 20000 },
  );
  expect(tripReads).toBeGreaterThanOrEqual(3);
});

test("compiled workflow records its identity and stops a superseded attempt before AI", async ({
  request,
  context,
}) => {
  test.setTimeout(240_000);
  // Cold compilation on shared CI runners can exceed the workflow polling
  // budget. Compile the real internal handlers before dispatching the run.
  await context.request.get("/.well-known/workflow/v1/flow", {
    timeout: 120_000,
  });
  await context.request.get("/.well-known/workflow/v1/step", {
    timeout: 120_000,
  });
  await request.post("http://127.0.0.1:4401/fixture/trip", {
    data: { ...baseTrip, status: "draft", search_id: null, itineraries: null },
  });
  const response = await context.request.post(`/api/trips/${id}/generate`, {
    headers: { "x-faroway-ai-disclosure": "planning-google-v1" },
    data: {},
  });
  expect(response.status(), await response.text()).toBe(200);
  await expect
    .poll(
      async () => {
        const state = await (
          await request.get("http://127.0.0.1:4401/fixture/state")
        ).json();
        return {
          status: state.searches[0]?.status,
          updates: state.generationUpdates.map(
            (call: { p_state: string }) => call.p_state,
          ),
        };
      },
      { timeout: 120000 },
    )
    .toEqual({ status: "error", updates: ["progress", "failed"] });
  const state = await (
    await request.get("http://127.0.0.1:4401/fixture/state")
  ).json();
  expect(state.searches[0].workflow_run_id).toBeTruthy();
  expect(state.searches[0].error_message).toContain("no longer active");
  expect(
    state.generationUpdates.map((call: { p_state: string }) => call.p_state),
  ).toEqual(["progress", "failed"]);
  expect(state.generationUpdates[0].p_payload.step).toBe("orchestrator");
  // Exercise the real getRun() backend lookup after the compiled run settles.
  await expect
    .poll(
      async () => {
        const status = await context.request.get(`/api/trips/${id}/generate`);
        return (await status.json()).recovery;
      },
      { timeout: 30000 },
    )
    .toBe("settled");
});

test("uncertain planning offers a status check without dispatching another run", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:4401/fixture/trip", {
    data: {
      ...baseTrip,
      status: "generating",
      search_id: null,
      itineraries: null,
    },
  });
  let dispatches = 0;
  await page.route("**/api/trips/*/generate", (route) => {
    if (route.request().method() === "POST") dispatches += 1;
    return route.fulfill({
      json: {
        status: "generating",
        recovery: "unconfirmed",
        message:
          "Planning startup is unconfirmed. Your saved trip is safe. Check again shortly.",
      },
    });
  });
  await page.goto(`/trips/${id}`);
  await page.getByRole("button", { name: "Check planning status" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Planning startup is unconfirmed" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to saved trips" }),
  ).toBeVisible();
  expect(dispatches).toBe(0);
});

test("saves the complete brief without starting work and preserves it on reload", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:4401/fixture/trip", {
    data: {
      ...baseTrip,
      is_shared: true,
      share_token: "old-link",
      preferences: { originCity: "London", creationRequestHash: "keep-me" },
      itineraries: {
        ...baseTrip.itineraries,
        days: [
          {
            ...baseTrip.itineraries.days[0],
            hotel: {
              name: "Old hotel offer",
              pricePerNight: 100,
              currency: "USD",
              affiliateUrl: "https://booking.example.invalid/old",
            },
            transport: {
              provider: "Old airline",
              price: 200,
              currency: "USD",
              departure: { airport: "LHR", time: "08:00" },
              arrival: { airport: "CDG", time: "10:00" },
              affiliateUrl: "https://flights.example.invalid/old",
            },
            morning: {
              activities: [
                {
                  id: "old-activity",
                  name: "Old activity offer",
                  bookingInfo: {
                    bookingUrl: "https://viator.example.invalid/old",
                  },
                },
              ],
              meals: [],
            },
          },
        ],
      },
    },
  });
  let starts = 0;
  await page.route("**/api/trips/*/generate", (route) => {
    if (route.request().method() === "POST") starts++;
    return route.fulfill({ json: {} });
  });
  await page.goto(`/trips/${id}`);
  await page.getByText("Your trip brief", { exact: true }).click();
  await page
    .getByLabel("Interests, separated by commas")
    .fill("Art, quiet cafés");
  await page.getByLabel("Children", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Save trip brief" }).click();
  await expect(
    page.getByText("Your updated brief is saved.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start planning" }),
  ).toBeVisible();
  expect(starts).toBe(0);
  await expect(
    page.getByRole("region", { name: "Previous plan" }),
  ).toBeVisible();
  await expect(
    page.getByText("Old activity offer", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Old hotel offer", { exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByText("Your Flights", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Book|Review experience|View deal/i }),
  ).toHaveCount(0);
  await expect(page.locator('a[href*="example.invalid/old"]')).toHaveCount(0);
  const state = await (
    await request.get("http://127.0.0.1:4401/fixture/state")
  ).json();
  expect(state.trips[0]).toMatchObject({
    travelers: 3,
    is_shared: false,
    share_token: null,
    preferences: {
      adults: 2,
      children: 1,
      interests: ["Art", "quiet cafés"],
      creationRequestHash: "keep-me",
      originCity: "London",
    },
  });
  await page.reload();
  await page.getByText("Your trip brief", { exact: true }).click();
  await expect(page.getByLabel("Interests, separated by commas")).toHaveValue(
    "Art, quiet cafés",
  );
  await page.screenshot({
    path: test.info().outputPath("trip-brief-editor.png"),
    fullPage: true,
  });
});

test("keeps unsaved edits when another device changes the brief", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:4401/fixture/trip", { data: baseTrip });
  await page.goto(`/trips/${id}`);
  await page.getByText("Your trip brief", { exact: true }).click();
  await page.getByLabel("Destination", { exact: true }).fill("Vienna");
  await request.post("http://127.0.0.1:4401/fixture/trip", {
    data: {
      ...baseTrip,
      destination: "Rome",
      updated_at: "2026-10-04T00:00:00.000Z",
    },
  });
  await page.getByRole("button", { name: "Save trip brief" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "another tab or device" }),
  ).toBeVisible();
  await expect(page.getByLabel("Destination", { exact: true })).toHaveValue(
    "Vienna",
  );
  await page.getByRole("button", { name: "Load latest brief" }).click();
  await page.getByText("Your trip brief", { exact: true }).click();
  await expect(page.getByLabel("Destination", { exact: true })).toHaveValue(
    "Rome",
  );
});

test("saving unchecked legacy flight permission persists explicit refusal", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:4401/fixture/trip", {
    data: { ...baseTrip, preferences: { travelerType: "couple" } },
  });
  await page.goto(`/trips/${id}`);
  await page.getByText("Your trip brief", { exact: true }).click();
  await expect(page.getByLabel("Allow flight searches")).not.toBeChecked();
  await page.getByRole("button", { name: "Save trip brief" }).click();
  await expect(
    page.getByText("Your updated brief is saved.", { exact: false }),
  ).toBeVisible();
  const state = await (
    await request.get("http://127.0.0.1:4401/fixture/state")
  ).json();
  expect(state.trips[0].preferences.flightSearch).toBeNull();
});

test("unchanged brief with saved flight refusal preserves its revision and public link", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:4401/fixture/trip", {
    data: {
      ...baseTrip,
      preferences: { travelerType: "couple", flightSearch: null },
      is_shared: true,
      share_token: "keep-public-link",
    },
  });
  let writes = 0;
  await page.route("**/api/trips/*", async (route) => {
    if (route.request().method() === "PATCH") writes++;
    await route.continue();
  });
  await page.goto(`/trips/${id}`);
  await page.getByText("Your trip brief", { exact: true }).click();
  await page.getByRole("button", { name: "Save trip brief" }).click();
  await expect(
    page.getByText("Your brief is already up to date.", { exact: false }),
  ).toBeVisible();
  expect(writes).toBe(0);
  const state = await (
    await request.get("http://127.0.0.1:4401/fixture/state")
  ).json();
  expect(state.trips[0]).toMatchObject({
    status: "planned",
    updated_at: baseTrip.updated_at,
    is_shared: true,
    share_token: "keep-public-link",
    preferences: { travelerType: "couple", flightSearch: null },
  });
});

test("locks favorites and reviews a swap before publishing a new plan", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:4401/fixture/trip", {
    data: {
      ...baseTrip,
      is_shared: true,
      share_token: "old-plan-link",
      itineraries: {
        ...baseTrip.itineraries,
        days: [
          {
            ...baseTrip.itineraries.days[0],
            morning: {
              activities: [{ id: "walk", name: "Quiet walk" }],
              meals: [],
            },
            afternoon: {
              activities: [{ id: "museum", name: "Art museum" }],
              meals: [],
            },
          },
        ],
      },
    },
  });
  await page.goto(`/trips/${id}`);
  const editor = page
    .locator("details")
    .filter({ has: page.getByText("Make this plan yours", { exact: false }) })
    .first();
  await editor.locator("summary").first().click();
  await editor
    .getByRole("button", { name: "Lock Quiet walk", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get("http://127.0.0.1:4401/fixture/state")
          ).json()
        ).planHistory.length,
    )
    .toBe(1);
  await expect(editor).toHaveAttribute("open");
  await expect(
    editor.getByRole("button", { name: "Unlock Quiet walk", exact: true }),
  ).toBeVisible();
  await expect(editor.getByRole("button", { name: "Review swap" })).toHaveCount(
    0,
  );
  await editor
    .getByRole("button", { name: "Unlock Quiet walk", exact: true })
    .click();
  await expect
    .poll(
      async () =>
        (
          await (
            await request.get("http://127.0.0.1:4401/fixture/state")
          ).json()
        ).planHistory.length,
    )
    .toBe(2);
  await expect(editor).toHaveAttribute("open");
  await editor
    .getByRole("combobox", { name: "First activity", exact: true })
    .selectOption({ label: "Quiet walk · 2099-06-01 morning" });
  await editor
    .getByRole("combobox", { name: "Swap with", exact: true })
    .selectOption({ label: "Art museum · 2099-06-01 afternoon" });
  await editor
    .getByRole("button", { name: "Review swap", exact: true })
    .click();
  await expect(
    editor.getByRole("region", { name: "Review activity swap" }),
  ).toContainText("Quiet walk moves to 2099-06-01, afternoon");
  expect(
    (await (await request.get("http://127.0.0.1:4401/fixture/state")).json())
      .planHistory.length,
  ).toBe(2);
  await page.screenshot({
    path: test.info().outputPath("review-plan-swap.png"),
    fullPage: true,
  });
  let loseReply = true;
  await page.route("**/api/trips/*/plan", async (route) => {
    if (route.request().method() === "POST" && loseReply) {
      loseReply = false;
      await route.fetch();
      await route.abort();
    } else await route.continue();
  });
  await editor.getByRole("button", { name: "Confirm swap" }).click();
  await expect(
    editor.getByText("A plan change needs confirmation.", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await editor.locator("summary").first().click();
  await editor.getByRole("button", { name: "Check saved plan" }).click();
  await expect(
    editor.getByRole("button", { name: "Retry saved change" }),
  ).toHaveCount(0);
  const state = await (
    await request.get("http://127.0.0.1:4401/fixture/state")
  ).json();
  expect(state.planHistory).toHaveLength(3);
  expect(state.trips[0].itineraries.days[0].morning.activities[0].name).toBe(
    "Art museum",
  );
  expect(state.trips[0].is_shared).toBe(false);
});

test("refreshes the main trip after a confirmed edit even when editor refresh fails", async ({
  page,
  request,
}) => {
  await request.post("http://127.0.0.1:4401/fixture/trip", {
    data: {
      ...baseTrip,
      is_shared: true,
      share_token: "old-link",
      itineraries: {
        ...baseTrip.itineraries,
        days: [
          {
            ...baseTrip.itineraries.days[0],
            morning: {
              activities: [{ id: "walk", name: "Quiet walk" }],
              meals: [],
            },
          },
        ],
      },
    },
  });
  let saved = false;
  let failEditorRefresh = true;
  let mainReadsAfterSave = 0;
  await page.route("**/api/trips/*", async (route) => {
    if (saved && route.request().method() === "GET") mainReadsAfterSave++;
    await route.continue();
  });
  await page.route("**/api/trips/*/plan", async (route) => {
    if (route.request().method() === "POST") {
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      saved = true;
      return route.fulfill({ response });
    }
    if (saved && failEditorRefresh)
      return route.fulfill({
        status: 503,
        json: { error: "Editor refresh temporarily unavailable" },
      });
    await route.continue();
  });
  await page.goto(`/trips/${id}`);
  const editor = page
    .locator("details")
    .filter({ has: page.getByText("Make this plan yours", { exact: false }) })
    .first();
  await editor.locator("summary").first().click();
  await editor
    .getByRole("button", { name: "Lock Quiet walk", exact: true })
    .click();
  await expect.poll(() => mainReadsAfterSave).toBeGreaterThan(0);
  await expect(
    page.getByRole("button", { name: "Create public share link", exact: true }),
  ).toBeVisible();
  await expect(editor).toHaveAttribute("open");
  await expect(
    editor.getByRole("button", { name: "Refresh saved plan" }),
  ).toBeVisible();
  await expect(
    editor.getByRole("button", { name: "Retry saved change" }),
  ).toHaveCount(0);
  await expect(editor).not.toContainText("Your last accepted plan is kept");
  failEditorRefresh = false;
  await editor.getByRole("button", { name: "Refresh saved plan" }).click();
  await expect(
    editor.getByRole("button", { name: "Unlock Quiet walk", exact: true }),
  ).toBeVisible();
  const state = await (
    await request.get("http://127.0.0.1:4401/fixture/state")
  ).json();
  expect(state.planHistory).toHaveLength(1);
});

test("retains traveler booking reports after interruption, edits and regeneration", async ({
  page,
  request,
}) => {
  const trip = structuredClone(baseTrip);
  trip.itineraries.days[0].morning.activities = [
    { name: "Quiet walk" },
  ] as never;
  await request.post("http://127.0.0.1:4401/fixture/trip", { data: trip });
  await page.goto(`/trips/${id}`);
  const checklist = page.getByRole("region", {
    name: "Booking checklist",
    exact: true,
  });
  await expect(
    checklist.getByText("Provider verification is not connected.", {
      exact: false,
    }),
  ).toBeVisible();
  let dropReply = true;
  await page.route("**/api/trips/*/bookings", async (route) => {
    if (route.request().method() === "POST" && dropReply) {
      dropReply = false;
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      await route.abort();
    } else await route.continue();
  });
  await checklist
    .getByRole("button", { name: "I opened the provider", exact: true })
    .click();
  await checklist
    .getByRole("button", { name: "Save my report", exact: true })
    .click();
  await expect(
    checklist.getByRole("button", { name: "Check saved report", exact: true }),
  ).toBeVisible();
  await page.reload();
  await checklist
    .getByRole("button", { name: "Check saved report", exact: true })
    .click();
  await expect(
    checklist.getByText("Provider opened · reported by you", { exact: true }),
  ).toBeVisible();
  await expect(
    checklist.getByRole("button", { name: "Retry same report", exact: true }),
  ).toHaveCount(0);
  await checklist
    .getByRole("button", { name: "I booked this", exact: true })
    .click();
  await expect(
    checklist.getByText("This records your own progress only.", {
      exact: false,
    }),
  ).toBeVisible();
  await checklist
    .getByRole("button", { name: "Save my report", exact: true })
    .click();
  await expect(
    checklist.getByText("Booked · reported by you", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("booking-checklist.png"),
    fullPage: true,
  });
  let state = await (
    await request.get("http://127.0.0.1:4401/fixture/state")
  ).json();
  expect(state.bookingReports).toHaveLength(2);
  expect(state.trips[0].updated_at).toBe(trip.updated_at);
  await page
    .locator("summary")
    .filter({ hasText: "Make this plan yours" })
    .click();
  await page
    .getByRole("button", { name: "Lock Quiet walk", exact: true })
    .click();
  await expect(
    checklist.getByText("Trip changed — review this report", { exact: false }),
  ).toBeVisible();
  await expect(
    checklist.getByText("Booked · reported by you", { exact: true }),
  ).toBeVisible();
  state = await (
    await request.get("http://127.0.0.1:4401/fixture/state")
  ).json();
  state.trips[0].itineraries.booking_generation_id =
    "00000000-0000-4000-8000-000000000099";
  state.trips[0].updated_at = "2026-10-05T00:00:00.000Z";
  await request.post("http://127.0.0.1:4401/fixture/trip", {
    data: state.trips[0],
  });
  await page.reload();
  await expect(
    checklist.getByText("Review / still needed", { exact: true }),
  ).toBeVisible();
  await checklist
    .getByText("Reports from earlier or unavailable activities (1)", {
      exact: true,
    })
    .click();
  await expect(
    checklist.getByText("Quiet walk · 2099-06-01 · Booked · reported by you", {
      exact: true,
    }),
  ).toBeVisible();
});

test("recovers a confirmed booking report when the following refresh fails", async ({
  page,
  request,
}) => {
  const trip = structuredClone(baseTrip);
  trip.itineraries.days[0].morning.activities = [
    { name: "Quiet walk" },
  ] as never;
  await request.post("http://127.0.0.1:4401/fixture/trip", { data: trip });
  await page.goto(`/trips/${id}`);
  const checklist = page.getByRole("region", {
    name: "Booking checklist",
    exact: true,
  });
  let saved = false,
    failRead = true;
  await page.route("**/api/trips/*/bookings", async (route) => {
    if (route.request().method() === "POST") {
      const response = await route.fetch();
      expect(response.status()).toBe(200);
      saved = true;
      await route.fulfill({ response });
    } else if (saved && failRead)
      await route.fulfill({ status: 503, json: { error: "Unavailable" } });
    else await route.continue();
  });
  await checklist
    .getByRole("button", { name: "I booked this", exact: true })
    .click();
  await checklist
    .getByRole("button", { name: "Save my report", exact: true })
    .click();
  await expect(
    checklist.getByText(
      "Your report was saved, but progress could not refresh.",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    checklist.getByRole("button", { name: "Retry same report", exact: true }),
  ).toHaveCount(0);
  failRead = false;
  await checklist
    .getByRole("button", { name: "Refresh saved progress", exact: true })
    .click();
  await expect(
    checklist.getByText("Booked · reported by you", { exact: true }),
  ).toBeVisible();
  const state = await (
    await request.get("http://127.0.0.1:4401/fixture/state")
  ).json();
  expect(state.bookingReports).toHaveLength(1);
  await checklist
    .getByRole("button", { name: "Still needed", exact: true })
    .click();
  await expect(
    checklist.getByText("changing this status does not cancel it", {
      exact: false,
    }),
  ).toBeVisible();
  await checklist
    .getByRole("button", { name: "Keep current status", exact: true })
    .click();
  await expect(
    checklist.getByText("Booked · reported by you", { exact: true }),
  ).toBeVisible();
});

test("AI sharing decline makes no trip or planning request; a deliberate retry sends versioned consent", async ({
  page,
  request,
}) => {
  await page.goto("/create");
  await page.evaluate(
    ({ userId, value }) =>
      localStorage.setItem(
        `faroway:pending-create:${userId}`,
        JSON.stringify(value),
      ),
    { userId: user.id, value: payload },
  );
  await page.reload();
  page.removeAllListeners("dialog");
  page.on("dialog", (dialog) => dialog.dismiss());
  let generations = 0;
  await page.route("**/api/trips/*/generate", (route) => {
    generations++;
    expect(route.request().headers()["x-faroway-ai-disclosure"]).toBe(
      "planning-google-v1",
    );
    expect(route.request().headers()["authorization"]).toMatch(/^Bearer /);
    return route.fulfill({
      status: 503,
      json: { error: "Fixture unavailable" },
    });
  });
  await page.getByRole("button", { name: "Resume saved trip" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: /sharing declined/i }),
  ).toBeVisible();
  expect(generations).toBe(0);
  expect(
    (await (await request.get("http://127.0.0.1:4401/fixture/state")).json())
      .inserts,
  ).toBe(0);
  page.removeAllListeners("dialog");
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Resume saved trip" }).click();
  await expect(page).toHaveURL(new RegExp(`/trips/${id}$`));
  expect(generations).toBe(1);
});

test("a delayed create retry cannot recreate a deleted trip", async ({
  context,
  request,
}) => {
  const first = await context.request.post("/api/trips", { data: payload });
  expect(first.status()).toBe(201);
  expect((await context.request.delete(`/api/trips/${id}`)).ok()).toBe(true);
  const replay = await context.request.post("/api/trips", { data: payload });
  expect(replay.status()).toBe(410);
  expect((await replay.json()).code).toBe("CREATION_DELETED");
  const state = await (
    await request.get("http://127.0.0.1:4401/fixture/state")
  ).json();
  expect(state.trips).toHaveLength(0);
  expect(state.inserts).toBe(1);
});

test("a stalled creation releases the UI and keeps the same request for retry", async ({
  page,
  request,
}) => {
  // Shorten only the write deadline; production uses 25 seconds.
  await page.addInitScript(() => {
    const timeout = AbortSignal.timeout.bind(AbortSignal);
    AbortSignal.timeout = (ms) => timeout(ms === 25_000 ? 200 : ms);
  });
  await page.goto("/create");
  await page.evaluate(
    ({ userId, value }) =>
      localStorage.setItem(
        `faroway:pending-create:${userId}`,
        JSON.stringify(value),
      ),
    { userId: user.id, value: payload },
  );
  await page.reload();
  await page.route("**/api/trips", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    // Leave this request unanswered. Its AbortSignal must release the screen.
    return undefined;
  });
  await page.getByRole("button", { name: "Resume saved trip" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Resume saved trip" }),
  ).toBeEnabled();
  const saved = await page.evaluate(
    (userId) =>
      JSON.parse(localStorage.getItem(`faroway:pending-create:${userId}`)!),
    user.id,
  );
  expect(saved.requestId).toBe(id);
  expect(
    (await (await request.get("http://127.0.0.1:4401/fixture/state")).json())
      .inserts,
  ).toBe(0);
});
