import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "../..");

function readRoot(path: string) {
  return readFileSync(join(root, path), "utf8");
}

describe("release readiness guardrails", () => {
  it("exposes the mobile release check from the repo root", () => {
    const packageJson = JSON.parse(readRoot("package.json")) as {
      scripts: Record<string, string>;
    };

    expect(packageJson.scripts["release:check:mobile"]).toBe(
      "cd apps/mobile && bun run release:check",
    );
  });

  it("keeps app.config.ts as the single Expo config source", () => {
    expect(existsSync(join(root, "apps/mobile/app.config.ts"))).toBe(true);
    expect(existsSync(join(root, "apps/mobile/app.json"))).toBe(false);
  });

  it("keeps shared itinerary pages link-only and reportable", () => {
    const layout = readRoot("apps/web/app/s/[token]/layout.tsx");
    const sharedView = readRoot("apps/web/components/trips/SharedTripView.tsx");

    expect(layout).toContain("robots: { index: false, follow: true }");
    expect(sharedView).toContain("Report this itinerary");
    expect(sharedView).toContain("/report?type=shared_trip&token=");
  });

  it("documents credential setup without storing credential values", () => {
    const credentialSetup = readRoot("docs/CREDENTIAL_SETUP.md");
    const eas = readRoot("apps/mobile/eas.json");

    expect(credentialSetup).toContain("Do not commit credential values");
    expect(credentialSetup).toContain("EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME");
    expect(eas).not.toMatch(
      /appleId|ascAppId|appleTeamId|serviceAccountKeyPath/,
    );
  });

  it("keeps mobile release env validation scoped to mobile inputs", () => {
    const checkEnv = readRoot("scripts/check-env.ts");

    expect(checkEnv).toContain('args.has("--mobile-release")');
    expect(checkEnv).toContain("MOBILE_RELEASE");
    expect(checkEnv).toContain("loadEasProductionEnv");
  });

  it("does not publish placeholder social metadata", () => {
    const blogTypes = readRoot("apps/web/lib/blog/types.ts");

    expect(blogTypes).not.toContain('twitter: "@faroway"');
  });
});
