import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

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
  usePathname: () => "/tools/visa-checker",
}));

vi.mock("next/og", () => ({
  ImageResponse: class MockImageResponse {
    element: React.ReactElement;
    constructor(element: React.ReactElement) {
      this.element = element;
    }
  },
}));

import { ToolCTA } from "@/components/tools/ToolCTA";
import { ToolHero } from "@/components/tools/ToolHero";
import { ToolsNav } from "@/components/tools/ToolsNav";
import { RelatedTools } from "@/components/tools/RelatedTools";
import VisaOGImage from "@/app/tools/visa-checker/[destination]/opengraph-image";
import TripCostOGImage from "@/app/tools/trip-cost/[slug]/opengraph-image";
import BestTimeOGImage from "@/app/tools/best-time-to-visit/[slug]/opengraph-image";

describe("ToolCTA, shared tool chrome & all 3 Tool OG images", () => {
  it("ToolCTA uses #143D46 Ocean Teal, font-editorial, encoded destination link, and zero #253A34", () => {
    const html = renderToStaticMarkup(<ToolCTA destination="New York" />);
    expect(html).toContain("bg-[#143D46]");
    expect(html).toContain("font-editorial");
    expect(html).toContain("text-[#143D46]");
    expect(html).toContain("/create?destination=New%20York");
    expect(html).not.toContain("#253A34");
  });

  it("ToolsNav, ToolHero, and RelatedTools comply with Brand 2.0 contrast rules", () => {
    const html = renderToStaticMarkup(
      <div>
        <ToolsNav />
        <ToolHero
          badge="Free Tool"
          title="Visa Checker"
          gradientWord="Visa"
          description="Check visa requirements."
        />
        <RelatedTools currentSlug="visa-checker" />
      </div>,
    );

    expect(html).toContain("bg-primary-700 text-white");
    expect(html).toContain("font-editorial");
    expect(html).not.toMatch(/text-primary(?![-\w])/);
    expect(html).not.toMatch(/bg-primary(?![-\w])/);
    expect(html).not.toContain("text-slate-400");
    expect(html).not.toContain("text-gradient");
  });

  it("all 3 tool OG images render Faroway Route-F template with zero TG monogram or legacy colors", async () => {
    const visaRes = (await VisaOGImage({
      params: Promise.resolve({ destination: "tokyo" }),
    })) as unknown as { element: React.ReactElement };
    const costRes = (await TripCostOGImage({
      params: Promise.resolve({ slug: "tokyo" }),
    })) as unknown as { element: React.ReactElement };
    const bestTimeRes = (await BestTimeOGImage({
      params: Promise.resolve({ slug: "tokyo" }),
    })) as unknown as { element: React.ReactElement };

    for (const res of [visaRes, costRes, bestTimeRes]) {
      const html = renderToStaticMarkup(res.element);
      expect(html).toContain("Faroway");
      expect(html).toContain("#143D46");
      expect(html).toContain("#F97066");
      expect(html).not.toContain(">TG<");
      expect(html).not.toContain("#1a1a2e");
      expect(html).not.toContain("#f97316");
    }
  });
});
