"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import Image from "next/image";
import {
  Loader2,
  AlertCircle,
  MapPin,
  RefreshCw,
  Sparkles,
  Clock,
  LogIn,
  Star,
  ExternalLink,
  Shield,
  ChevronUp,
  Ticket,
  Plane,
} from "lucide-react";

/**
 * Error boundary that prevents a single broken itinerary day from crashing the whole page.
 */
class DayErrorBoundary extends React.Component<
  { children: React.ReactNode; dayNumber: number },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; dayNumber: number }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.warn(
      `[TripDetail] Day ${this.props.dayNumber} failed to render:`,
      error.message,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-700">
          Day {this.props.dayNumber} could not be displayed.
        </div>
      );
    }
    return this.props.children;
  }
}
import { TripHeader } from "@/components/trips/TripHeader";
import { ItineraryDay } from "@/components/trips/ItineraryDay";
import { SkeletonItineraryDay } from "@/components/trips/SkeletonItineraryDay";
import { BookingDashboard } from "@/components/trips/BookingDashboard";
import { ShareButtons } from "@/components/ShareButtons";
import {
  useTripGeneration,
  type SearchProgress,
} from "@/hooks/useTripGeneration";
import type { GeneratedItinerary } from "@/lib/ai/types";
import type { TripDay } from "@faroway/types";

const ItineraryMap = dynamic(
  () =>
    import("@/components/trips/ItineraryMap").then((m) => ({
      default: m.ItineraryMap,
    })),
  { ssr: false },
);

interface Trip {
  id: string;
  user_id: string;
  destination: string;
  start_date: string;
  end_date: string;
  travelers: number;
  preferences?: Record<string, unknown>;
  vibes?: string[];
  status: "draft" | "generating" | "generated" | "completed" | "failed";
  search_id?: string;
  created_at: string;
  updated_at: string;
}

interface TripResponse {
  trip: Trip;
  itinerary?: GeneratedItinerary;
}

const GENERATION_STEPS = [
  {
    key: "orchestrator",
    label: "Analyzing",
    emoji: "🔍",
    description: "Understanding your preferences",
  },
  {
    key: "hotels",
    label: "Hotels",
    emoji: "🏨",
    description: "Searching for the best hotels",
  },
  {
    key: "activities",
    label: "Activities",
    emoji: "✨",
    description: "Finding activities & attractions",
  },
  {
    key: "dining",
    label: "Dining",
    emoji: "🍽️",
    description: "Discovering restaurants",
  },
  {
    key: "transport",
    label: "Flights",
    emoji: "✈️",
    description: "Finding the best flights",
  },
  {
    key: "aggregator",
    label: "Composing",
    emoji: "📝",
    description: "Crafting your itinerary",
  },
];

