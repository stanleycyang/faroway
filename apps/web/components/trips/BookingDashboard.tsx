"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  CheckCircle,
  Clock,
  ExternalLink,
  Plane,
  MapPin,
  AlertCircle,
  Loader2,
} from "lucide-react";
import type { TripBooking, TripBookingStatus } from "@faroway/types";

interface BookingDashboardProps {
  tripId: string;
}

const partnerDisplayNames: Record<string, string> = {
  viator: "Viator",
  getyourguide: "GetYourGuide",
  duffel: "Duffel",
};

const statusConfig: Record<
  TripBookingStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  confirmed: {
    label: "Confirmed",
    icon: <CheckCircle className="w-4 h-4" />,
    className: "bg-green-50 text-green-700 ring-green-200",
  },
  user_confirmed: {
    label: "Confirmed",
    icon: <CheckCircle className="w-4 h-4" />,
    className: "bg-green-50 text-green-700 ring-green-200",
  },
  pending: {
    label: "Pending",
    icon: <Clock className="w-4 h-4" />,
    className: "bg-yellow-50 text-yellow-700 ring-yellow-200",
  },
  cancelled: {
    label: "Cancelled",
    icon: <AlertCircle className="w-4 h-4" />,
    className: "bg-red-50 text-red-700 ring-red-200",
  },
  expired: {
    label: "Expired",
    icon: <AlertCircle className="w-4 h-4" />,
    className: "bg-gray-50 text-gray-500 ring-gray-200",
  },
};

function CategoryIcon({ category }: { category: string }) {
  if (category === "flight") {
    return <Plane className="w-4 h-4 text-blue-500" />;
  }
  return <MapPin className="w-4 h-4 text-purple-500" />;
}

export function BookingDashboard({ tripId }: BookingDashboardProps) {
  const [bookings, setBookings] = useState<TripBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/bookings`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) {
        setBookings(data.bookings);
      }
    } catch {
      // Silently fail — dashboard is non-critical
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  // Re-fetch when tab becomes visible (return-from-OTA detection)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchBookings();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibility);
  }, [fetchBookings]);

  const handleUserConfirm = async (bookingId: string) => {
    setConfirmingId(bookingId);
    try {
      const res = await fetch(`/api/trips/${tripId}/bookings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookingId, status: "user_confirmed" }),
      });
      if (res.ok) {
        await fetchBookings();
      }
    } catch {
      // Silently fail
    } finally {
      setConfirmingId(null);
    }
  };

  // Don't render if no bookings
  if (loading) return null;
  if (bookings.length === 0) return null;

  const activeBookings = bookings.filter(
    (b) => b.status !== "expired" && b.status !== "cancelled",
  );
  if (activeBookings.length === 0) return null;

  const confirmedCount = activeBookings.filter(
    (b) => b.status === "confirmed" || b.status === "user_confirmed",
  ).length;

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-base">Your Bookings</h3>
          <span className="text-xs text-gray-500">
            {confirmedCount} of {activeBookings.length} confirmed
          </span>
        </div>
      </div>

      <div className="divide-y divide-gray-50">
        {activeBookings.map((booking) => {
          const status = statusConfig[booking.status];
          const partnerName =
            partnerDisplayNames[booking.partner] || booking.partner;
          const isConfirmed =
            booking.status === "confirmed" ||
            booking.status === "user_confirmed";
          const isPending = booking.status === "pending";

          return (
            <div
              key={booking.id}
              className="px-5 py-3.5 flex items-center gap-3"
            >
              <CategoryIcon category={booking.category} />

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {booking.itemName}
                </p>
                <p className="text-xs text-gray-500">
                  {isConfirmed
                    ? `Booked via ${partnerName}`
                    : `Pending on ${partnerName}`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ring-1 ${status.className}`}
                >
                  {status.icon}
                  {status.label}
                </span>

                {isConfirmed && booking.partnerManageUrl && (
                  <a
                    href={booking.partnerManageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                  >
                    Manage
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}

                {isPending && (
                  <button
                    onClick={() => handleUserConfirm(booking.id)}
                    disabled={confirmingId === booking.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                  >
                    {confirmingId === booking.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <CheckCircle className="w-3 h-3" />
                    )}
                    I booked this
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Support deflection footer */}
      <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
        <p className="text-[11px] text-gray-400">
          Bookings are managed by our partners. For changes or support, use the
          &ldquo;Manage&rdquo; link on each booking.
        </p>
      </div>
    </div>
  );
}
