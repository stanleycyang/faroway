"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  withAuthRequestDeadline,
  AuthRequestTimeoutError,
} from "@/lib/auth/request-deadline";
import { useHydrated } from "@/hooks/useHydrated";
import { useAuthActions } from "./AuthActionProvider";

interface EmailPasswordFormProps {
  mode: "signin" | "signup";
  redirectTo?: string;
}

export function EmailPasswordForm({
  mode,
  redirectTo = "/dashboard",
}: EmailPasswordFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const actions = useAuthActions();
  const hydrated = useHydrated();
  const loading = actions.pending === "email";
  const disabled = !hydrated || !!actions.pending;
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hydrated) return;
    const attempt = actions.begin("email");
    if (!attempt) return;
    setError(null);
    setMessage(null);

    // Validate inputs
    if (!email || !password) {
      setError("Please fill in all fields");
      actions.finish(attempt);
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError("Passwords do not match");
      actions.finish(attempt);
      return;
    }

    // Existing passwords may predate the current signup policy. Let Auth verify them.
    if (mode === "signup" && password.length < 8) {
      setError("Password must be at least 8 characters");
      actions.finish(attempt);
      return;
    }

    try {
      const supabase = createClient();

      if (mode === "signup") {
        if (typeof supabase.auth.signUp !== "function")
          throw new Error(
            "Account creation is unavailable right now. Please try again later.",
          );
        const { data, error: signUpError } = await withAuthRequestDeadline(
          supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
            },
          }),
        );

        if (!actions.isActive(attempt)) return;
        if (signUpError) throw signUpError;
        if (data.session) {
          router.push(redirectTo);
          router.refresh();
          return;
        }
        setMessage(
          "Check your email for a confirmation link to complete your signup.",
        );
      } else {
        if (typeof supabase.auth.signInWithPassword !== "function")
          throw new Error(
            "Sign-in is unavailable right now. Please try again later.",
          );
        const { error: signInError } = await withAuthRequestDeadline(
          supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          }),
        );

        if (!actions.isActive(attempt)) return;
        if (signInError) {
          throw new Error(
            signInError.message === "Invalid login credentials"
              ? "Invalid email or password"
              : signInError.message,
          );
        }

        router.push(redirectTo);
        router.refresh();
      }
    } catch (submitError) {
      if (!actions.isActive(attempt)) return;
      setError(
        submitError instanceof AuthRequestTimeoutError
          ? mode === "signup"
            ? "Account creation could not be confirmed. Check your inbox before trying again."
            : "Sign-in could not be confirmed. Please try again."
          : submitError instanceof Error
            ? submitError.message
            : "Couldn’t complete authentication. Please try again.",
      );
    } finally {
      actions.finish(attempt);
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-busy={loading} className="space-y-4">
      {/* Error Message */}
      {error && (
        <div
          role="alert"
          className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm"
        >
          {error}
        </div>
      )}

      {/* Success Message */}
      {message && (
        <div
          role="status"
          className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm"
        >
          {message}
        </div>
      )}

      {/* Email Input */}
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Email address
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          disabled={disabled}
          className="w-full px-4 py-3 min-h-[48px] border border-gray-300 rounded-xl text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
        />
      </div>

      {/* Password Input */}
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          required
          disabled={disabled}
          minLength={mode === "signup" ? 8 : undefined}
          className="w-full px-4 py-3 min-h-[48px] border border-gray-300 rounded-xl text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
        />
      </div>

      {/* Confirm Password (signup only) */}
      {mode === "signup" && (
        <div>
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            required
            disabled={disabled}
            minLength={8}
            className="w-full px-4 py-3 min-h-[48px] border border-gray-300 rounded-xl text-base text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
          />
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={disabled}
        className="w-full px-4 py-3 min-h-[48px] bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg
              className="animate-spin motion-reduce:animate-none h-5 w-5"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            {mode === "signin" ? "Signing in..." : "Creating account..."}
          </span>
        ) : (
          <span>{mode === "signin" ? "Sign in" : "Create account"}</span>
        )}
      </button>
    </form>
  );
}