export default function TripDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [itinerary, setItinerary] = useState<GeneratedItinerary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Determine if we should stream
  const shouldStream = trip?.status === "generating" && !!trip?.search_id;

  // SSE progressive generation hook
  const generation = useTripGeneration({
    tripId,
    enabled: shouldStream,
    onComplete: () => {
      // Refetch trip to get updated status and DB itinerary
      fetchTrip();
    },
  });

  // Fetch trip data
  const fetchTrip = useCallback(async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}`);
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/auth/login?redirectTo=/trips/" + tripId);
          return;
        }
        throw new Error("Failed to fetch trip");
      }
      const data: TripResponse = await res.json();
      setTrip(data.trip);
      if (data.itinerary) {
        setItinerary(data.itinerary);
      }
      return data.trip;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trip");
      return null;
    } finally {
      setLoading(false);
    }
  }, [tripId, router]);

  // Initial load
  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  // Sticky booking bar scroll listener
  useEffect(() => {
    const handleScroll = () => {
      setShowStickyBar(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // For trips in 'generating' state without a search_id (old workflow),
  // fall back to polling the generate endpoint
  useEffect(() => {
    if (!trip || trip.status !== "generating" || trip.search_id) {
      return;
    }

    const interval = setInterval(async () => {
      const res = await fetch(`/api/trips/${tripId}/generate`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(interval);
          await fetchTrip();
        }
      }
    }, 3000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- we intentionally depend on trip?.status and trip?.search_id, not the whole trip object
  }, [trip?.status, trip?.search_id, tripId, fetchTrip]);

  const handleShare = async () => {
    try {
      let url = shareUrl;
      if (!url) {
        const res = await fetch(`/api/trips/${tripId}/share`, {
          method: "POST",
        });
        if (!res.ok) throw new Error("Failed to enable sharing");
        const data = await res.json();
        url = data.shareUrl;
        setShareUrl(url!);
      }
      if (navigator.share) {
        await navigator.share({
          title: `Trip to ${trip?.destination}`,
          text: `Check out my trip itinerary to ${trip?.destination}!`,
          url: url!,
        });
      } else {
        await navigator.clipboard.writeText(url!);
        alert("Share link copied to clipboard!");
      }
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        console.error("Share failed:", err);
      }
    }
  };

  const handleExport = () => {
    alert("Export feature coming soon!");
  };

  const handleRetry = async () => {
    if (!trip || isRetrying) return;
    setIsRetrying(true);

    try {
      // Reset trip to draft
      await fetch(`/api/trips/${tripId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "draft" }),
      });

      // Trigger new generation
      const genRes = await fetch(`/api/trips/${tripId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!genRes.ok) {
        const data = await genRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to retry generation");
      }

      // Refetch trip to pick up the new search_id
      await fetchTrip();
    } catch (err) {
      console.error("Retry failed:", err);
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      setIsRetrying(false);
    }
  };

  // Extract top hotel from itinerary days
  const topHotel = useMemo(() => {
    if (!itinerary?.days?.length) return null;
    // Check if any day has hotel info
    for (const day of itinerary.days) {
      const dayRecord = day as unknown as Record<string, unknown>;
      if (dayRecord.hotel) return dayRecord.hotel as FeaturedHotel;
    }
    return null;
  }, [itinerary]);

  // Count bookable experiences across itinerary
  const bookableCount = useMemo(() => {
    if (!itinerary?.days?.length) return 0;
    let count = 0;
    for (const day of itinerary.days) {
      for (const slot of [day.morning, day.afternoon, day.evening]) {
        if (!slot) continue;
        if (Array.isArray(slot.activities)) {
          count += slot.activities.filter(
            (a) => a?.bookingInfo?.bookingUrl,
          ).length;
        }
      }
    }
    return count;
  }, [itinerary]);

  // Compute budget breakdown
  const budgetBreakdown = useMemo(() => {
    if (!itinerary?.days?.length) return null;

    let accommodation = 0;
    let activities = 0;
    let dining = 0;
    let transport = 0;

    const nights = itinerary.days.length > 0 ? itinerary.days.length - 1 : 0;
    if (topHotel?.pricePerNight) {
      accommodation = topHotel.pricePerNight * nights;
    }

    for (const day of itinerary.days) {
      if (day.transport?.price) {
        transport += day.transport.price;
      }
      for (const slot of [day.morning, day.afternoon, day.evening]) {
        if (!slot) continue;
        if (Array.isArray(slot.activities)) {
          for (const act of slot.activities) {
            if (act?.estimatedCost?.amount)
              activities += act.estimatedCost.amount;
          }
        }
        const slotRecord = slot as unknown as Record<string, unknown>;
        const mealsList = Array.isArray(slot.meals)
          ? slot.meals
          : slotRecord.meal
            ? [slotRecord.meal as { estimatedCost?: { amount: number } }]
            : [];
        for (const meal of mealsList) {
          if (meal?.estimatedCost?.amount) dining += meal.estimatedCost.amount;
        }
      }
    }

    const total = accommodation + activities + dining + transport;
    if (total === 0) return null;

    return { accommodation, activities, dining, transport, total };
  }, [itinerary, topHotel]);

  // Compute number of days for skeletons (from trip date range)
  const skeletonDayCount = useMemo(() => {
    if (!trip) return 3;
    const start = new Date(trip.start_date);
    const end = new Date(trip.end_date);
    const diff =
      Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, Math.min(diff, 14));
  }, [trip]);

  // Compute dates for skeleton days
  const skeletonDates = useMemo(() => {
    if (!trip) return [];
    return Array.from({ length: skeletonDayCount }, (_, i) => {
      const d = new Date(trip.start_date);
      d.setDate(d.getDate() + i);
      return d.toISOString().split("T")[0];
    });
  }, [trip, skeletonDayCount]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading trip...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !trip) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Trip not found
          </h1>
          <p className="text-gray-600 mb-6">
            {error ||
              "This trip may have been deleted or you may not have access to it."}
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center px-6 py-3 bg-primary text-white rounded-full font-semibold hover:bg-primary-600 transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Determine display status
  const isGenerating = trip.status === "generating" || generation.isStreaming;
  const isFailed = trip.status === "failed" || !!generation.error;
  const isComplete =
    trip.status === "generated" ||
    trip.status === "completed" ||
    generation.isComplete;
  const tripStatus = isGenerating
    ? "generating"
    : isFailed
      ? "failed"
      : "completed";

  // Progressive data: prefer DB itinerary when available, fall back to streamed days
  const displayDays: TripDay[] | null =
    itinerary?.days || generation.days || null;
  const displayTopHotel = topHotel || generation.topHotel;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Trip Header */}
      <TripHeader
        destination={trip.destination}
        startDate={trip.start_date}
        endDate={trip.end_date}
        travelers={trip.travelers}
        totalCost={itinerary?.totalEstimatedCost}
        status={tripStatus}
        onShare={handleShare}
        onExport={handleExport}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Generation Progress — real agent progress via SSE */}
        {isGenerating && (
          <AgentProgress
            step={generation.phase}
            progress={generation.progress}
            message={generation.message}
            searchProgress={generation.searchProgress}
          />
        )}

        {/* Generation Failed */}
        {isFailed && !isGenerating && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-800 mb-1">
                  Generation Failed
                </h3>
                <p className="text-sm text-red-700 mb-4">
                  {generation.error ||
                    "Something went wrong while generating your itinerary. Please try again."}
                </p>
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`}
                  />
                  {isRetrying ? "Retrying..." : "Try Again"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Progressive discovery badges during generation */}
        {isGenerating &&
          (generation.activitiesCount > 0 ||
            generation.diningCount > 0 ||
            generation.transportCount > 0) && (
            <div className="flex flex-wrap gap-2 mb-6">
              {generation.activitiesCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200 animate-in fade-in slide-in-from-bottom-1 duration-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  Found {generation.activitiesCount} activities
                </span>
              )}
              {generation.diningCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-full text-xs font-bold border border-orange-200 animate-in fade-in slide-in-from-bottom-1 duration-300">
                  <Sparkles className="w-3.5 h-3.5" />
                  Found {generation.diningCount} restaurants
                </span>
              )}
              {generation.transportCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-bold border border-blue-200 animate-in fade-in slide-in-from-bottom-1 duration-300">
                  <Plane className="w-3.5 h-3.5" />
                  Found {generation.transportCount} flight
                  {generation.transportCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

        {/* Overview Section */}
        {itinerary?.overview && !isGenerating && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">
              Trip Overview
            </h2>
            <p className="text-gray-600 leading-relaxed">
              {itinerary.overview}
            </p>
          </div>
        )}

        {/* Recommended Hotel — fades in from stream or DB */}
        {displayTopHotel && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <FeaturedHotelCard
              hotel={displayTopHotel}
              nights={
                displayDays
                  ? Math.max(0, displayDays.length - 1)
                  : skeletonDayCount > 0
                    ? skeletonDayCount - 1
                    : 0
              }
            />
          </div>
        )}

        {/* Featured Flights */}
        <FeaturedFlights days={itinerary?.days || null} />

        {/* Booking Dashboard — shows booking status for this trip */}
        {trip && !isGenerating && (
          <div className="mb-6">
            <BookingDashboard tripId={trip.id} />
          </div>
        )}

        {/* Interactive Map (only when DB itinerary loaded) */}
        {itinerary && !isGenerating && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
            <ItineraryMap itinerary={itinerary} className="h-64 sm:h-80" />
          </div>
        )}

        {/* Day-by-Day Itinerary — progressive rendering */}
        {displayDays && displayDays.length > 0 ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                Your Itinerary
              </h2>
              {bookableCount > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full text-xs font-bold">
                  <Ticket className="w-3.5 h-3.5" />
                  {bookableCount} bookable experience
                  {bookableCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {displayDays.map((day, index) => (
              <div
                key={day.dayNumber || index}
                className="animate-in fade-in slide-in-from-bottom-2 duration-500"
                style={{
                  animationDelay: `${index * 150}ms`,
                  animationFillMode: "both",
                }}
              >
                <DayErrorBoundary dayNumber={day.dayNumber || index + 1}>
                  <ItineraryDay
                    dayNumber={day.dayNumber}
                    date={day.date}
                    title={day.title}
                    summary={day.summary}
                    morning={day.morning}
                    afternoon={day.afternoon}
                    evening={day.evening}
                    totalEstimatedCost={day.totalEstimatedCost}
                    tips={day.tips}
                    defaultExpanded={true}
                    hotel={
                      index === 0 && displayTopHotel
                        ? {
                            name: displayTopHotel.name,
                            starRating: displayTopHotel.starRating,
                            pricePerNight: displayTopHotel.pricePerNight,
                            amenities: displayTopHotel.amenities,
                            affiliateUrl: displayTopHotel.affiliateUrl,
                            image: displayTopHotel.images?.[0],
                          }
                        : undefined
                    }
                    transport={day.transport}
                  />
                </DayErrorBoundary>
              </div>
            ))}
          </div>
        ) : isGenerating && !displayDays ? (
          /* Skeleton days while generating */
          <div className="space-y-5">
            <h2 className="text-xl font-bold text-gray-900">Your Itinerary</h2>
            {Array.from({ length: skeletonDayCount }, (_, i) => (
              <div
                key={i}
                className="animate-in fade-in slide-in-from-bottom-2 duration-500"
                style={{
                  animationDelay: `${i * 100}ms`,
                  animationFillMode: "both",
                }}
              >
                <SkeletonItineraryDay
                  dayNumber={i + 1}
                  date={skeletonDates[i]}
                />
              </div>
            ))}
          </div>
        ) : isComplete && !displayDays ? (
          <EmptyItinerary destination={trip.destination} />
        ) : null}

        {/* Budget Summary */}
        {budgetBreakdown && (
          <BudgetSummary breakdown={budgetBreakdown} currency="USD" />
        )}

        {/* General Tips */}
        {itinerary?.generalTips && itinerary.generalTips.length > 0 && (
          <div className="mt-6 bg-gradient-to-r from-primary-50 to-amber-50 rounded-2xl p-6 border border-primary-100/50">
            <h3 className="font-bold text-primary-800 mb-3 flex items-center gap-2">
              <span className="text-lg">💡</span> Travel Tips for{" "}
              {trip.destination}
            </h3>
            <ul className="space-y-2">
              {itinerary.generalTips.map((tip, i) => (
                <li
                  key={i}
                  className="text-sm text-primary-700 flex items-start gap-2"
                >
                  <span className="text-primary-400 mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Packing List */}
        {itinerary?.packingList && itinerary.packingList.length > 0 && (
          <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
              <span className="text-lg">🧳</span> Packing Suggestions
            </h3>
            <div className="flex flex-wrap gap-2">
              {itinerary.packingList.map((item, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-3 py-1.5 rounded-full text-sm bg-gray-100 text-gray-700 font-medium"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Empty state for completed trips without itinerary */}
        {isComplete && !displayDays && !itinerary && (
          <EmptyItinerary destination={trip.destination} />
        )}

        {/* Save Trip Nudge for anonymous users */}
        {isComplete && !trip.user_id && <SaveTripNudge tripId={trip.id} />}

        {/* Share This Trip */}
        {isComplete && (displayDays || itinerary) && (
          <div className="mt-8 bg-gradient-to-r from-primary-50 to-amber-50 rounded-2xl p-6 sm:p-8 text-center border border-primary-100/30">
            <h3 className="font-bold text-gray-900 mb-2 text-lg">
              Share Your Adventure
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Let friends and family know about your upcoming trip!
            </p>
            <ShareButtons
              url={shareUrl || undefined}
              title={`My ${trip.destination} Trip Itinerary`}
              description={`Check out my AI-generated itinerary to ${trip.destination}! Created with Faroway.`}
              hashtags={[
                "Faroway",
                "Travel",
                trip.destination.replace(/\s+/g, ""),
              ]}
              className="justify-center"
            />
            {!shareUrl && (
              <button
                onClick={handleShare}
                className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Generate a public share link
              </button>
            )}
          </div>
        )}
      </main>

      {/* Sticky Booking Bar */}
      {isComplete && bookableCount > 0 && (
        <div
          className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ${
            showStickyBar
              ? "translate-y-0 opacity-100"
              : "translate-y-full opacity-0"
          }`}
        >
          <div className="bg-white/95 backdrop-blur-lg border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <Ticket className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">
                    {bookableCount} experience{bookableCount > 1 ? "s" : ""} to
                    book
                  </p>
                  <p className="text-xs text-gray-500">
                    Secure your spots before they fill up
                  </p>
                </div>
              </div>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-primary to-primary-600 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:shadow-primary/25 transition-all active:scale-[0.98]"
              >
                <ChevronUp className="w-4 h-4" />
                View All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Featured Hotel Card ──────────────────────────────────────────────────────

interface FeaturedHotel {
  id?: string;
  name: string;
  images?: string[];
  affiliateUrl?: string;
  affiliatePartner?: string;
  pricePerNight: number;
  starRating?: number;
  userRating?: number;
  reviewCount?: number;
  description?: string;
  amenities?: string[];
}

function FeaturedHotelCard({
  hotel,
  nights,
}: {
  hotel: FeaturedHotel;
  nights: number;
}) {
  const handleClick = () => {
    if (!hotel.affiliateUrl) return;

    fetch("/api/track/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemType: "hotel",
        itemId: hotel.id || hotel.name,
        itemName: hotel.name,
        affiliatePartner: hotel.affiliatePartner || "booking",
        affiliateUrl: hotel.affiliateUrl,
        source: "itinerary",
      }),
    }).catch(() => {});

    window.open(hotel.affiliateUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6 group hover:shadow-lg transition-shadow">
      {hotel.images?.[0] && (
        <div className="relative h-56 sm:h-72 overflow-hidden">
          <Image
            src={hotel.images[0]}
            alt={hotel.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute top-3 left-3 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full text-xs font-bold text-white flex items-center gap-1.5 shadow-lg">
            <Sparkles className="w-3.5 h-3.5" />
            Faroway Pick
          </div>
          {/* Price overlay on image */}
          <div className="absolute bottom-4 right-4 text-right">
            <div className="text-3xl font-black text-white drop-shadow-lg">
              ${hotel.pricePerNight}
            </div>
            <div className="text-xs text-white/80 font-medium">per night</div>
          </div>
        </div>
      )}
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-black text-xl text-gray-900">{hotel.name}</h3>
            <div className="flex items-center gap-2 mt-1.5">
              {hotel.starRating && (
                <span className="text-yellow-500 text-sm">
                  {"★".repeat(Math.min(5, hotel.starRating))}
                </span>
              )}
              {hotel.userRating && (
                <span className="flex items-center gap-1 text-sm">
                  <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                  <span className="font-bold text-gray-700">
                    {hotel.userRating.toFixed(1)}
                  </span>
                  {hotel.reviewCount && (
                    <span className="text-gray-400 text-xs">
                      ({hotel.reviewCount.toLocaleString()} reviews)
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
          {!hotel.images?.[0] && (
            <div className="text-right flex-shrink-0">
              <div className="text-2xl font-black text-gray-900">
                ${hotel.pricePerNight}
              </div>
              <div className="text-xs text-gray-500">per night</div>
            </div>
          )}
        </div>

        {hotel.description && (
          <p className="text-sm text-gray-600 mb-4 leading-relaxed line-clamp-2">
            {hotel.description}
          </p>
        )}

        {hotel.amenities && hotel.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-5">
            {hotel.amenities.slice(0, 6).map((amenity: string, i: number) => (
              <span
                key={i}
                className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs bg-gray-50 text-gray-600 font-medium border border-gray-100"
              >
                {amenity}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-gray-100">
          <div className="text-sm text-gray-500">
            {nights > 0 && (
              <span>
                Total:{" "}
                <span className="font-black text-lg text-gray-900">
                  ${hotel.pricePerNight * nights}
                </span>{" "}
                for {nights} night{nights !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {hotel.affiliateUrl && (
            <button
              onClick={handleClick}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-sm hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg hover:shadow-blue-500/25 active:scale-[0.98]"
            >
              <Shield className="w-4 h-4" />
              Check Availability & Prices
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </button>
          )}
        </div>

        {/* Trust signals */}
        {hotel.affiliateUrl && (
          <div className="flex items-center justify-center gap-4 mt-3 text-[11px] text-gray-500">
            <span className="inline-flex items-center gap-1">
              <svg
                className="w-3 h-3 text-green-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Best price guarantee
            </span>
            <span className="inline-flex items-center gap-1">
              <svg
                className="w-3 h-3 text-green-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              Free cancellation
            </span>
            <span className="inline-flex items-center gap-1">
              <svg
                className="w-3 h-3 text-green-500"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              No hidden fees
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Budget Summary Component ─────────────────────────────────────────────────

function BudgetSummary({
  breakdown,
  currency,
}: {
  breakdown: {
    accommodation: number;
    activities: number;
    dining: number;
    transport: number;
    total: number;
  };
  currency: string;
}) {
  const formatCost = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const categories = [
    {
      label: "Accommodation",
      amount: breakdown.accommodation,
      color: "bg-blue-500",
      bgColor: "bg-blue-50 text-blue-700",
      icon: "🏨",
    },
    {
      label: "Activities & Tours",
      amount: breakdown.activities,
      color: "bg-emerald-500",
      bgColor: "bg-emerald-50 text-emerald-700",
      icon: "🎯",
    },
    {
      label: "Dining",
      amount: breakdown.dining,
      color: "bg-orange-500",
      bgColor: "bg-orange-50 text-orange-700",
      icon: "🍽️",
    },
    {
      label: "Transport",
      amount: breakdown.transport,
      color: "bg-sky-500",
      bgColor: "bg-sky-50 text-sky-700",
      icon: "✈️",
    },
  ].filter((c) => c.amount > 0);

  return (
    <div className="mt-6 bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <h3 className="font-bold text-gray-900 mb-5 text-lg">Budget Summary</h3>

      {/* Stacked bar */}
      <div className="h-4 rounded-full overflow-hidden flex mb-5 bg-gray-100">
        {categories.map((cat) => (
          <div
            key={cat.label}
            className={`${cat.color} transition-all first:rounded-l-full last:rounded-r-full`}
            style={{ width: `${(cat.amount / breakdown.total) * 100}%` }}
          />
        ))}
      </div>

      {/* Category breakdown */}
      <div className="space-y-3">
        {categories.map((cat) => (
          <div key={cat.label} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-lg">{cat.icon}</span>
              <span className="text-sm text-gray-600 font-medium">
                {cat.label}
              </span>
            </div>
            <span className="text-sm font-bold text-gray-900">
              {formatCost(cat.amount)}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-5 border-t border-gray-100 flex items-center justify-between">
        <span className="font-bold text-gray-900">Estimated Total</span>
        <span className="text-2xl font-black text-gray-900">
          {formatCost(breakdown.total)}
        </span>
      </div>
    </div>
  );
}

// ── Agent Progress Component ─────────────────────────────────────────────────

interface AgentProgressProps {
  step: string;
  progress: number;
  message: string;
  searchProgress: SearchProgress | null;
}

function AgentProgress({
  step,
  progress,
  message,
  searchProgress,
}: AgentProgressProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-primary animate-pulse" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">
            Creating Your Itinerary
          </h3>
          <p className="text-sm text-gray-600">{message}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="relative mb-4">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary-600 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.max(5, progress)}%` }}
          />
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-gray-500">{step}</span>
          <span className="text-xs text-gray-500">{progress}%</span>
        </div>
      </div>

      {/* Agent Steps */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {GENERATION_STEPS.map((genStep) => {
          const agentStatus = searchProgress?.[genStep.key];
          const isActive = agentStatus === "searching";
          const isDone = agentStatus === "done";

          return (
            <div
              key={genStep.key}
              className={`text-center p-2 rounded-lg transition-colors ${
                isActive
                  ? "bg-primary-50 ring-1 ring-primary-200"
                  : isDone
                    ? "bg-green-50"
                    : "bg-gray-50"
              }`}
            >
              <div
                className={`text-lg mb-1 ${isActive ? "animate-bounce" : ""}`}
              >
                {isDone ? "✅" : genStep.emoji}
              </div>
              <p
                className={`text-xs font-medium ${
                  isActive
                    ? "text-primary-700"
                    : isDone
                      ? "text-green-700"
                      : "text-gray-500"
                }`}
              >
                {genStep.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Save Trip Nudge (anonymous users) ─────────────────────────────────────────

function SaveTripNudge({ tripId }: { tripId: string }) {
  const redirectTo = encodeURIComponent(`/trips/${tripId}`);

  return (
    <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-6">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
          <Clock className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-amber-800 mb-1">
            Save this trip permanently
          </h3>
          <p className="text-sm text-amber-700 mb-4">
            Sign up to keep this trip forever. Anonymous trips expire after 7
            days.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/auth/signup?redirectTo=${redirectTo}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-600 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Sign Up Free
            </Link>
            <Link
              href={`/auth/login?redirectTo=${redirectTo}`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Log In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Featured Flights ────────────────────────────────────────────────────────

function formatFlightCost(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function FlightLeg({
  transport,
  label,
}: {
  transport: NonNullable<TripDay["transport"]>;
  label: string;
}) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider mb-2">
        {label}
      </p>
      <div className="flex items-center gap-3">
        <div className="text-center min-w-[48px]">
          <p className="text-lg font-bold text-white">
            {transport.departure.airport}
          </p>
          <p className="text-[11px] text-blue-200">
            {new Date(transport.departure.dateTime).toLocaleTimeString(
              "en-US",
              {
                hour: "2-digit",
                minute: "2-digit",
              },
            )}
          </p>
        </div>
        <div className="flex-1 flex flex-col items-center">
          <p className="text-[11px] text-blue-200 font-medium">
            {Math.floor(transport.duration / 60)}h {transport.duration % 60}m
          </p>
          <div className="w-full flex items-center gap-0.5 my-0.5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-300" />
            <div className="flex-1 h-px bg-blue-400/50" />
            <Plane className="h-3 w-3 text-blue-300 rotate-90" />
            <div className="flex-1 h-px bg-blue-400/50" />
            <div className="w-1.5 h-1.5 rounded-full bg-blue-300" />
          </div>
          <p className="text-[11px] text-blue-300">
            {transport.stops === 0
              ? "Direct"
              : `${transport.stops} stop${transport.stops > 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="text-center min-w-[48px]">
          <p className="text-lg font-bold text-white">
            {transport.arrival.airport}
          </p>
          <p className="text-[11px] text-blue-200">
            {new Date(transport.arrival.dateTime).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2">
        <p className="text-xs text-blue-200">{transport.provider}</p>
        <p className="text-sm font-bold text-white">
          {formatFlightCost(transport.price, transport.currency)}
        </p>
      </div>
    </div>
  );
}

function FeaturedFlights({ days }: { days: TripDay[] | null }) {
  if (!days?.length) return null;

  // Find outbound (first day with transport) and return (last day with transport)
  const outbound = days.find((d) => d.transport);
  const lastDayWithTransport = [...days].reverse().find((d) => d.transport);
  const returnFlight =
    lastDayWithTransport &&
    lastDayWithTransport !== outbound &&
    lastDayWithTransport.transport
      ? lastDayWithTransport
      : null;

  if (!outbound?.transport) return null;

  const handleFlightClick = (transport: TripDay["transport"]) => {
    if (!transport?.affiliateUrl) return;
    fetch("/api/track/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemType: "transport",
        itemId: `transport_${transport.departure.airport}_${transport.arrival.airport}`,
        itemName: `${transport.provider} ${transport.departure.airport}-${transport.arrival.airport}`,
        affiliatePartner: transport.affiliatePartner || "duffel",
        affiliateUrl: transport.affiliateUrl,
        source: "itinerary",
      }),
    }).catch(() => {});
    window.open(transport.affiliateUrl, "_blank", "noopener,noreferrer");
  };

  const totalPrice =
    (outbound.transport?.price || 0) + (returnFlight?.transport?.price || 0);
  const currency = outbound.transport?.currency || "USD";

  return (
    <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-2xl overflow-hidden mb-6 shadow-lg shadow-blue-500/20 relative">
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-[0.05]">
        <div className="absolute -right-12 -top-12 w-48 h-48 rounded-full border-[24px] border-white" />
        <div className="absolute -left-6 -bottom-6 w-32 h-32 rounded-full border-[16px] border-white" />
      </div>

      <div className="relative p-6">
        <div className="flex items-center gap-2 mb-5">
          <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <Plane className="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Your Flights</h3>
            <p className="text-[11px] text-blue-200">
              {returnFlight ? "Round trip" : "One way"}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xl font-black text-white">
              {formatFlightCost(totalPrice, currency)}
            </p>
            <p className="text-[11px] text-blue-200">
              {returnFlight ? "total round trip" : "per person"}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
          <FlightLeg transport={outbound.transport!} label="Outbound" />
          {returnFlight?.transport && (
            <>
              <div className="hidden sm:block w-px bg-blue-500/30 self-stretch" />
              <div className="sm:hidden h-px bg-blue-500/30" />
              <FlightLeg transport={returnFlight.transport} label="Return" />
            </>
          )}
        </div>

        {outbound.transport?.affiliateUrl && (
          <button
            onClick={() => handleFlightClick(outbound.transport)}
            className="w-full mt-5 inline-flex items-center justify-center gap-2 px-5 py-3 bg-white text-blue-700 rounded-xl text-sm font-bold hover:bg-blue-50 transition-all shadow-md active:scale-[0.98]"
          >
            <Shield className="w-4 h-4" />
            Book {returnFlight ? "Flights" : "Flight"}
            <ExternalLink className="w-3.5 h-3.5 opacity-70" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Empty Itinerary ─────────────────────────────────────────────────────────

function EmptyItinerary({ destination }: { destination: string }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-8 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <MapPin className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        No Itinerary Yet
      </h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        Your trip to {destination} doesn&apos;t have an itinerary yet. Generate
        one with our AI planner!
      </p>
      <Link
        href={`/create?destination=${encodeURIComponent(destination)}`}
        className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-full font-semibold hover:bg-primary-600 transition-colors"
      >
        <Sparkles className="w-5 h-5" />
        Generate Itinerary
      </Link>
    </div>
  );
}
