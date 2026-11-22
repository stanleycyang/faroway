import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    children?: React.ReactNode;
  }) => React.createElement("a", props, children),
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("AppStoreButtons", () => {
  test("renders direct /create web planner CTA without mailto dead end or raw phone emoji when store links are unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_STORE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_PLAY_STORE_URL", "");
    vi.resetModules();

    const { AppStoreButtons } = await import("@/components/AppStoreButtons");
    const html = renderToStaticMarkup(<AppStoreButtons variant="solid" />);

    expect(html).toContain('href="/create"');
    expect(html).toContain("Plan on Web — Free");
    expect(html).toContain("Live on Web · Mobile Preview");
    expect(html).toContain("bg-primary-700");
    expect(html).not.toContain("mailto:");
    expect(html).not.toContain("📱");
  });

  test("renders external App Store and Google Play links with rel=noopener noreferrer when store URLs are configured", async () => {
    vi.stubEnv(
      "NEXT_PUBLIC_APP_STORE_URL",
      "https://apps.apple.com/app/faroway",
    );
    vi.stubEnv(
      "NEXT_PUBLIC_PLAY_STORE_URL",
      "https://play.google.com/store/apps/details?id=ai.faroway.app",
    );
    vi.resetModules();

    const { AppStoreButtons } = await import("@/components/AppStoreButtons");
    const html = renderToStaticMarkup(<AppStoreButtons variant="glass" />);

    expect(html).toContain('href="https://apps.apple.com/app/faroway"');
    expect(html).toContain(
      'href="https://play.google.com/store/apps/details?id=ai.faroway.app"',
    );
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("App Store");
    expect(html).toContain("Google Play");
  });
});
