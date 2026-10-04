import "server-only";
import { getSupabase } from "@/lib/supabase/server";
import { sendItineraryReadyPush } from "./expo";

/** At-most-once dispatch attempt per completed generation. An unknown Expo
 * outcome is never automatically resent: a push is optional, not a booking.
 * Claiming before I/O can miss a notification after a crash; the saved trip and
 * in-app notification remain the source of truth. Tickets are not delivery proof.
 */
export async function dispatchItineraryReady(tripId: string, searchId: string) {
  if (
    process.env.PUSH_DELIVERY_ENABLED !== "true" ||
    process.env.PUSH_CONSENT_V2_ENABLED !== "true"
  )
    return "disabled";
  const db = getSupabase();
  try {
    const claim = await db.rpc("claim_itinerary_push", {
      p_trip_id: tripId,
      p_search_id: searchId,
    });
    if (claim.error) return "unavailable";
    if (!claim.data) return "skipped";
    const { userId, itineraryId } = claim.data as {
      userId: string;
      itineraryId: string;
    };
    // Recheck the live trip after the durable claim; stale/replaced/deleted plans
    // and newly opted-out accounts must not use the earlier snapshot.
    const current = await db
      .from("trips")
      .select("id")
      .eq("id", tripId)
      .eq("search_id", searchId)
      .eq("user_id", userId)
      .eq("status", "planned")
      .eq("itinerary_id", itineraryId)
      .maybeSingle();
    const deletion = await db
      .from("account_deletion_receipts")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    let outcome = "skipped";
    if (!current.error && current.data && !deletion.error && !deletion.data) {
      const result = await sendItineraryReadyPush(db, {
        userId,
        tripId,
        itineraryId,
        destination: "",
      });
      outcome =
        result.sent > 0 ? "accepted" : result.failed > 0 ? "failed" : "skipped";
    }
    await db
      .from("itinerary_push_dispatches")
      .update({ outcome })
      .eq("trip_id", tripId)
      .eq("search_id", searchId);
    return outcome;
  } catch {
    return "unavailable";
  } // Notification failure must not fail planning.
}
