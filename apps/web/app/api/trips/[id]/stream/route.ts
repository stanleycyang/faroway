/**
 * GET /api/trips/[id]/stream
 *
 * SSE endpoint for real-time trip generation progress and progressive data streaming.
 *
 * Polls the searches table for agent progress and intermediate_results,
 * emitting typed data events as each agent completes.
 *
 * SSE event protocol:
 *   event: progress   — { step, status, progress, message, searchProgress }
 *   event: hotels     — { topHotel, count }
 *   event: activities — { count }
 *   event: dining     — { count }
 *   event: itinerary  — { days, topHotel }
 *   event: complete   — { tripId }
 *   event: error      — { message }
 */

import { NextRequest } from 'next/server';
import { createClient, getSupabase } from '@/lib/supabase/server';

type Params = {
  params: Promise<{
    id: string;
  }>;
};

async function resolveUser(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: Params
) {
  const { id: tripId } = await params;
  const userId = await resolveUser();
  const adminClient = getSupabase();

  // Verify trip access
  let tripQuery = adminClient
    .from('trips')
    .select('id, status, search_id')
    .eq('id', tripId);

  if (userId) {
    tripQuery = tripQuery.eq('user_id', userId);
  } else {
    tripQuery = tripQuery.is('user_id', null);
  }

  const { data: trip, error: tripError } = await tripQuery.single();

  if (tripError || !trip) {
    return new Response(
      JSON.stringify({ error: 'Trip not found or access denied' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // If the trip is already generated, send complete immediately
        if (trip.status === 'generated') {
          send('progress', { step: 'complete', status: 'done', progress: 100, message: 'Your itinerary is ready!' });
          send('complete', { tripId });
          controller.close();
          return;
        }

        // If no search_id, wait for it
        if (!trip.search_id && trip.status !== 'generating') {
          send('progress', { step: 'waiting', status: 'pending', progress: 0, message: 'Waiting for generation to start...' });
          controller.close();
          return;
        }

        const searchId = trip.search_id;
        if (!searchId) {
          send('error', { message: 'No search linked to this trip' });
          controller.close();
          return;
        }

        // Track what data events we've already sent
        let sentHotels = false;
        let sentActivities = false;
        let sentDining = false;
        let sentItinerary = false;

        let lastProgressJson = '';
        let isComplete = false;
        const MAX_POLLS = 180; // 3 minutes at 1s intervals
        let pollCount = 0;

        while (!isComplete && pollCount < MAX_POLLS) {
          // Check if client disconnected
          if (request.signal.aborted) {
            controller.close();
            return;
          }

          const { data: search } = await adminClient
            .from('searches')
            .select('status, progress, error_message, intermediate_results, completed_at')
            .eq('id', searchId)
            .single();

          if (!search) {
            send('error', { message: 'Search record not found' });
            break;
          }

          if (search.status === 'error') {
            send('error', { message: search.error_message || 'Generation failed' });
            break;
          }

          // Emit progress if changed
          const searchProgress = (search.progress || {}) as Record<string, string>;
          const progressJson = JSON.stringify(searchProgress);
          if (progressJson !== lastProgressJson) {
            lastProgressJson = progressJson;

            const { percent, step, message } = calculateProgress(searchProgress);
            send('progress', {
              step,
              status: searchProgress[step] || 'pending',
              progress: percent,
              message,
              searchProgress,
            });
          }

          // Stream intermediate results as they appear
          const ir = (search.intermediate_results || {}) as Record<string, unknown>;

          if (!sentHotels && ir.hotels) {
            const hotels = ir.hotels as unknown[];
            const topHotel = ir.topHotel || hotels[0] || null;
            send('hotels', { topHotel, count: hotels.length });
            sentHotels = true;
          }

          if (!sentActivities && ir.activitiesCount != null) {
            send('activities', { count: ir.activitiesCount });
            sentActivities = true;
          }

          if (!sentDining && ir.diningCount != null) {
            send('dining', { count: ir.diningCount });
            sentDining = true;
          }

          if (!sentItinerary && ir.days) {
            const topHotel = ir.topHotel || null;
            send('itinerary', { days: ir.days, topHotel });
            sentItinerary = true;
          }

          if (search.status === 'completed') {
            isComplete = true;
            send('progress', { step: 'complete', status: 'done', progress: 100, message: 'Your itinerary is ready!' });
            send('complete', { tripId });
            break;
          }

          // Wait 1 second before next poll
          await new Promise(resolve => setTimeout(resolve, 1000));
          pollCount++;
        }

        if (!isComplete && pollCount >= MAX_POLLS) {
          send('error', { message: 'Generation timed out' });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Stream error';
        try {
          send('error', { message });
        } catch {
          // Controller may already be closed
        }
      }

      try {
        controller.close();
      } catch {
        // Already closed
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

/**
 * Calculate overall progress from per-agent search progress.
 */
function calculateProgress(searchProgress: Record<string, string>): {
  percent: number;
  step: string;
  message: string;
} {
  const stages = ['orchestrator', 'hotels', 'activities', 'dining', 'aggregator'];
  let percent = 0;
  let currentStep = 'queued';
  let message = 'Starting trip planning...';

  for (const stage of stages) {
    if (searchProgress[stage] === 'done') {
      percent += 20;
    } else if (searchProgress[stage] === 'searching') {
      percent += 10;
    }
  }

  // Determine active step (last one that's searching or done)
  for (let i = stages.length - 1; i >= 0; i--) {
    if (searchProgress[stages[i]] === 'searching') {
      currentStep = stages[i];
      message = stepMessages[stages[i]] || 'Processing...';
      break;
    }
    if (searchProgress[stages[i]] === 'done' && i > 0) {
      // If this stage is done, the next one is likely starting
      currentStep = stages[i];
      message = `${stepMessages[stages[i]]?.replace('...', '')} complete`;
      break;
    }
  }

  return { percent: Math.min(100, percent), step: currentStep, message };
}

const stepMessages: Record<string, string> = {
  orchestrator: 'Understanding your preferences...',
  hotels: 'Searching for the best hotels...',
  activities: 'Finding activities & attractions...',
  dining: 'Discovering restaurants...',
  aggregator: 'Crafting your perfect itinerary...',
};
