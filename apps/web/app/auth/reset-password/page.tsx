"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { Check, KeyRound } from "lucide-react";
import { Logo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setStatus("saving");
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });
      if (updateError) throw updateError;
      setStatus("saved");
    } catch {
      setError(
        "This reset link is invalid or has expired. Request a new link and try again.",
      );
      setStatus("idle");
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 to-white px-4 py-12">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-8 flex justify-center">
          <Logo size="lg" variant="dark" />
        </div>

        {status === "saved" ? (
          <div className="rounded-2xl border border-emerald-200 bg-white p-8 text-center shadow-xl">
            <Check className="mx-auto mb-4 h-12 w-12 text-emerald-600" />
            <h1 className="text-2xl font-semibold text-gray-900">
              Password updated
            </h1>
            <p className="mt-3 text-gray-600">
              Your new password is ready. You can now return to your trips.
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-6 py-3 font-semibold text-white hover:bg-primary-600"
            >
              Continue to my trips
            </Link>
          </div>
        ) : (
          <div className="rounded-2xl border border-gray-100 bg-white p-8 shadow-xl">
            <KeyRound className="mb-4 h-9 w-9 text-primary" />
            <h1 className="text-2xl font-semibold text-gray-900">
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
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
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
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
                >
                  {error}
                  <Link
                    href="/auth/forgot-password"
                    className="mt-2 block font-semibold underline underline-offset-2"
                  >
                    Request a new reset link
                  </Link>
                </div>
              )}

              <button
                type="submit"
                disabled={status === "saving"}
                className="min-h-12 w-full rounded-xl bg-primary px-5 py-3 font-semibold text-white shadow-lg shadow-primary/20 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
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
