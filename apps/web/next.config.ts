import { assertDatabaseIsolation } from "./lib/config/database-isolation";
import { withWorkflow } from "workflow/next";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const developmentScriptSource =
  process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

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
        headers: [
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline'${developmentScriptSource}`,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co https://*.tile.openstreetmap.org https://hare-media-cdn.tripadvisor.com https://media-cdn.tripadvisor.com https://media.tacdn.com",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://*.supabase.co https://ai-gateway.vercel.sh",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
        ],
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
