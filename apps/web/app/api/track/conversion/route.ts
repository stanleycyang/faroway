/**
 * Affiliate Conversion Webhook
 * POST /api/track/conversion - Webhook for affiliate partners to report conversions
 */

import crypto from "node:crypto";
import type { AffiliatePartnerId } from "@faroway/constants";
import { conversionWebhookSchema } from "@faroway/validation";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { checkRateLimitAsync, getClientIp } from "@/lib/security/rate-limit";

const MAX_WEBHOOK_BODY_BYTES = 16_384;

const STATUS_RANK: Record<"pending" | "confirmed" | "cancelled", number> = {
  pending: 0,
  confirmed: 1,
  cancelled: 2,
};

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

function normalizeSignature(signature: string | null): string | null {
  if (!signature) {
    return null;
  }
  const normalizedSig = signature.startsWith("sha256=")
    ? signature.slice(7)
    : signature;
  if (!/^[a-f0-9]{64}$/i.test(normalizedSig)) {
    return null;
  }
  return normalizedSig;
}

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

  const normalizedSig = normalizeSignature(signature);
  if (!normalizedSig) {
    return false;
  }

  return verifySignatureWithSecret(secret, payload, normalizedSig);
}

function verifyAnyConfiguredPartnerSignature(
  payload: string,
  signature: string | null,
): boolean {
  const normalizedSig = normalizeSignature(signature);
  if (!normalizedSig) {
    return false;
  }
  let matched = false;
  for (const partner of Object.keys(
    WEBHOOK_SECRET_ENV_KEYS,
  ) as AffiliatePartnerId[]) {
    const secret = getWebhookSecret(partner);
    if (!secret) continue;
    if (verifySignatureWithSecret(secret, payload, normalizedSig)) {
      matched = true;
    }
  }
  return matched;
}

