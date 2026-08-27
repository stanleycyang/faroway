/**
 * POST /api/search/start
 * Start a new travel search using Vercel Workflow + AI SDK Agents
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { requireUserIdFromRequest } from "@/lib/auth/middleware";
import { startWorkflow } from "@/lib/workflow/runtime";
import { planTripWorkflow } from "@/workflows/plan-trip";
import { checkRateLimitAsync, getClientIp } from "@/lib/security/rate-limit";
import { isValidDateOnly, isValidDateRange } from "@/lib/api/date-range";
import { z } from "zod";

const DateOnlySchema = z
  .string()
  .refine(isValidDateOnly, "Must be a valid YYYY-MM-DD date");

const SearchInputSchema = z
  .object({
    destination: z.string().min(1).max(200).trim(),
    startDate: DateOnlySchema,
    endDate: DateOnlySchema,
    travelers: z.number().int().min(1).max(50).optional(),
    travelerType: z
      .enum(["solo", "couple", "family", "friends", "business"])
      .optional(),
    vibes: z.array(z.string().max(50)).max(10).optional(),
    budget: z.string().max(50).optional(),
    originCity: z.string().max(200).optional(),
    originAirport: z.string().max(10).optional(),
  })
  .refine((data) => isValidDateRange(data.startDate, data.endDate), {
    message: "End date must be on or after start date",
    path: ["endDate"],
  });

export async function POST(request: NextRequest) {
  let searchId: string | null = null;

  try {
    const auth = await requireUserIdFromRequest(request);
    if (auth instanceof NextResponse) return auth;
    const userId = auth.userId;

    // Rate limit: 5 searches per minute per IP
    const ip = getClientIp(request);
    const { allowed } = await checkRateLimitAsync(`search:${ip}`, {
      maxRequests: 5,
      windowMs: 60_000,
      failClosed: true,
    });
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": "60" } },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const parseResult = SearchInputSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parseResult.error.issues },
        { status: 400 },
      );
    }

    const {
      destination,
      startDate,
      endDate,
      travelers,
      travelerType,
      vibes,
      budget,
      originCity,
      originAirport,
    } = parseResult.data;

    // Create search record
    const { data: search, error: insertError } = await getSupabase()
      .from("searches")
      .insert({
        user_id: userId,
        destination,
        start_date: startDate,
        end_date: endDate,
        travelers: travelers || 2,
        traveler_type: travelerType || null,
        vibes: vibes || [],
        budget: budget || "moderate",
        status: "pending",
        progress: {
          orchestrator: "pending",
          hotels: "pending",
          activities: "pending",
          dining: "pending",
          transport: "pending",
          enrichment: "pending",
          aggregator: "pending",
        },
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Search Start] Database error:", insertError);
      return NextResponse.json(
        { error: "Failed to create search record" },
        { status: 500 },
      );
    }

    const createdSearchId = search.id;
    searchId = createdSearchId;

    // The generation path is now aggressively timeboxed and parallelized.
    const estimatedTime = 5;

    // Start the durable workflow (doesn't block)
    await startWorkflow(planTripWorkflow, [
      {
        searchId: createdSearchId,
        destination,
        startDate,
        endDate,
        travelers: travelers || 2,
        travelerType,
        vibes: vibes || [],
        budget: budget || "moderate",
        originCity,
        originAirport,
        userId,
      },
    ]);

    // Update status to searching
    await getSupabase()
      .from("searches")
      .update({ status: "searching" })
      .eq("id", createdSearchId);

    return NextResponse.json({
      searchId: createdSearchId,
      status: "started",
      estimatedTime,
    });
  } catch (error) {
    console.error("[Search Start] Error:", error);
    if (searchId) {
      try {
        await getSupabase()
          .from("searches")
          .update({
            status: "error",
            error_message:
              error instanceof Error ? error.message : "Workflow start failed",
          })
          .eq("id", searchId);
      } catch (updateError) {
        console.error(
          "[Search Start] Failed to mark search as errored:",
          updateError,
        );
      }
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
