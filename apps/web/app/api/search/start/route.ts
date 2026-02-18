/**
 * POST /api/search/start
 * Start a new travel search using Vercel Workflow + AI SDK Agents
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';
import { start } from 'workflow/api';
import { planTripWorkflow } from '@/workflows/plan-trip';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';
import { z } from 'zod';

const SearchInputSchema = z.object({
  destination: z.string().min(1).max(200).trim(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  travelers: z.number().int().min(1).max(50).optional(),
  travelerType: z.string().max(50).optional(),
  vibes: z.array(z.string().max(50)).max(10).optional(),
  budget: z.string().max(50).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 5 searches per minute per IP
    const ip = getClientIp(request);
    const { allowed } = checkRateLimit(`search:${ip}`, { maxRequests: 5, windowMs: 60_000 });
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }

    const body = await request.json();
    const parseResult = SearchInputSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.issues },
        { status: 400 }
      );
    }

    const { destination, startDate, endDate, travelers, travelerType, vibes, budget } = parseResult.data;

    // Get user ID from auth header if present
    const authHeader = request.headers.get('Authorization');
    let userId: string | null = null;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const { data: { user } } = await getSupabase().auth.getUser(token);
      userId = user?.id || null;
    }

    // Create search record
    const { data: search, error: insertError } = await getSupabase()
      .from('searches')
      .insert({
        user_id: userId,
        destination,
        start_date: startDate,
        end_date: endDate,
        travelers: travelers || 2,
        traveler_type: travelerType || null,
        vibes: vibes || [],
        budget: budget || 'moderate',
        status: 'pending',
        progress: {
          orchestrator: 'pending',
          hotels: 'pending',
          activities: 'pending',
          dining: 'pending',
          aggregator: 'pending',
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error('[Search Start] Database error:', insertError);
      return NextResponse.json(
        { error: 'Failed to create search record' },
        { status: 500 }
      );
    }

    const searchId = search.id;

    // Calculate estimated time
    const nights = Math.ceil(
      (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    const estimatedTime = Math.min(60, 20 + nights * 5);

    // Start the durable workflow (doesn't block)
    await start(planTripWorkflow, [{
      searchId,
      destination,
      startDate,
      endDate,
      travelers: travelers || 2,
      vibes: vibes || [],
      budget: budget || 'moderate',
      userId: userId || undefined,
    }]);

    // Update status to searching
    await getSupabase()
      .from('searches')
      .update({ status: 'searching' })
      .eq('id', searchId);

    return NextResponse.json({
      searchId,
      status: 'started',
      estimatedTime,
    });
  } catch (error) {
    console.error('[Search Start] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
