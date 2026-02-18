/**
 * Itinerary Generation API Route
 * Uses AI SDK + Vercel AI Gateway for streaming generation
 * 
 * POST /api/itinerary/generate
 * - Returns streaming response for real-time progress
 * - Uses Server-Sent Events (SSE) format
 */

import { NextRequest } from 'next/server';
import { streamItinerary } from '@/lib/ai/client';
import { TripPreferences } from '@/lib/ai/types';

export const runtime = 'edge'; // Use edge runtime for better streaming
export const maxDuration = 60; // Allow up to 60 seconds for generation

export async function POST(request: NextRequest) {
  try {
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

    // Validate required fields
    if (!preferences.destination || !preferences.startDate || !preferences.endDate) {
      return Response.json(
        { error: 'Missing required fields: destination, startDate, endDate' },
        { status: 400 }
      );
    }

    // Stream the response using AI SDK
    const result = await streamItinerary(preferences, {
      model: body.model, // Optional model override
    });

    // Return as streaming response
    return result.toTextStreamResponse();
  } catch (error) {
    console.error('[Itinerary Generation Error]', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
