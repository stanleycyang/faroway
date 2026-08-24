/**
 * Itinerary API Route (Non-streaming)
 * For cases where full response is preferred over streaming.
 *
 * POST /api/itinerary
 * - Runs the same parallel vendor/search workflow as streaming generation
 * - Returns a GeneratedItinerary-compatible JSON payload
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { executeTravelSearch } from "@/lib/search/workflow";
import { mapSearchResultsToItinerary } from "@/lib/search/bridge";
import { createClient } from "@/lib/supabase/server";
import { checkRateLimitAsync, getClientIp } from "@/lib/security/rate-limit";
import { isValidDateOnly, isValidDateRange } from "@/lib/api/date-range";
import type { GeneratedItinerary } from "@faroway/types";

export const maxDuration = 60;

const TravelerInputSchema = z.union([
  z.number().int().min(1).max(50),
  z.object({
    adults: z.number().int().min(1).max(50),
    children: z.number().int().min(0).max(49).default(0),
  }),
]);

const DateOnlySchema = z
  .string()
  .refine(isValidDateOnly, "Must be a valid YYYY-MM-DD date");

const ItineraryRequestSchema = z
  .object({
    destination: z.string().min(1).max(200).trim(),
    startDate: DateOnlySchema,
    endDate: DateOnlySchema,
    travelers: TravelerInputSchema.optional(),
    travelerType: z
      .enum(["solo", "couple", "family", "friends", "business"])
      .optional(),
    originCity: z.string().max(200).optional(),
    originAirport: z.string().max(10).optional(),
    vibes: z.array(z.string().max(50)).max(10).optional(),
    budget: z.enum(["budget", "moderate", "luxury"]).optional(),
    interests: z.array(z.string().max(100)).max(20).optional(),
    dietaryRestrictions: z.array(z.string().max(100)).max(20).optional(),
    save: z.boolean().optional(),
  })
  .refine((data) => isValidDateRange(data.startDate, data.endDate), {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 generations per minute per IP
    const ip = getClientIp(request);
    const { allowed, remaining } = await checkRateLimitAsync(
      `itinerary:${ip}`,
      {
        maxRequests: 10,
        windowMs: 60_000,
        failClosed: true,
      },
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "X-RateLimit-Remaining": String(remaining),
          },
        },
      );
    }

    const body = await request.json();
    const parseResult = ItineraryRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.issues },
        { status: 400 },
      );
    }

    const params = parseResult.data;
    const travelers = normalizeTravelerCount(params.travelers);
    const vibes = params.vibes?.length ? params.vibes : ["adventure"];
    const budget = params.budget || "moderate";

    // Get user ID if authenticated
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const searchResult = await executeTravelSearch(
      `itinerary_${crypto.randomUUID()}`,
      {
        destination: params.destination,
        startDate: params.startDate,
        endDate: params.endDate,
        travelers,
        travelerType: params.travelerType,
        originCity: params.originCity,
        originAirport: params.originAirport,
        vibes,
        budget,
      },
    );

    if (searchResult.status !== "completed" || !searchResult.results) {
      throw new Error(searchResult.error || "Itinerary search failed");
    }

    const topHotel =
      searchResult.results.itinerary?.[0]?.hotel ||
      searchResult.results.hotels[0] ||
      null;
    const mapped = mapSearchResultsToItinerary(searchResult.results, topHotel);
    const itinerary: GeneratedItinerary = {
      tripId: user?.id ? `trip_${user.id}_${Date.now()}` : `trip_${Date.now()}`,
      destination: params.destination,
      startDate: params.startDate,
      endDate: params.endDate,
      overview: `Your personalized ${mapped.days.length}-day trip to ${params.destination}`,
      totalEstimatedCost: {
        amount: mapped.totalEstimatedCost,
        currency: mapped.currency,
      },
      days: mapped.days,
      packingList: [],
      generalTips: [],
      generatedAt: new Date().toISOString(),
    };

    // Optionally save to database if user is authenticated
    if (user && params.save !== false) {
      const { error: saveError } = await supabase.from("trips").insert({
        user_id: user.id,
        destination: params.destination,
        start_date: params.startDate,
        end_date: params.endDate,
        preferences: {
          vibes,
          budget,
          travelers,
          interests: params.interests || [],
          dietaryRestrictions: params.dietaryRestrictions || [],
        },
        itinerary: itinerary,
        status: "draft",
      });

      if (saveError) {
        console.error("[Save Error]", saveError);
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json(itinerary);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    console.error("[Itinerary Error]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 },
    );
  }
}

function normalizeTravelerCount(
  travelers: z.infer<typeof TravelerInputSchema> | undefined,
): number {
  if (!travelers) return 1;
  if (typeof travelers === "number") return travelers;
  return travelers.adults + travelers.children;
}
