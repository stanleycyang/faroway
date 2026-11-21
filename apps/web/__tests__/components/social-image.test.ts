import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createSocialImage } from "@/lib/social-image";

describe("createSocialImage & Brand 2.0 foundation", () => {
  test("renders a valid PNG social image using Playfair Display, Inter, and Route-F brand palette", async () => {
    const response = await createSocialImage(
      "Kyoto. Your journey.",
      "5 days · Oct 12 - Oct 16, 2026 · 2 travelers",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("image/png");

    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(bytes.length).toBeGreaterThan(5000);
    // PNG magic header: 89 50 4E 47 0D 0A 1A 0A
    expect(Array.from(bytes.slice(0, 8))).toEqual([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
  });

  test("globals.css normalizes --color-paper to #faf8f3 and fixes .glass-card and drop-cap contrast", () => {
    const globals = fs.readFileSync(
      path.resolve(process.cwd(), "app/globals.css"),
      "utf8",
    );
    expect(globals).toContain("--color-paper: #faf8f3;");
    expect(globals).not.toContain("--color-paper: #faf6ef;");
    expect(globals).toContain("--color-ocean: #143d46;");
    expect(globals).toContain("--color-mist: #eff5f3;");
    expect(globals).toContain("background: rgba(255, 255, 255, 0.92);");
    expect(globals).toContain("color: var(--primary-accessible, #c03a31);");
  });

  test("M3A auth, dashboard, and shared chrome files contain zero raw OS emojis or legacy #f7f8fa canvas", () => {
    const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    const filesToCheck = [
      "app/(app)/dashboard/page.tsx",
      "app/(app)/dashboard/loading.tsx",
      "components/dashboard/TripStats.tsx",
      "components/dashboard/EmptyState.tsx",
      "components/dashboard/TripCard.tsx",
      "components/dashboard/TripFilters.tsx",
      "components/auth/AuthPageFrame.tsx",
      "components/auth/EmailPasswordForm.tsx",
      "app/auth/login/page.tsx",
      "app/auth/signup/page.tsx",
      "app/auth/forgot-password/page.tsx",
      "app/auth/reset-password/page.tsx",
      "app/auth/logout-error/page.tsx",
      "components/Header.tsx",
      "components/SkipToContent.tsx",
      "components/ShareButtons.tsx",
      "components/places/PlacesExplorer.tsx",
    ];

    for (const rel of filesToCheck) {
      const content = fs.readFileSync(path.resolve(process.cwd(), rel), "utf8");
      expect(content, `${rel} should not contain raw OS emojis`).not.toMatch(
        emojiRe,
      );
      expect(content, `${rel} should not use legacy #f7f8fa`).not.toContain(
        "#f7f8fa",
      );
    }

    const dashboardPage = fs.readFileSync(
      path.resolve(process.cwd(), "app/(app)/dashboard/page.tsx"),
      "utf8",
    );
    expect(dashboardPage).toContain("<Logo ");
    expect(dashboardPage).not.toContain("faroway.");
  });
});
