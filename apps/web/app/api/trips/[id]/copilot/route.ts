import { NextRequest, NextResponse } from "next/server";
import type { GeneratedItinerary, TripDay } from "@faroway/types";
import { requireUserIdFromRequest } from "@/lib/auth/middleware";
import { getSupabase } from "@/lib/supabase/server";
import { checkRateLimitAsync } from "@/lib/security/rate-limit";
import {
  canDisplayViatorContent,
  filterViatorDisplay,
} from "@/lib/affiliates/viator-policy";
import { readSavedItinerary } from "@/lib/trips/read-itinerary";
import { stampPlanItems } from "@/lib/trips/plan-edits";
import { CopilotRequestSchema, applyCopilotEdit } from "@/lib/trips/copilot";

type Context = { params: Promise<{ id: string }> };

interface ItineraryRow {
  id?: string;
  days: unknown;
  overview: string | null;
  total_cost: number | null;
  packing_list: string[] | null;
  general_tips: string[] | null;
  generated_at: string | null;
}

interface SearchResultRow {
  id: string;
  category: string;
  data: Record<string, unknown>;
  vibe_score: number | null;
}

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

export async function POST(request: NextRequest, context: Context) {
  try {
    const auth = await requireUserIdFromRequest(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    if (!/^[a-zA-Z0-9-]+$/.test(id)) {
      return json({ error: "Invalid trip ID" }, 400);
    }

    const rate = await checkRateLimitAsync(`copilot:${auth.userId}`, {
      maxRequests: 30,
      windowMs: 60_000,
    });
    if (!rate.allowed) {
      return json(
        { error: "Too many itinerary edits right now. Please wait a moment." },
        429,
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = CopilotRequestSchema.safeParse(body);
    if (!parsed.success) {
      return json(
        {
          error:
            parsed.error.issues[0]?.message || "Invalid co-pilot instruction.",
        },
        400,
      );
    }
    const command = parsed.data;

    const db = getSupabase();
    const { data: trip, error: tripError } = await db
      .from("trips")
      .select(
        "id, user_id, destination, start_date, end_date, status, updated_at, preferences, plan_revision_id, search_id, itineraries(id, days, overview, total_cost, packing_list, general_tips, generated_at)",
      )
      .eq("id", id)
      .eq("user_id", auth.userId)
      .single();

    if (tripError) {
      if (tripError.code === "PGRST116") {
        return json({ error: "Trip not found" }, 404);
      }
      return json(
        { error: "Your saved trip is temporarily unavailable." },
        503,
      );
    }

    if (!trip || trip.user_id !== auth.userId) {
      return json({ error: "Trip not found" }, 404);
    }

    if (
      !["planned", "generated", "completed"].includes(trip.status) ||
      trip.preferences?.planNeedsRefresh
    ) {
      return json(
        {
          error:
            "Finish planning for your saved brief before using co-pilot edits.",
          code: "PLAN_NOT_READY",
        },
        409,
      );
    }

    if (
      command.expectedUpdatedAt &&
      trip.updated_at !== command.expectedUpdatedAt
    ) {
      return json(
        {
          error:
            "Your trip changed in another tab or device. Reload the latest plan before editing.",
          code: "REVISION_CONFLICT",
        },
        409,
      );
    }

    const joined = (
      trip as typeof trip & {
        itineraries: ItineraryRow[] | ItineraryRow | null;
      }
    ).itineraries;
    const rawItinerary = Array.isArray(joined)
      ? (joined[0] ?? null)
      : (joined ?? null);

    if (!rawItinerary) {
      return json(
        { error: "No saved itinerary found for this trip yet." },
        409,
      );
    }

    let currentItinerary: GeneratedItinerary | null;
    try {
      currentItinerary = readSavedItinerary(
        filterViatorDisplay({
          tripId: trip.id,
          destination: trip.destination,
          startDate: trip.start_date,
          endDate: trip.end_date,
          days: rawItinerary.days,
          overview: rawItinerary.overview ?? "",
          totalEstimatedCost:
            typeof rawItinerary.total_cost === "number"
              ? { amount: rawItinerary.total_cost, currency: "USD" }
              : { amount: 0, currency: "USD" },
          packingList: rawItinerary.packing_list ?? [],
          generalTips: rawItinerary.general_tips ?? [],
          generatedAt: rawItinerary.generated_at ?? trip.updated_at,
        }),
      );
    } catch {
      return json(
        {
          error:
            "Your saved itinerary could not be read cleanly. Refresh the trip before editing.",
        },
        409,
      );
    }

    if (!currentItinerary || !Array.isArray(currentItinerary.days)) {
      return json({ error: "No editable days found in this itinerary." }, 409);
    }

    // Stamp plan item IDs so any locked items from PlanEditor are respected
    try {
      const stampedDays = stampPlanItems(
        id,
        currentItinerary.days,
      ) as unknown as TripDay[];
      currentItinerary = { ...currentItinerary, days: stampedDays };
    } catch {
      // Keep original days if stamping encounters legacy duplicate IDs
    }

    // Load locked item IDs from active plan revision if present
    let lockedItemIds: string[] = [];
    if (trip.plan_revision_id) {
      const { data: activeRevision } = await db
        .from("trip_plan_revisions")
        .select("locked_items")
        .eq("id", trip.plan_revision_id)
        .eq("trip_id", id)
        .eq("user_id", auth.userId)
        .maybeSingle();
      if (Array.isArray(activeRevision?.locked_items)) {
        lockedItemIds = activeRevision.locked_items.filter(
          (item): item is string => typeof item === "string",
        );
      }
    }

    // Load grounded backup candidates from the trip's own search session
    const backupPool: Record<string, unknown>[] = [];
    if (trip.search_id && command.action !== "undo") {
      const { data: search } = await db
        .from("searches")
        .select(
          "id, user_id, intermediate_results, search_results(id, category, data, vibe_score)",
        )
        .eq("id", trip.search_id)
        .eq("user_id", auth.userId)
        .maybeSingle();

      if (search && search.user_id === auth.userId) {
        const rows = (
          (search as typeof search & { search_results?: SearchResultRow[] })
            .search_results ?? []
        ).sort((a, b) => (b.vibe_score ?? 0) - (a.vibe_score ?? 0));

        for (const row of rows) {
          if (row.category !== "activity" || !row.data) continue;
          const candidate = {
            ...row.data,
            id: typeof row.data.id === "string" ? row.data.id : row.id,
          };
          if (canDisplayViatorContent(candidate)) {
            backupPool.push(candidate);
          }
        }

        const ir = search.intermediate_results as
          | Record<string, unknown>
          | null
          | undefined;
        if (ir && Array.isArray(ir.activities)) {
          for (const rawAct of ir.activities) {
            if (
              rawAct &&
              typeof rawAct === "object" &&
              !Array.isArray(rawAct) &&
              canDisplayViatorContent(rawAct)
            ) {
              backupPool.push(rawAct as Record<string, unknown>);
            }
          }
        }
      }
    }

    // Sanitize undo snapshot if provided
    let effectiveCommand = command;
    if (command.action === "undo" && command.previousItinerarySnapshot) {
      try {
        const sanitizedUndo = readSavedItinerary(
          filterViatorDisplay(command.previousItinerarySnapshot),
        );
        if (!sanitizedUndo) {
          return json({ error: "Invalid undo snapshot." }, 400);
        }
        effectiveCommand = {
          ...command,
          previousItinerarySnapshot: sanitizedUndo as unknown as Record<
            string,
            unknown
          > & { days: Record<string, unknown>[] },
        };
      } catch {
        return json({ error: "Invalid undo snapshot." }, 400);
      }
    }

    const result = applyCopilotEdit(currentItinerary, effectiveCommand, {
      lockedItemIds,
      backupPool,
    });

    if (!result.applied) {
      return json({
        ...result,
        updatedAt: trip.updated_at,
      });
    }

    // Persist with optimistic concurrency on trips.updated_at first
    const nextUpdatedAt = new Date().toISOString();
    const { data: bumpedTrip, error: bumpError } = await db
      .from("trips")
      .update({ updated_at: nextUpdatedAt })
      .eq("id", id)
      .eq("user_id", auth.userId)
      .eq("updated_at", trip.updated_at)
      .select("updated_at")
      .maybeSingle();

    if (bumpError) {
      return json(
        {
          error:
            "Could not save your co-pilot edit. Your previous itinerary is unchanged.",
        },
        503,
      );
    }

    if (!bumpedTrip) {
      return json(
        {
          error:
            "Your trip changed in another tab or device. Reload the latest plan before editing.",
          code: "REVISION_CONFLICT",
        },
        409,
      );
    }

    const itineraryUpdateQuery = db
      .from("itineraries")
      .update({ days: result.updatedItinerary.days })
      .eq("trip_id", id);

    const { error: saveError } = rawItinerary.id
      ? await itineraryUpdateQuery.eq("id", rawItinerary.id)
      : await itineraryUpdateQuery;

    if (saveError) {
      return json(
        {
          error:
            "Could not save your updated itinerary days. Please refresh and check your plan.",
        },
        503,
      );
    }

    return json({
      ...result,
      updatedAt: bumpedTrip.updated_at ?? nextUpdatedAt,
    });
  } catch (error) {
    console.error("[Trip Copilot] Unexpected error:", error);
    return json(
      {
        error:
          "Co-pilot edits are temporarily unavailable. Your saved trip is safe.",
      },
      503,
    );
  }
}
