/**
 * Authentication Middleware
 * Validates JWT tokens and extracts user information
 */

import { NextRequest, NextResponse } from "next/server";
import { createClientFromRequest, getSupabase } from "@/lib/supabase/server";

export interface AuthUser {
  id: string;
  email: string;
  role?: string;
}

export interface AuthResult {
  authenticated: boolean;
  user: AuthUser | null;
  error?: string;
}

/**
 * Validate authentication token from request
 */
export async function validateAuth(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader?.startsWith("Bearer ")) {
    return {
      authenticated: false,
      user: null,
      error: "Missing or invalid Authorization header",
    };
  }

  const token = authHeader.substring(7);

  try {
    const {
      data: { user },
      error,
    } = await getSupabase().auth.getUser(token);

    if (error || !user) {
      return {
        authenticated: false,
        user: null,
        error: error?.message || "Invalid token",
      };
    }

    return {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email || "",
        role: user.role,
      },
    };
  } catch {
    return {
      authenticated: false,
      user: null,
      error: "Token validation failed",
    };
  }
}

/**
 * Require authentication - returns error response if not authenticated
 */
export async function requireAuth(
  request: NextRequest,
): Promise<AuthResult | NextResponse> {
  const result = await validateAuth(request);

  if (!result.authenticated) {
    return NextResponse.json(
      { error: result.error, code: "UNAUTHORIZED" },
      { status: 401 },
    );
  }

  return result;
}

/**
 * Optional authentication - returns user if authenticated, null otherwise
 */
export async function optionalAuth(
  request: NextRequest,
): Promise<AuthUser | null> {
  const result = await validateAuth(request);
  return result.authenticated ? result.user : null;
}

/**
 * Create unauthorized response
 */
export function unauthorizedResponse(message = "Unauthorized"): NextResponse {
  return NextResponse.json(
    { error: message, code: "UNAUTHORIZED" },
    { status: 401 },
  );
}

/**
 * Create forbidden response
 */
export function forbiddenResponse(message = "Forbidden"): NextResponse {
  return NextResponse.json(
    { error: message, code: "FORBIDDEN" },
    { status: 403 },
  );
}

/**
 * Create not found response
 */
export function notFoundResponse(message = "Not found"): NextResponse {
  return NextResponse.json(
    { error: message, code: "NOT_FOUND" },
    { status: 404 },
  );
}

/**
 * Create validation error response
 */
export function validationErrorResponse(
  message: string,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    { error: message, code: "VALIDATION_ERROR", details },
    { status: 400 },
  );
}

/**
 * Resolve the signed-in user ID via the request's bearer token (mobile) or
 * cookie session (web). Unlike {@link requireAuth}, this works for both
 * transports because it delegates to {@link createClientFromRequest}.
 *
 * Returns `{ userId }` on success, a 401 NextResponse if there's no valid
 * session, or a 500 NextResponse if Supabase itself failed. Routes that just
 * need the user's UUID (and not the full {@link AuthUser} object) should
 * prefer this over {@link requireAuth}.
 */
export async function requireUserIdFromRequest(
  request: NextRequest,
): Promise<{ userId: string } | NextResponse> {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return { userId: user.id };
  } catch (err) {
    // A thrown exception here means the Supabase client itself blew up
    // (network / config) — treat as a 500 so Sentry surfaces it instead of
    // masquerading as a permissions problem.
    console.error("[auth] requireUserIdFromRequest threw:", err);
    return NextResponse.json({ error: "Auth check failed" }, { status: 500 });
  }
}
