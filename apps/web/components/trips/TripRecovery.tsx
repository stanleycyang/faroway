"use client";

import { useEffect, useRef, type ReactNode } from "react";
import * as Sentry from "@sentry/nextjs";
import { useRetrySegment } from "@/hooks/useRetrySegment";

/** Common trip recovery presentation with route-specific messages and exits. */
export function TripRecovery({
  eyebrow,
  title,
  description,
  error,
  reset,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  error?: Error & { digest?: string };
  reset: () => void;
  children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const { retry, retrying } = useRetrySegment(reset);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  useEffect(() => {
    if (error) Sentry.captureException(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fa] px-5 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-10">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          {eyebrow}
        </p>
        <h1
          ref={heading}
          tabIndex={-1}
          className="font-editorial text-3xl text-slate-900 outline-none sm:text-4xl"
        >
          {title}
        </h1>
        <p className="mt-4 leading-relaxed text-slate-600">{description}</p>
        <div className="mt-7 flex flex-wrap items-center gap-5">
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            aria-busy={retrying}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {retrying ? "Trying again…" : "Try again"}
          </button>
          {children}
        </div>
      </section>
    </main>
  );
}
