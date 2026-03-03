/**
 * Affiliate Click Tracking API
 *
 * POST /api/affiliate/click
 * Records a click and returns a redirect URL with tracking params
 */

import { NextRequest, NextResponse } from "next/server";
import {
  trackClick,
  generateViatorAffiliateUrl,
  generateBookingAffiliateUrl,
  generateGYGAffiliateUrl,
  type AffiliatePartner,
} from "@/lib/affiliates";
import { optionalAuth } from "@/lib/auth/middleware";
import { checkRateLimit, getClientIp } from "@/lib/security/rate-limit";
import { getSupabase } from "@/lib/supabase/server";
import type { TripBookingCategory } from "@faroway/types";

interface ClickRequest {
  tripId?: string;
  activityId?: string;
  partner: AffiliatePartner;
  productId: string;
  productName: string;
  // Optional booking context
  date?: string;
  travelers?: number;
  checkIn?: string;
  checkOut?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limit: 10 req/min per IP
    const ip = getClientIp(request);
    const rl = checkRateLimit(`affiliate-click:${ip}`, {
      maxRequests: 10,
      windowMs: 60_000,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body: ClickRequest = await request.json();

    // Validate required fields
    if (!body.partner || !body.productId || !body.productName) {
      return NextResponse.json(
        { error: "Missing required fields: partner, productId, productName" },
        { status: 400 },
      );
    }

    // Validate partner
    const validPartners: AffiliatePartner[] = [
      "viator",
      "booking",
      "getyourguide",
      "tripadvisor",
      "discovercars",
      "hostelworld",
      "duffel",
    ];
    if (!validPartners.includes(body.partner)) {
      return NextResponse.json(
        {
          error: `Invalid partner. Must be one of: ${validPartners.join(", ")}`,
        },
        { status: 400 },
      );
    }

    // Extract user ID from auth token (not spoofable header)
    const authUser = await optionalAuth(request);
    const userId = authUser?.id;
    const ipAddress = ip;
    const userAgent = request.headers.get("user-agent") || undefined;
    const referrerUrl = request.headers.get("referer") || undefined;

    // Track the click
    const { trackingId, click } = await trackClick({
      userId,
      tripId: body.tripId,
      activityId: body.activityId,
      partner: body.partner,
      productId: body.productId,
      productName: body.productName,
      referrerUrl,
      ipAddress,
      userAgent,
    });

    // Generate affiliate URL based on partner
    let redirectUrl: string;

    switch (body.partner) {
      case "viator":
        redirectUrl = generateViatorAffiliateUrl(body.productId, trackingId, {
          date: body.date,
          travelers: body.travelers,
        });
        break;

      case "booking":
        redirectUrl = generateBookingAffiliateUrl(body.productId, trackingId, {
          checkIn: body.checkIn,
          checkOut: body.checkOut,
          guests: body.travelers,
        });
        break;

      case "getyourguide":
        redirectUrl = generateGYGAffiliateUrl(body.productId, trackingId, {
          date: body.date,
        });
        break;

      case "tripadvisor":
        // TripAdvisor URL format
        redirectUrl = `https://www.tripadvisor.com/${body.productId}?m=faroway&mcid=${trackingId}`;
        break;

      default:
        return NextResponse.json(
          { error: "Partner not supported for redirect generation" },
          { status: 400 },
        );
    }

    // Create a pending trip_booking for bookable partners
    let bookingId: string | undefined;
    const bookablePartnerCategory: Record<string, TripBookingCategory> = {
      viator: "activity",
      getyourguide: "activity",
      duffel: "flight",
    };
    const bookingCategory = bookablePartnerCategory[body.partner];

    if (bookingCategory && userId && body.tripId) {
      try {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        const { data: booking } = await getSupabase()
          .from("trip_bookings")
          .insert({
            user_id: userId,
            trip_id: body.tripId,
            click_id: click.id,
            category: bookingCategory,
            item_name: body.productName,
            item_id: body.productId,
            partner: body.partner,
            partner_manage_url: redirectUrl,
            check_in: body.checkIn || null,
            check_out: body.checkOut || null,
            start_time: body.date ? new Date(body.date).toISOString() : null,
            price: null,
            currency: "USD",
            status: "pending",
            expires_at: expiresAt.toISOString(),
          })
          .select("id")
          .single();

        bookingId = booking?.id;
      } catch (bookingError) {
        // Non-blocking: click tracking succeeded, booking creation is best-effort
        console.error("[Affiliate Click API] Failed to create trip booking:", bookingError);
      }
    }

    return NextResponse.json({
      success: true,
      trackingId,
      redirectUrl,
      bookingId,
      click: {
        id: click.id,
        partner: click.partner,
        productId: click.productId,
        clickedAt: click.clickedAt,
      },
    });
  } catch (error) {
    console.error("[Affiliate Click API] Error:", error);

    return NextResponse.json(
      { error: "Failed to track affiliate click" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/affiliate/click?trackingId=xxx
 * Get click details by tracking ID (requires authentication)
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication to prevent data leakage
    const authUser = await optionalAuth(request);
    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const trackingId = searchParams.get("trackingId");

    if (!trackingId || !/^[a-zA-Z0-9_-]+$/.test(trackingId)) {
      return NextResponse.json(
        { error: "Missing or invalid trackingId parameter" },
        { status: 400 },
      );
    }

    const { getClickByTrackingId } = await import("@/lib/affiliates");
    const click = await getClickByTrackingId(trackingId);

    if (!click) {
      return NextResponse.json({ error: "Click not found" }, { status: 404 });
    }

    // Only return click data if the requesting user owns it
    if (click.userId && click.userId !== authUser.id) {
      return NextResponse.json({ error: "Click not found" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      click,
    });
  } catch (error) {
    console.error("[Affiliate Click API] Error:", error);

    return NextResponse.json(
      { error: "Failed to get click details" },
      { status: 500 },
    );
  }
}
