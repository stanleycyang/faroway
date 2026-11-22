import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { AFFILIATE_DISCLOSURE_FULL } from "@faroway/constants";

vi.mock("next/image", () => ({
  default: ({
    fill: _fill,
    priority: _priority,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
  }) => React.createElement("img", props),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    prefetch: _prefetch,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
    children?: React.ReactNode;
    prefetch?: boolean;
  }) => React.createElement("a", props, children),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

import LandingPage from "@/app/(marketing)/page";
import AboutPage from "@/app/(marketing)/about/page";
import SupportPage from "@/app/(marketing)/support/page";
import PrivacyPolicyPage from "@/app/(marketing)/privacy/page";
import TermsOfServicePage from "@/app/(marketing)/terms/page";
import { Footer } from "@/components/Footer";

describe("Marketing & Legal Pages", () => {
  test("LandingPage renders Warm Paper canvas, benefit-first copy, Lucide icons, and no raw OS emojis or sign-in friction", () => {
    const html = renderToStaticMarkup(<LandingPage />);

    expect(html).toContain("bg-[#FAF8F3]");
    expect(html).toContain("<h1");
    expect(html).toContain('href="/create"');
    expect(html).toContain("Plan My Trip");
    expect(html).toContain("Personalized day-by-day travel planning");
    expect(html).toContain("Ready in minutes");
    expect(html).toContain("Day-by-day · Tailored to your vibes");
    expect(html).toContain("Tailored to your pace");
    expect(html).toContain("Generate &amp; save your plan");

    expect(html).not.toContain(
      "Transparent itinerary generation with live progress",
    );
    expect(html).not.toContain("Choose your trip, then sign in");
    expect(html).not.toContain("Free account");
    expect(html).not.toContain("AI-generated");
    expect(html).not.toContain("Sign in to generate");
    expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);

    const pageSource = fs.readFileSync(
      path.resolve(process.cwd(), "app/(marketing)/page.tsx"),
      "utf8",
    );
    expect(pageSource).not.toMatch(/text-primary-[34]00.*Free to start/);
    expect(pageSource).toContain('fallbackAlt="Illustrated travel route"');
  });

  test("Privacy Policy and Terms of Service disclose Google Maps/Places, FTC disclosure, and M2 affiliate partners", () => {
    const privacyHtml = renderToStaticMarkup(<PrivacyPolicyPage />);
    const termsHtml = renderToStaticMarkup(<TermsOfServicePage />);

    for (const html of [privacyHtml, termsHtml]) {
      expect(html).toContain("https://maps.google.com/help/terms_maps/");
      expect(html).toContain("https://policies.google.com/privacy");
      expect(html).toContain(AFFILIATE_DISCLOSURE_FULL);
      expect(html).toContain("Stay22");
      expect(html).toContain("GetYourGuide");
      expect(html).toContain("Booking.com");
      expect(html).toContain("Duffel");
      expect(html).toContain("SafetyWing");
      expect(html).toContain("Airalo");
      expect(html).toContain("OpenStreetMap");
    }

    expect(termsHtml).toContain("objectionable");
    expect(termsHtml).toContain("support@faroway.ai");
  });

  test("Footer renders unified <Logo /> and canonical FTC affiliate disclosure", () => {
    const html = renderToStaticMarkup(<Footer />);
    expect(html).toContain('src="/icon.png"');
    expect(html).toContain(">Faroway<");
    expect(html).toContain(AFFILIATE_DISCLOSURE_FULL);
  });

  test("AboutPage and SupportPage render cleanly without low-contrast gradients, white/60 or white/40 scrim text, or *-500 white-text icon tiles", () => {
    const aboutHtml = renderToStaticMarkup(<AboutPage />);
    const supportHtml = renderToStaticMarkup(<SupportPage />);
    expect(aboutHtml).toContain("Craftsmanship");
    expect(supportHtml).toContain("Bookings &amp; Payments");

    for (const relPath of [
      "app/(marketing)/about/page.tsx",
      "app/(marketing)/support/page.tsx",
    ]) {
      const source = fs.readFileSync(
        path.resolve(process.cwd(), relPath),
        "utf8",
      );
      expect(source).not.toContain("from-primary to-amber-500");
      expect(source).not.toContain("text-white/60");
      expect(source).not.toContain("text-white/40");
      expect(source).not.toMatch(
        /from-(?:teal|emerald|sky|blue|violet|rose)-500/,
      );
    }
  });
});
