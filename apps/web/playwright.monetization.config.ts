import { defineConfig, devices } from "@playwright/test";

// Component & shared-contract browser tests use isolated local fixtures and
// mocked APIs. No Supabase account, provider credentials, or Next server needed.
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["monetization-checkout.spec.ts", "monetization-surfaces.spec.ts"],
  workers: 1,
  use: {
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
