import { test, expect } from "@playwright/test";
import { AUTH_REQUEST_DEADLINE_MS } from "../lib/auth/request-deadline";

const AUTH_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "apikey, authorization, content-type, x-client-info, x-supabase-api-version",
  "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
};

test.beforeEach(async ({ page }) => {
  await page.route(/^https:\/\//, (route) => route.abort());
});

test("password recovery keeps one submitted address while sending and confirms without exposing account existence", async ({
  page,
}) => {
  let release: () => void = () => undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const emails: string[] = [];
  await page.route("**/auth/v1/recover*", async (route) => {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "apikey, authorization, content-type, x-client-info, x-supabase-api-version",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    emails.push(route.request().postDataJSON().email);
    await pending;
    await route.fulfill({ status: 200, headers, json: {} });
  });
  await page.goto("/auth/forgot-password", { waitUntil: "domcontentloaded" });
  const email = page.getByRole("textbox", { name: "Email address" });
  await email.fill("traveler@example.invalid");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(email).toBeDisabled();
  await expect(page.getByRole("button", { name: "Sending..." })).toBeDisabled();
  await page.locator("form").evaluate((form) => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  await expect.poll(() => emails.length).toBe(1);
  release();
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
  await expect(
    page.getByText("If an account uses", { exact: false }),
  ).toContainText("traveler@example.invalid");
  expect(emails).toEqual(["traveler@example.invalid"]);
  await expect(
    page.getByRole("link", { name: "Back to sign in" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("password recovery preserves the address after a provider error and allows a deliberate retry", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/auth/v1/recover*", async (route) => {
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "apikey, authorization, content-type, x-client-info, x-supabase-api-version",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
    };
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }
    calls++;
    await route.fulfill(
      calls === 1
        ? {
            status: 429,
            headers,
            json: { message: "Please wait before requesting another link." },
          }
        : { status: 200, headers, json: {} },
    );
  });
  await page.goto("/auth/forgot-password", { waitUntil: "domcontentloaded" });
  const email = page.getByRole("textbox", { name: "Email address" });
  await email.fill("traveler@example.invalid");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Please wait before requesting another link." }),
  ).toBeVisible();
  await expect(email).toHaveValue("traveler@example.invalid");
  await expect(email).toBeEnabled();
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
  expect(calls).toBe(2);
});

test("a stalled reset request releases the form and cannot later overwrite its recovery state", async ({
  page,
}) => {
  await page.clock.install();
  let release: () => void = () => undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let calls = 0;
  await page.route("**/auth/v1/recover*", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: AUTH_CORS });
      return;
    }
    calls++;
    await pending;
    await route.fulfill({ status: 200, headers: AUTH_CORS, json: {} });
  });
  await page.goto("/auth/forgot-password", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("textbox", { name: "Email address" })
    .fill("traveler@example.invalid");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect.poll(() => calls).toBe(1);
  await page.clock.fastForward(AUTH_REQUEST_DEADLINE_MS + 1);
  const error = page
    .getByRole("alert")
    .filter({ hasText: "Check your inbox before trying again" });
  await expect(error).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send reset link" }),
  ).toBeEnabled();
  const lateResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/auth/v1/recover") &&
      response.request().method() === "POST",
  );
  release();
  await (await lateResponse).finished();
  await page.clock.runFor(1);
  await expect(error).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toHaveCount(0);
  expect(calls).toBe(1);
});

test("new-password validation explains a mismatch without writing or clearing the fields", async ({
  page,
}) => {
  let writes = 0;
  await page.route("**/auth/v1/user*", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: AUTH_CORS });
      return;
    }
    if (route.request().method() === "PUT") writes++;
    await route.fulfill({
      status: 401,
      json: { message: "No recovery session" },
    });
  });
  await page.goto("/auth/reset-password", { waitUntil: "domcontentloaded" });
  await page.getByLabel("New password", { exact: true }).fill("first-password");
  await page
    .getByLabel("Confirm new password", { exact: true })
    .fill("other-password");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Passwords do not match" }),
  ).toBeVisible();
  await expect(page.getByLabel("New password", { exact: true })).toHaveValue(
    "first-password",
  );
  await expect(page.getByLabel("New password", { exact: true })).toBeEnabled();
  expect(writes).toBe(0);
});

