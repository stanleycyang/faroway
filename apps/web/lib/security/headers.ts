/**
 * Security Headers Configuration
 * Applied via next.config.ts
 */

export function getPinnedSupabaseOrigin(
  rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): string | null {
  if (!rawUrl) return null;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.username || parsed.password) return null;
    if (parsed.protocol === "https:") return parsed.origin;
    if (
      nodeEnv !== "production" &&
      parsed.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname)
    ) {
      return parsed.origin;
    }
    return null;
  } catch {
    return null;
  }
}

export function buildSecurityHeaders(
  env: { NEXT_PUBLIC_SUPABASE_URL?: string; NODE_ENV?: string } = process.env,
) {
  const developmentScriptSource =
    env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
  const supabaseOrigin = getPinnedSupabaseOrigin(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NODE_ENV,
  );
  const supabaseDirective = supabaseOrigin ? ` ${supabaseOrigin}` : "";

  return [
    {
      key: "X-DNS-Prefetch-Control",
      value: "on",
    },
    {
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    },
    {
      key: "X-Frame-Options",
      value: "SAMEORIGIN",
    },
    {
      key: "X-Content-Type-Options",
      value: "nosniff",
    },
    {
      key: "Referrer-Policy",
      value: "strict-origin-when-cross-origin",
    },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
    },
    {
      key: "Content-Security-Policy",
      value: [
        "default-src 'self'",
        // TODO: Replace 'unsafe-inline' with nonce-based CSP
        `script-src 'self' 'unsafe-inline'${developmentScriptSource}`,
        "style-src 'self' 'unsafe-inline'",
        `img-src 'self' data: blob: https://images.unsplash.com${supabaseDirective} https://*.tile.openstreetmap.org https://hare-media-cdn.tripadvisor.com https://media-cdn.tripadvisor.com https://media.tacdn.com`,
        "font-src 'self' https://fonts.gstatic.com",
        `connect-src 'self'${supabaseDirective} https://ai-gateway.vercel.sh`,
        "frame-ancestors 'self'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join("; "),
    },
  ];
}

export const securityHeaders = buildSecurityHeaders();
