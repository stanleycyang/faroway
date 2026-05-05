import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import packageJson from "../../package.json";

describe("vendor diagnostics command", () => {
  it("keeps strict live checks patient while app runtime defaults stay fast", () => {
    const command = packageJson.scripts["vendors:check"];

    expect(command).toContain("ITINERARY_VENDOR_REQUIRE_ALL=true");
    expect(command).toContain("ITINERARY_VENDOR_TIMEOUT_MS=30000");
    expect(command).toContain("DUFFEL_SUPPLIER_TIMEOUT_MS=30000");
    expect(command).toContain("DUFFEL_LINK_TIMEOUT_MS=10000");
  });

  it("uses future-relative dates so live vendor checks do not go stale", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts/check-itinerary-vendors.ts"),
      "utf8",
    );

    expect(source).toContain("CHECK_START_DATE");
    expect(source).toContain("formatDateOffset");
    expect(source).not.toContain("2026-06-01");
    expect(source).not.toContain("2026-06-05");
  });

  it("uses current Tavily bearer authentication", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts/check-itinerary-vendors.ts"),
      "utf8",
    );

    expect(source).toContain("Authorization: `Bearer ${apiKey}`");
    expect(source).not.toContain("api_key: apiKey");
  });
});
