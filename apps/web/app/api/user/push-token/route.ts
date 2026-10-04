import { NextRequest, NextResponse } from "next/server";
import { createClientFromRequest, getSupabase } from "@/lib/supabase/server";
import { z } from "zod";

const schema = z.object({
  token: z
    .string()
    .min(20)
    .max(256)
    .regex(/^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]+\]$/),
  revision: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  consentVersion: z.literal("notifications-v2"),
  platform: z.enum(["ios", "android", "web", "unknown"]).default("unknown"),
});
async function update(request: NextRequest, enabled: boolean) {
  const auth = await createClientFromRequest(request);
  const {
    data: { user },
    error: authError,
  } = await auth.auth.getUser();
  if (authError || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success)
    return NextResponse.json(
      { error: "An updated notification consent request is required." },
      { status: 400 },
    );
  const db = getSupabase();
  if (enabled && process.env.PUSH_CONSENT_V2_ENABLED !== "true")
    return NextResponse.json(
      { error: "Device notifications are not enabled yet." },
      { status: 503 },
    );
  // Registration flags never disable ordered revocation. Physical deletion
  // would erase the revision tombstone and let a delayed POST resurrect consent.
  // Missing ordering schema fails closed; no destructive legacy fallback.
  const { data, error } = await db.rpc("set_device_push_consent", {
    p_user_id: user.id,
    p_token: input.data.token,
    p_revision: input.data.revision,
    p_enabled: enabled,
    p_platform: input.data.platform,
  });
  if (error)
    return NextResponse.json(
      { error: "Notification settings are unavailable. Please retry." },
      { status: 503 },
    );
  if (data !== true)
    return NextResponse.json(
      {
        error:
          "Registration changed or belongs to another account. Please retry from Settings.",
      },
      { status: 409 },
    );
  return NextResponse.json(enabled ? { registered: true } : { deleted: true });
}
export async function POST(request: NextRequest) {
  return update(request, true).catch(() =>
    NextResponse.json(
      { error: "Notification settings unavailable" },
      { status: 503 },
    ),
  );
}
export async function DELETE(request: NextRequest) {
  return update(request, false).catch(() =>
    NextResponse.json(
      { error: "Notification settings unavailable" },
      { status: 503 },
    ),
  );
}
