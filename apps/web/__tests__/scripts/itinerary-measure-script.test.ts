import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import packageJson from "../../package.json";

describe("itinerary latency measurement command", () => {
  it("keeps the perf script exposed through the web package", () => {
    expect(packageJson.scripts["perf:itinerary"]).toBe(
      "bun --env-file .env scripts/measure-itinerary-stream.ts",
    );
  });

  it("supports comparing baseline and streaming deployments separately", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts/measure-itinerary-stream.ts"),
      "utf8",
    );

    expect(source).toContain("baseline-base-url");
    expect(source).toContain("stream-base-url");
    expect(source).toContain("args.baselineBaseUrl");
    expect(source).toContain("args.streamBaseUrl");
  });

  it("documents a built-in simulated mobile-network profile", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts/measure-itinerary-stream.ts"),
      "utf8",
    );

    expect(source).toContain("simulated-rtt-ms");
    expect(source).toContain("simulated-down-kbps");
    expect(source).toContain("simulateDownload");
  });
});
