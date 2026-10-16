import { withAuthRequestDeadline } from "./request-deadline";
import { validateRedirectUrl } from "@/lib/security/validate-redirect";
import { createClient } from "@/lib/supabase/client";

export async function requestPasswordReset(
  email: string,
  destination = "/dashboard",
) {
  const supabase = createClient();
  if (typeof supabase.auth.resetPasswordForEmail !== "function") {
    throw new Error(
      "Password recovery is unavailable right now. Please contact support or try again later.",
    );
  }
  const redirectTo = validateRedirectUrl(destination);
  const next =
    redirectTo === "/dashboard"
      ? "/auth/reset-password"
      : `/auth/reset-password?redirectTo=${encodeURIComponent(redirectTo)}`;
  const callbackNext =
    redirectTo === "/dashboard" ? next : encodeURIComponent(next);
  return withAuthRequestDeadline(
    supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=${callbackNext}`,
    }),
  );
}
