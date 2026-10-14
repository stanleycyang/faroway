"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHydrated } from "@/hooks/useHydrated";
import { withAuthRequestDeadline } from "@/lib/auth/request-deadline";
import { useAuthActions } from "./AuthActionProvider";

export function useOAuthSignIn(
  provider: "google" | "apple",
  redirectTo: string,
) {
  const actions = useAuthActions();
  const hydrated = useHydrated();
  const [error, setError] = useState<string | null>(null);
  const signIn = async () => {
    if (!hydrated) return;
    const attempt = actions.begin(provider);
    if (!attempt) return;
    setError(null);
    try {
      const supabase = createClient();
      if (typeof supabase.auth.signInWithOAuth !== "function") {
        throw new Error(
          "Sign-in is unavailable right now. Please try again later.",
        );
      }
      const result = await withAuthRequestDeadline(
        supabase.auth.signInWithOAuth({
          provider,
          options: {
            skipBrowserRedirect: true,
            redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
            ...(provider === "google"
              ? { queryParams: { access_type: "offline", prompt: "consent" } }
              : {}),
          },
        }),
      );
      if (result.error) throw result.error;
      if (!result.data.url)
        throw new Error(
          "The sign-in provider could not be reached. Please try again.",
        );
      if (!actions.isActive(attempt)) return;
      // Explicit navigation prevents a late SDK result from leaving a screen
      // the traveler has already exited. Keep methods locked until departure.
      window.location.assign(result.data.url);
    } catch (cause) {
      if (actions.isActive(attempt)) {
        setError(
          cause instanceof Error
            ? cause.message
            : "Couldn’t start sign-in. Please try again.",
        );
      }
      actions.finish(attempt);
    }
  };
  return {
    signIn,
    error,
    disabled: !hydrated || !!actions.pending,
    pending: actions.pending === provider,
  };
}
