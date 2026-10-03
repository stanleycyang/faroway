import { NextRequest, NextResponse } from "next/server";
import { requireUserIdFromRequest } from "@/lib/auth/middleware";
import { getSupabase } from "@/lib/supabase/server";
import { canDisplayViatorContent } from "@/lib/affiliates/viator-policy";
import {
  PlanCommand,
  editPlan,
  planItems,
  stampPlanItems,
} from "@/lib/trips/plan-edits";

type Context = { params: Promise<{ id: string }> };
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });

async function readPlan(id: string, userId: string) {
  const db = getSupabase();
  const { data: trip, error } = await db
    .from("trips")
    .select(
      "id, status, updated_at, preferences, plan_revision_id, itineraries(days)",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error || !trip) return null;
  const { data: history, error: historyError } = await db
    .from("trip_plan_revisions")
    .select("id, request_id, locked_items, created_at, command")
    .eq("trip_id", id)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (historyError) throw new Error("Revision history unavailable");
  const active = (history || []).find(
    (row) => row.id === trip.plan_revision_id,
  );
  if (trip.plan_revision_id && !active)
    throw new Error("Active revision unavailable");
  const itinerary = Array.isArray(trip.itineraries)
    ? trip.itineraries[0]
    : trip.itineraries;
  return {
    trip,
    days: stampPlanItems(id, itinerary?.days),
    locked: (active?.locked_items || []) as string[],
    history: history || [],
  };
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const auth = await requireUserIdFromRequest(request);
    if (auth instanceof NextResponse) return auth;
    if (process.env.FAROWAY_PLAN_EDITING_ENABLED !== "true")
      return json(
        {
          error: "Plan editing is not available yet. Your saved plan is safe.",
        },
        503,
      );
    const { id } = await context.params;
    const plan = await readPlan(id, auth.userId);
    if (!plan) return json({ error: "Trip not found" }, 404);
    return json({
      revision: plan.trip.updated_at,
      planRevision: plan.trip.plan_revision_id ?? null,
      editable:
        ["planned", "generated"].includes(plan.trip.status) &&
        !plan.trip.preferences?.planNeedsRefresh &&
        planItems(plan.days, plan.locked).every(({ item }) =>
          canDisplayViatorContent(item),
        ),
      items: planItems(plan.days, plan.locked)
        .filter(({ item }) => canDisplayViatorContent(item))
        .map(({ id, name, date, period, locked }) => ({
          id,
          name,
          date,
          period,
          locked,
        })),
      history: plan.history.map((row) => ({
        id: row.id,
        requestId: row.request_id,
        createdAt: row.created_at,
        action: row.command?.action || "baseline",
      })),
    });
  } catch {
    return json(
      {
        error:
          "Plan editing is temporarily unavailable. Your saved plan is safe.",
      },
      503,
    );
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const auth = await requireUserIdFromRequest(request);
    if (auth instanceof NextResponse) return auth;
    if (process.env.FAROWAY_PLAN_EDITING_ENABLED !== "true")
      return json(
        {
          error: "Plan editing is not available yet. Your saved plan is safe.",
        },
        503,
      );
    const parsed = PlanCommand.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return json({ error: "Invalid plan change" }, 400);
    const { id } = await context.params;
    const plan = await readPlan(id, auth.userId);
    if (!plan) return json({ error: "Trip not found" }, 404);
    const command = parsed.data;
    // An exact replay must reach the atomic RPC even though its original version
    // is now older. It verifies request identity and the still-current result.
    const replay = plan.history.some(
      (row) => row.request_id === command.requestId,
    );
    if (
      !replay &&
      (plan.trip.updated_at !== command.expectedUpdatedAt ||
        (plan.trip.plan_revision_id ?? null) !== command.expectedPlanRevision)
    )
      return json(
        {
          error:
            "Your plan changed. Load the latest plan and review this change again.",
        },
        409,
      );
    if (
      !["planned", "generated"].includes(plan.trip.status) ||
      plan.trip.preferences?.planNeedsRefresh
    )
      return json(
        {
          error:
            "Finish planning for your saved brief before editing activities.",
        },
        409,
      );
    if (
      planItems(plan.days, plan.locked).some(
        ({ item }) => !canDisplayViatorContent(item),
      )
    )
      return json(
        {
          error:
            "This plan contains provider content that is not available for editing. Your saved plan is unchanged.",
        },
        409,
      );
    let updated;
    try {
      updated = replay
        ? { days: plan.days, locked: plan.locked }
        : editPlan(plan.days, plan.locked, command);
    } catch (error) {
      return json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Cannot edit this activity",
        },
        409,
      );
    }
    const { data, error } = await getSupabase().rpc("edit_trip_plan", {
      p_trip_id: id,
      p_user_id: auth.userId,
      p_command: command,
      p_days: updated.days,
      p_locked: updated.locked,
    });
    if (error)
      return json(
        {
          error:
            "The save could not be confirmed. Check your saved plan before retrying.",
        },
        503,
      );
    if (!data || data.state === "conflict")
      return json(
        {
          error: "Your plan changed. Load the latest plan before trying again.",
        },
        409,
      );
    return json(data);
  } catch {
    return json(
      { error: "The save could not be confirmed. Your previous plan is kept." },
      503,
    );
  }
}
