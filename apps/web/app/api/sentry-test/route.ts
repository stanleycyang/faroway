/**
 * GET /api/sentry-test
 *
 * Throws a test error to verify Sentry is capturing server-side exceptions
 * with source maps resolving correctly.
 *
 * ONLY available in non-production environments.
 * Usage: curl https://your-preview-url.vercel.app/api/sentry-test
 */

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const testError = new Error("Sentry test error — server-side source maps check");
  testError.name = "SentryTestError";

  Sentry.captureException(testError, {
    tags: { test: "true", endpoint: "/api/sentry-test" },
    extra: { timestamp: new Date().toISOString() },
  });

  return NextResponse.json({
    ok: true,
    message: "Test error captured — check your Sentry dashboard",
    dsn: process.env.SENTRY_DSN ? "configured" : "missing — set SENTRY_DSN",
  });
}
