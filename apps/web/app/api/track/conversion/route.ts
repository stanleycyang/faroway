/**
 * Affiliate Conversion Webhook
 * POST /api/track/conversion - Webhook for affiliate partners to report conversions
 */

import crypto from "node:crypto";
import type { AffiliatePartnerId } from "@faroway/constants";
import { conversionWebhookSchema } from "@faroway/validation";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";

const WEBHOOK_SECRET_ENV_KEYS: Partial<Record<AffiliatePartnerId, string>> = {
  viator: "VIATOR_WEBHOOK_SECRET",
  getyourguide: "GYG_WEBHOOK_SECRET",
  klook: "KLOOK_WEBHOOK_SECRET",
  travelpayouts: "TRAVELPAYOUTS_WEBHOOK_SECRET",
  stay22: "STAY22_WEBHOOK_SECRET",
  duffel: "DUFFEL_WEBHOOK_SECRET",
  safetywing: "SAFETYWING_WEBHOOK_SECRET",
  airalo: "AIRALO_WEBHOOK_SECRET",
};

function getWebhookSecret(partner: AffiliatePartnerId): string | undefined {
  const envKey = WEBHOOK_SECRET_ENV_KEYS[partner];
  if (!envKey) return undefined;
  const value = process.env[envKey]?.trim();
  return value || undefined;
}

/**
 * Verify webhook signature from affiliate partner
 */
function verifyWebhookSignature(
  partner: AffiliatePartnerId,
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

  if (!signature) {
    return false;
  }

  const normalizedSig = signature.startsWith("sha256=")
    ? signature.slice(7)
    : signature;

  if (!/^[a-f0-9]{64}$/i.test(normalizedSig)) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(normalizedSig, "hex"),
    Buffer.from(expectedSignature, "hex"),
  );
}

function normalizeWebhookInput(raw: Record<string, unknown>): {
  schemaInput: Record<string, unknown>;
  legacyOrderId?: string;
  legacyBookingReference?: string;
} {
  const isLegacySnakeCase =
    raw.click_id !== undefined && raw.clickId === undefined;
  const legacyOrderId =
    typeof raw.order_id === "string" && raw.order_id.trim()
      ? raw.order_id.trim()
      : undefined;
  const legacyBookingReference =
    typeof raw.booking_reference === "string" && raw.booking_reference.trim()
      ? raw.booking_reference.trim()
      : undefined;

  const rawStatus = raw.status === "cancelled" ? "canceled" : raw.status;

  if (!isLegacySnakeCase) {
    return {
      schemaInput: {
        ...raw,
        ...(rawStatus !== undefined ? { status: rawStatus } : {}),
      },
      legacyOrderId,
      legacyBookingReference,
    };
  }

  const clickId = typeof raw.click_id === "string" ? raw.click_id : undefined;
  const externalTransactionId =
    raw.externalTransactionId ??
    legacyOrderId ??
    legacyBookingReference ??
    (clickId && clickId.trim() ? clickId.trim() : undefined);

  return {
    schemaInput: {
      partner: raw.partner,
      clickId,
      externalTransactionId,
      ...(rawStatus !== undefined ? { status: rawStatus } : {}),
      ...(raw.bookingAmount !== undefined || raw.booking_value !== undefined
        ? { bookingAmount: raw.bookingAmount ?? raw.booking_value }
        : {}),
      ...(raw.commissionAmount !== undefined ||
      raw.commission_value !== undefined
        ? { commissionAmount: raw.commissionAmount ?? raw.commission_value }
        : {}),
      ...(raw.currency !== undefined ? { currency: raw.currency } : {}),
      ...(raw.occurredAt !== undefined || raw.conversion_date !== undefined
        ? { occurredAt: raw.occurredAt ?? raw.conversion_date }
        : {}),
      ...(raw.metadata !== undefined ? { metadata: raw.metadata } : {}),
    },
    legacyOrderId,
    legacyBookingReference,
  };
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (
      !parsedJson ||
      typeof parsedJson !== "object" ||
      Array.isArray(parsedJson)
    ) {
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 },
      );
    }

    const { schemaInput, legacyOrderId, legacyBookingReference } =
      normalizeWebhookInput(parsedJson as Record<string, unknown>);

    const parseResult = conversionWebhookSchema.safeParse(schemaInput);

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
    const signature = request.headers.get("x-webhook-signature");

    // Verify webhook authenticity
    if (!verifyWebhookSignature(data.partner, rawBody, signature)) {
      console.error(
        "[Conversion Webhook] Invalid signature for partner:",
        data.partner,
      );
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 },
      );
    }

    // Find the original click (use .single() for mock compatibility)
    const { data: click, error: findError } = await getSupabase()
      .from("affiliate_clicks")
      .select("*")
      .eq("id", data.clickId)
      .single();

    if (findError || !click) {
      console.error("[Conversion Webhook] Click not found:", data.clickId);
      // Still record the conversion, but log the issue
    }

    const dbStatus =
      data.status === "canceled" || data.status === "refunded"
        ? "cancelled"
        : data.status;
    const currency = data.currency ?? "USD";
    const bookingValue = data.bookingAmount ?? 0;
    const commissionValue = data.commissionAmount ?? 0;

    // Record the conversion idempotently. Partner webhooks are retried and may
    // advance a booking from pending to confirmed or cancelled.
    const { error: insertError } = await getSupabase()
      .from("affiliate_conversions")
      .upsert(
        {
          click_id: click?.id || null,
          partner: data.partner,
          order_id: legacyOrderId ?? data.externalTransactionId,
          booking_reference: legacyBookingReference ?? null,
          booking_value: bookingValue,
          commission_value: commissionValue,
          currency,
          status: dbStatus,
          user_id: click?.user_id || null,
          conversion_date: data.occurredAt ?? new Date().toISOString(),
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
      const { error: updateError } = await getSupabase()
        .from("affiliate_clicks")
        .update({
          converted: dbStatus === "confirmed",
          conversion_value: dbStatus === "confirmed" ? commissionValue : null,
        })
        .eq("id", data.clickId);

      if (updateError) {
        console.error(
          "[Conversion Webhook] Failed to reconcile click:",
          updateError,
        );
      }
    }

    console.log(
      `[Conversion Webhook] Recorded: ${data.clickId} - $${commissionValue} from ${data.partner}`,
    );

    return NextResponse.json({ success: true, clickId: data.clickId });
  } catch (error) {
    console.error("[Conversion Webhook] Error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
