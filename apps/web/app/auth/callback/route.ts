import { NextResponse } from "next/server";
import {
  withAuthRequestDeadline,
  AuthRequestTimeoutError,
} from "@/lib/auth/request-deadline";
import { createClient } from "@/lib/supabase/server";
import { validateRedirectUrl } from "@/lib/security/validate-redirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = validateRedirectUrl(searchParams.get("next"));
  let timedOut = false;

  if (code && !searchParams.has("error")) {
    try {
      const supabase = await createClient();
      const { error } = await withAuthRequestDeadline(
        supabase.auth.exchangeCodeForSession(code),
      );

      if (!error) {
        // Preserve the request origin; arbitrary forwarding headers are not a
        // trusted source for the post-authentication destination.
        return NextResponse.redirect(new URL(next, origin));
      }
    } catch (cause) {
      timedOut = cause instanceof AuthRequestTimeoutError;
      // A provider/network failure must leave a usable path back to sign-in.
    }
  }

  // Authentication failed - redirect to login with error
  const login = new URL("/auth/login", origin);
  login.searchParams.set(
    "error",
    timedOut
      ? "auth_timeout"
      : searchParams.get("error") === "access_denied"
        ? "auth_cancelled"
        : "auth_code_error",
  );
  if (next !== "/dashboard") login.searchParams.set("redirectTo", next);
  return NextResponse.redirect(login);
}
