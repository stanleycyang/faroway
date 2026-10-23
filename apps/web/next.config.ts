import { securityHeaders } from "./lib/security/headers";
import { assertDatabaseIsolation } from "./lib/config/database-isolation";
import { withWorkflow } from "workflow/next";
import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

assertDatabaseIsolation({
  VERCEL_ENV: process.env.VERCEL_ENV,
  FAROWAY_STAGING_SUPABASE_PROJECT_REF:
    process.env.FAROWAY_STAGING_SUPABASE_PROJECT_REF,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
});

const nextConfig: NextConfig = {
  // The local Workflow backend uses Node's real entrypoint to resolve its
  // cache directory. Bundling this dependency replaces require.main with a
  // webpack module lacking filename and prevents workflow routes from loading.
  serverExternalPackages: ["xdg-app-paths"],
  transpilePackages: [
    "@faroway/supabase",
    "@faroway/constants",
    "@faroway/types",
  ],
  outputFileTracingIncludes: {
    "/api/og": ["./app/api/og/world-map/fonts/*.ttf"],
    "/opengraph-image": ["./app/api/og/world-map/fonts/*.ttf"],
    "/twitter-image": ["./app/api/og/world-map/fonts/*.ttf"],
    "/trips/*/opengraph-image": ["./app/api/og/world-map/fonts/*.ttf"],
    "/s/*/opengraph-image": ["./app/api/og/world-map/fonts/*.ttf"],
  },
  trailingSlash: false,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "hare-media-cdn.tripadvisor.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "media-cdn.tripadvisor.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "media.tacdn.com",
        pathname: "/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/icon.png",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800, immutable" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
    ];
  },
};

export default withSentryConfig(withWorkflow(nextConfig), {
  // Source map upload — requires SENTRY_AUTH_TOKEN in CI
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: !process.env.CI,
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Tunnels Sentry requests through Next.js to avoid ad-blockers
  tunnelRoute: "/monitoring",
});
