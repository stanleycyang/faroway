"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { EmailPasswordForm } from "@/components/auth/EmailPasswordForm";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { AppleButton } from "@/components/auth/AppleButton";
import { AuthActionProvider } from "@/components/auth/AuthActionProvider";
import {
  AuthPageFrame,
  AuthPageLoading,
} from "@/components/auth/AuthPageFrame";
import { validateRedirectUrl } from "@/lib/security/validate-redirect";
import { getLoginCopy } from "@/lib/auth/login-copy";

function LoginContent() {
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const redirectTo = validateRedirectUrl(searchParams.get("redirectTo"));
  const error = searchParams.get("error");
  const message = searchParams.get("message");
  const copy = getLoginCopy(redirectTo);

  return (
    <AuthPageFrame
      title={copy.title}
      subtitle={copy.subtitle}
      action="signing in"
    >
      {/* Error/Success Messages */}
      {error && (
        <div
          role="alert"
          className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
        >
          {error === "auth_code_error" &&
            "There was an error signing you in. Please try again."}
          {error === "auth_cancelled" &&
            "Sign-in was canceled. Choose a method below to continue planning."}
          {error === "auth_timeout" &&
            "Sign-in could not be confirmed. Choose a method below to try again."}
          {error === "no_code" &&
            "Invalid authentication request. Please try again."}
          {error !== "auth_code_error" &&
            error !== "auth_cancelled" &&
            error !== "auth_timeout" &&
            error !== "no_code" &&
            error}
        </div>
      )}

      {message && (
        <div
          role="status"
          className="mb-4 p-4 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm"
        >
          {message}
        </div>
      )}

      {/* Auth Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
        {/* OAuth Buttons */}
        <div className="space-y-3">
          <GoogleButton mode="signin" redirectTo={redirectTo} />
          <AppleButton mode="signin" redirectTo={redirectTo} />
        </div>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">
              or continue with email
            </span>
          </div>
        </div>

        {/* Email/Password Form */}
        <EmailPasswordForm mode="signin" redirectTo={redirectTo} />

        {/* Forgot Password Link */}
        <div className="mt-4 text-center">
          <Link
            href={`/auth/forgot-password${redirectTo !== "/dashboard" ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`}
            className="text-sm text-gray-600 hover:text-primary transition-colors"
          >
            Forgot your password?
          </Link>
        </div>

        {/* Sign Up Link */}
        {copy.emphasizeSignup ? (
          <div className="mt-6 rounded-xl border border-primary/20 bg-primary-50 px-4 py-3 text-center">
            <p className="text-sm font-medium text-primary-800">
              First time here? A free account is required to generate this trip.
            </p>
            <Link
              href={`/auth/signup?redirectTo=${encodeURIComponent(redirectTo)}`}
              className="mt-2 inline-block font-semibold text-primary hover:text-primary-dark transition-colors"
            >
              {copy.signupCta}
            </Link>
          </div>
        ) : (
          <p className="mt-6 text-center text-sm text-gray-600">
            Don&apos;t have an account?{" "}
            <Link
              href={`/auth/signup${redirectTo !== "/dashboard" ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`}
              className="font-semibold text-primary hover:text-primary-dark transition-colors"
            >
              Sign up
            </Link>
          </p>
        )}
      </div>
    </AuthPageFrame>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthPageLoading />}>
      <AuthActionProvider>
        <LoginContent />
      </AuthActionProvider>
    </Suspense>
  );
}
