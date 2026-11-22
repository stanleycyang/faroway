import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AFFILIATE_DISCLOSURE_FULL,
  AFFILIATE_DISCLOSURE_SHORT,
} from "@faroway/constants";
import { BlogCard } from "@/components/blog/BlogCard";
import { FeaturedHero } from "@/components/blog/FeaturedHero";
import { Pagination } from "@/components/blog/Pagination";
import { Breadcrumbs } from "@/components/blog/Breadcrumbs";
import { ShareButtons } from "@/components/blog/ShareButtons";
import { Callout, TipBox } from "@/components/blog/MDXComponents";
import { TopicGrid } from "@/components/blog/guides/TopicGrid";
import { StartHerePath } from "@/components/blog/guides/StartHerePath";
import { ClusterCTA } from "@/components/blog/guides/ClusterCTA";
import { BlogAffiliateSection } from "@/components/blog/BlogAffiliateSection";
import { BlogEssentialsStrip } from "@/components/blog/BlogEssentialsStrip";
import { CLUSTERS } from "@/lib/blog/clusters";
import type { BlogPostMeta } from "@/lib/blog/types";

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

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function textOf(node: unknown): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "children" in node) {
    return textOf((node as { children: unknown }).children);
  }
  return "";
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const samplePost: BlogPostMeta = {
  slug: "best-time-to-visit-japan",
  title: "Best Time to Visit Japan",
  description: "Seasonal guide to Tokyo and Kyoto.",
  date: "2026-04-01",
  author: {
    name: "Faroway Editorial",
    avatar: "/icon.png",
    bio: "Travel editors",
  },
  category: "Destination Guides",
  tags: ["japan", "tokyo"],
  coverImage: "/images/journal-cover.svg",
  readingTime: 6,
};

