import { defineConfig, devices } from "@playwright/test";

const hasExternalBaseUrl = Boolean(process.env.E2E_BASE_URL?.trim());

process.env.E2E_INTEGRATED_MONETIZATION ||= "true";
process.env.E2E_BASE_URL ||= "http://127.0.0.1:4410";
process.env.E2E_SHARED_TRIP_TOKEN ||= "e2e-shared-tokyo-token";
process.env.E2E_OWNED_TRIP_ID ||= "44444444-4444-4444-8444-444444444444";
process.env.E2E_AUTH_USER_ID ||= "11111111-1111-4111-8111-111111111111";
process.env.NEXT_PUBLIC_SUPABASE_URL ||= "http://127.0.0.1:4411";

process.env.VIATOR_WEBHOOK_SECRET ||= "fixture-viator-webhook-secret";
process.env.GYG_WEBHOOK_SECRET ||= "fixture-gyg-webhook-secret";
process.env.KLOOK_WEBHOOK_SECRET ||= "fixture-klook-webhook-secret";
process.env.TRAVELPAYOUTS_WEBHOOK_SECRET ||=
  "fixture-travelpayouts-webhook-secret";
process.env.STAY22_WEBHOOK_SECRET ||= "fixture-stay22-webhook-secret";
process.env.DUFFEL_WEBHOOK_SECRET ||= "fixture-duffel-webhook-secret";
process.env.SAFETYWING_WEBHOOK_SECRET ||= "fixture-safetywing-webhook-secret";
process.env.AIRALO_WEBHOOK_SECRET ||= "fixture-airalo-webhook-secret";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "monetization-integrated.spec.ts",
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  ...(hasExternalBaseUrl
    ? {}
    : {
        webServer: {
          command: "node e2e/fixtures/monetization-server.mjs",
          env: {
            ...process.env,
            E2E_SEED_INTEGRATED: "true",
          },
          url: "http://127.0.0.1:4410/api/health",
          timeout: 600_000,
          stdout: "pipe",
          reuseExistingServer: false,
          gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
        },
      }),
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 14"] },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
