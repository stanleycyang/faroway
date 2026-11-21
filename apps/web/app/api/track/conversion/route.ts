/**
 * Affiliate Conversion Webhook
 * POST /api/track/conversion - Webhook for affiliate partners to report conversions
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { checkRateLimitAsync, getClientIp } from "@/lib/security/rate-limit";
import { z } from "zod";
import crypto from "crypto";

const MAX_WEBHOOK_BODY_BYTES = 16_384;
const KNOWN_PARTNERS = ["viator", "getyourguide", "klook"] as const;
type WebhookPartner = (typeof KNOWN_PARTNERS)[number];

const STATUS_RANK: Record<"pending" | "confirmed" | "cancelled", number> = {
  pending: 0,
  confirmed: 1,
  cancelled: 2,
};

function getWebhookSecret(partner: WebhookPartner): string | undefined {
  switch (partner) {
    case "viator":
      return process.env.VIATOR_WEBHOOK_SECRET;
    case "getyourguide":
      return process.env.GYG_WEBHOOK_SECRET;
    case "klook":
      return process.env.KLOOK_WEBHOOK_SECRET;
  }
}

const ConversionSchema = z.object({
  // Required fields
  click_id: z.string().min(1).max(200),
  partner: z.enum(KNOWN_PARTNERS),

  // Conversion details
  order_id: z.string().min(1).max(200).optional(),
  booking_reference: z.string().min(1).max(200).optional(),

  // Financial
  booking_value: z.number().finite().nonnegative(),
  commission_value: z.number().finite().nonnegative(),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .default("USD"),

  // Status
  status: z.enum(["confirmed", "pending", "cancelled"]).default("confirmed"),

  // Timing
  conversion_date: z.string().datetime({ offset: true }).optional(),
});

function verifySignatureWithSecret(
  secret: string,
  payload: string,
  signature: string,
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSignature, "hex"),
  );
}

/**
 * Verify webhook signature from affiliate partner
 */
function verifyWebhookSignature(
  partner: WebhookPartner,
  payload: string,
  signature: string | null,
): boolean {
  const secret = getWebhookSecret(partner);

  // Fail-closed: reject if no secret configured regardless of environment
  if (!secret) {
    console.warn(
      `[Conversion Webhook] No secret configured for partner: ${partner}. Rejecting request.`,
    );
    return false;
  }

  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }

  return verifySignatureWithSecret(secret, payload, signature);
}

function verifyAnyConfiguredPartnerSignature(
  payload: string,
  signature: string | null,
): boolean {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) {
    return false;
  }
  let matched = false;
  for (const partner of KNOWN_PARTNERS) {
    const secret = getWebhookSecret(partner);
    if (!secret) continue;
    if (verifySignatureWithSecret(secret, payload, signature)) {
      matched = true;
    }
  }
  return matched;
}

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimitAsync(`conversion-webhook:${ip}`, {
      maxRequests: 60,
      windowMs: 60_000,
      failClosed: true,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const contentLength = Number(request.headers.get("content-length") || "0");
    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_WEBHOOK_BODY_BYTES
    ) {
      return NextResponse.json(
        { error: "Webhook payload too large" },
        { status: 413 },
      );
    }

    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BODY_BYTES) {
      return NextResponse.json(
        { error: "Webhook payload too large" },
        { status: 413 },
      );
    }

    const signature = request.headers.get("x-webhook-signature");
    if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 },
      );
    }

    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      if (!verifyAnyConfiguredPartnerSignature(rawBody, signature)) {
        return NextResponse.json(
          { error: "Invalid webhook signature" },
          { status: 401 },
        );
      }
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 },
      );
    }

    // Verify webhook authenticity BEFORE full schema validation so unauthenticated
    // callers cannot probe payload structure or trigger validation work.
    const rawPartner =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>).partner
        : undefined;
    const isKnownPartner =
      typeof rawPartner === "string" &&
      (KNOWN_PARTNERS as readonly string[]).includes(rawPartner);

    const signatureValid = isKnownPartner
      ? verifyWebhookSignature(rawPartner as WebhookPartner, rawBody, signature)
      : verifyAnyConfiguredPartnerSignature(rawBody, signature);

    if (!signatureValid) {
      console.error("[Conversion Webhook] Invalid signature");
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 },
      );
    }

    const parseResult = ConversionSchema.safeParse(body);

    if (!parseResult.success) {
      console.error(
        "[Conversion Webhook] Validation error:",
        parseResult.error,
      );
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 },
      );
    }

    const data = parseResult.data;

    // Find the original click
    const { data: click, error: findError } = await getSupabase()
      .from("affiliate_clicks")
      .select("*")
      .eq("id", data.click_id)
      .single();

    if (findError || !click) {
      console.error("[Conversion Webhook] Click not found:", data.click_id);
      // Still record the conversion, but log the issue
    }

    // Monotonic status guard: prevent out-of-order or replayed older webhooks
    // from regressing a confirmed/cancelled conversion to an earlier state.
    const conversionKey =
      data.order_id || data.booking_reference || (click?.id ?? null);
    if (conversionKey) {
      const { data: existingRows } = await getSupabase()
        .from("affiliate_conversions")
        .select("status")
        .eq("partner", data.partner)
        .eq("conversion_key", conversionKey)
        .limit(1);
      const existingStatus = Array.isArray(existingRows)
        ? (existingRows[0] as { status?: string } | undefined)?.status
        : undefined;
      if (
        existingStatus &&
        existingStatus in STATUS_RANK &&
        STATUS_RANK[existingStatus as keyof typeof STATUS_RANK] >
          STATUS_RANK[data.status]
      ) {
        return NextResponse.json({
          success: true,
          clickId: data.click_id,
          ignored: true,
        });
      }
    }

    // Record the conversion idempotently. Partner webhooks are retried and may
    // advance a booking from pending to confirmed or cancelled.
    const { error: insertError } = await getSupabase()
      .from("affiliate_conversions")
      .upsert(
        {
          click_id: click?.id || null,
          partner: data.partner,
          order_id: data.order_id,
          booking_reference: data.booking_reference,
          booking_value: data.booking_value,
          commission_value: data.commission_value,
          currency: data.currency,
          status: data.status,
          user_id: click?.user_id || null,
          conversion_date: data.conversion_date || new Date().toISOString(),
        },
        { onConflict: "partner,conversion_key" },
      );

    if (insertError) {
      console.error("[Conversion Webhook] Database error:", insertError);
      return NextResponse.json(
        { error: "Failed to record conversion" },
        { status: 500 },
      );
    }

    // Update the original click as converted
    if (click) {
      await getSupabase()
        .from("affiliate_clicks")
        .update({
          converted: data.status === "confirmed",
          conversion_value:
            data.status === "confirmed" ? data.commission_value : null,
        })
        .eq("id", data.click_id);
    }

    console.log(
      `[Conversion Webhook] Recorded: ${data.click_id} - $${data.commission_value} from ${data.partner}`,
    );

    return NextResponse.json({ success: true, clickId: data.click_id });
  } catch (error) {
    console.error("[Conversion Webhook] Error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
