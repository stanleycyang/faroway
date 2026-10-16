"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { validateRedirectUrl } from "@/lib/security/validate-redirect";
import { useHydrated } from "@/hooks/useHydrated";
import { Check, KeyRound } from "lucide-react";
import { Logo } from "@/components/Logo";
import {
  withAuthRequestDeadline,
  AuthRequestTimeoutError,
} from "@/lib/auth/request-deadline";
import { createClient } from "@/lib/supabase/client";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const redirectTo = validateRedirectUrl(searchParams.get("redirectTo"));
  const returnQuery =
    redirectTo === "/dashboard"
      ? ""
      : `?redirectTo=${encodeURIComponent(redirectTo)}`;
  const hydrated = useHydrated();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const submittingRef = useRef(false);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (status === "saved") successHeadingRef.current?.focus();
  }, [status]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) return;
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    submittingRef.current = true;
    setStatus("saving");
    try {
      const supabase = createClient();
      const { error: updateError } = await withAuthRequestDeadline(
        supabase.auth.updateUser({
          password,
        }),
      );
      if (updateError) throw updateError;
      setStatus("saved");
    } catch (reason) {
      setError(
        reason instanceof AuthRequestTimeoutError
          ? "We couldn’t confirm the password change. Try signing in with your new password, or request another reset link."
          : "We couldn’t update your password. Check your connection and try again, or request a new reset link.",
      );
      setStatus("idle");
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f8fa] px-4 py-12">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" variant="dark" />
        </div>

        {status === "saved" ? (
          <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-sm">
            <Check className="mx-auto mb-4 h-12 w-12 text-emerald-600" />
            <h1
              ref={successHeadingRef}
              tabIndex={-1}
              className="font-editorial text-3xl text-slate-900 outline-none"
            >
              Password updated
            </h1>
            <p className="mt-3 text-gray-600">
              Your new password is ready. You can now return to your trips.
            </p>
            <Link
              href={redirectTo}
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white hover:bg-slate-800"
            >
              {redirectTo.startsWith("/create")
                ? "Continue planning"
                : "Continue to my trips"}
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-sm">
            <KeyRound className="mb-4 h-9 w-9 text-primary" />
            <h1 className="font-editorial text-3xl text-slate-900">
              Choose a new password
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              Use at least 8 characters and avoid a password you use elsewhere.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div>
                <label
                  htmlFor="new-password"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  New password
                </label>
                <input
                  id="new-password"
                  type="password"
                  disabled={!hydrated || status === "saving"}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm-new-password"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Confirm new password
                </label>
                <input
                  id="confirm-new-password"
                  type="password"
                  disabled={!hydrated || status === "saving"}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                  {error}
                  <Link
                    href={`/auth/forgot-password${returnQuery}`}
                    className="mt-2 block font-semibold underline underline-offset-2"
                  >
                    Request a new reset link
                  </Link>
                </div>
              )}

              <button
                type="submit"
                disabled={!hydrated || status === "saving"}
                className="min-h-12 w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "saving" ? "Updating password…" : "Update password"}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
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
      <ResetPasswordContent />
    </Suspense>
  );
}
