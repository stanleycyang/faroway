import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance monitoring — capture 10% of transactions in production
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Replay 1% of sessions, 100% on error
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 1.0,

  integrations: [
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],

  // Release tagging for source map resolution
  release: process.env.NEXT_PUBLIC_APP_VERSION,
  environment: process.env.NODE_ENV,

  // Filter out noise
  ignoreErrors: [
    // Browser extensions
    "Non-Error promise rejection captured",
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    // Next.js navigation aborts
    "NEXT_NOT_FOUND",
    "NEXT_REDIRECT",
  ],

  beforeSend(event) {
    // Strip PII from request URLs (query strings may contain user data)
    if (event.request?.url) {
      try {
        const url = new URL(event.request.url);
        // Keep only pathname, remove search params
        event.request.url = url.origin + url.pathname;
      } catch {
        // Not a valid URL — leave as-is
      }
    }
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
