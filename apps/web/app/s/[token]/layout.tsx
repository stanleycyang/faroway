import { getTripDuration, parseTripDate } from "@/lib/trips/date-duration";
import { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  loadSharedTrip,
  type SharedTripData,
} from "@/lib/trips/load-shared-trip";

interface SharedTripLayoutProps {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}

function buildTripMeta(trip: SharedTripData) {
  const destination = trip.destination;
  const startDate = trip.start_date ? parseTripDate(trip.start_date) : null;
  const endDate = trip.end_date ? parseTripDate(trip.end_date) : null;
  const travelers = trip.travelers || 2;

  let duration = "";
  let dateRange = "";

  if (startDate && endDate && getTripDuration(startDate, endDate) !== null) {
    const days = getTripDuration(startDate, endDate);
    duration = `${days}-day`;
    dateRange = `${startDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${endDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
  }

  const title = `${duration} ${destination} Trip Itinerary`.trim();
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
    ...(startDate &&
      !Number.isNaN(startDate.getTime()) && { startTime: trip.start_date }),
    ...(endDate &&
      !Number.isNaN(endDate.getTime()) && { endTime: trip.end_date }),
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

  const trip = await loadSharedTrip(token);

  if (!trip) {
    return {
      title: "Shared Trip Itinerary",
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
  const trip = await loadSharedTrip(token);
  if (!trip) notFound();

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
