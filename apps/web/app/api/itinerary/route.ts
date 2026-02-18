/**
 * Itinerary API Route (Non-streaming)
 * For cases where full response is preferred over streaming
 * 
 * POST /api/itinerary
 * - Returns complete itinerary as JSON
 * - Better for saving to database after generation
 */

import { NextRequest, NextResponse } from 'next/server';
import { generateItinerary } from '@/lib/ai/client';
import { TripPreferences } from '@/lib/ai/types';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, getClientIp } from '@/lib/security/rate-limit';

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 generations per minute per IP
    const ip = getClientIp(request);
    const { allowed, remaining } = checkRateLimit(`itinerary:${ip}`, { maxRequests: 10, windowMs: 60_000 });
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': '60', 'X-RateLimit-Remaining': String(remaining) } }
      );
    }

    const body = await request.json();
    const preferences: TripPreferences = {
      destination: body.destination,
      startDate: body.startDate,
      endDate: body.endDate,
      travelers: body.travelers || 1,
      vibes: body.vibes || ['adventure'],
      budget: body.budget || 'moderate',
      interests: body.interests || [],
      dietaryRestrictions: body.dietaryRestrictions || [],
    };

    if (!preferences.destination || !preferences.startDate || !preferences.endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: destination, startDate, endDate' },
        { status: 400 }
      );
    }

    // Get user ID if authenticated
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Generate itinerary
    const itinerary = await generateItinerary(preferences, {
      userId: user?.id,
    });

    // Optionally save to database if user is authenticated
    if (user && body.save !== false) {
      const { error: saveError } = await supabase
        .from('trips')
        .insert({
          user_id: user.id,
          destination: preferences.destination,
          start_date: preferences.startDate,
          end_date: preferences.endDate,
          preferences: preferences,
          itinerary: itinerary,
          status: 'draft',
        });

      if (saveError) {
        console.error('[Save Error]', saveError);
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json(itinerary);
  } catch (error) {
    console.error('[Itinerary Error]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
