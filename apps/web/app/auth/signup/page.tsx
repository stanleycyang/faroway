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
import { getSignupCopy } from "@/lib/auth/login-copy";

function SignupContent() {
  const searchParams = useSearchParams() ?? new URLSearchParams();
  const redirectTo = validateRedirectUrl(searchParams.get("redirectTo"));
  const error = searchParams.get("error");
  const copy = getSignupCopy(redirectTo);

  return (
    <AuthPageFrame
      title={copy.title}
      subtitle={copy.subtitle}
      action="signing up"
    >
      {/* Error Message */}
      {error && (
        <div
          role="alert"
          className="mb-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
        >
          {error}
        </div>
      )}

      {/* Auth Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
        {/* OAuth Buttons */}
        <div className="space-y-3">
          <GoogleButton mode="signup" redirectTo={redirectTo} />
          <AppleButton mode="signup" redirectTo={redirectTo} />
        </div>

        {/* Divider */}
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">
              or sign up with email
            </span>
          </div>
        </div>

        {/* Email/Password Form */}
        <EmailPasswordForm mode="signup" redirectTo={redirectTo} />

        {/* Sign In Link */}
        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link
            href={`/auth/login${redirectTo !== "/dashboard" ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ""}`}
            className="font-semibold text-primary hover:text-primary-dark transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthPageFrame>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<AuthPageLoading />}>
      <AuthActionProvider>
        <SignupContent />
      </AuthActionProvider>
    </Suspense>
  );
}
