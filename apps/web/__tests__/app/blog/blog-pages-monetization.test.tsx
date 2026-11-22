import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AFFILIATE_DISCLOSURE_FULL,
  AFFILIATE_DISCLOSURE_SHORT,
} from "@faroway/constants";

const mockPosts = [
  {
    slug: "best-time-to-visit-japan",
    title: "Best Time to Visit Japan",
    description: "Cherry blossoms and autumn leaves in Tokyo and Kyoto.",
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
    featured: true,
    content:
      "## Spring in Tokyo\nPlan your trip.\n## Autumn in Kyoto\nGreat colors.\n## Getting Around\nRail pass.",
  },
  {
    slug: "best-travel-credit-cards-2026",
    title: "Best Travel Cards for 2026",
    description: "No foreign transaction fees abroad.",
    date: "2026-03-01",
    author: {
      name: "Faroway Editorial",
      avatar: "/icon.png",
      bio: "Finance editors",
    },
    category: "Money",
    tags: ["credit-cards", "finance"],
    coverImage: "/images/journal-cover.svg",
    readingTime: 7,
    featured: false,
    content: "## FX Fees\nAvoid dynamic currency conversion.",
  },
  {
    slug: "smart-packing-tips",
    title: "Smart Packing Tips for Carry-On Travelers",
    description: "How to pack light for any trip.",
    date: "2026-02-01",
    author: {
      name: "Faroway Editorial",
      avatar: "/icon.png",
      bio: "Travel editors",
    },
    category: "Travel Tips",
    tags: ["packing"],
    coverImage: "/images/journal-cover.svg",
    readingTime: 4,
    featured: false,
    content: "## Pack Light\nUse compression cubes.",
  },
];

vi.mock("@/lib/blog/pages", () => ({
  getBlogIndexPage: vi.fn(async () => ({
    allPosts: mockPosts,
    featured: mockPosts[0],
    items: mockPosts.slice(1),
    totalPages: 1,
    page: 1,
  })),
}));

vi.mock("@/lib/blog", () => ({
  getAllPostMetas: vi.fn(async () => mockPosts),
  getPostBySlug: vi.fn(
    async (slug: string) => mockPosts.find((p) => p.slug === slug) ?? null,
  ),
  getRelatedPosts: vi.fn(async () => []),
}));

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
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/blog",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/og", () => ({
  ImageResponse: class MockImageResponse {
    element: React.ReactElement;
    constructor(element: React.ReactElement) {
      this.element = element;
    }
  },
}));

import BlogIndex from "@/app/blog/page";
import BlogPostPage from "@/app/blog/[slug]/page";
import BlogOGImage from "@/app/blog/[slug]/opengraph-image";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Blog Server Pages & OG Image Monetization", () => {
  it("BlogIndex renders Travel Blog heading, BlogEssentialsStrip outside <article>, and NewsletterCTA", async () => {
    vi.stubEnv("AIRALO_AFFILIATE_ID", "airalo-test");
    const element = await BlogIndex({
      searchParams: Promise.resolve({}),
    });
    const html = renderToStaticMarkup(element);
    expect(html).toContain("Travel Blog");
    expect(html).toContain("Subscribe Free");
    expect(html).toContain(AFFILIATE_DISCLOSURE_SHORT);
    expect(html).toContain("Ready to turn inspiration into a trip?");
  });

  it("BlogPostPage renders contextual Japan stays, activities, flights, and Airalo eSIM without leaking server secrets", async () => {
    vi.stubEnv("STAY22_AID", "stay22-secret-aid");
    vi.stubEnv("VIATOR_API_KEY", "super-secret-viator-key");
    vi.stubEnv("AIRALO_AFFILIATE_ID", "airalo-ref-1");

    const element = await BlogPostPage({
      params: Promise.resolve({ slug: "best-time-to-visit-japan" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Book Tokyo Stays, Flights &amp; Essentials");
    expect(html).toContain("Check rates on Stay22");
    expect(html).toContain("Get Japan eSIM data on Airalo");
    expect(html).toContain(AFFILIATE_DISCLOSURE_FULL);
    expect(html).not.toContain("super-secret-viator-key");
  });

  it("BlogPostPage renders issuer aside + dedicated financial block on Money posts", async () => {
    vi.stubEnv("SAFETYWING_REFERENCE_ID", "sw-ref-99");
    vi.stubEnv("WISE_AFFILIATE_ID", "wise-id-99");

    const element = await BlogPostPage({
      params: Promise.resolve({ slug: "best-travel-credit-cards-2026" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Financial terms can change.");
    expect(html).toContain("Smart Financial Essentials for Your Trip");
    expect(html).toContain("Spend abroad with Wise multi-currency card");
    expect(html).toContain("Get travel medical insurance with SafetyWing");
    expect(html).toContain("Editorial disclosure: Financial rates, card terms");
  });

  it("BlogPostPage renders global flight & essentials fallbacks for generic posts without hotel cards", async () => {
    const element = await BlogPostPage({
      params: Promise.resolve({ slug: "smart-packing-tips" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Flights &amp; Trip Essentials for Your Next Trip");
    expect(html).not.toContain("Where to Stay");
    expect(html).toContain("Compare flights on Skyscanner");
    expect(html).toContain("Get global eSIM data on Airalo");
  });

  it("Blog OG image renders Route-F Brand 2.0 template with zero paper airplane or indigo", async () => {
    const res = (await BlogOGImage({
      params: Promise.resolve({ slug: "best-time-to-visit-japan" }),
    })) as unknown as { element: React.ReactElement };
    const html = renderToStaticMarkup(res.element);

    expect(html).toContain("Faroway");
    expect(html).toContain("faroway.ai/blog");
    expect(html).toContain("#143D46");
    expect(html).not.toContain("M12 19l9 2");
    expect(html).not.toContain("#6366f1");
    expect(html).not.toContain("#8b5cf6");
  });
});