function normalizeWebhookInput(raw: Record<string, unknown>): {
  schemaInput: Record<string, unknown>;
  legacyOrderId?: string;
  legacyBookingReference?: string;
} {
  const legacyOrderId =
    typeof raw.order_id === "string" && raw.order_id.trim()
      ? raw.order_id.trim()
      : undefined;
  const legacyBookingReference =
    typeof raw.booking_reference === "string" && raw.booking_reference.trim()
      ? raw.booking_reference.trim()
      : undefined;

  const rawClickId = raw.clickId ?? raw.click_id;
  const normalizedClickId =
    typeof rawClickId === "string" ? rawClickId.trim() : rawClickId;

  const rawExternalTxId =
    typeof raw.externalTransactionId === "string"
      ? raw.externalTransactionId.trim()
      : raw.externalTransactionId;
  const externalTransactionId =
    rawExternalTxId !== undefined && rawExternalTxId !== ""
      ? rawExternalTxId
      : (legacyOrderId ??
        legacyBookingReference ??
        (raw.click_id !== undefined &&
        typeof normalizedClickId === "string" &&
        normalizedClickId
          ? normalizedClickId
          : undefined));

  const rawStatus = raw.status === "cancelled" ? "canceled" : raw.status;
  const bookingAmount = raw.bookingAmount ?? raw.booking_value;
  const commissionAmount = raw.commissionAmount ?? raw.commission_value;
  const occurredAt = raw.occurredAt ?? raw.conversion_date;

  return {
    schemaInput: {
      ...raw,
      ...(normalizedClickId !== undefined
        ? { clickId: normalizedClickId }
        : {}),
      ...(externalTransactionId !== undefined ? { externalTransactionId } : {}),
      ...(rawStatus !== undefined ? { status: rawStatus } : {}),
      ...(bookingAmount !== undefined ? { bookingAmount } : {}),
      ...(commissionAmount !== undefined ? { commissionAmount } : {}),
      ...(occurredAt !== undefined ? { occurredAt } : {}),
    },
    legacyOrderId,
    legacyBookingReference,
  };
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

    const normalizedSig = normalizeSignature(
      request.headers.get("x-webhook-signature"),
    );
    if (!normalizedSig) {
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 },
      );
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      if (!verifyAnyConfiguredPartnerSignature(rawBody, normalizedSig)) {
        return NextResponse.json(
          { error: "Invalid webhook signature" },
          { status: 401 },
        );
      }
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (
      !parsedJson ||
      typeof parsedJson !== "object" ||
      Array.isArray(parsedJson)
    ) {
      if (!verifyAnyConfiguredPartnerSignature(rawBody, normalizedSig)) {
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
    const rawPartner = (parsedJson as Record<string, unknown>).partner;
    const isKnownSecretPartner =
      typeof rawPartner === "string" &&
      Object.hasOwn(WEBHOOK_SECRET_ENV_KEYS, rawPartner);

    const signatureValid = isKnownSecretPartner
      ? verifyWebhookSignature(
          rawPartner as AffiliatePartnerId,
          rawBody,
          normalizedSig,
        )
      : verifyAnyConfiguredPartnerSignature(rawBody, normalizedSig);

    if (!signatureValid) {
      console.error(
        "[Conversion Webhook] Invalid signature for partner:",
        rawPartner,
      );
      return NextResponse.json(
        { error: "Invalid webhook signature" },
        { status: 401 },
      );
    }

    const { schemaInput, legacyOrderId, legacyBookingReference } =
      normalizeWebhookInput(parsedJson as Record<string, unknown>);

    const parseResult = conversionWebhookSchema.safeParse(schemaInput);

    if (
      !parseResult.success ||
      !Object.hasOwn(WEBHOOK_SECRET_ENV_KEYS, parseResult.data.partner)
    ) {
      console.error(
        "[Conversion Webhook] Validation error:",
        parseResult.success ? "Unsupported webhook partner" : parseResult.error,
      );
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 },
      );
    }

    const data = parseResult.data;
    const clickId = data.clickId.trim();
    const externalTransactionId = data.externalTransactionId.trim();
    if (!clickId || !externalTransactionId) {
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 },
      );
    }

    // Find the original click (use .single() for mock compatibility)
    const { data: click, error: findError } = await getSupabase()
      .from("affiliate_clicks")
      .select("*")
      .eq("id", clickId)
      .single();

    if (findError || !click) {
      console.error("[Conversion Webhook] Click not found:", clickId);
      // Still record the conversion, but log the issue
    }

    const dbStatus =
      data.status === "canceled" || data.status === "refunded"
        ? "cancelled"
        : data.status;
    const currency = data.currency ?? "USD";
    const bookingValue = data.bookingAmount ?? 0;
    const commissionValue = data.commissionAmount ?? 0;

    // Monotonic status guard: prevent out-of-order or replayed older webhooks
    // from regressing a confirmed/cancelled conversion to an earlier state.
    const conversionKey =
      legacyOrderId ||
      externalTransactionId ||
      legacyBookingReference ||
      (click?.id ?? null);
    const guardTable = getSupabase().from("affiliate_conversions");
    if (conversionKey && typeof guardTable?.select === "function") {
      const { data: existingRows } = await guardTable
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
          STATUS_RANK[dbStatus]
      ) {
        return NextResponse.json({
          success: true,
          clickId,
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
          order_id: legacyOrderId ?? externalTransactionId,
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

    // Reconcile the original click from all recorded conversions for this click_id
    // so subsequent pending webhooks or partial cancellations never clobber
    // confirmed revenue from another transaction.
    if (click) {
      let nextConverted: boolean | null = null;
      let nextConversionValue: number | null = null;

      const conversionsTable = getSupabase().from("affiliate_conversions");
      let clickConversions: Array<{
        status?: unknown;
        commission_value?: unknown;
      }> | null = null;

      if (typeof conversionsTable?.select === "function") {
        try {
          const { data: rows, error: rowsError } = await conversionsTable
            .select("status, commission_value")
            .eq("click_id", clickId);
          if (!rowsError && Array.isArray(rows) && rows.length > 0) {
            clickConversions = rows;
          }
        } catch {
          clickConversions = null;
        }
      }

      if (clickConversions) {
        const confirmedRows = clickConversions.filter(
          (row) => row.status === "confirmed",
        );
        if (confirmedRows.length > 0) {
          const totalConfirmed = confirmedRows.reduce((sum, row) => {
            const val = Number(row.commission_value);
            return sum + (Number.isFinite(val) && val > 0 ? val : 0);
          }, 0);
          nextConverted = true;
          nextConversionValue = Number(totalConfirmed.toFixed(2));
        } else {
          nextConverted = false;
          nextConversionValue = null;
        }
      } else {
        const alreadyConfirmed = click.converted === true;
        if (dbStatus === "confirmed") {
          nextConverted = true;
          nextConversionValue = commissionValue;
        } else if (dbStatus === "pending") {
          nextConverted = alreadyConfirmed;
          nextConversionValue =
            alreadyConfirmed &&
            typeof click.conversion_value === "number" &&
            Number.isFinite(click.conversion_value)
              ? click.conversion_value
              : null;
        } else if (!alreadyConfirmed) {
          nextConverted = false;
          nextConversionValue = null;
        } else {
          console.warn(
            "[Conversion Webhook] Unable to query click conversions on cancellation; preserving prior confirmed click state:",
            clickId,
          );
        }
      }

      if (nextConverted !== null) {
        const { error: updateError } = await getSupabase()
          .from("affiliate_clicks")
          .update({
            converted: nextConverted,
            conversion_value: nextConversionValue,
          })
          .eq("id", clickId);

        if (updateError) {
          console.error(
            "[Conversion Webhook] Failed to reconcile click:",
            updateError,
          );
        }
      }
    }

    console.log(
      `[Conversion Webhook] Recorded: ${clickId} - $${commissionValue} from ${data.partner}`,
    );

    return NextResponse.json({ success: true, clickId });
  } catch (error) {
    console.error("[Conversion Webhook] Error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    );
  }
}
