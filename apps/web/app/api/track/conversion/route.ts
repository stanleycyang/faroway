/**
 * Affiliate Conversion Webhook
 * POST /api/track/conversion - Webhook for affiliate partners to report conversions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';
import { z } from 'zod';
import crypto from 'crypto';


// Webhook secrets for each affiliate partner
const WEBHOOK_SECRETS: Record<string, string | undefined> = {
  viator: process.env.VIATOR_WEBHOOK_SECRET,
  booking: process.env.BOOKING_WEBHOOK_SECRET,
  getyourguide: process.env.GYG_WEBHOOK_SECRET,
  klook: process.env.KLOOK_WEBHOOK_SECRET,
};

const ConversionSchema = z.object({
  // Required fields
  click_id: z.string(),
  partner: z.string(),
  
  // Conversion details
  order_id: z.string().optional(),
  booking_reference: z.string().optional(),
  
  // Financial
  booking_value: z.number(),
  commission_value: z.number(),
  currency: z.string().default('USD'),
  
  // Status
  status: z.enum(['confirmed', 'pending', 'cancelled']).default('confirmed'),
  
  // Timing
  conversion_date: z.string().optional(),
});

/**
 * Verify webhook signature from affiliate partner
 */
function verifyWebhookSignature(
  partner: string,
  payload: string,
  signature: string | null
): boolean {
  const secret = WEBHOOK_SECRETS[partner];
  
  // If no secret configured, allow in development
  if (!secret) {
    console.warn(`[Conversion Webhook] No secret configured for partner: ${partner}`);
    return process.env.NODE_ENV === 'development';
  }

  if (!signature) {
    return false;
  }

  // Calculate expected signature
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  // Constant-time comparison
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);
    
    const parseResult = ConversionSchema.safeParse(body);

    if (!parseResult.success) {
      console.error('[Conversion Webhook] Validation error:', parseResult.error);
      return NextResponse.json(
        { error: 'Invalid webhook payload' },
        { status: 400 }
      );
    }

    const data = parseResult.data;
    const signature = request.headers.get('x-webhook-signature');

    // Verify webhook authenticity
    if (!verifyWebhookSignature(data.partner, rawBody, signature)) {
      console.error('[Conversion Webhook] Invalid signature for partner:', data.partner);
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    // Find the original click
    const { data: click, error: findError } = await getSupabase()
      .from('affiliate_clicks')
      .select('*')
      .eq('id', data.click_id)
      .single();

    if (findError || !click) {
      console.error('[Conversion Webhook] Click not found:', data.click_id);
      // Still record the conversion, but log the issue
    }

    // Record the conversion
    const { error: insertError } = await getSupabase().from('affiliate_conversions').insert({
      click_id: data.click_id,
      partner: data.partner,
      order_id: data.order_id,
      booking_reference: data.booking_reference,
      booking_value: data.booking_value,
      commission_value: data.commission_value,
      currency: data.currency,
      status: data.status,
      user_id: click?.user_id || null,
      conversion_date: data.conversion_date || new Date().toISOString(),
    });

    if (insertError) {
      console.error('[Conversion Webhook] Database error:', insertError);
      return NextResponse.json(
        { error: 'Failed to record conversion' },
        { status: 500 }
      );
    }

    // Update the original click as converted
    if (click) {
      await getSupabase()
        .from('affiliate_clicks')
        .update({
          converted: true,
          conversion_value: data.commission_value,
        })
        .eq('id', data.click_id);
    }

    console.log(`[Conversion Webhook] Recorded: ${data.click_id} - $${data.commission_value} from ${data.partner}`);

    return NextResponse.json({ success: true, clickId: data.click_id });
  } catch (error) {
    console.error('[Conversion Webhook] Error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
