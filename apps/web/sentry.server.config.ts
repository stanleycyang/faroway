import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Server-side: capture all transactions (they're cheaper than client replay)
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,

  release: process.env.NEXT_PUBLIC_APP_VERSION,
  environment: process.env.NODE_ENV,

  // Add request ID to every server event for log correlation
  beforeSend(event, hint) {
    const err = hint.originalException;
    if (err instanceof Error) {
      event.tags = {
        ...event.tags,
        error_name: err.name,
      };
    }
    return event;
  },
});
