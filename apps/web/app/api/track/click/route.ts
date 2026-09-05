/**
 * Affiliate click tracking and redirect endpoint.
 *
 * POST returns a tracked partner URL for native clients. GET records the same
 * event and redirects browsers, which keeps new-tab navigation compatible
 * with popup blockers.
 */

import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  parseViatorAffiliateUrl,
  normalizeAffiliatePartner,
  type AffiliatePartnerKey,
} from "@faroway/constants";
import { optionalAuth } from "@/lib/auth";
import { checkRateLimitAsync, getClientIp } from "@/lib/security/rate-limit";
import { getSupabase } from "@/lib/supabase/server";

const PARTNER_DOMAINS: Partial<Record<AffiliatePartnerKey, readonly string[]>> =
  {
    viator: ["viator.com"],
    booking: ["booking.com"],
    getyourguide: ["getyourguide.com"],
    tripadvisor: ["tripadvisor.com"],
    discovercars: ["discovercars.com"],
    hostelworld: ["hostelworld.com"],
    duffel: ["duffel.com"],
    opentable: ["opentable.com"],
  } as const;

const ClickTrackingSchema = z
  .object({
    itemType: z.enum([
      "hotel",
      "activity",
      "restaurant",
      "flight",
      "transport",
    ]),
    itemId: z.string().min(1).max(500),
    itemName: z.string().min(1).max(500),
    affiliatePartner: z.string().min(1).max(50),
    affiliateUrl: z.string().url().max(2000),
    searchId: z.string().uuid().optional(),
    tripId: z.string().uuid().optional(),
    price: z.number().finite().nonnegative().optional(),
    currency: z.string().min(1).max(10).optional(),
    source: z
      .enum(["search_results", "trip_view", "itinerary", "email"])
      .optional(),
  })
  .strict();

type ClickTrackingInput = z.infer<typeof ClickTrackingSchema>;

function hostnameMatches(hostname: string, domain: string): boolean {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function isAllowedAffiliateUrl(url: string, partner: string): boolean {
  try {
    const parsed = new URL(url);
    const normalizedPartner = normalizeAffiliatePartner(partner);
    if (parsed.protocol !== "https:" || !normalizedPartner) return false;
    if (normalizedPartner === "viator") {
      return (
        parseViatorAffiliateUrl(url, process.env.VIATOR_PARTNER_ID) !== null
      );
    }

    return (
      PARTNER_DOMAINS[normalizedPartner]?.some((domain) =>
        hostnameMatches(parsed.hostname, domain),
      ) ?? false
    );
  } catch {
    return false;
  }
}

export function buildTrackedAffiliateUrl(
  affiliateUrl: string,
  clickId: string,
  partner: string,
  itemType: ClickTrackingInput["itemType"],
): string {
  const url = new URL(affiliateUrl);
  url.searchParams.set("utm_source", "faroway");
  url.searchParams.set("utm_medium", "affiliate");
  url.searchParams.set("utm_campaign", itemType);
  url.searchParams.set("click_id", clickId);

  // mcid belongs to Viator. campaign is the affiliate-defined correlation field.
  // Newly generated click IDs use only campaign-safe characters.
  if (normalizeAffiliatePartner(partner) === "viator") {
    url.searchParams.set("campaign", clickId);
  }

  return url.toString();
}

function inputFromSearchParams(searchParams: URLSearchParams): unknown {
  const price = searchParams.get("price");

  return {
    itemType: searchParams.get("itemType"),
    itemId: searchParams.get("itemId"),
    itemName: searchParams.get("itemName"),
    affiliatePartner: searchParams.get("affiliatePartner"),
    affiliateUrl: searchParams.get("affiliateUrl"),
    searchId: searchParams.get("searchId") || undefined,
    tripId: searchParams.get("tripId") || undefined,
    price: price === null ? undefined : Number(price),
    currency: searchParams.get("currency") || undefined,
    source: searchParams.get("source") || undefined,
  };
}

async function parseJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function checkClickRateLimit(request: NextRequest): Promise<boolean> {
  const ip = getClientIp(request);
  const result = await checkRateLimitAsync(`affiliate-click:${ip}`, {
    maxRequests: 30,
    windowMs: 60_000,
    failClosed: true,
  });
  return result.allowed;
}

async function recordClick(
  request: NextRequest,
  data: ClickTrackingInput,
): Promise<{ clickId: string; redirectUrl: string; tracked: boolean }> {
  const user = await optionalAuth(request);
  const db = getSupabase();
  const [tripId, searchId] = await Promise.all([
    resolveOwnedContextId(db, "trips", data.tripId, user?.id),
    resolveOwnedContextId(db, "searches", data.searchId, user?.id),
  ]);
  const clickId = `click-${randomUUID()}`;
  const redirectUrl = buildTrackedAffiliateUrl(
    data.affiliateUrl,
    clickId,
    data.affiliatePartner,
    data.itemType,
  );

  const { error } = await db.from("affiliate_clicks").insert({
    id: clickId,
    user_id: user?.id || null,
    item_type: data.itemType,
    item_id: data.itemId,
    item_name: data.itemName,
    affiliate_partner: normalizeAffiliatePartner(data.affiliatePartner),
    affiliate_url: data.affiliateUrl,
    search_id: searchId,
    trip_id: tripId,
    price: data.price ?? null,
    currency: data.currency || "USD",
    source: data.source || "search_results",
    clicked_at: new Date().toISOString(),
    converted: false,
    conversion_value: null,
  });

  if (error) {
    console.error("[Click Tracking] Database error:", error);
  }

  return { clickId, redirectUrl, tracked: !error };
}

async function resolveOwnedContextId(
  db: ReturnType<typeof getSupabase>,
  table: "trips" | "searches",
  id: string | undefined,
  userId: string | undefined,
): Promise<string | null> {
  if (!id || !userId) return null;

  const { data, error } = await db
    .from(table)
    .select("id")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  return !error && data?.id === id ? id : null;
}

function validateInput(input: unknown) {
  const result = ClickTrackingSchema.safeParse(input);
  if (!result.success) return result;

  if (
    !isAllowedAffiliateUrl(
      result.data.affiliateUrl,
      result.data.affiliatePartner,
    )
  ) {
    return {
      success: false as const,
      error: new z.ZodError([
        {
          code: "custom",
          path: ["affiliateUrl"],
          message: "Affiliate URL does not match the selected partner",
        },
      ]),
    };
  }

  return result;
}

export async function POST(request: NextRequest) {
  if (!(await checkClickRateLimit(request))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const input = await parseJsonBody(request);
  if (input === null) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const result = validateInput(input);
  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(await recordClick(request, result.data));
  } catch (error) {
    console.error("[Click Tracking] Error:", error);
    return NextResponse.json(
      { error: "Failed to track click" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  if (!(await checkClickRateLimit(request))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const result = validateInput(
    inputFromSearchParams(request.nextUrl.searchParams),
  );
  if (!result.success) {
    return NextResponse.json(
      { error: "Invalid affiliate link" },
      { status: 400 },
    );
  }

  try {
    const click = await recordClick(request, result.data);
    return NextResponse.redirect(click.redirectUrl, {
      status: 307,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("[Click Tracking] Redirect error:", error);
    return NextResponse.redirect(result.data.affiliateUrl, {
      status: 307,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
