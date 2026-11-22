import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AFFILIATE_DISCLOSURE_SHORT } from "@faroway/constants";

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
  usePathname: () => "/tools",
}));

import VisaDestinationPage from "@/app/tools/visa-checker/[destination]/page";
import TripCostDestinationPage from "@/app/tools/trip-cost/[slug]/page";
import BestTimeDestinationPage from "@/app/tools/best-time-to-visit/[slug]/page";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Dynamic Tool Server Pages (visa-checker, trip-cost, best-time-to-visit)", () => {
  it("renders VisaDestinationPage with ISO code badges, iVisa + SafetyWing CTAs, and zero flag emojis", async () => {
    vi.stubEnv("IVISA_AFFILIATE_ID", "ivisa-123");
    vi.stubEnv("SAFETYWING_REFERENCE_ID", "sw-123");

    const element = await VisaDestinationPage({
      params: Promise.resolve({ destination: "tokyo" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("font-editorial");
    expect(html).toContain("Check entry &amp; visa requirements on iVisa");
    expect(html).toContain("Get travel medical insurance with SafetyWing");
    expect(html).toContain(AFFILIATE_DISCLOSURE_SHORT);
    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(html).not.toContain("text-gradient");
  });

  it("renders TripCostDestinationPage with Stay22, Skyscanner, and Wise JPY CTAs", async () => {
    vi.stubEnv("STAY22_AID", "stay22-123");
    vi.stubEnv("SKYSCANNER_ASSOCIATE_ID", "sky-123");
    vi.stubEnv("WISE_AFFILIATE_ID", "wise-123");

    const element = await TripCostDestinationPage({
      params: Promise.resolve({ slug: "tokyo" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("font-editorial");
    expect(html).toContain("Check rates on Stay22");
    expect(html).toContain("Compare flights on Skyscanner");
    expect(html).toContain("Spend abroad with Wise multi-currency card");
    expect(html).toContain(AFFILIATE_DISCLOSURE_SHORT);
    expect(html).not.toContain("text-gradient");
  });

  it("renders BestTimeDestinationPage with pre-dated peak-season Stay22, Skyscanner, and GYG CTAs", async () => {
    vi.stubEnv("STAY22_AID", "stay22-123");
    vi.stubEnv("SKYSCANNER_ASSOCIATE_ID", "sky-123");

    const element = await BestTimeDestinationPage({
      params: Promise.resolve({ slug: "tokyo" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("font-editorial");
    expect(html).toContain("Check rates on Stay22");
    expect(html).toContain("Compare flights on Skyscanner");
    expect(html).toContain("Explore tours on GetYourGuide");
    expect(html).toContain(AFFILIATE_DISCLOSURE_SHORT);
    expect(html).not.toContain("text-gradient");
    expect(html).not.toContain("text-green-500");
    expect(html).not.toContain("text-red-400");
  });
});
