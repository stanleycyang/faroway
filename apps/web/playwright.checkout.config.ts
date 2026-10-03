import { defineConfig, devices } from "@playwright/test";

// Component browser tests use an isolated local fixture and mocked APIs. No
// Supabase account, provider credentials, Next server, or real booking needed.
export default defineConfig({
  testDir: "./e2e",
  testMatch: ["checkout.spec.ts", "places.spec.ts"],
  workers: 1,
  use: {
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : {},
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
});
