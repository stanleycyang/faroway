/**
 * CORS Utility
 * Dynamic origin validation against an allowlist.
 */

import { NextRequest, NextResponse } from "next/server";

const ALLOWED_REQUEST_HEADERS =
  "Content-Type, Authorization, Idempotency-Key, Cache-Control";

function getAllowedOrigins(): string[] {
  const envOrigins = process.env.ALLOWED_ORIGINS;
  if (envOrigins) {
    return envOrigins
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  }
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  return appUrl ? [appUrl] : [];
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return false;
  const allowed = getAllowedOrigins();
  return allowed.includes(origin);
}

/**
 * Apply CORS headers to a response based on the request origin.
 * Returns the origin if allowed, or null if rejected.
 */
export function applyCorsHeaders(
  request: NextRequest,
  response: NextResponse,
): string | null {
  const origin = request.headers.get("origin");

  if (origin && isOriginAllowed(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PATCH, DELETE, OPTIONS",
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      ALLOWED_REQUEST_HEADERS,
    );
    response.headers.set("Access-Control-Max-Age", "86400");
    response.headers.set("Vary", "Origin");
    return origin;
  }

  return null;
}

/**
 * Handle CORS preflight (OPTIONS) request.
 */
export function handleCorsPreflightResponse(
  request: NextRequest,
): NextResponse {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": ALLOWED_REQUEST_HEADERS,
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };

  if (origin && isOriginAllowed(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return new NextResponse(null, { status: 204, headers });
}
