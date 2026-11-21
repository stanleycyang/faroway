/**
 * Affiliate Click Tracking API
 * POST /api/track/click - Track when user clicks an affiliate link
 */

import { randomUUID } from "node:crypto";
import { affiliateClickInsert } from "@/lib/affiliates/click-record";
import { readPrice } from "@faroway/constants";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { optionalAuth } from "@/lib/auth";
import { checkRateLimitAsync, getClientIp } from "@/lib/security/rate-limit";
import { z } from "zod";

// Allowed affiliate domains — prevents SSRF via user-supplied URLs
const ALLOWED_AFFILIATE_DOMAINS = [
  "viator.com",
  "www.viator.com",
  "getyourguide.com",
  "www.getyourguide.com",
  "tripadvisor.com",
  "www.tripadvisor.com",
  "discovercars.com",
  "www.discovercars.com",
  "hostelworld.com",
  "www.hostelworld.com",
  "duffel.com",
  "www.duffel.com",
  "book.duffel.com",
  "links.duffel.com",
  "opentable.com",
  "www.opentable.com",
];

function isAllowedAffiliateUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) {
      return false;
    }
    return ALLOWED_AFFILIATE_DOMAINS.some(
      (d) => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`),
    );
  } catch {
    return false;
  }
}

const ClickTrackingSchema = z.object({
  clickId: z.string().max(200).optional(),

  // What was clicked
  itemType: z.enum(["hotel", "activity", "restaurant", "flight", "transport"]),
  itemId: z.string().max(500),
  itemName: z.string().max(500),

  // Affiliate info
  affiliatePartner: z.string().max(50),
  affiliateUrl: z.string().url().max(2000),

  // Context
  searchId: z.string().uuid().optional(),
  tripId: z.string().uuid().optional(),

  // Pricing
  price: z.number().nonnegative().optional(),
  currency: z.string().max(10).optional(),

  // Source
  source: z
    .enum(["search_results", "trip_view", "itinerary", "email"])
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimitAsync(`affiliate-click:${ip}`, {
      maxRequests: 30,
      windowMs: 60_000,
      failClosed: true,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parseResult = ClickTrackingSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    const data = parseResult.data;

    // This namespace is reserved for server-verified, owned-trip handoffs.
    // The public analytics endpoint must not be able to forge that ledger.
    if (data.clickId?.startsWith("checkout-")) {
      return NextResponse.json({ error: "Reserved click ID" }, { status: 400 });
    }

    // Validate affiliate URL domain to prevent SSRF
    if (!isAllowedAffiliateUrl(data.affiliateUrl)) {
      return NextResponse.json(
        { error: "Invalid affiliate URL" },
        { status: 400 },
      );
    }

    const user = await optionalAuth(request);
    const db = getSupabase();

    // Only associate a click with a trip or search owned by the authenticated user.
    let verifiedTripId: string | null = null;
    let verifiedSearchId: string | null = null;
    if (user) {
      if (data.tripId) {
        const { data: ownedTrip } = await db
          .from("trips")
          .select("id")
          .eq("id", data.tripId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (ownedTrip?.id === data.tripId) {
          verifiedTripId = data.tripId;
        }
      }
      if (data.searchId) {
        const { data: ownedSearch } = await db
          .from("searches")
          .select("id")
          .eq("id", data.searchId)
          .eq("user_id", user.id)
          .maybeSingle();
        if (ownedSearch?.id === data.searchId) {
          verifiedSearchId = data.searchId;
        }
      }
    }

    // Generate a unique click ID for conversion tracking
    const clickId = data.clickId || `click_${randomUUID()}`;

    // Store only a complete price/currency pair.
    const price = readPrice(data.price, data.currency);
    const clickedAt = new Date().toISOString();
    const { error } = await db.from("affiliate_clicks").insert(
      affiliateClickInsert({
        clickId,
        userId: user?.id || null,
        itemType: data.itemType,
        itemId: data.itemId,
        itemName: data.itemName,
        affiliatePartner: data.affiliatePartner,
        affiliateUrl: data.affiliateUrl,
        searchId: verifiedSearchId,
        tripId: verifiedTripId,
        price: price?.amount ?? null,
        currency: price?.currency ?? null,
        source: data.source || "search_results",
        clickedAt,
      }),
    );

    if (error) {
      console.error("[Click Tracking] Database error:", error);
      // Don't fail the request, just log it
    }

    // Return the click ID and redirect URL with tracking params
    const trackingUrl = new URL(data.affiliateUrl);
    trackingUrl.searchParams.set("utm_source", "faroway");
    trackingUrl.searchParams.set("utm_medium", "affiliate");
    trackingUrl.searchParams.set("utm_campaign", data.itemType);
    trackingUrl.searchParams.set("click_id", clickId);

    return NextResponse.json({
      clickId,
      redirectUrl: trackingUrl.toString(),
    });
  } catch (error) {
    console.error("[Click Tracking] Error:", error);
    return NextResponse.json(
      { error: "Failed to track click" },
      { status: 500 },
    );
  }
}
