/**
 * POST /api/webhooks/workflow-complete
 * 
 * Webhook handler for workflow completion events.
 * Called by the workflow when itinerary generation completes.
 * Can trigger real-time client notifications via WebSocket, Server-Sent Events, etc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js';
import { z } from 'zod';

// Validate webhook payload
const WebhookPayloadSchema = z.object({
  event: z.enum(['itinerary_generated', 'workflow_failed']),
  tripId: z.string().uuid(),
  itineraryId: z.string().uuid().optional(),
  userId: z.string().uuid(),
  timestamp: z.string(),
  error: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret (required in production)
    const webhookSecret = process.env.WORKFLOW_WEBHOOK_SECRET;
    const authHeader = request.headers.get('x-webhook-secret');
    
    if (!webhookSecret && process.env.NODE_ENV === 'production') {
      console.error('[Webhook] WORKFLOW_WEBHOOK_SECRET not configured in production');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }
    
    if (webhookSecret && authHeader !== webhookSecret) {
      return NextResponse.json(
        { error: 'Invalid webhook secret' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validationResult = WebhookPayloadSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid webhook payload' },
        { status: 400 }
      );
    }

    const payload = validationResult.data;
    console.log(`[Webhook] Received ${payload.event} for trip ${payload.tripId}`);

    const supabase = createSupabaseAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    if (payload.event === 'itinerary_generated') {
      // Mark workflow as completed
      await supabase
        .from('workflow_runs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('trip_id', payload.tripId)
        .eq('status', 'running');

      // Update trip status
      await supabase
        .from('trips')
        .update({
          status: 'generated',
          itinerary_id: payload.itineraryId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.tripId);

      // Create success notification
      await supabase
        .from('notifications')
        .insert({
          user_id: payload.userId,
          type: 'itinerary_ready',
          title: '🎉 Your Itinerary is Ready!',
          message: 'Your AI-generated travel itinerary is complete and ready to view.',
          data: {
            trip_id: payload.tripId,
            itinerary_id: payload.itineraryId,
          },
          read: false,
          created_at: new Date().toISOString(),
        });

      // Trigger Supabase Realtime broadcast for instant client updates
      await supabase
        .from('realtime_events')
        .insert({
          channel: `user:${payload.userId}`,
          event: 'itinerary_ready',
          payload: {
            tripId: payload.tripId,
            itineraryId: payload.itineraryId,
          },
        });

      console.log(`[Webhook] Successfully processed itinerary_generated for trip ${payload.tripId}`);
    } else if (payload.event === 'workflow_failed') {
      // Mark workflow as failed
      await supabase
        .from('workflow_runs')
        .update({
          status: 'failed',
          error_message: payload.error,
          completed_at: new Date().toISOString(),
        })
        .eq('trip_id', payload.tripId)
        .eq('status', 'running');

      // Update trip status
      await supabase
        .from('trips')
        .update({
          status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', payload.tripId);

      // Create failure notification
      await supabase
        .from('notifications')
        .insert({
          user_id: payload.userId,
          type: 'itinerary_failed',
          title: '❌ Itinerary Generation Failed',
          message: payload.error || 'There was an error generating your itinerary. Please try again.',
          data: {
            trip_id: payload.tripId,
            error: payload.error,
          },
          read: false,
          created_at: new Date().toISOString(),
        });

      console.log(`[Webhook] Processed workflow_failed for trip ${payload.tripId}`);
    }

    return NextResponse.json({
      success: true,
      event: payload.event,
      tripId: payload.tripId,
    });
  } catch (error) {
    console.error('[Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
