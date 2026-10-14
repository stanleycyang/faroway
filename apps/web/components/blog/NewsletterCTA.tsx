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
    <section className="my-16 rounded-2xl glass-card p-8 md:p-12">
      <div className="max-w-2xl mx-auto text-center">
        <div className="h-1 w-16 bg-gradient-to-r from-primary to-amber-500 rounded-full mx-auto mb-6" />
        <h2 className="font-editorial text-2xl md:text-3xl text-slate-900 mb-3">
          Join the travel journal
        </h2>
        <p className="text-slate-600 mb-6">
          Join our list for destination guides, travel tips, and fresh planning
          ideas.
        </p>
        {status === "success" ? (
          <p
            ref={successRef}
            tabIndex={-1}
            role="status"
            className="text-slate-900 font-semibold text-lg outline-none"
          >
            You’re subscribed as {submittedEmail}. Thanks for joining our travel
            journal.
          </p>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto"
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
              className="flex-1 px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
            />
            <button
              type="submit"
              disabled={!hydrated || status === "loading"}
              className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-xl transition-all whitespace-nowrap disabled:opacity-50"
            >
              {status === "loading" ? "Subscribing..." : "Subscribe Free"}
            </button>
          </form>
        )}
        {status === "error" && (
          <p role="alert" className="text-red-600 text-sm mt-3">
            We couldn’t confirm your subscription. Please try again.
          </p>
        )}
        <p className="text-xs text-slate-500 mt-3">
          Travel-journal updates only.
        </p>
      </div>
    </section>
  );
}
