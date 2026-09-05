/**
 * Affiliate Conversion Webhook
 * POST /api/track/conversion - Webhook for affiliate partners to report conversions
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { z } from "zod";
import crypto from "crypto";
import { normalizeAffiliatePartner } from "@faroway/constants";

// Webhook secrets for each affiliate partner
const WEBHOOK_SECRETS: Record<string, string | undefined> = {
  viator: process.env.VIATOR_WEBHOOK_SECRET,
  booking: process.env.BOOKING_WEBHOOK_SECRET,
  getyourguide: process.env.GYG_WEBHOOK_SECRET,
  klook: process.env.KLOOK_WEBHOOK_SECRET,
};

const ConversionSchema = z.object({
  // Required fields
  click_id: z.string().min(1).max(200),
  partner: z.enum(["viator", "booking", "getyourguide", "klook"]),

  // Conversion details
  order_id: z.string().min(1).max(200).optional(),
  booking_reference: z.string().min(1).max(200).optional(),

  // Financial
  booking_value: z.number().finite().nonnegative().max(99_999_999.99),
  commission_value: z.number().finite().nonnegative().max(99_999_999.99),
  currency: z
    .string()
    .regex(/^[A-Z]{3}$/)
    .default("USD"),

  // Status
  status: z.enum(["confirmed", "pending", "cancelled"]).default("confirmed"),

  // Timing
  conversion_date: z.string().datetime({ offset: true }).optional(),
});

/**
 * Verify webhook signature from affiliate partner
 */
function verifyWebhookSignature(
  partner: string,
  payload: string,
  signature: string | null,
): boolean {
  const secret = WEBHOOK_SECRETS[partner];

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

  // Calculate expected signature
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  // Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expectedSignature, "hex"),
  );
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

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

    const db = getSupabase();

    // Find the original click
    const { data: click, error: findError } = await db
      .from("affiliate_clicks")
      .select("*")
      .eq("id", data.click_id)
      .single();

    if (findError || !click) {
      console.error("[Conversion Webhook] Click not found:", data.click_id);
      // An external booking reference is required when Faroway cannot resolve
      // the click. Without one, conversion_key would be NULL and webhook
      // retries could create duplicate revenue rows.
      if (!data.order_id && !data.booking_reference) {
        return NextResponse.json(
          { error: "Missing conversion reference" },
          { status: 400 },
        );
      }
    } else if (
      normalizeAffiliatePartner(click.affiliate_partner) !== data.partner
    ) {
      console.error(
        "[Conversion Webhook] Partner does not match click:",
        data.click_id,
      );
      return NextResponse.json(
        { error: "Click partner mismatch" },
        { status: 400 },
      );
    }

    // Record the conversion idempotently. Partner webhooks are retried and may
    // advance a booking from pending to confirmed or cancelled.
    const { error: insertError } = await db
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
      const { error: updateError } = await db
        .from("affiliate_clicks")
        .update({
          converted: data.status === "confirmed",
          conversion_value:
            data.status === "confirmed" ? data.commission_value : null,
        })
        .eq("id", data.click_id);

      if (updateError) {
        console.error(
          "[Conversion Webhook] Failed to update click:",
          updateError,
        );
        return NextResponse.json(
          { error: "Failed to finalize conversion" },
          { status: 500 },
        );
      }
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
