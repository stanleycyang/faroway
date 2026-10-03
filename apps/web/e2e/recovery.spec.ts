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
  await page.getByRole("button", { name: "Turn off public access" }).click();
  await expect(
    page.getByText("Public access has been turned off."),
  ).toBeVisible();
  expect((await request.get(`/s/${token}`)).status()).toBe(404);
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
