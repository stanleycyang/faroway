import { differenceInCalendarDays } from "date-fns";
import { parseTripDate } from "@/lib/trips/date-duration";
import Link from "next/link";
import { Compass, Users, ArrowUpRight } from "lucide-react";
import { TripCoverImage } from "../trips/TripCoverImage";
import { destinationImage } from "@/lib/trips/destination-image";

export type TripStatus =
  | "draft"
  | "generating"
  | "complete"
  | "failed"
  | "canceled";

/** Canonicalize legacy lifecycle spellings before choosing a truthful label. */
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

export function toDashboardTripStatus(status: string | undefined): TripStatus {
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
      return "complete";
    case "canceled":
      return "canceled";
    case "failed":
      return "failed";
    default:
      return "draft";
  }
}

export interface Trip {
  id: string;
  destination: string;
  start_date: string;
  end_date: string;
  travelers: number;
  status?: string;
  thumbnail_url?: string;
  created_at?: string;
}

interface TripCardProps {
  trip: Trip;
}

const statusConfig: Record<
  TripStatus,
  { label: string; color: string; bg: string }
> = {
  draft: {
    label: "Draft",
    color: "text-yellow-700",
    bg: "bg-yellow-100",
  },
  generating: {
    label: "Planning",
    color: "text-blue-700",
    bg: "bg-blue-100",
  },
  complete: {
    label: "Plan ready",
    color: "text-green-700",
    bg: "bg-green-100",
  },
  failed: {
    label: "Planning interrupted",
    color: "text-amber-900",
    bg: "bg-amber-50",
  },
  canceled: { label: "Canceled", color: "text-slate-700", bg: "bg-slate-100" },
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

  const thumbnailUrl = trip.thumbnail_url || destinationImage(trip.destination);

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-lg transition-all overflow-hidden flex flex-col"
    >
      {/* Thumbnail */}
      <div className="relative h-40 sm:h-48 overflow-hidden bg-gray-100">
        <Compass
          className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 text-slate-300"
          aria-hidden="true"
        />
        {thumbnailUrl && (
          <TripCoverImage src={thumbnailUrl} className="object-cover" />
        )}

        {/* Status Badge */}
        <div
          className={`absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color} flex items-center gap-1`}
        >
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
        <h3 className="font-editorial text-slate-900 text-2xl">
          {trip.destination}
        </h3>

        <p className="text-sm text-gray-600 mt-1">
          {formatDateRange(trip.start_date, trip.end_date)}
        </p>

        <div className="mt-auto pt-4 flex items-center justify-between text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Users className="h-4 w-4" aria-hidden="true" />
            {trip.travelers} traveler{trip.travelers > 1 ? "s" : ""}
          </span>

          <span className="inline-flex items-center gap-1 text-slate-700 font-medium">
            Open trip <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </div>
      </div>
    </Link>
  );
}
