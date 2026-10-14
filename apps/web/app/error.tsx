"use client";

import { useEffect, useRef } from "react";
import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { AlertTriangle, RefreshCw, Home, MessageCircle } from "lucide-react";

export default function Error({
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
    console.error("Application error:", error);
  }, [error]);

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-50 to-red-50 flex items-center justify-center p-4">
      <div className="max-w-lg w-full text-center">
        {/* Error Icon */}
        <div className="relative mb-8">
          <div className="w-32 h-32 mx-auto bg-white rounded-full shadow-lg flex items-center justify-center">
            <AlertTriangle className="w-16 h-16 text-red-500" />
          </div>
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-black/10 rounded-full blur-md" />
        </div>

        {/* Error Message */}
        <h1
          ref={heading}
          tabIndex={-1}
          className="font-editorial text-3xl text-gray-900 mb-4 outline-none"
        >
          This page couldn’t load
        </h1>
        <p className="text-gray-600 mb-2">
          We hit some turbulence while loading this page.
        </p>
        <p className="text-gray-500 text-sm mb-8">
          Try loading the page again. If this happened while saving a change,
          check your saved trip before submitting it again.
        </p>

        {/* Error Details (only in development) */}
        {process.env.NODE_ENV === "development" && (
          <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl text-left">
            <p className="text-sm text-red-800 font-mono break-all">
              {error.message}
            </p>
            {error.digest && (
              <p className="text-xs text-red-600 mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white rounded-full font-semibold hover:bg-primary-600 transition-all shadow-lg shadow-primary/25 hover:shadow-xl"
          >
            <RefreshCw className="w-5 h-5" />
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-gray-700 rounded-full font-semibold border border-gray-200 hover:border-primary hover:text-primary transition-all"
          >
            <Home className="w-5 h-5" />
            Back to Home
          </Link>
        </div>

        {/* Help Link */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-2">Still having issues?</p>
          <a
            href="mailto:support@faroway.ai"
            className="inline-flex items-center gap-2 text-primary hover:text-primary-600 font-medium transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Contact Support
          </a>
        </div>
      </div>
    </main>
  );
}
