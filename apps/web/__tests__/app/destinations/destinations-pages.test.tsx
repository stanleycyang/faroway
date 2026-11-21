import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AFFILIATE_DISCLOSURE_FULL,
  AFFILIATE_DISCLOSURE_SHORT,
} from "@faroway/constants";
import { DestinationBookingSection } from "@/components/destinations/DestinationBookingSection";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

vi.mock("next/og", () => ({
  ImageResponse: class MockImageResponse {
    element: React.ReactElement;
    constructor(element: React.ReactElement) {
      this.element = element;
    }
  },
}));

import DestinationsIndex from "@/app/destinations/page";
import DestinationGuidePage from "@/app/destinations/[slug]/page";
import DestinationOGImage from "@/app/destinations/[slug]/opengraph-image";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Destinations pages brand, contrast, copy & monetization", () => {
  it("DestinationsIndex renders all 42 guides, ready-in-minutes copy, essentials strip, and zero contrast/emoji violations", async () => {
    const html = renderToStaticMarkup(<DestinationsIndex />);
    expect(html).toContain("42 Curated Guides");
    expect(html).toContain("ready in minutes and free to start");
    expect(html).not.toContain("60 seconds");
    expect(html).not.toMatch(/text-primary(?![-\w])/);
    expect(html).not.toContain("from-primary to-amber-500");
    expect(html).not.toContain("text-primary-600");
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(html).toContain("Compare Stays, Flights &amp; Travel Essentials");
    expect(html).toContain(AFFILIATE_DISCLOSURE_SHORT);
  });

  it("DestinationGuidePage omits Viator/SafetyWing/Stay22 when unconfigured and passes Petra JOD currency to Wise", async () => {
    vi.stubEnv("VIATOR_CONTENT_ENABLED", "");
    vi.stubEnv("STAY22_AID", "");
    vi.stubEnv("SAFETYWING_REFERENCE_ID", "");
    vi.stubEnv("TRAVELPAYOUTS_MARKER", "");

    const petraElement = await DestinationGuidePage({
      params: Promise.resolve({ slug: "petra" }),
    });
    const petraHtml = renderToStaticMarkup(petraElement);

    expect(petraHtml).toContain("font-editorial");
    expect(petraHtml).toContain("ready in minutes and free to start");
    expect(petraHtml).not.toContain("60 seconds");
    expect(petraHtml).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(petraHtml).not.toMatch(/text-primary(?![-\w])/);
    expect(petraHtml).not.toContain("text-amber-600");
    expect(petraHtml).toContain("Spend abroad with Wise multi-currency card");
    expect(petraHtml).toContain("Get global eSIM data on Airalo");
    expect(petraHtml).not.toContain("SafetyWing");
    expect(petraHtml).not.toContain("Stay22");
    expect(petraHtml).not.toContain("Viator");
    expect(petraHtml).toContain(AFFILIATE_DISCLOSURE_FULL);

    let tree!: ReturnType<typeof create>;
    await act(async () => {
      tree = create(petraElement);
    });
    const bookingSection = tree.root.findByType(DestinationBookingSection);
    const wiseEntry = bookingSection.props.essentials.find(
      (e: { key: string; link: { url: string | null } }) => e.key === "fx",
    );
    const esimEntry = bookingSection.props.essentials.find(
      (e: { key: string; link: { url: string | null } }) => e.key === "esim",
    );
    expect(wiseEntry?.link.url).toContain("usd-to-jod-rate");
    expect(esimEntry?.link.url).toContain("global-esim");
  });

  it("DestinationGuidePage activates Stay22, Viator, and SafetyWing when configured without leaking secrets", async () => {
    vi.stubEnv("VIATOR_CONTENT_ENABLED", "true");
    vi.stubEnv("VIATOR_CONTENT_APPROVAL_REF", "ref-ok");
    vi.stubEnv("VIATOR_PARTNER_ID", "P000123");
    vi.stubEnv("VIATOR_MCID", "42383");
    vi.stubEnv("VIATOR_API_KEY", "secret-viator-token");
    vi.stubEnv("STAY22_AID", "stay22-123");
    vi.stubEnv("SAFETYWING_REFERENCE_ID", "sw-123");

    const element = await DestinationGuidePage({
      params: Promise.resolve({ slug: "tokyo" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Check rates on Stay22");
    expect(html).toContain("Browse tours on Viator");
    expect(html).toContain("Get travel medical insurance with SafetyWing");
    expect(html).toContain("Get Japan eSIM data on Airalo");
    expect(html).not.toContain("secret-viator-token");
  });

  it("Destination OG image uses Route-F & Faroway brand colors with zero TG monogram", async () => {
    const res = (await DestinationOGImage({
      params: Promise.resolve({ slug: "tokyo" }),
    })) as unknown as { element: React.ReactElement };
    const html = renderToStaticMarkup(res.element);

    expect(html).toContain("Faroway");
    expect(html).toContain("faroway.ai/destinations");
    expect(html).toContain("#143D46");
    expect(html).not.toContain(">TG<");
    expect(html).not.toContain("#1a1a2e");
    expect(html).not.toContain("#f97316");
  });
});