describe("Blog components brand, contrast, emoji & affiliate compliance", () => {
  it("renders zero raw OS emojis and zero banned contrast classes across blog components", () => {
    const cluster = CLUSTERS[0];
    const html = renderToStaticMarkup(
      <div>
        <BlogCard post={samplePost} />
        <FeaturedHero post={samplePost} />
        <Pagination currentPage={2} totalPages={5} basePath="/blog" />
        <Breadcrumbs
          variant="dark"
          items={[{ label: "Home", href: "/" }, { label: "Blog" }]}
        />
        <ShareButtons
          variant="dark"
          url="https://www.faroway.ai/blog/best-time-to-visit-japan"
          title="Best Time to Visit Japan"
          description="Desc"
        />
        <Callout type="info">Info body</Callout>
        <Callout type="warning">Warning body</Callout>
        <Callout type="tip">Tip body</Callout>
        <Callout type="important">Important body</Callout>
        <TipBox title="Pro tip">Tip text</TipBox>
        <TopicGrid cluster={cluster} />
        <StartHerePath cluster={cluster} />
        <ClusterCTA cluster={cluster} />
      </div>,
    );

    expect(html).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(html).not.toMatch(/text-primary(?![-\w])/);
    expect(html).not.toContain("text-slate-400");
    expect(html).not.toContain("text-white/50");
    expect(html).not.toContain("from-primary to-amber-500");
    expect(html).not.toContain("text-green-400");
    expect(html).not.toContain("text-blue-400");
  });

  it("BlogAffiliateSection drops unallowlisted/null links, shows financial editorial disclosure, and tracks clicks with source=blog", async () => {
    const popupMock = {
      opener: {} as unknown,
      closed: false,
      location: { replace: vi.fn() },
      close: vi.fn(),
    };
    const openSpy = vi.fn(() => popupMock);
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        clickId: "11111111-1111-4111-8111-111111111111",
        trackedUrl: "https://wise.com/us/travel-money/?sub_id=clk1",
      }),
    });
    vi.stubGlobal("open", openSpy);
    vi.stubGlobal("window", { open: openSpy, location: { assign: vi.fn() } });
    vi.stubGlobal("fetch", fetchMock);

    const props = {
      postSlug: "best-travel-cards-2026",
      destinationLabel: "Tokyo",
      plannerHref: "/create?destination=Tokyo",
      isFinancialContent: true,
      stays: [
        {
          partner: "booking" as const,
          label: "Check availability on Booking.com",
          vertical: "hotels" as const,
          url: "https://www.booking.com/searchresults.html?ss=Tokyo",
          configured: true,
          isSearchFallback: true,
          disclosure: AFFILIATE_DISCLOSURE_SHORT,
        },
        {
          partner: "stay22" as const,
          label: "Unconfigured Stay22",
          vertical: "hotels" as const,
          url: null,
          configured: false,
          isSearchFallback: true,
          disclosure: AFFILIATE_DISCLOSURE_SHORT,
        },
      ],
      activities: [
        {
          partner: "viator" as const,
          label: "Evil NonAllowlisted",
          vertical: "activities" as const,
          url: "https://evil.example.com/phish",
          configured: false,
          isSearchFallback: true,
          disclosure: AFFILIATE_DISCLOSURE_SHORT,
        },
      ],
      flights: [
        {
          partner: "travelpayouts" as const,
          label: "Compare flights on Aviasales",
          vertical: "flights" as const,
          url: "https://www.aviasales.com/",
          configured: true,
          isSearchFallback: true,
          disclosure: AFFILIATE_DISCLOSURE_SHORT,
        },
      ],
      essentials: [
        {
          key: "esim" as const,
          title: "eSIM",
          link: {
            partner: "airalo" as const,
            label: "Get Japan eSIM data on Airalo",
            vertical: "esim" as const,
            url: "https://www.airalo.com/japan-esim",
            configured: true,
            isSearchFallback: true,
            disclosure: AFFILIATE_DISCLOSURE_SHORT,
          },
        },
      ],
      financialLinks: {
        fx: {
          partner: "wise" as const,
          label: "Spend abroad with Wise multi-currency card",
          vertical: "finance" as const,
          url: "https://wise.com/us/currency-converter/usd-to-jpy-rate",
          configured: true,
          isSearchFallback: true,
          disclosure: AFFILIATE_DISCLOSURE_SHORT,
        },
        insurance: null,
      },
    };

    const html = renderToStaticMarkup(<BlogAffiliateSection {...props} />);
    expect(html).toContain("Check availability on Booking.com");
    expect(html).toContain("Compare flights on Aviasales");
    expect(html).toContain("Spend abroad with Wise multi-currency card");
    expect(html).not.toContain("Unconfigured Stay22");
    expect(html).not.toContain("Evil NonAllowlisted");
    expect(html).toContain(AFFILIATE_DISCLOSURE_FULL);
    expect(html).toContain(
      "Editorial disclosure: Financial rates, card terms, FX fees, and insurance coverage vary by country and change over time.",
    );

    let root!: ReturnType<typeof create>;
    await act(async () => {
      root = create(<BlogAffiliateSection {...props} />);
    });

    const flightBtn = root.root
      .findAllByType("button")
      .find((b) => textOf(b).includes("Aviasales"));
    expect(flightBtn).toBeDefined();

    await act(async () => {
      await flightBtn!.props.onClick({
        currentTarget: { focus: vi.fn() },
      });
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/track/click",
      expect.objectContaining({ method: "POST" }),
    );
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.source).toBe("blog");
    expect(payload.itemType).toBe("flight");
    expect(payload.affiliatePartner).toBe("travelpayouts");
    expect(openSpy).toHaveBeenCalledWith("", "_blank");
    expect(popupMock.opener).toBeNull();
  });

  it("BlogEssentialsStrip renders outside article tags with short disclosure", () => {
    const html = renderToStaticMarkup(
      <BlogEssentialsStrip
        flightLinks={[
          {
            partner: "skyscanner",
            label: "Compare flights on Skyscanner",
            vertical: "flights",
            url: "https://www.skyscanner.com/flights",
            configured: true,
            isSearchFallback: true,
            disclosure: AFFILIATE_DISCLOSURE_SHORT,
          },
        ]}
        esim={{
          partner: "airalo",
          label: "Get global eSIM data on Airalo",
          vertical: "esim",
          url: "https://www.airalo.com/global-esim",
          configured: true,
          isSearchFallback: true,
          disclosure: AFFILIATE_DISCLOSURE_SHORT,
        }}
        fx={null}
        insurance={null}
      />,
    );

    expect(html).toContain("Compare flights on Skyscanner");
    expect(html).toContain("Get global eSIM data on Airalo");
    expect(html).toContain(AFFILIATE_DISCLOSURE_SHORT);
    expect(html).not.toContain("<article");
  });
});