test("password update locks the submitted password and focuses the completed state", async ({
  page,
  context,
  baseURL,
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
  const session = {
    user,
    access_token: token,
    refresh_token: "fixture-refresh",
    expires_at: 4102444800,
    expires_in: 3600,
    token_type: "bearer",
  };
  await context.addCookies([
    {
      name: process.env.E2E_SUPABASE_COOKIE || "sb-localhost-auth-token",
      value:
        "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"),
      url: baseURL!,
    },
  ]);
  let release: () => void = () => undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const passwords: string[] = [];
  await page.route("**/auth/v1/user*", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: AUTH_CORS });
      return;
    }
    if (route.request().method() === "PUT") {
      passwords.push(route.request().postDataJSON().password);
      await pending;
    }
    await route.fulfill({ status: 200, headers: AUTH_CORS, json: user });
  });
  await page.goto("/auth/reset-password", { waitUntil: "domcontentloaded" });
  const password = page.getByLabel("New password", { exact: true });
  const confirmation = page.getByLabel("Confirm new password", { exact: true });
  await password.fill("fixture-password");
  await confirmation.fill("fixture-password");
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(password).toBeDisabled();
  await expect(confirmation).toBeDisabled();
  await expect.poll(() => passwords.length).toBe(1);
  release();
  await expect(
    page.getByRole("heading", { name: "Password updated" }),
  ).toBeFocused();
  await expect(
    page.getByRole("link", { name: "Continue to my trips" }),
  ).toBeVisible();
  expect(passwords).toEqual(["fixture-password"]);
});

test("sign-in and legacy trip links preserve the traveler’s destination and return context", async ({
  page,
}) => {
  await page.goto("/dashboard?filter=upcoming&sort=date-asc", {
    waitUntil: "domcontentloaded",
  });
  await expect
    .poll(() => new URL(page.url()).searchParams.get("redirectTo"))
    .toBe("/dashboard?filter=upcoming&sort=date-asc");
  await page.goto("/trips/new?destination=paris", {
    waitUntil: "domcontentloaded",
  });
  await expect(page.locator(".trip-planner")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(
    page.getByRole("heading", { name: "Paris", exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/create");
});

test("editorial typography resolves the body-scoped font in the real application", async ({
  page,
}) => {
  await page.goto("/auth/forgot-password", { waitUntil: "domcontentloaded" });
  const heading = page.getByRole("heading", { name: "Reset your password" });
  await expect(heading).toHaveCSS("font-family", /Playfair Display/);
  await page.evaluate(() => document.fonts.ready);
  expect(
    await page.evaluate(() =>
      [...document.fonts].some(
        (face) =>
          face.family.includes("Playfair Display") && face.status === "loaded",
      ),
    ),
  ).toBe(true);
});

test("password recovery preserves the trip draft through login, reset request, and confirmation", async ({
  page,
}) => {
  const destination = "/create?draft=fixture-journey";
  let redirect = "";
  await page.route("**/auth/v1/recover*", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: AUTH_CORS });
      return;
    }
    redirect =
      new URL(route.request().url()).searchParams.get("redirect_to") || "";
    await route.fulfill({ status: 200, headers: AUTH_CORS, json: {} });
  });
  await page.goto(`/auth/login?redirectTo=${encodeURIComponent(destination)}`);
  await page.getByRole("link", { name: "Forgot your password?" }).click();
  await expect(page).toHaveURL(
    new RegExp(
      `/auth/forgot-password\\?redirectTo=${encodeURIComponent(destination)}$`,
    ),
  );
  await expect(
    page.getByRole("heading", { name: "Reset your password" }),
  ).toBeVisible();
  await page.getByLabel("Email address").fill("traveler@example.invalid");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(
    page.getByRole("heading", { name: "Check your email" }),
  ).toBeVisible();
  expect(new URL(redirect).searchParams.get("next")).toBe(
    `/auth/reset-password?redirectTo=${encodeURIComponent(destination)}`,
  );
  await expect(
    page.getByRole("link", { name: "Back to sign in" }),
  ).toHaveAttribute(
    "href",
    `/auth/login?redirectTo=${encodeURIComponent(destination)}`,
  );
});
