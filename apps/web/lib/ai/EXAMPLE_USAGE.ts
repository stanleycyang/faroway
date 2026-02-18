/**
 * Example Usage of TripGenie AI Module
 * Copy these patterns into your API routes
 */

import { generateItinerary, generateActivities, generateRestaurants } from './index';
import type { TripPreferences } from './types';

// ============================================
// Example 1: Generate Complete Itinerary
// ============================================

async function exampleGenerateItinerary() {
  const preferences: TripPreferences = {
    destination: 'Barcelona, Spain',
    startDate: '2026-06-15',
    endDate: '2026-06-20',
    budget: 'moderate',
    vibes: ['cultural', 'foodie', 'photography', 'nightlife'],
    travelers: {
      adults: 2,
      children: 0,
    },
    interests: ['architecture', 'tapas', 'beaches', 'art'],
    dietaryRestrictions: ['pescatarian'],
  };

  try {
    console.log('🚀 Starting itinerary generation...');
    
    const itinerary = await generateItinerary(preferences, {
      userId: 'user_123',
      onProgress: (progress) => {
        console.log(`📍 ${progress.message}`);
        if (progress.currentDay) {
          console.log(`   Day ${progress.currentDay}/${progress.totalDays} complete`);
        }
      },
    });

    console.log('✅ Itinerary generated!');
    console.log(`   ${itinerary.days.length} days planned`);
    console.log(`   Total cost: ${itinerary.totalEstimatedCost.amount} ${itinerary.totalEstimatedCost.currency}`);
    
    // Access individual days
    itinerary.days.forEach((day) => {
      console.log(`\n📅 Day ${day.dayNumber}: ${day.title}`);
      console.log(`   Morning: ${day.morning.activities.length} activities`);
      console.log(`   Afternoon: ${day.afternoon.activities.length} activities`);
      console.log(`   Evening: ${day.evening.activities.length} activities`);
    });

    return itinerary;
  } catch (error) {
    console.error('❌ Generation failed:', error);
    throw error;
  }
}

// ============================================
// Example 2: Generate Activities Only
// ============================================

async function exampleGenerateActivities() {
  try {
    const activities = await generateActivities(
      'Kyoto, Japan',
      ['cultural', 'photography', 'relaxed'],
      'morning',
      'moderate'
    );

    console.log(`✅ Generated ${activities.length} activities`);
    
    activities.forEach((activity) => {
      console.log(`\n🎯 ${activity.name}`);
      console.log(`   ${activity.description}`);
      console.log(`   Duration: ${activity.duration} minutes`);
      console.log(`   Cost: ${activity.estimatedCost.amount} ${activity.estimatedCost.currency}`);
      console.log(`   Vibe match: ${activity.vibeMatch.reasoning}`);
    });

    return activities;
  } catch (error) {
    console.error('❌ Activity generation failed:', error);
    throw error;
  }
}

// ============================================
// Example 3: Generate Restaurants
// ============================================

async function exampleGenerateRestaurants() {
  try {
    const restaurants = await generateRestaurants(
      'Paris, France',
      ['foodie', 'romantic', 'luxury'],
      'dinner',
      'luxury',
      ['gluten-free']
    );

    console.log(`✅ Generated ${restaurants.length} restaurant recommendations`);
    
    restaurants.forEach((restaurant) => {
      console.log(`\n🍽️  ${restaurant.name}`);
      console.log(`   Cuisine: ${restaurant.cuisineType.join(', ')}`);
      console.log(`   Price: ${'$'.repeat(restaurant.priceLevel)}`);
      console.log(`   ${restaurant.description}`);
      console.log(`   ~${restaurant.estimatedCost.amount} ${restaurant.estimatedCost.currency} per person`);
      console.log(`   Dietary: ${restaurant.dietaryOptions.join(', ')}`);
    });

    return restaurants;
  } catch (error) {
    console.error('❌ Restaurant generation failed:', error);
    throw error;
  }
}

// ============================================
// Example 4: API Route Pattern (Next.js)
// ============================================

/*
// File: app/api/itinerary/generate/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { generateItinerary } from '@/lib/ai';
import type { TripPreferences } from '@/lib/ai';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const preferences: TripPreferences = body.preferences;
    
    // Get user from auth session
    // const session = await getSession(req);
    // const userId = session.user.id;
    
    const itinerary = await generateItinerary(preferences, {
      userId: 'user_from_session',
    });
    
    // Optionally save to database
    // await supabase.from('itineraries').insert({
    //   user_id: userId,
    //   data: itinerary,
    // });
    
    return NextResponse.json({
      success: true,
      itinerary,
    });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate itinerary' 
      },
      { status: 500 }
    );
  }
}
*/

// ============================================
// Example 5: Streaming Response (SSE)
// ============================================

/*
// File: app/api/itinerary/stream/route.ts

import { NextRequest } from 'next/server';
import { generateItinerary } from '@/lib/ai';

export async function POST(req: NextRequest) {
  const { preferences } = await req.json();
  
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await generateItinerary(preferences, {
          onProgress: (progress) => {
            // Send progress update as SSE
            const data = `data: ${JSON.stringify(progress)}\n\n`;
            controller.enqueue(encoder.encode(data));
          },
        });
        
        // Send completion signal
        controller.enqueue(encoder.encode('data: {"status": "done"}\n\n'));
        controller.close();
      } catch (error) {
        const errorData = `data: ${JSON.stringify({ status: 'error', message: error.message })}\n\n`;
        controller.enqueue(encoder.encode(errorData));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
*/

// ============================================
// Example 6: Client-Side Usage (React)
// ============================================

/*
// Client component example

'use client';

import { useState } from 'react';
import type { GeneratedItinerary, TripPreferences } from '@/lib/ai';

export function ItineraryGenerator() {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [itinerary, setItinerary] = useState<GeneratedItinerary | null>(null);

  async function generateTrip(preferences: TripPreferences) {
    setLoading(true);
    setProgress('Starting generation...');
    
    try {
      const response = await fetch('/api/itinerary/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setItinerary(data.itinerary);
        setProgress('Complete!');
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Failed to generate:', error);
      setProgress('Error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {loading && <p>{progress}</p>}
      {itinerary && (
        <div>
          <h2>{itinerary.destination}</h2>
          {itinerary.days.map(day => (
            <div key={day.dayNumber}>
              <h3>Day {day.dayNumber}: {day.title}</h3>
              {day.morning.activities.map(activity => (
                <div key={activity.id}>{activity.name}</div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
*/

// Export examples for testing
export {
  exampleGenerateItinerary,
  exampleGenerateActivities,
  exampleGenerateRestaurants,
};
