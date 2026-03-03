/**
 * Trip Bookings API
 *
 * GET /api/trips/[id]/bookings - Fetch all bookings for a trip
 * PATCH /api/trips/[id]/bookings - Update a booking status (user-confirmed)
 */

import { NextRequest, NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";
import type { TripBooking } from "@faroway/types";

type Params = {
  params: Promise<{
    id: string;
  }>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeBooking(row: any): TripBooking {
  return {
    id: row.id,
    userId: row.user_id,
    tripId: row.trip_id,
    clickId: row.click_id,
    category: row.category,
    itemName: row.item_name,
    itemId: row.item_id,
    partner: row.partner,
    partnerBookingRef: row.partner_booking_ref,
    partnerManageUrl: row.partner_manage_url,
    checkIn: row.check_in,
    checkOut: row.check_out,
    startTime: row.start_time,
    price: row.price ? Number(row.price) : null,
    currency: row.currency || "USD",
    status: row.status,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
    expiresAt: row.expires_at,
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;

    if (!tripId || !/^[0-9a-f-]{36}$/.test(tripId)) {
      return NextResponse.json(
        { error: "Invalid trip ID" },
        { status: 400 },
      );
    }

    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: bookings, error } = await supabase
      .from("trip_bookings")
      .select("*")
      .eq("trip_id", tripId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[Trip Bookings API] Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch bookings" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      bookings: (bookings || []).map(normalizeBooking),
    });
  } catch (error) {
    console.error("[Trip Bookings API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch bookings" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id: tripId } = await params;
    const body = await request.json();
    const { bookingId, status } = body;

    if (!tripId || !/^[0-9a-f-]{36}$/.test(tripId)) {
      return NextResponse.json(
        { error: "Invalid trip ID" },
        { status: 400 },
      );
    }

    if (!bookingId || !status) {
      return NextResponse.json(
        { error: "Missing bookingId or status" },
        { status: 400 },
      );
    }

    // Only allow user-initiated status changes
    const allowedStatuses = ["user_confirmed", "cancelled", "expired"];
    if (!allowedStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Status must be one of: ${allowedStatuses.join(", ")}` },
        { status: 400 },
      );
    }

    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const updateData: Record<string, unknown> = { status };
    if (status === "user_confirmed") {
      updateData.confirmed_at = new Date().toISOString();
    }

    const { data: booking, error } = await supabase
      .from("trip_bookings")
      .update(updateData)
      .eq("id", bookingId)
      .eq("trip_id", tripId)
      .eq("user_id", user.id)
      .select("*")
      .single();

    if (error) {
      console.error("[Trip Bookings API] Update error:", error);
      return NextResponse.json(
        { error: "Failed to update booking" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      booking: normalizeBooking(booking),
    });
  } catch (error) {
    console.error("[Trip Bookings API] Error:", error);
    return NextResponse.json(
      { error: "Failed to update booking" },
      { status: 500 },
    );
  }
}
