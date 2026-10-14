"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import * as Sentry from "@sentry/nextjs";

export default function BlogError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    Sentry.captureException(error);
    headingRef.current?.focus();
  }, [error]);

  return (
    <main
      aria-labelledby="blog-recovery-title"
      className="min-h-[70vh] bg-[#f7f8fa] px-6 pt-32 pb-16"
    >
      <div className="mx-auto max-w-lg text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          Travel stories
        </p>
        <h1
          ref={headingRef}
          id="blog-recovery-title"
          tabIndex={-1}
          className="font-editorial text-4xl leading-tight text-slate-900 outline-none"
        >
          Stories are taking a moment.
        </h1>
        <p className="mt-5 text-base leading-relaxed text-slate-600">
          Our travel stories aren’t loading right now. Try again, or explore
          destinations while we reconnect.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="min-h-12 rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900"
          >
            Try again
          </button>
          <Link
            href="/destinations"
            className="min-h-12 rounded-xl border border-slate-300 bg-white px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
          >
            Explore destinations
          </Link>
        </div>
        <Link
          href="/support"
          className="mt-6 inline-block text-sm text-slate-600 underline underline-offset-4"
        >
          Get help
        </Link>
      </div>
    </main>
  );
}
