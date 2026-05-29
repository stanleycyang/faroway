import { Metadata } from "next";
import { getSupabase } from "@/lib/supabase/server";

interface SharedTripLayoutProps {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}

interface TripData {
  destination: string;
  start_date: string | null;
  end_date: string | null;
  travelers: number | null;
}

async function getTrip(token: string): Promise<TripData | null> {
  try {
    const supabase = getSupabase();
    const { data: trip } = await supabase
      .from("trips")
      .select("destination, start_date, end_date, travelers")
      .eq("share_token", token)
      .eq("is_shared", true)
      .single();
    return trip;
  } catch {
    return null;
  }
}

function buildTripMeta(trip: TripData) {
  const destination = trip.destination;
  const startDate = trip.start_date ? new Date(trip.start_date) : null;
  const endDate = trip.end_date ? new Date(trip.end_date) : null;
  const travelers = trip.travelers || 2;

  let duration = "";
  let dateRange = "";

  if (startDate && endDate) {
    const days =
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1;
    duration = `${days}-day`;
    dateRange = `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }

  const title = `${duration} ${destination} Trip Itinerary`;
  const description = `Explore this ${duration ? duration + " " : ""}AI-generated itinerary to ${destination}${dateRange ? ` (${dateRange})` : ""}. Created with Faroway for ${travelers} traveler${travelers > 1 ? "s" : ""}.`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "TravelAction",
    name: title,
    description,
    toLocation: {
      "@type": "Place",
      name: destination,
    },
    ...(startDate && { startTime: startDate.toISOString() }),
    ...(endDate && { endTime: endDate.toISOString() }),
  };

  return { title, description, jsonLd };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.faroway.ai";

  const trip = await getTrip(token);

  if (!trip) {
    return {
      title: "Shared Trip Itinerary | Faroway",
      description: "View this AI-generated travel itinerary on Faroway",
      openGraph: {
        title: "Shared Trip Itinerary | Faroway",
        description: "View this AI-generated travel itinerary",
        type: "article",
        url: `${baseUrl}/s/${token}`,
      },
      twitter: {
        card: "summary_large_image",
        title: "Shared Trip Itinerary | Faroway",
        description: "View this AI-generated travel itinerary",
      },
      robots: { index: false, follow: true },
    };
  }

  const { title, description } = buildTripMeta(trip);

  return {
    title,
    description,
    openGraph: {
      title: `${title} | Faroway`,
      description,
      type: "article",
      url: `${baseUrl}/s/${token}`,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Faroway`,
      description,
    },
    alternates: {
      canonical: `${baseUrl}/s/${token}`,
    },
    robots: { index: false, follow: true },
  };
}

export default async function SharedTripLayout({
  children,
  params,
}: SharedTripLayoutProps) {
  const { token } = await params;
  const trip = await getTrip(token);

  return (
    <>
      {trip && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(buildTripMeta(trip).jsonLd).replace(
              /</g,
              "\\u003c",
            ),
          }}
        />
      )}
      {children}
    </>
  );
}
