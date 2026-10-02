import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserIdFromRequest } from "@/lib/auth/middleware";
import { loadTripForUserUncached } from "@/lib/trips/load-trip";
import { getSupabase } from "@/lib/supabase/server";
import { checkRateLimitAsync } from "@/lib/security/rate-limit";
import { getViatorProduct, isViatorConfigured } from "@/lib/affiliates/viator";
import { buildViatorHandoffUrl } from "@/lib/affiliates/viator-link";
import { isValidDateOnly } from "@/lib/api/date-range";

type Context = { params: Promise<{ id: string }> };
const Input = z
  .object({
    activityId: z
      .string()
      .regex(/^activity_v_[a-zA-Z0-9]+$/)
      .max(200),
    date: z.string().refine(isValidDateOnly),
    attemptId: z.string().uuid(),
  })
  .strict();

function enabled() {
  return (
    process.env.VIATOR_HOSTED_CHECKOUT_ENABLED === "true" &&
    process.env.VIATOR_SANDBOX !== "true" &&
    /^P\d+$/.test(process.env.VIATOR_PARTNER_ID || "") &&
    isViatorConfigured()
  );
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: NextRequest, context: Context) {
  try {
    const auth = await requireUserIdFromRequest(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await context.params;
    const trip = await loadTripForUserUncached(id, auth.userId);
    if (!trip) return json({ error: "Trip not found" }, 404);
    const { data, error } = await getSupabase()
      .from("affiliate_clicks")
      .select("id, item_id, item_name, clicked_at")
      .eq("trip_id", id)
      .eq("user_id", auth.userId)
      .eq("affiliate_partner", "viator")
      .like("id", "checkout-%")
      .order("clicked_at", { ascending: false })
      .limit(50);
    if (error)
      return json(
        { error: "Booking history is unavailable. Please try again." },
        503,
      );
    // A saved handoff is not evidence of a booking or a charge. Do not promote
    // clicks, client returns, or legacy conversion flags into booking state.
    return json({ enabled: enabled(), attempts: data || [] });
  } catch {
    return json({ error: "Booking history is temporarily unavailable." }, 503);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const auth = await requireUserIdFromRequest(request);
    if (auth instanceof NextResponse) return auth;
    const { id } = await context.params;
    if (!enabled())
      return json({ error: "Viator checkout is not available yet." }, 503);
    const limit = await checkRateLimitAsync(`checkout:${auth.userId}`, {
      maxRequests: 20,
      windowMs: 60_000,
      failClosed: true,
    });
    if (!limit.allowed)
      return json({ error: "Please wait before trying again." }, 429);
    const input = Input.safeParse(await request.json().catch(() => null));
    if (!input.success) return json({ error: "Invalid checkout request" }, 400);
    const { activityId, date, attemptId } = input.data;
    const loaded = await loadTripForUserUncached(id, auth.userId);
    if (!loaded) return json({ error: "Trip not found" }, 404);
    const day = loaded.itinerary?.days?.find((d) => d.date === date);
    const activity =
      day &&
      [day.morning, day.afternoon, day.evening]
        .flatMap((block) => block?.activities || [])
        .find((a) => a.id === activityId);
    if (!activity || activity.bookingInfo?.affiliateId !== "viator") {
      return json({ error: "This experience is no longer in your plan." }, 409);
    }
    if (date < new Date().toISOString().slice(0, 10)) {
      return json({ error: "Please choose a future travel date." }, 409);
    }
    const clickId = `checkout-${attemptId}`;
    const itemId = `${activityId}@${date}`;
    const db = getSupabase();
    const readExisting = () =>
      db
        .from("affiliate_clicks")
        .select("id, user_id, trip_id, item_id, affiliate_url")
        .eq("id", clickId)
        .maybeSingle();
    const responseForExisting = (row: {
      user_id: string;
      trip_id: string;
      item_id: string;
      affiliate_url: string;
    }) => {
      if (
        row.user_id !== auth.userId ||
        row.trip_id !== id ||
        row.item_id !== itemId
      ) {
        return json({ error: "Please restart this checkout step." }, 409);
      }
      const url = buildViatorHandoffUrl(
        row.affiliate_url,
        clickId,
        process.env.VIATOR_PARTNER_ID,
      );
      return url
        ? json({ redirectUrl: url, attemptId, status: "handoff_prepared" })
        : json(
            {
              error:
                "The provider link is unavailable. Please restart this step.",
            },
            503,
          );
    };
    const existing = await readExisting();
    if (existing.error)
      return json(
        { error: "Could not recover checkout. Please try again." },
        503,
      );
    if (existing.data) return responseForExisting(existing.data);

    // Resolve the canonical URL from the provider, never from user input or an
    // LLM. Product details are not a date-specific availability/price quote.
    const productCode = activityId.slice("activity_v_".length);
    const product = await getViatorProduct(productCode, clickId);
    const url =
      product?.productCode === productCode && product.productUrl
        ? buildViatorHandoffUrl(
            product.productUrl,
            clickId,
            process.env.VIATOR_PARTNER_ID,
          )
        : null;
    if (!url)
      return json(
        {
          error:
            "Viator could not verify this experience. Please try again later.",
        },
        503,
      );
    const { error } = await db.from("affiliate_clicks").insert({
      id: clickId,
      user_id: auth.userId,
      trip_id: id,
      item_id: itemId,
      item_type: "activity",
      item_name: product!.title,
      affiliate_partner: "viator",
      affiliate_url: url,
      source: "itinerary",
      converted: false,
      clicked_at: new Date().toISOString(),
    });
    if (error?.code === "23505") {
      const raced = await readExisting();
      if (!raced.error && raced.data) return responseForExisting(raced.data);
    }
    if (error)
      return json(
        { error: "Could not save this booking step. Please try again." },
        503,
      );
    return json({ redirectUrl: url, attemptId, status: "handoff_prepared" });
  } catch {
    return json(
      { error: "Checkout is temporarily unavailable. Please try again." },
      503,
    );
  }
}
