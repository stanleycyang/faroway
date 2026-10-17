"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { validateRedirectUrl } from "@/lib/security/validate-redirect";
import { useHydrated } from "@/hooks/useHydrated";
import { ArrowLeft, Mail, Check } from "lucide-react";
import { Logo } from "@/components/Logo";
import { AuthRequestTimeoutError } from "@/lib/auth/request-deadline";
import { requestPasswordReset } from "@/lib/auth/password-reset";

function ForgotPasswordContent() {
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const redirectTo = validateRedirectUrl(searchParams.get("redirectTo"));
  const returnQuery =
    redirectTo === "/dashboard"
      ? ""
      : `?redirectTo=${encodeURIComponent(redirectTo)}`;
  const hydrated = useHydrated();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const submittingRef = useRef(false);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (emailSent) successHeadingRef.current?.focus();
  }, [emailSent]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    const address = email.trim();
    setSubmittedEmail(address);
    setIsLoading(true);
    setError("");

    try {
      const { error: resetError } = await requestPasswordReset(
        address,
        redirectTo,
      );
      if (resetError) throw resetError;

      setEmailSent(true);
    } catch (err) {
      setError(
        err instanceof AuthRequestTimeoutError
          ? "We couldn’t confirm whether your reset email was sent. Check your inbox before trying again."
          : err instanceof Error
            ? err.message
            : "Couldn’t request a reset link. Please try again.",
      );
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
  };

  if (emailSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa] px-4">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
            <Check className="w-10 h-10 text-green-600" />
          </div>

          <h1
            ref={successHeadingRef}
            tabIndex={-1}
            className="font-editorial text-3xl text-slate-900 mb-3 outline-none"
          >
            Check your email
          </h1>
          <p className="text-gray-600 mb-8">
            If an account uses <strong>{submittedEmail}</strong>, you’ll receive
            a password reset link. Open the link in that email to choose a new
            password.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
            <p className="text-sm text-blue-800">
              <strong>Didn&apos;t receive the email?</strong> Check your spam
              folder or wait a few minutes and try again.
            </p>
          </div>

          <Link
            href={`/auth/login${returnQuery}`}
            className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900 font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa] px-4">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <Link
          href={`/auth/login${returnQuery}`}
          className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </Link>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo size="lg" variant="dark" />
          </div>
          <h1 className="mt-6 font-editorial text-3xl text-slate-900">
            Reset your password
          </h1>
          <p className="mt-2 text-gray-600">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
          >
            {error}
          </div>
        )}

        {/* Form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  autoComplete="email"
                  disabled={!hydrated || isLoading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!hydrated || isLoading || !email}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-colors shadow-sm"
            >
              {isLoading ? "Sending..." : "Send reset link"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-600">
            Remember your password?{" "}
            <Link
              href={`/auth/login${returnQuery}`}
              className="font-semibold text-slate-700 hover:text-slate-900 transition-colors"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          className="min-h-screen flex items-center justify-center"
        >
          Loading password recovery…
        </div>
      }
    >
      <ForgotPasswordContent />
    </Suspense>
  );
}
