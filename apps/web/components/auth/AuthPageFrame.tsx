import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";

/** Shared presentation; sign-in and sign-up retain their own state and actions. */
export function AuthPageFrame({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action: "signing in" | "signing up";
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa] px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Logo size="lg" variant="dark" />
          </div>
          <h1 className="mt-6 font-editorial text-4xl leading-tight text-slate-900">
            {title}
          </h1>
          <p className="mt-2 text-gray-600">{subtitle}</p>
        </div>
        {children}
        <p className="mt-6 text-center text-xs text-gray-500">
          By {action}, you agree to our{" "}
          <Link href="/terms" className="underline hover:text-gray-700">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-gray-700">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}

export function AuthPageLoading() {
  return (
    <div
      role="status"
      className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#f7f8fa] text-slate-700"
    >
      <div
        aria-hidden="true"
        className="motion-safe:animate-spin rounded-full h-8 w-8 border-b-2 border-primary-700"
      />
      <p className="text-sm">Preparing your sign-in options…</p>
    </div>
  );
}
