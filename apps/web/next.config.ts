import { withWorkflow } from "workflow/next";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

// `eslint.ignoreDuringBuilds` is a real Next runtime option but isn't
// exported on Next 16's NextConfig type — cast to allow it.
const nextConfig: NextConfig = {
  typescript: {
    // Type-check runs as a dedicated CI step (bun run type-check) to avoid
    // competing with Turbopack for heap during the static generation phase.
    ignoreBuildErrors: true,
  },
  // ESLint also runs as a dedicated CI step.
  ...({ eslint: { ignoreDuringBuilds: true } } as Pick<NextConfig, never>),
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
              "script-src 'self' 'unsafe-inline'",
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

  // Automatically tree-shake Sentry debug logging in production
  disableLogger: true,

  // Tunnels Sentry requests through Next.js to avoid ad-blockers
  tunnelRoute: "/monitoring",
});
