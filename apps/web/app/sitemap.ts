import { MetadataRoute } from "next";
import {
  getAllSitemapPostMetas,
  getAllCategories,
  getAllClusterSlugs,
} from "@/lib/blog";
import { getGuideSlugs } from "@/lib/destination-guides";

import { getAllCostProfiles } from "@/lib/tools/cost-data";

// Public editorial content can refresh on access every six hours.
export const revalidate = 21600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.faroway.ai";
  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/create`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/privacy`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/support`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/about`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/destinations`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  // Destination landing pages
  const guideSlugs = getGuideSlugs();
  const destinationPages: MetadataRoute.Sitemap = guideSlugs.map((dest) => ({
    url: `${baseUrl}/destinations/${dest}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Blog pages
  const blogIndex: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/blog`,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  const [postMetas, categories] = await Promise.all([
    getAllSitemapPostMetas(),
    getAllCategories(),
  ]);
  const blogPosts: MetadataRoute.Sitemap = postMetas.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.lastUpdated || post.date,
    changeFrequency: "monthly" as const,
    priority: 0.7,
  }));

  const blogGuides: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/blog/guides`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...getAllClusterSlugs().map((slug) => ({
      url: `${baseUrl}/blog/guides/${slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];

  const blogCategories: MetadataRoute.Sitemap = categories.map((cat) => ({
    url: `${baseUrl}/blog/category/${cat.toLowerCase().replace(/\s+/g, "-")}`,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));

  // Tools pages
  const toolSlugs = [
    "travel-quiz",
    "packing-list",
    "trip-cost",
    "best-time-to-visit",
    "visa-checker",
    "currency-converter",
    "world-map",
  ];
  const toolPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/tools`,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...toolSlugs.map((slug) => ({
      url: `${baseUrl}/tools/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...guideSlugs.map((slug) => ({
      url: `${baseUrl}/tools/best-time-to-visit/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...getAllCostProfiles().map((p) => ({
      url: `${baseUrl}/tools/trip-cost/${p.slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...guideSlugs.map((slug) => ({
      url: `${baseUrl}/tools/visa-checker/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];

  return [
    ...staticPages,
    ...destinationPages,
    ...toolPages,
    ...blogIndex,
    ...blogPosts,
    ...blogCategories,
    ...blogGuides,
  ];
}
