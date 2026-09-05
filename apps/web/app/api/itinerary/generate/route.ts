/**
 * Itinerary Generation API Route
 * Compatibility route for older clients.
 *
 * POST /api/itinerary/generate
 * - If `tripId` is provided, starts the durable parallel trip workflow
 * - Otherwise delegates to /api/itinerary/stream, which uses the parallel search workflow
 */

import { NextRequest } from "next/server";
import { POST as startTripGeneration } from "@/app/api/trips/[id]/generate/route";
import { POST as streamItineraryGeneration } from "@/app/api/itinerary/stream/route";

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.clone().json();

    if (typeof body.tripId === "string" && body.tripId.trim().length > 0) {
      return startTripGeneration(request, {
        params: Promise.resolve({ id: body.tripId }),
      });
    }

    return streamItineraryGeneration(request);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return Response.json({ error: "Invalid request body" }, { status: 400 });
    }

    console.error("[Itinerary Generation Error]", error);
    return Response.json({ error: "Generation failed" }, { status: 500 });
  }
}
