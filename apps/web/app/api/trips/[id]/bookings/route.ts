import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserIdFromRequest } from "@/lib/auth/middleware";
import { getSupabase } from "@/lib/supabase/server";
import { canDisplayViatorContent } from "@/lib/affiliates/viator-policy";
import { planItems, stampPlanItems } from "@/lib/trips/plan-edits";
import { BookingReportCommand } from "@/lib/trips/booking-checklist";
type Context = { params: Promise<{ id: string }> };
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
interface Report {
  id: string;
  generation_id: string;
  item_id: string;
  trip_version: string;
  status: string;
  item_snapshot: unknown;
  activity_date: string;
  created_at: string;
}
async function read(
  id: string,
  userId: string,
  requestId: string | null = null,
) {
  const db = getSupabase();
  const { data: trip, error } = await db
    .from("trips")
    .select(
      "id,status,updated_at,preferences,itineraries(id,days,booking_generation_id)",
    )
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error("Saved booking progress is temporarily unavailable");
  }
  if (!trip) return null;
  const { data, error: reportError } = await db.rpc(
    "read_trip_booking_reports",
    { p_trip_id: id, p_user_id: userId, p_request_id: requestId },
  );
  if (reportError || !data) throw new Error("Progress unavailable");
  const itinerary = Array.isArray(trip.itineraries)
    ? trip.itineraries[0]
    : trip.itineraries;
  const generationId = itinerary?.booking_generation_id;
  const items = itinerary?.days
    ? planItems(stampPlanItems(id, itinerary.days), []).filter(({ item }) =>
        canDisplayViatorContent(item),
      )
    : [];
  return {
    trip,
    generationId,
    items,
    reports: data.reports as Report[],
    receipt: data.receipt as boolean,
  };
}
export async function GET(request: NextRequest, context: Context) {
  try {
    const auth = await requireUserIdFromRequest(request);
    if (auth instanceof NextResponse) return auth;
    if (process.env.FAROWAY_BOOKING_CHECKLIST_ENABLED !== "true")
      return json({ error: "Booking progress is not available yet." }, 503);
    const requestId = request.nextUrl.searchParams.get("requestId");
    if (requestId && !z.string().uuid().safeParse(requestId).success)
      return json({ error: "Invalid request identity" }, 400);
    const { id } = await context.params;
    const state = await read(id, auth.userId, requestId);
    if (!state) return json({ error: "Trip not found" }, 404);
    const { trip, generationId, items, reports } = state;
    const editable =
      !!generationId &&
      ["planned", "generated"].includes(trip.status) &&
      !trip.preferences?.planNeedsRefresh;
    const present = new Set(items.map((item) => item.id));
    return json({
      revision: trip.updated_at,
      generationId,
      editable,
      receipt: state.receipt,
      verificationAvailable: false,
      items: items
        .filter(
          ({ id }) =>
            editable ||
            reports.some(
              (r) => r.generation_id === generationId && r.item_id === id,
            ),
        )
        .map(({ id, name, date }) => {
          const report = reports.find(
            (r) => r.generation_id === generationId && r.item_id === id,
          );
          return {
            id,
            name,
            date,
            reportId: report?.id ?? null,
            status: report?.status ?? "needed",
            needsReview:
              !!report &&
              (!editable || report.trip_version !== trip.updated_at),
          };
        }),
      earlier: reports
        .filter(
          (r) => r.generation_id !== generationId || !present.has(r.item_id),
        )
        .map((r) => ({
          id: r.id,
          name: canDisplayViatorContent(r.item_snapshot)
            ? String(
                (r.item_snapshot as { name?: string })?.name ||
                  "Earlier activity",
              )
            : "Provider activity",
          date: r.activity_date,
          status: r.status,
        })),
    });
  } catch {
    return json(
      {
        error: "Could not load booking progress. Your saved reports are kept.",
      },
      503,
    );
  }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    const auth = await requireUserIdFromRequest(request);
    if (auth instanceof NextResponse) return auth;
    if (process.env.FAROWAY_BOOKING_CHECKLIST_ENABLED !== "true")
      return json({ error: "Booking progress is not available yet." }, 503);
    const parsed = BookingReportCommand.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) return json({ error: "Invalid booking report" }, 400);
    const { id } = await context.params;
    const command = parsed.data;
    const state = await read(id, auth.userId, command.requestId);
    if (!state) return json({ error: "Trip not found" }, 404);
    if (
      !state.receipt &&
      (state.trip.updated_at !== command.expectedUpdatedAt ||
        state.generationId !== command.generationId ||
        !["planned", "generated"].includes(state.trip.status) ||
        state.trip.preferences?.planNeedsRefresh ||
        !state.items.some((i) => i.id === command.itemId))
    )
      return json(
        {
          error:
            "Your trip changed or this activity is unavailable. Refresh and review before reporting progress.",
        },
        409,
      );
    const { data, error } = await getSupabase().rpc("report_trip_booking", {
      p_trip_id: id,
      p_user_id: auth.userId,
      p_command: command,
    });
    if (error)
      return json(
        { error: "Save not confirmed. Check saved progress before retrying." },
        503,
      );
    if (!data || data.state === "conflict")
      return json(
        { error: "Progress changed. Refresh before making another report." },
        409,
      );
    return json({ ...data, requestId: command.requestId });
  } catch {
    return json(
      { error: "Save not confirmed. Check saved progress before retrying." },
      503,
    );
  }
}
