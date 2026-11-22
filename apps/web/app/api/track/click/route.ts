/**
 * Affiliate Click Tracking API
 * POST /api/track/click - Track when user clicks an affiliate link
 */

import crypto from "node:crypto";
import { affiliateClickInsert } from "@/lib/affiliates/click-record";
import {
  injectAffiliateSubId,
  isAllowedAffiliateUrl,
  normalizeAffiliatePartner,
  readPrice,
  resolveAffiliatePartnerByUrl,
} from "@faroway/constants";
import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase/server";
import { optionalAuth } from "@/lib/auth";
import { checkRateLimitAsync, getClientIp } from "@/lib/security/rate-limit";
import { z } from "zod";

const ClickTrackingSchema = z.object({
  clickId: z.string().trim().min(1).max(200).optional(),

  // What was clicked
  itemType: z.enum(["hotel", "activity", "restaurant", "flight", "transport"]),
  itemId: z.string().trim().min(1).max(500),
  itemName: z.string().trim().min(1).max(500),

  // Affiliate info
  affiliatePartner: z.string().trim().min(1).max(50),
  affiliateUrl: z.string().url().max(2000),

  // Context
  searchId: z.string().uuid().optional(),
  tripId: z.string().uuid().optional(),

  // Pricing
  price: z.number().finite().nonnegative().optional(),
  currency: z.string().max(10).optional(),

  // Source & attribution metadata
  source: z
    .enum([
      "search_results",
      "trip_view",
      "itinerary",
      "email",
      "shared_trip",
      "blog",
      "destination_guide",
      "tool",
      "booking_checklist",
      "on_trip",
    ])
    .optional(),
  placement: z.string().max(100).optional(),
  campaign: z.string().max(200).optional(),
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

    // Validate affiliate URL domain to prevent SSRF, credentials, non-HTTPS, and ports
    if (!isAllowedAffiliateUrl(data.affiliateUrl)) {
      return NextResponse.json(
        { error: "Invalid affiliate URL" },
        { status: 400 },
      );
    }

    const urlPartner = resolveAffiliatePartnerByUrl(data.affiliateUrl);
    const normalizedInputPartner = normalizeAffiliatePartner(
      data.affiliatePartner,
    );
    if (!urlPartner || !normalizedInputPartner) {
      return NextResponse.json(
        { error: "Invalid affiliate partner" },
        { status: 400 },
      );
    }

    // Host partner takes canonical precedence (e.g. Travelpayouts-wrapped links)
    const partner = urlPartner;

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
    const clickId = data.clickId || crypto.randomUUID();

    // Inject partner-native subID without clobbering preserved partner params
    const trackingUrl = injectAffiliateSubId(
      data.affiliateUrl,
      partner,
      clickId,
      { itemType: data.itemType },
    );
    if (!trackingUrl) {
      return NextResponse.json(
        { error: "Invalid affiliate URL" },
        { status: 400 },
      );
    }

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
        affiliatePartner: partner,
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

    return NextResponse.json({
      clickId,
      partner,
      trackingUrl,
      redirectUrl: trackingUrl,
    });
  } catch (error) {
    console.error("[Click Tracking] Error:", error);
    return NextResponse.json(
      { error: "Failed to track click" },
      { status: 500 },
    );
  }
}
