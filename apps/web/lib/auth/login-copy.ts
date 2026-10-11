export type AuthRedirectIntent = "create" | "trips" | "default";

export interface LoginCopy {
  title: string;
  subtitle: string;
  emphasizeSignup: boolean;
  signupCta: string;
}

export interface SignupCopy {
  title: string;
  subtitle: string;
}

function redirectPath(redirectTo: string | null | undefined): string {
  if (!redirectTo) return "";
  try {
    return decodeURIComponent(redirectTo).split("?")[0] || "";
  } catch {
    return redirectTo.split("?")[0] || "";
  }
}

export function getAuthRedirectIntent(
  redirectTo: string | null | undefined,
): AuthRedirectIntent {
  const path = redirectPath(redirectTo);
  if (path === "/create" || path.startsWith("/create/")) return "create";
  if (path === "/trips" || path.startsWith("/trips/")) return "trips";
  return "default";
}

export function getLoginCopy(redirectTo: string | null | undefined): LoginCopy {
  const intent = getAuthRedirectIntent(redirectTo);
  if (intent === "create") {
    return {
      title: "Your trip is waiting",
      subtitle:
        "Sign in or create a free account to generate your itinerary. We'll keep the destination, dates, and vibes you already entered.",
      emphasizeSignup: true,
      signupCta: "New to Faroway? Sign up to generate your trip",
    };
  }
  if (intent === "trips") {
    return {
      title: "Sign in to see your trips",
      subtitle:
        "You're signing in to open My Trips and the itineraries saved to your account.",
      emphasizeSignup: false,
      signupCta: "Don't have an account? Sign up",
    };
  }
  return {
    title: "Welcome back",
    subtitle: "Sign in to continue planning your adventures",
    emphasizeSignup: false,
    signupCta: "Don't have an account? Sign up",
  };
}

export function getSignupCopy(
  redirectTo: string | null | undefined,
): SignupCopy {
  const intent = getAuthRedirectIntent(redirectTo);
  if (intent === "create") {
    return {
      title: "Create an account to generate your trip",
      subtitle:
        "We'll pick up the destination, dates, and vibes you already entered.",
    };
  }
  if (intent === "trips") {
    return {
      title: "Create an account to see your trips",
      subtitle: "Sign up so generated itineraries stay saved to your account.",
    };
  }
  return {
    title: "Create your account",
    subtitle: "Start planning your perfect trips with AI",
  };
}
