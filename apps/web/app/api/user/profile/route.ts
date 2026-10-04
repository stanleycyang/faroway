/**
 * User Profile API
 * GET /api/user/profile - Get current user profile
 * PATCH /api/user/profile - Update user profile
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import {
  requireAuth,
  validationErrorResponse,
  AuthResult,
} from "@/lib/auth/middleware";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { z } from "zod";

interface ProfileRow {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  auth_provider: string;
  subscription_tier: string;
  preferences: Record<string, unknown> | null;
  notification_settings: Record<string, boolean> | null;
  notification_consent_version?: string | null;
  created_at: string;
  updated_at: string;
}

const UpdateProfileSchema = z.object({
  email: z.string().email().optional(),
  display_name: z.string().min(1).max(100).trim().optional(),
  avatar_url: z.string().url().optional(),
  preferences: z
    .object({
      vibes: z.array(z.string().max(50)).max(10).optional(),
      budget: z.enum(["budget", "moderate", "luxury"]).optional(),
      travelerType: z
        .enum(["solo", "couple", "family", "friends", "business"])
        .optional(),
    })
    .optional(),
  notification_settings: z.record(z.boolean()).optional(),
});

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult as AuthResult;

  try {
    const { data: profile, error } = await getSupabase()
      .from("users")
      .select(
        "id, email, display_name, avatar_url, auth_provider, subscription_tier, preferences, notification_settings, created_at, updated_at" +
          (process.env.PUSH_CONSENT_V2_ENABLED === "true"
            ? ", notification_consent_version"
            : ""),
      )
      .eq("id", user!.id)
      .single<ProfileRow>();

    if (error) {
      console.error("[User Profile] Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch profile" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      id: profile.id,
      email: profile.email,
      name: profile.display_name,
      avatar: profile.avatar_url,
      authProvider: profile.auth_provider,
      subscriptionTier: profile.subscription_tier,
      preferences: profile.preferences || {},
      notificationSettings: profile.notification_settings || {},
      notificationConsentVersion: profile.notification_consent_version || null,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    });
  } catch (error) {
    console.error("[User Profile] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const authResult = await requireAuth(request);

  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult as AuthResult;

  // Rate limit: 10 req/min per user
  const rl = checkRateLimit(`profile-patch:${user!.id}`, {
    maxRequests: 10,
    windowMs: 60_000,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parseResult = UpdateProfileSchema.safeParse(body);

    if (!parseResult.success) {
      return validationErrorResponse(
        "Invalid request body",
        parseResult.error.issues,
      );
    }

    const updates: Record<string, unknown> = {};

    if (parseResult.data.email) {
      updates.email = parseResult.data.email;
    }
    if (parseResult.data.display_name !== undefined) {
      updates.display_name = parseResult.data.display_name;
    }
    if (parseResult.data.avatar_url !== undefined) {
      updates.avatar_url = parseResult.data.avatar_url;
    }
    if (parseResult.data.preferences !== undefined) {
      updates.preferences = parseResult.data.preferences;
    }
    if (parseResult.data.notification_settings !== undefined) {
      updates.notification_settings = parseResult.data.notification_settings;
      if (process.env.PUSH_CONSENT_V2_ENABLED === "true")
        updates.notification_consent_version = "notifications-v2";
    }

    if (Object.keys(updates).length === 0) {
      return validationErrorResponse("No fields to update");
    }

    const { data: profile, error } = await getSupabase()
      .from("users")
      .update(updates)
      .eq("id", user!.id)
      .select()
      .single<ProfileRow>();

    if (error) {
      console.error("[User Profile] Update error:", error);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      id: profile.id,
      email: profile.email,
      name: profile.display_name,
      avatar: profile.avatar_url,
      authProvider: profile.auth_provider,
      subscriptionTier: profile.subscription_tier,
      preferences: profile.preferences || {},
      notificationSettings: profile.notification_settings || {},
      notificationConsentVersion: profile.notification_consent_version || null,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    });
  } catch (error) {
    console.error("[User Profile] PATCH error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/user/profile
 * Permanently deletes the signed-in user's account and all owned data.
 *
 * Two ordered ops:
 *   1. DELETE FROM public.users → cascades trips, itineraries,
 *      workflow_progress, workflow_runs (per init/workflow migrations).
 *   2. auth.admin.deleteUser → cascades push_tokens; SET NULLs
 *      affiliate_clicks / affiliate_conversions / searches.user_id
 *      (intentional — keeps anonymized affiliate-revenue rows).
 *
 * Step 1 fails ⇒ bail before step 2 so the user can retry.
 */
// One deletion boundary for both legacy and current native clients.
export { DELETE } from "@/lib/auth/account-deletion-route";
