"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** Common trip recovery presentation with route-specific messages and exits. */
export function TripRecovery({
  eyebrow,
  title,
  description,
  reset,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  reset: () => void;
  children: ReactNode;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);

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
            onClick={reset}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800"
          >
            Try again
          </button>
          {children}
        </div>
      </section>
    </main>
  );
}
