/**
 * TripGenie Itinerary Generation Workflow
 * 
 * Durable workflow for AI-powered itinerary generation.
 * Handles long-running AI tasks asynchronously with progress tracking.
 * 
 * @see https://useworkflow.dev/docs/foundations
 */

import { FatalError } from "workflow";
import { generateItinerary, TripPreferences, GeneratedItinerary } from "@/lib/ai";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

// Types for workflow input/output
export interface GenerateItineraryInput {
  tripId: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: {
    adults: number;
    children: number;
  };
  budget: 'budget' | 'moderate' | 'luxury';
  preferences: {
    vibes: string[];
    interests?: string[];
    dietaryRestrictions?: string[];
    mobilityNeeds?: string;
  };
  userId: string;
}

export interface WorkflowProgress {
  step: string;
  progress: number;
  message: string;
  updatedAt: string;
}

export interface GenerateItineraryOutput {
  tripId: string;
  itineraryId: string;
  status: 'completed' | 'failed';
  progress: number;
  itinerary?: GeneratedItinerary;
  error?: string;
}

// Admin client for server-side operations (not using cookies)
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new FatalError("Missing Supabase configuration");
  }
  
  return createSupabaseAdmin(supabaseUrl, supabaseServiceKey);
}

/**
 * Main workflow function for generating itineraries
 * This is a durable workflow that can pause, resume, and survive crashes
 */
export async function generateItineraryWorkflow(input: GenerateItineraryInput): Promise<GenerateItineraryOutput> {
  "use workflow";

  console.log(`[Workflow] Starting itinerary generation for trip ${input.tripId}`);
  
  // Step 1: Validate trip and fetch details (5%)
  const tripData = await validateAndFetchTrip(input);
  
  // Step 2: Generate itinerary with AI (5% -> 90%)
  const itinerary = await generateItineraryWithAI(tripData);
  
  // Step 3: Save to database (90% -> 98%)
  const itineraryId = await saveItineraryToDatabase(input.tripId, input.userId, itinerary);
  
  // Step 4: Send completion notification (98% -> 100%)
  await sendCompletionNotification(input.tripId, itineraryId, input.userId);
  
  console.log(`[Workflow] Itinerary generation complete for trip ${input.tripId}`);
  
  return {
    tripId: input.tripId,
    itineraryId,
    status: 'completed',
    progress: 100,
    itinerary,
  };
}

/**
 * Step 1: Validate trip exists and belongs to user
 */
