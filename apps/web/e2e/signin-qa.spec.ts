import { test, expect } from "@playwright/test";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "apikey,authorization,content-type,x-client-info,x-supabase-api-version",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};
test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\//, (route) => route.abort());
});

test("email sign-in serializes all methods and preserves credentials after failure", async ({
  page,
}) => {
  let release: () => void = () => undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let requests = 0;
  await page.route("**/auth/v1/token*", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    requests++;
    await pending;
    await route.fulfill({
      status: 400,
      headers,
      json: {
        code: "invalid_credentials",
        message: "Invalid login credentials",
      },
    });
  });
  await page.goto("/auth/login");
  await page.getByLabel("Email address").fill("traveler@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("oldpw");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Email address")).toBeDisabled();
  for (const name of ["Continue with Google", "Continue with Apple"]) {
    await expect(page.getByRole("button", { name })).toBeDisabled();
  }
  await page
    .locator("form")
    .evaluate((form) =>
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      ),
    );
  await expect.poll(() => requests).toBe(1);
  release();
  await expect(
    page.getByRole("alert").filter({ hasText: "Invalid email or password" }),
  ).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
    "oldpw",
  );
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Forgot password?" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Forgot your password?" }),
  ).toBeVisible();
});

test("signup validates locally and requests confirmation without an active session", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/auth/v1/signup*", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    requests++;
    await route.fulfill({
      status: 200,
      headers,
      json: {
        id: "00000000-0000-4000-8000-000000000001",
        email: "traveler@example.invalid",
        identities: [],
      },
    });
  });
  await page.goto("/auth/signup?redirectTo=%2Fcreate%3Fdraft%3Dfixture");
  await page.getByLabel("Email address").fill("traveler@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("different-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Passwords do not match" }),
  ).toBeVisible();
  expect(requests).toBe(0);
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("fixture-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "confirmation link" }),
  ).toBeVisible();
  expect(requests).toBe(1);
  await expect(
    page.getByRole("link", { name: "Sign in", exact: true }),
  ).toHaveAttribute(
    "href",
    "/auth/login?redirectTo=%2Fcreate%3Fdraft%3Dfixture",
  );
});

test("confirmed signup immediately continues to its validated destination", async ({
  page,
}) => {
  const user = {
    id: "00000000-0000-4000-8000-000000000001",
    email: "traveler@example.invalid",
    aud: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-01-01T00:00:00Z",
  };
  const token =
    [
      { alg: "HS256", typ: "JWT" },
      { sub: user.id, aud: "authenticated", exp: 4102444800 },
    ]
      .map((value) => Buffer.from(JSON.stringify(value)).toString("base64url"))
      .join(".") + ".fixture";
  await page.route("**/auth/v1/signup*", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    await route.fulfill({
      status: 200,
      headers,
      json: {
        user,
        access_token: token,
        refresh_token: "fixture-refresh",
        expires_in: 3600,
        token_type: "bearer",
      },
    });
  });
  await page.route("**/auth/v1/user*", (route) =>
    route.fulfill({ status: 200, headers, json: user }),
  );
  await page.goto(
    "/auth/signup?redirectTo=%2Ftools%2Fpacking-list%3Ffrom%3Dsignup",
  );
  await page.getByLabel("Email address").fill("traveler@example.invalid");
  await page.getByLabel("Password", { exact: true }).fill("fixture-password");
  await page
    .getByLabel("Confirm password", { exact: true })
    .fill("fixture-password");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/tools\/packing-list\?from=signup$/);
  await expect(
    page.getByRole("heading", { name: "Smart Packing List" }),
  ).toBeVisible();
});

test("canceling a provider returns to a usable sign-in screen with the trip draft intact", async ({
  page,
}) => {
  const destination = "/create?draft=fixture-provider-trip";
  let openedProvider = "";
  await page.route("**/auth/v1/authorize*", async (route) => {
    const authorize = new URL(route.request().url());
    openedProvider = authorize.searchParams.get("provider") || "";
    const callback = new URL(authorize.searchParams.get("redirect_to")!);
    callback.searchParams.set("error", "access_denied");
    await route.fulfill({
      contentType: "text/html",
      body: `<a href="${callback.toString().replace(/&/g, "&amp;")}">Cancel sign-in</a>`,
    });
  });
  await page.goto(`/auth/login?redirectTo=${encodeURIComponent(destination)}`);
  await page.getByRole("button", { name: "Continue with Google" }).click();
  await page.getByRole("link", { name: "Cancel sign-in" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Sign-in was canceled" }),
  ).toBeVisible();
  expect(openedProvider).toBe("google");
  expect(new URL(page.url()).searchParams.get("redirectTo")).toBe(destination);
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Continue with Apple" }),
  ).toBeEnabled();
});

test("returning from the provider through browser Back restores all sign-in methods", async ({
  page,
}) => {
  await page.route("**/auth/v1/authorize*", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<h1>Fixture provider</h1>",
    }),
  );
  await page.goto("/auth/login?redirectTo=%2Fcreate%3Fdraft%3Dfixture-back");
  await page.getByRole("button", { name: "Continue with Apple" }).click();
  await expect(
    page.getByRole("heading", { name: "Fixture provider" }),
  ).toBeVisible();
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Your trip is waiting" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Apple" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeEnabled();
  expect(new URL(page.url()).searchParams.get("redirectTo")).toBe(
    "/create?draft=fixture-back",
  );
});

test("callback timeout offers sign-in retry while preserving the trip destination", async ({
  page,
}) => {
  const destination = "/create?destination=paris";
  await page.goto(
    `/auth/login?error=auth_timeout&redirectTo=${encodeURIComponent(destination)}`,
  );
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Sign-in could not be confirmed" }),
  ).toHaveText(
    "Sign-in could not be confirmed. Choose a method below to try again.",
  );
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Continue with Apple" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("button", { name: "Sign in", exact: true }),
  ).toBeEnabled();
  await expect(page.locator('a[href^="/auth/signup"]')).toHaveAttribute(
    "href",
    `/auth/signup?redirectTo=${encodeURIComponent(destination)}`,
  );
});
