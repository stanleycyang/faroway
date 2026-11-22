import { defineConfig, devices } from "@playwright/test";

if (!process.env.MONETIZATION_ROUTES_E2E) {
  process.env.MONETIZATION_ROUTES_E2E = "true";
}

export default defineConfig({
  testDir: "./e2e",
  testMatch: "monetization-routes.spec.ts",
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  use: {
    baseURL: "http://127.0.0.1:4410",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  webServer: {
    command: "node e2e/fixtures/monetization-server.mjs",
    url: "http://127.0.0.1:4410/api/health",
    timeout: 600_000,
    stdout: "pipe",
    reuseExistingServer: false,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  },
  projects: [{ name: "desktop", use: { ...devices["Desktop Chrome"] } }],
});
