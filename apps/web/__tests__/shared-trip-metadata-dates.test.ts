import { afterEach, expect, test, vi } from "vitest";
import { generateMetadata } from "../app/s/[token]/layout";
vi.mock("@/lib/trips/load-shared-trip", () => ({
  loadSharedTrip: async () => ({
    destination: "Tokyo",
    start_date: "2026-11-01",
    end_date: "2026-11-04",
    travelers: 2,
  }),
}));
afterEach(() => vi.unstubAllEnvs());
test.each(["America/Los_Angeles", "UTC", "Asia/Tokyo"])(
  "shared preview keeps calendar dates and duration in %s",
  async (timezone) => {
    vi.stubEnv("TZ", timezone);
    const metadata = await generateMetadata({
      params: Promise.resolve({ token: "fixture-link" }),
    });
    expect(metadata.title).toBe("4-day Tokyo Trip Itinerary");
    expect(metadata.description).toContain("Nov 1 - Nov 4, 2026");
  },
);
