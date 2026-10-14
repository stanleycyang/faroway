import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.faroway.ai";

  return {
    rules: {
      userAgent: "*",
      // Allow the whole site plus the Open Graph image endpoint under /api/og
      allow: ["/", "/api/og", "/api/og/world-map"],
      disallow: [
        "/api/",
        "/auth/callback",
        "/auth/logout",
        "/.well-known/",
        "/dashboard",
        "/trips/",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
