/**
 * GET /api/search/[searchId]
 * Get search status and results
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/supabase/server';
import { SearchStatusResponse, SearchResults, HotelResult, ActivityResult, DiningResult, SuggestedDay } from '@/lib/search/types';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';
import { z } from 'zod';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ searchId: string }> }
) {
  const { searchId } = await params;

  try {
    // Get search record with results and itinerary in a single joined query
    const { data: search, error: searchError } = await getSupabase()
      .from('searches')
      .select('id, status, progress, created_at, completed_at, error_message, json_render_spec, search_results(id, category, data, vibe_score), search_itineraries(day_number, date, title, summary, morning_activities, afternoon_activities, evening_activities, meals, estimated_cost, cost_currency, tips, hotel_id)')
      .eq('id', searchId)
      .single();

    if (searchError || !search) {
      return NextResponse.json(
        { error: 'Search not found' },
        { status: 404 }
      );
    }

    // Base response
    const response: SearchStatusResponse = {
      searchId: search.id,
      status: search.status,
      progress: search.progress,
      createdAt: search.created_at,
      completedAt: search.completed_at || undefined,
    };

    // If completed, include results
    if (search.status === 'completed') {
      const resultsData = ((search as any).search_results || [])
        .sort((a: any, b: any) => (b.vibe_score ?? 0) - (a.vibe_score ?? 0));
      const itineraryData = ((search as any).search_itineraries || [])
        .sort((a: any, b: any) => a.day_number - b.day_number);

      if (resultsData) {
        // Parse results by category
        const hotels: HotelResult[] = resultsData
          .filter((r: any) => r.category === 'hotel')
          .map((r: any) => ({
            ...r.data,
            id: r.id,
          }));

        const activities: ActivityResult[] = resultsData
          .filter((r: any) => r.category === 'activity')
          .map((r: any) => ({
            ...r.data,
            id: r.id,
          }));

        const dining: DiningResult[] = resultsData
          .filter((r: any) => r.category === 'dining')
          .map((r: any) => ({
            ...r.data,
            id: r.id,
          }));

        // Build itinerary from stored data
        const itinerary: SuggestedDay[] = (itineraryData || []).map((day: any) => ({
          dayNumber: day.day_number,
          date: day.date,
          title: day.title,
          summary: day.summary,
          hotel: hotels[0], // Top hotel for all days
          morning: {
            activities: activities.filter(a => 
              (day.morning_activities || []).includes(a.id)
            ),
            meal: dining.find(d => 
              (day.meals || []).includes(d.id) && d.mealTypes?.includes('breakfast')
            ),
          },
          afternoon: {
            activities: activities.filter(a => 
              (day.afternoon_activities || []).includes(a.id)
            ),
            meal: dining.find(d => 
              (day.meals || []).includes(d.id) && d.mealTypes?.includes('lunch')
            ),
          },
          evening: {
            activities: activities.filter(a => 
              (day.evening_activities || []).includes(a.id)
            ),
            meal: dining.find(d => 
              (day.meals || []).includes(d.id) && d.mealTypes?.includes('dinner')
            ),
          },
          estimatedCost: day.estimated_cost,
          currency: day.cost_currency,
          tips: day.tips || [],
        }));

        response.results = {
          searchId,
          hotels,
          activities,
          dining,
          itinerary,
        };
      }

      // Include the json-render spec if available
      if (search.json_render_spec) {
        response.jsonRenderSpec = search.json_render_spec;
      }
    }

    // If error, include error message
    if (search.status === 'error') {
      response.error = search.error_message || 'An error occurred';
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[Search Status] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/search/[searchId]
 * Update search status (service role only)
 */

const PatchSearchSchema = z.object({
  status: z.enum(['pending', 'searching', 'completed', 'error']).optional(),
  progress: z.object({
    step: z.string().optional(),
    percent: z.number().min(0).max(100).optional(),
    message: z.string().max(500).optional(),
  }).optional(),
  errorMessage: z.string().max(1000).optional(),
});

async function verifyServiceRole(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;

  const token = authHeader.substring(7);
  const jwtSecret = process.env.SUPABASE_JWT_SECRET;
  if (!jwtSecret) {
    console.error('[Search Update] SUPABASE_JWT_SECRET not configured');
    return false;
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    // Verify HMAC-SHA256 signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(jwtSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const data = encoder.encode(`${parts[0]}.${parts[1]}`);
    const signature = Uint8Array.from(
      atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0)
    );
    const valid = await crypto.subtle.verify('HMAC', key, signature, data);
    if (!valid) return false;

    // Decode payload and check role
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.role === 'service_role';
  } catch {
    return false;
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ searchId: string }> }
) {
  // Require service_role authentication
  if (!(await verifyServiceRole(request))) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { searchId } = await params;

  // Rate limit: 30 req/min per searchId
  const rl = checkRateLimit(`search-patch:${searchId}`, { maxRequests: 30, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const parseResult = PatchSearchSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    const { status, progress, errorMessage } = parseResult.data;

    const updates: Record<string, unknown> = {};

    if (status) {
      updates.status = status;
      if (status === 'completed') {
        updates.completed_at = new Date().toISOString();
      }
    }

    if (progress) {
      // Merge with existing progress
      const { data: current } = await getSupabase()
        .from('searches')
        .select('progress')
        .eq('id', searchId)
        .single();

      updates.progress = { ...current?.progress, ...progress };
    }

    if (errorMessage) {
      updates.error_message = errorMessage;
    }

    const { error } = await getSupabase()
      .from('searches')
      .update(updates)
      .eq('id', searchId);

    if (error) {
      console.error('[Search Update] Database error:', error);
      return NextResponse.json({ error: 'Failed to update search' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Search Update] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
