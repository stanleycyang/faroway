import { differenceInCalendarDays } from "date-fns";
import { parseTripDate } from "@/lib/trips/date-duration";
import Link from "next/link";
import Image from "next/image";
import { IMAGE_PATHS, getImageUrl } from "@faroway/constants";

export type TripStatus = "draft" | "generating" | "complete";

/**
 * Backend trip statuses span more values than the dashboard's three display
 * buckets understand (draft / generating / complete). This collapses every
 * known lifecycle status onto one of those buckets so the card never crashes
 * on a status it hasn't seen — and canonicalizes legacy spellings on the way
 * through ("complete" → "completed", "cancelled" → "canceled").
 *
 * Returns the canonicalized status string (used by callers that just need a
 * non-empty label); use {@link toDashboardTripStatus} when you need a value
 * keyed into `statusConfig` directly.
 */
export function normalizeDashboardTripStatus(status: string): string {
  switch (status) {
    case "complete":
      return "completed";
    case "cancelled":
      return "canceled";
    default:
      return status;
  }
}

/**
 * Map any backend lifecycle status onto one of the card's three display
 * buckets. Anything we don't recognize falls back to "complete" — which is
 * also the implicit pre-PR default, so this is the most conservative choice.
 */
function toDashboardTripStatus(status: string | undefined): TripStatus {
  switch (normalizeDashboardTripStatus(status ?? "")) {
    case "draft":
    case "planning":
      return "draft";
    case "generating":
    case "pending":
      return "generating";
    case "generated":
    case "planned":
    case "active":
    case "in_progress":
    case "booked":
    case "paid":
    case "completed":
    case "canceled":
    case "failed":
      return "complete";
    default:
      return "complete";
  }
}

export interface Trip {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  travelers: number;
  status?: TripStatus;
  thumbnail_url?: string;
  created_at?: string;
}

interface TripCardProps {
  trip: Trip;
}

const statusConfig: Record<
  TripStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  draft: {
    label: "Draft",
    color: "text-yellow-700",
    bg: "bg-yellow-100",
    icon: "📝",
  },
  generating: {
    label: "Generating",
    color: "text-blue-700",
    bg: "bg-blue-100",
    icon: "⏳",
  },
  complete: {
    label: "Complete",
    color: "text-green-700",
    bg: "bg-green-100",
    icon: "✅",
  },
};

function formatDateRange(startDate: string, endDate: string): string {
  const start = parseTripDate(startDate);
  const end = parseTripDate(endDate);

  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };

  const startStr = start.toLocaleDateString("en-US", options);
  const endStr = end.toLocaleDateString("en-US", {
    ...options,
    year: "numeric",
  });

  // If same year, show year only at the end
  if (start.getFullYear() === end.getFullYear()) {
    return `${startStr} - ${endStr}`;
  }

  return `${start.toLocaleDateString("en-US", { ...options, year: "numeric" })} - ${endStr}`;
}

function getDaysUntil(startDate: string): {
  text: string;
  isUpcoming: boolean;
  isPast: boolean;
} {
  const now = new Date();
  const start = parseTripDate(startDate);
  const diffDays = differenceInCalendarDays(start, now);

  if (diffDays < 0) {
    return { text: "Past trip", isUpcoming: false, isPast: true };
  } else if (diffDays === 0) {
    return { text: "Today!", isUpcoming: true, isPast: false };
  } else if (diffDays === 1) {
    return { text: "Tomorrow", isUpcoming: true, isPast: false };
  } else if (diffDays <= 7) {
    return { text: `In ${diffDays} days`, isUpcoming: true, isPast: false };
  } else if (diffDays <= 30) {
    const weeks = Math.floor(diffDays / 7);
    return {
      text: `In ${weeks} week${weeks > 1 ? "s" : ""}`,
      isUpcoming: true,
      isPast: false,
    };
  }

  return { text: `In ${diffDays} days`, isUpcoming: true, isPast: false };
}

export function TripCard({ trip }: TripCardProps) {
  const status = toDashboardTripStatus(trip.status);
  const statusInfo = statusConfig[status];
  const daysInfo = getDaysUntil(trip.start_date);

  // Default placeholder images based on destination
  const placeholderImages = [
    getImageUrl(IMAGE_PATHS.placeholders.paris),
    getImageUrl(IMAGE_PATHS.placeholders.tokyo),
    getImageUrl(IMAGE_PATHS.placeholders.nyc),
    getImageUrl(IMAGE_PATHS.placeholders.italy),
  ];

  const imageIndex = trip.destination.length % placeholderImages.length;
  const thumbnailUrl = trip.thumbnail_url || placeholderImages[imageIndex];

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all overflow-hidden flex flex-col"
    >
      {/* Thumbnail */}
      <div className="relative h-40 sm:h-48 overflow-hidden bg-gray-100">
        <Image
          src={thumbnailUrl}
          alt={trip.destination}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />

        {/* Status Badge */}
        <div
          className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color} flex items-center gap-1`}
        >
          <span>{statusInfo.icon}</span>
          {statusInfo.label}
        </div>

        {/* Days until badge */}
        {!daysInfo.isPast && (
          <div className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-medium bg-white/90 text-gray-700 backdrop-blur-sm">
            {daysInfo.text}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-semibold text-gray-900 text-lg group-hover:text-primary transition-colors">
          {trip.destination}
        </h3>

        <p className="text-sm text-gray-600 mt-1">
          {formatDateRange(trip.start_date, trip.end_date)}
        </p>

        <div className="mt-auto pt-4 flex items-center justify-between text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <span>👥</span>
            {trip.travelers} traveler{trip.travelers > 1 ? "s" : ""}
          </span>

          <span className="text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
            View details →
          </span>
        </div>
      </div>
    </Link>
  );
}
