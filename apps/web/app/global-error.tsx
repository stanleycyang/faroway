"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useRef } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
    Sentry.captureException(error);
  }, [error]);

  // This boundary replaces the root layout; keep it usable without app CSS or routing.
  const actionStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "48px",
    padding: "12px 24px",
    boxSizing: "border-box" as const,
    borderRadius: "999px",
    fontSize: "16px",
    fontWeight: 600,
  };
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Faroway — page recovery</title>
      </head>
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          color: "#253A34",
          background: "#F7F4ED",
        }}
      >
        <main
          aria-labelledby="root-recovery-title"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "24px",
            boxSizing: "border-box",
          }}
        >
          <section
            style={{
              width: "100%",
              maxWidth: "480px",
              padding: "28px",
              boxSizing: "border-box",
              border: "1px solid #DDDCD5",
              borderRadius: "24px",
              background: "#fff",
            }}
          >
            <h1
              ref={heading}
              id="root-recovery-title"
              tabIndex={-1}
              style={{
                fontSize: "28px",
                lineHeight: 1.2,
                fontWeight: 600,
                margin: "0 0 16px",
              }}
            >
              This page couldn’t load
            </h1>
            <p
              style={{ color: "#475569", lineHeight: 1.6, margin: "0 0 24px" }}
            >
              Try again in a moment. If you were saving a change, check your
              saved trip before submitting it again.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "12px" }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  ...actionStyle,
                  background: "#253A34",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Try again
              </button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- Root-layout recovery requires document navigation independent of the router. */}
              <a
                href="/"
                style={{
                  ...actionStyle,
                  border: "1px solid #CBD5E1",
                  color: "#253A34",
                  textDecoration: "underline",
                }}
              >
                Go home
              </a>
            </div>
            {error.digest && (
              <p
                style={{
                  color: "#475569",
                  fontSize: "12px",
                  overflowWrap: "anywhere",
                  margin: "24px 0 0",
                }}
              >
                Error ID: {error.digest}
              </p>
            )}
          </section>
        </main>
      </body>
    </html>
  );
}
