import { NextRequest, NextResponse } from "next/server";
import type { GeneratedItinerary, HotelResult, TripDay } from "@faroway/types";
import { requireUserIdFromRequest } from "@/lib/auth/middleware";
import { getSupabase } from "@/lib/supabase/server";
import { checkRateLimitAsync } from "@/lib/security/rate-limit";
import {
  canDisplayViatorContent,
  filterViatorDisplay,
} from "@/lib/affiliates/viator-policy";
import { readSavedItinerary } from "@/lib/trips/read-itinerary";
import { planItems, stampPlanItems } from "@/lib/trips/plan-edits";
import {
  CopilotRequestSchema,
  applyCopilotEdit,
  parseCopilotPrompt,
} from "@/lib/trips/copilot";

type Context = { params: Promise<{ id: string }> };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 16_384;

interface ItineraryRow {
  id?: string;
  days: unknown;
  overview: string | null;
  total_cost: unknown;
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

const json = (
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>,
) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store", ...extraHeaders },
  });

function readTotalEstimatedCost(raw: unknown): {
  amount: number;
  currency: string;
} {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return { amount: raw, currency: "USD" };
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const rec = raw as Record<string, unknown>;
    if (
      typeof rec.amount === "number" &&
      Number.isFinite(rec.amount) &&
      typeof rec.currency === "string" &&
      rec.currency.trim().length > 0
    ) {
      return { amount: rec.amount, currency: rec.currency.trim() };
    }
  }
  return { amount: 0, currency: "USD" };
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const auth = await requireUserIdFromRequest(request);
    if (auth instanceof NextResponse) return auth;

    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) {
      return json({ error: "Invalid trip ID" }, 400);
    }

    const rate = await checkRateLimitAsync(`copilot:${auth.userId}`, {
      maxRequests: 30,
      windowMs: 60_000,
      failClosed: true,
    });
    if (!rate.allowed) {
      return json(
        { error: "Too many itinerary edits right now. Please wait a moment." },
        429,
        {
          "Retry-After": String(Math.max(1, Math.ceil(rate.resetIn / 1000))),
        },
      );
    }

    const rawText = await request.text().catch(() => null);
    if (rawText === null || rawText.length > MAX_BODY_BYTES) {
      return json({ error: "Invalid or oversized co-pilot request." }, 400);
    }

    let body: unknown = null;
    try {
      body = JSON.parse(rawText);
    } catch {
      return json({ error: "Invalid JSON request body." }, 400);
    }

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

    if (
      command.expectedPlanRevision !== undefined &&
      (trip.plan_revision_id ?? null) !== command.expectedPlanRevision
    ) {
      return json(
        {
          error:
            "Your plan revision changed. Reload the latest plan before editing.",
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

    // Fail closed if stamping fails or raw stored items contain restricted provider content
    // (never rewrite Viator-filtered content back to the database).
    let stampedRawDays: Record<string, unknown>[];
    try {
      stampedRawDays = stampPlanItems(id, rawItinerary.days);
    } catch {
      return json(
        {
          error:
            "Your saved itinerary could not be verified for editing. Refresh before trying again.",
        },
        409,
      );
    }

    // Load locked item IDs from active plan revision — fail closed on DB error
    let lockedItemIds: string[] = [];
    if (trip.plan_revision_id) {
      const { data: activeRevision, error: revError } = await db
        .from("trip_plan_revisions")
        .select("id, locked_items, parent_id")
        .eq("id", trip.plan_revision_id)
        .eq("trip_id", id)
        .eq("user_id", auth.userId)
        .maybeSingle();

      if (revError || !activeRevision) {
        return json(
          {
            error:
              "Active plan revision could not be verified. Your saved trip is unchanged.",
          },
          503,
        );
      }

      if (Array.isArray(activeRevision.locked_items)) {
        lockedItemIds = activeRevision.locked_items.filter(
          (item): item is string => typeof item === "string",
        );
      }
    }

    if (
      planItems(stampedRawDays, lockedItemIds).some(
        ({ item }) => !canDisplayViatorContent(item),
      )
    ) {
      return json(
        {
          error:
            "This plan contains provider content that is not available for editing. Your saved plan is unchanged.",
        },
        409,
      );
    }

    let currentItinerary: GeneratedItinerary | null;
    try {
      currentItinerary = readSavedItinerary({
        tripId: trip.id,
        destination: trip.destination,
        startDate: trip.start_date,
        endDate: trip.end_date,
        days: stampedRawDays,
        overview: rawItinerary.overview ?? "",
        totalEstimatedCost: readTotalEstimatedCost(rawItinerary.total_cost),
        packingList: rawItinerary.packing_list ?? [],
        generalTips: rawItinerary.general_tips ?? [],
        generatedAt: rawItinerary.generated_at ?? trip.updated_at,
      });
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

    // Load grounded backup candidates + topHotel from the trip's own search session
    const backupPool: Record<string, unknown>[] = [];
    let topHotel: HotelResult | undefined;
    if (trip.search_id) {
      const { data: search, error: searchError } = await db
        .from("searches")
        .select(
          "id, user_id, intermediate_results, search_results(id, category, data, vibe_score)",
        )
        .eq("id", trip.search_id)
        .eq("user_id", auth.userId)
        .maybeSingle();

      if (!searchError && search && search.user_id === auth.userId) {
        const ir = filterViatorDisplay(
          (search.intermediate_results as Record<string, unknown> | null) ?? {},
        );
        if (ir.topHotel && typeof ir.topHotel === "object") {
          topHotel = ir.topHotel as HotelResult;
        }

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
      }
    }

    if (topHotel) {
      currentItinerary = { ...currentItinerary, topHotel };
    }

    // Determine whether this request is a server-side undo
    const effectiveAction =
      command.action ??
      (command.prompt
        ? parseCopilotPrompt(command.prompt, currentItinerary).action
        : undefined);

    if (effectiveAction === "undo") {
      if (!trip.plan_revision_id) {
        return json({
          applied: false,
          summary: "No previous co-pilot edit is available to undo.",
          diff: [],
          updatedItinerary: filterViatorDisplay(currentItinerary),
          updatedAt: trip.updated_at,
          planRevision: trip.plan_revision_id ?? null,
        });
      }

      const { data: rpcResult, error: rpcError } = await db.rpc(
        "apply_trip_copilot_edit",
        {
          p_trip_id: id,
          p_user_id: auth.userId,
          p_mode: "undo",
          p_expected_updated_at: command.expectedUpdatedAt ?? trip.updated_at,
          p_expected_plan_revision: trip.plan_revision_id,
          p_command: { action: "undo" },
          p_days: null,
          p_undo_revision_id: command.undoRevisionId ?? null,
        },
      );

      if (rpcError) {
        return json(
          {
            error:
              "Could not undo your last edit right now. Your saved plan is unchanged.",
          },
          503,
        );
      }

      const outcome = (rpcResult ?? {}) as Record<string, unknown>;
      if (outcome.state === "conflict") {
        return json(
          {
            error:
              "Your trip changed in another tab or device. Reload the latest plan before undoing.",
            code: "REVISION_CONFLICT",
          },
          409,
        );
      }
      if (outcome.state !== "applied") {
        return json({
          applied: false,
          summary: "No earlier saved revision was found to restore.",
          diff: [],
          updatedItinerary: filterViatorDisplay(currentItinerary),
          updatedAt: trip.updated_at,
          planRevision: trip.plan_revision_id ?? null,
        });
      }

      const restoredItinerary: GeneratedItinerary = {
        ...currentItinerary,
        days: Array.isArray(outcome.restoredDays)
          ? (outcome.restoredDays as TripDay[])
          : currentItinerary.days,
        overview:
          typeof outcome.restoredOverview === "string"
            ? outcome.restoredOverview
            : currentItinerary.overview,
      };

      return json({
        applied: true,
        summary: "Reverted your last co-pilot change.",
        diff: [],
        updatedItinerary: filterViatorDisplay(restoredItinerary),
        updatedAt:
          typeof outcome.revision === "string"
            ? outcome.revision
            : trip.updated_at,
        planRevision:
          typeof outcome.planRevision === "string"
            ? outcome.planRevision
            : null,
        undoRevisionId:
          typeof outcome.undoRevisionId === "string"
            ? outcome.undoRevisionId
            : null,
      });
    }

    const result = applyCopilotEdit(currentItinerary, command, {
      lockedItemIds,
      backupPool,
    });

    if (!result.applied) {
      return json({
        applied: false,
        summary: result.summary,
        diff: result.diff,
        notice: result.notice,
        updatedItinerary: filterViatorDisplay(result.updatedItinerary),
        updatedAt: trip.updated_at,
        planRevision: trip.plan_revision_id ?? null,
      });
    }

    // Verify stamped days have no conflicting planItemIds before persisting
    let nextStampedDays: Record<string, unknown>[];
    try {
      nextStampedDays = stampPlanItems(id, result.updatedItinerary.days);
    } catch {
      return json(
        {
          error:
            "Could not verify updated plan item identities. Your previous itinerary is unchanged.",
        },
        409,
      );
    }

    // Atomically persist via fenced RPC (sets faroway.plan_write, revokes sharing, records revision)
    const { data: rpcResult, error: rpcError } = await db.rpc(
      "apply_trip_copilot_edit",
      {
        p_trip_id: id,
        p_user_id: auth.userId,
        p_mode: "apply",
        p_expected_updated_at: command.expectedUpdatedAt ?? trip.updated_at,
        p_expected_plan_revision: trip.plan_revision_id ?? null,
        p_command: {
          action: effectiveAction ?? "copilot",
          dayNumber: command.dayNumber ?? null,
          slot: command.slot ?? null,
          diffCount: result.diff.length,
        },
        p_days: nextStampedDays,
        p_undo_revision_id: null,
      },
    );

    if (rpcError) {
      return json(
        {
          error:
            "Could not save your co-pilot edit. Your previous itinerary is unchanged.",
        },
        503,
      );
    }

    const outcome = (rpcResult ?? {}) as Record<string, unknown>;
    if (outcome.state === "conflict") {
      return json(
        {
          error:
            "Your trip changed in another tab or device. Reload the latest plan before editing.",
          code: "REVISION_CONFLICT",
        },
        409,
      );
    }
    if (outcome.state !== "applied") {
      return json(
        {
          error:
            "Could not save your co-pilot edit. Your previous itinerary is unchanged.",
        },
        503,
      );
    }

    const persistedItinerary: GeneratedItinerary = {
      ...result.updatedItinerary,
      days: nextStampedDays as unknown as TripDay[],
      overview: "",
    };

    return json({
      applied: true,
      summary: result.summary,
      diff: result.diff,
      notice: result.notice,
      updatedItinerary: filterViatorDisplay(persistedItinerary),
      updatedAt:
        typeof outcome.revision === "string"
          ? outcome.revision
          : trip.updated_at,
      planRevision:
        typeof outcome.planRevision === "string" ? outcome.planRevision : null,
      undoRevisionId:
        typeof outcome.undoRevisionId === "string"
          ? outcome.undoRevisionId
          : null,
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
