/**
 * POST /api/workflows/generate-itinerary
 *
 * Compatibility adapter for older clients. The canonical trip-generation
 * route owns authorization, rate limiting, database-backed trip inputs,
 * preview creation, workflow startup, and failure recovery. It returns both
 * legacy workflowId/statusUrl and current searchId/streamUrl contracts.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { POST as startTripGeneration } from "@/app/api/trips/[id]/generate/route";
import { parseJsonRequest } from "@/lib/api/json";

const CompatibilityRequestSchema = z
  .object({
    tripId: z.string().uuid(),
  })
  .passthrough();

export async function POST(request: NextRequest) {
  // Validate a clone so the canonical handler receives the original request
  // with its body stream intact. Re-wrapping request.clone() in NextRequest
  // breaks Next.js' production request subclass (#state is not transferable).
  const body = await parseJsonRequest(request.clone(), "Invalid request body");
  if (!body.ok) return body.response;

  const validationResult = CompatibilityRequestSchema.safeParse(body.data);
  if (!validationResult.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  return startTripGeneration(request, {
    params: Promise.resolve({ id: validationResult.data.tripId }),
  });
}
