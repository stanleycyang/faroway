import "server-only";
import type { createClient } from "@/lib/supabase/server";
import type { Trip } from "@/components/dashboard/TripCard";
import type { SortType } from "@/components/dashboard/TripFilters";
import { readTripCursor, writeTripCursor, TRIP_PAGE_SIZE } from "./list-cursor";

/** Stable creation-order reads avoid the database's single-response row cap. */
export async function loadDashboardTrips(
  db: Awaited<ReturnType<typeof createClient>>,
  ownerId: string,
  sort: SortType,
) {
  try {
    const trips: Trip[] = [];
    const seen = new Set<string>();
    let cursor: ReturnType<typeof readTripCursor> = null;
    for (;;) {
      let query = db
        .from("trips")
        .select("*")
        .eq("user_id", ownerId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(TRIP_PAGE_SIZE);
      if (cursor)
        query = query.or(
          `created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
        );
      const { data, error } = await query;
      if (error) throw error;
      if (!Array.isArray(data)) throw new Error("Unreadable trip list");
      const page = data as Trip[];
      for (const trip of page) {
        if (!trip?.id || seen.has(trip.id))
          throw new Error("Repeated trip page");
        seen.add(trip.id);
        trips.push(trip);
      }
      if (page.length < TRIP_PAGE_SIZE) break;
      const last = page[page.length - 1];
      if (typeof last.created_at !== "string")
        throw new Error("Unreadable trip cursor");
      cursor = readTripCursor(
        writeTripCursor({ id: last.id, created_at: last.created_at }),
      );
    }
    trips.sort((a, b) => {
      const field = sort === "created" ? "created_at" : "start_date";
      const primary = (a[field] || "").localeCompare(b[field] || "");
      return (
        (sort === "date-asc" ? primary : -primary) || b.id.localeCompare(a.id)
      );
    });
    return { data: trips, error: null };
  } catch {
    // Never label an incomplete result as the full account or replace it with empty.
    return {
      data: null,
      error: { message: "Saved trips could not be read completely" },
    };
  }
}
