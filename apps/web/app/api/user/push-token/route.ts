import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { createClientFromRequest, getSupabase } from "@/lib/supabase/server";
import { z } from "zod";

const ExpoPushTokenSchema = z
  .string()
  .trim()
  .min(20)
  .max(256)
  .refine(
    (token) =>
      /^ExpoPushToken\[[A-Za-z0-9_-]+\]$/.test(token) ||
      /^ExponentPushToken\[[A-Za-z0-9_-]+\]$/.test(token),
    "Invalid Expo push token",
  );

const RegisterPushTokenSchema = z.object({
  token: ExpoPushTokenSchema,
  platform: z.enum(["ios", "android", "web", "unknown"]).default("unknown"),
  deviceName: z.string().trim().max(120).optional().nullable(),
});

const DeletePushTokenSchema = z.object({
  token: ExpoPushTokenSchema.optional(),
});

async function requireUser(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return user;
}

async function parseOptionalJson(
  request: NextRequest,
): Promise<{ data: unknown } | { error: string }> {
  try {
    const text = await request.text();
    if (!text.trim()) return { data: {} };
    return { data: JSON.parse(text) };
  } catch {
    return { error: "Invalid JSON body" };
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await parseOptionalJson(request);
    if ("error" in body) {
      return NextResponse.json({ error: body.error }, { status: 400 });
    }

    const parseResult = RegisterPushTokenSchema.safeParse(body.data);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.issues },
        { status: 400 },
      );
    }

    const { token, platform, deviceName } = parseResult.data;
    const now = new Date().toISOString();

    const { data, error } = await getSupabase()
      .from("push_tokens")
      .upsert(
        {
          user_id: user.id,
          token,
          platform,
          device_name: deviceName || null,
          updated_at: now,
          last_seen_at: now,
        },
        { onConflict: "user_id,token" },
      )
      .select("token, platform, device_name, updated_at, last_seen_at")
      .single();

    if (error) {
      logger.error("[Push Token] Upsert error:", error);
      return NextResponse.json(
        { error: "Failed to register push token" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      token: data.token,
      platform: data.platform,
      deviceName: data.device_name,
      updatedAt: data.updated_at,
      lastSeenAt: data.last_seen_at,
    });
  } catch (error) {
    logger.error("[Push Token] Error:", error);
    return NextResponse.json(
      { error: "Failed to register push token" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await parseOptionalJson(request);
    if ("error" in body) {
      return NextResponse.json({ error: body.error }, { status: 400 });
    }

    const parseResult = DeletePushTokenSchema.safeParse(body.data);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.issues },
        { status: 400 },
      );
    }

    let query = getSupabase()
      .from("push_tokens")
      .delete()
      .eq("user_id", user.id);

    if (parseResult.data.token) {
      query = query.eq("token", parseResult.data.token);
    }

    const { error } = await query;

    if (error) {
      logger.error("[Push Token] Delete error:", error);
      return NextResponse.json(
        { error: "Failed to delete push token" },
        { status: 500 },
      );
    }

    return NextResponse.json({ deleted: true });
  } catch (error) {
    logger.error("[Push Token] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete push token" },
      { status: 500 },
    );
  }
}
