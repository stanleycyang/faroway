import { MetadataRoute } from "next";
import {
  getAllPostMetas,
  getAllCategories,
  getAllClusterSlugs,
} from "@/lib/blog";
import { getSupabase } from "@/lib/supabase/server";
import { getGuideSlugs } from "@/lib/destination-guides";

import { getAllCostProfiles } from "@/lib/tools/cost-data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.faroway.ai";
  const currentDate = new Date().toISOString();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/create`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/support`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/about`,
      lastModified: currentDate,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/destinations`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
  ];

  // Destination landing pages
  const guideSlugs = getGuideSlugs();
  const destinationPages: MetadataRoute.Sitemap = guideSlugs.map((dest) => ({
    url: `${baseUrl}/destinations/${dest}`,
    lastModified: currentDate,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  // Blog pages
  const blogIndex: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/blog`,
      lastModified: currentDate,
      changeFrequency: "daily",
      priority: 0.9,
    },
  ];

  const blogPosts: MetadataRoute.Sitemap = (await getAllPostMetas()).map(
    (post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: post.lastUpdated || post.date,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    }),
  );

  const blogGuides: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/blog/guides`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...getAllClusterSlugs().map((slug) => ({
      url: `${baseUrl}/blog/guides/${slug}`,
      lastModified: currentDate,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];

  const blogCategories: MetadataRoute.Sitemap = (await getAllCategories()).map(
    (cat) => ({
      url: `${baseUrl}/blog/category/${cat.toLowerCase().replace(/\s+/g, "-")}`,
      lastModified: currentDate,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }),
  );

  // Shared trip pages
  let sharedTripPages: MetadataRoute.Sitemap = [];
  try {
    const supabase = getSupabase();
    const { data: sharedTrips } = await supabase
      .from("trips")
      .select("share_token, updated_at")
      .eq("is_shared", true)
      .not("share_token", "is", null)
      .order("shared_at", { ascending: false })
      .limit(200);

    if (sharedTrips) {
      sharedTripPages = sharedTrips.map(
        (trip: { share_token: string | null; updated_at: string | null }) => ({
          url: `${baseUrl}/s/${trip.share_token}`,
          lastModified: trip.updated_at || currentDate,
          changeFrequency: "weekly" as const,
          priority: 0.6,
        }),
      );
    }
  } catch {
    // Continue without shared trips if DB is unavailable
  }

  // Tools pages
  const toolSlugs = [
    "travel-quiz",
    "packing-list",
    "trip-cost",
    "best-time-to-visit",
    "visa-checker",
    "currency-converter",
  ];
  const toolPages: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/tools`,
      lastModified: currentDate,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    ...toolSlugs.map((slug) => ({
      url: `${baseUrl}/tools/${slug}`,
      lastModified: currentDate,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    ...guideSlugs.map((slug) => ({
      url: `${baseUrl}/tools/best-time-to-visit/${slug}`,
      lastModified: currentDate,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...getAllCostProfiles().map((p) => ({
      url: `${baseUrl}/tools/trip-cost/${p.slug}`,
      lastModified: currentDate,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
    ...guideSlugs.map((slug) => ({
      url: `${baseUrl}/tools/visa-checker/${slug}`,
      lastModified: currentDate,
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
    ...sharedTripPages,
  ];
}
