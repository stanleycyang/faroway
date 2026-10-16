import { getTripDuration, parseTripDate } from "@/lib/trips/date-duration";
import { createSocialImage } from "@/lib/social-image";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "Trip Itinerary - Faroway";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  // Fetch trip data
  let destination = "Your Trip";
  let dates = "";
  let travelers = 2;
  let duration = "";

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const trip = user
      ? (
          await supabase
            .from("trips")
            .select("destination, start_date, end_date, travelers")
            .eq("id", id)
            .eq("user_id", user.id)
            .single()
        ).data
      : null;

    if (trip) {
      destination = trip.destination;
      travelers = trip.travelers || 2;

      if (trip.start_date && trip.end_date) {
        const start = parseTripDate(trip.start_date);
        const end = parseTripDate(trip.end_date);
        const days = getTripDuration(start, end);
        if (days !== null) {
          duration = `${days} days`;
          dates = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
        }
      }
    }
  } catch {
    // Use defaults if fetch fails
  }

  const image = await createSocialImage(
    destination === "Your Trip"
      ? "A journey, shaped around you."
      : `${destination}. Your journey.`,
    destination === "Your Trip"
      ? null
      : [duration, dates, `${travelers} traveler${travelers === 1 ? "" : "s"}`]
          .filter(Boolean)
          .join(" · "),
  );
  image.headers.set("Cache-Control", "private, no-store, max-age=0");
  return image;
}
