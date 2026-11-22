"use client";

import { useHydrated } from "@/hooks/useHydrated";
import { useState, useRef, useEffect, FormEvent } from "react";

export function NewsletterCTA() {
  const hydrated = useHydrated();
  const submittingRef = useRef(false);
  const activeRef = useRef(true);
  const successRef = useRef<HTMLParagraphElement>(null);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");

  useEffect(() => {
    activeRef.current = true;
    return () => {
      activeRef.current = false;
    };
  }, []);
  useEffect(() => {
    if (status === "success") successRef.current?.focus();
  }, [status]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!hydrated || submittingRef.current) return;
    submittingRef.current = true;
    const address = email.trim();
    setSubmittedEmail(address);
    setStatus("loading");
    try {
      const res = await fetch("/api/blog/newsletter", {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: address, source: "blog" }),
      });
      const result = await res.json().catch(() => null);
      if (!activeRef.current) return;
      if (res.ok && result?.success === true) {
        setStatus("success");
        setEmail("");
      } else {
        setStatus("error");
      }
    } catch {
      if (activeRef.current) setStatus("error");
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <section className="my-16 rounded-2xl border border-[#DCE5E3] bg-[#EFF5F3] p-8 shadow-sm md:p-12">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto mb-6 h-1 w-16 rounded-full bg-gradient-to-r from-[#C03A31] to-[#143D46]" />
        <h2 className="font-editorial mb-3 text-2xl text-slate-900 md:text-3xl">
          Join the travel journal
        </h2>
        <p className="mb-6 text-slate-600">
          Join our list for destination guides, travel tips, and fresh planning
          ideas.
        </p>
        {status === "success" ? (
          <p
            ref={successRef}
            tabIndex={-1}
            role="status"
            className="text-lg font-semibold text-slate-900 outline-none"
          >
            You’re subscribed as {submittedEmail}. Thanks for joining our travel
            journal.
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="mx-auto flex max-w-lg flex-col gap-3 sm:flex-row"
          >
            <label htmlFor="newsletter-email" className="sr-only">
              Email address
            </label>
            <input
              id="newsletter-email"
              type="email"
              maxLength={254}
              required
              disabled={!hydrated || status === "loading"}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="flex-1 rounded-xl border border-[#DCE5E3] bg-white px-4 py-3 text-slate-900 outline-none placeholder:text-slate-500 focus:border-primary-700 focus:ring-2 focus:ring-primary-700"
            />
            <button
              type="submit"
              disabled={!hydrated || status === "loading"}
              className="whitespace-nowrap rounded-xl bg-[#143D46] px-6 py-3 font-semibold text-white transition-colors hover:bg-[#0E2C33] disabled:opacity-50"
            >
              {status === "loading" ? "Subscribing..." : "Subscribe Free"}
            </button>
          </form>
        )}
        {status === "error" && (
          <p role="alert" className="mt-3 text-sm font-medium text-red-700">
            We couldn’t confirm your subscription. Please try again.
          </p>
        )}
        <p className="mt-3 text-xs text-slate-600">
          Travel-journal updates only.
        </p>
      </div>
    </section>
  );
}