async function validateAndFetchTrip(input: GenerateItineraryInput): Promise<TripPreferences> {
  "use step";
  
  console.log(`[Step 1/4] Validating trip ${input.tripId}...`);
  
  const supabase = getSupabaseAdmin();
  
  // Update progress to 5%
  await supabase
    .from('workflow_progress')
    .upsert({
      trip_id: input.tripId,
      step: 'validate_trip',
      progress: 5,
      message: 'Validating trip details...',
      updated_at: new Date().toISOString(),
    }, { onConflict: 'trip_id' });
  
  // Fetch trip from database to validate ownership
  const { data: trip, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', input.tripId)
    .eq('user_id', input.userId)
    .single();
  
  if (error || !trip) {
    throw new FatalError(`Trip not found or access denied: ${input.tripId}`);
  }
  
  // Build TripPreferences from input + database
  const preferences: TripPreferences = {
    destination: input.destination || trip.destination,
    startDate: input.startDate || trip.start_date,
    endDate: input.endDate || trip.end_date,
    budget: input.budget || trip.budget || 'moderate',
    vibes: input.preferences?.vibes || trip.vibes || ['adventure', 'cultural'],
    travelers: input.travelers || trip.travelers || { adults: 2, children: 0 },
    interests: input.preferences?.interests || trip.interests,
    dietaryRestrictions: input.preferences?.dietaryRestrictions || trip.dietary_restrictions,
    mobilityNeeds: input.preferences?.mobilityNeeds || trip.mobility_needs,
  };
  
  console.log(`[Step 1/4] Trip validated: ${preferences.destination}`);
  return preferences;
}

/**
 * Step 2: Generate itinerary using AI
 * This is the most compute-intensive step
 */
async function generateItineraryWithAI(preferences: TripPreferences): Promise<GeneratedItinerary> {
  "use step";
  
  console.log(`[Step 2/4] Generating itinerary for ${preferences.destination}...`);
  
  const supabase = getSupabaseAdmin();
  
  // Update progress to 10%
  await supabase
    .from('workflow_progress')
    .update({
      step: 'generate_itinerary',
      progress: 10,
      message: `AI is creating your ${preferences.destination} itinerary...`,
      updated_at: new Date().toISOString(),
    })
    .match({ trip_id: preferences.destination }); // Will be fixed with proper trip_id tracking
  
  try {
    // Call the AI generation function
    const itinerary = await generateItinerary(preferences, {
      onProgress: async (progress) => {
        // Map AI progress to workflow progress (10% -> 90%)
        const mappedProgress = 10 + Math.floor((progress.currentDay || 0) / progress.totalDays * 80);
        
        await supabase
          .from('workflow_progress')
          .update({
            progress: Math.min(mappedProgress, 90),
            message: progress.message,
            updated_at: new Date().toISOString(),
          })
          .eq('step', 'generate_itinerary');
      },
    });
    
    console.log(`[Step 2/4] Itinerary generated: ${itinerary.days.length} days`);
    return itinerary;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown AI error';
    console.error(`[Step 2/4] AI generation failed: ${message}`);
    throw new Error(`AI generation failed: ${message}`);
  }
}

/**
 * Step 3: Save generated itinerary to database
 */
async function saveItineraryToDatabase(
  tripId: string,
  userId: string,
  itinerary: GeneratedItinerary
): Promise<string> {
  "use step";
  
  console.log(`[Step 3/4] Saving itinerary for trip ${tripId}...`);
  
  const supabase = getSupabaseAdmin();
  
  // Update progress to 95%
  await supabase
    .from('workflow_progress')
    .update({
      step: 'save_itinerary',
      progress: 95,
      message: 'Saving your itinerary...',
      updated_at: new Date().toISOString(),
    })
    .eq('trip_id', tripId);
  
  // Insert itinerary
  const { data: savedItinerary, error: insertError } = await supabase
    .from('itineraries')
    .insert({
      trip_id: tripId,
      user_id: userId,
      destination: itinerary.destination,
      start_date: itinerary.startDate,
      end_date: itinerary.endDate,
      overview: itinerary.overview,
      total_cost: itinerary.totalEstimatedCost,
      days: itinerary.days,
      packing_list: itinerary.packingList,
      general_tips: itinerary.generalTips,
      generated_at: itinerary.generatedAt,
    })
    .select('id')
    .single();
  
  if (insertError) {
    throw new Error(`Failed to save itinerary: ${insertError.message}`);
  }
  
  // Update trip status
  await supabase
    .from('trips')
    .update({
      status: 'generated',
      itinerary_id: savedItinerary.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', tripId);
  
  console.log(`[Step 3/4] Itinerary saved: ${savedItinerary.id}`);
  return savedItinerary.id;
}

/**
 * Step 4: Send completion notification
 */
async function sendCompletionNotification(
  tripId: string,
  itineraryId: string,
  userId: string
): Promise<void> {
  "use step";
  
  console.log(`[Step 4/4] Sending completion notification...`);
  
  const supabase = getSupabaseAdmin();
  
  // Update progress to 100%
  await supabase
    .from('workflow_progress')
    .update({
      step: 'complete',
      progress: 100,
      message: 'Your itinerary is ready!',
      updated_at: new Date().toISOString(),
    })
    .eq('trip_id', tripId);
  
  // Insert notification
  await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      type: 'itinerary_ready',
      title: 'Your Itinerary is Ready!',
      message: `Your trip itinerary has been generated and is ready to view.`,
      data: {
        trip_id: tripId,
        itinerary_id: itineraryId,
      },
      read: false,
    });
  
  // Optionally trigger webhook for real-time updates
  const webhookUrl = process.env.WORKFLOW_COMPLETION_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'itinerary_generated',
          tripId,
          itineraryId,
          userId,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      // Non-critical, don't fail the workflow
      console.warn('[Step 4/4] Webhook notification failed:', error);
    }
  }
  
  console.log(`[Step 4/4] Completion notification sent`);
}
