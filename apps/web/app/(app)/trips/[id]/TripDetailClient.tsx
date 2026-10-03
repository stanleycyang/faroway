"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  Loader2,
  AlertCircle,
  MapPin,
  RefreshCw,
  Sparkles,
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
import {
  FeaturedHotelCard,
  type FeaturedHotel,
} from "@/components/trips/FeaturedHotelCard";
import { ShareConsentDialog } from "@/components/trips/ShareConsentDialog";
import { TripBudget } from "@/components/trips/TripBudget";
import { TripHeader } from "@/components/trips/TripHeader";
import { ItineraryDay } from "@/components/trips/ItineraryDay";
import { ItineraryGenerationLoader } from "@/components/trips/ItineraryGenerationLoader";
import { TripReadyScreen } from "@/components/trips/TripReadyScreen";
import { StreamedSpecPreview } from "@/components/trips/StreamedSpecPreview";
import { TripWeather } from "@/components/trips/TripWeather";
import { PlacesExplorer } from "@/components/places/PlacesExplorer";
import { TripCheckout } from "@/components/trips/TripCheckout";
import { TripFeedback } from "@/components/trips/TripFeedback";
import { ShareButtons } from "@/components/ShareButtons";
import {
  ITINERARY_STREAMING_ENABLED,
  useTripGeneration,
} from "@/hooks/useTripGeneration";
import type { GeneratedItinerary } from "@/lib/ai/types";
import type { Trip, TripResponse } from "@/lib/trips/load-trip";
import type { TripDay } from "@faroway/types";
import { summarizeBudget } from "@/lib/trips/budget";

const ItineraryMap = dynamic(
  () =>
    import("@/components/trips/ItineraryMap").then((m) => ({
      default: m.ItineraryMap,
    })),
  { ssr: false },
);

interface TripDetailClientProps {
  tripId: string;
  initialData: TripResponse;
  initialShareUrl: string | null;
}

export function TripDetailClient({
  tripId,
  initialData,
  initialShareUrl,
}: TripDetailClientProps) {
  const router = useRouter();

  const [trip, setTrip] = useState<Trip | null>(initialData.trip);
  const [itinerary, setItinerary] = useState<GeneratedItinerary | null>(
    initialData.itinerary ?? null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareConsentOpen, setShareConsentOpen] = useState(false);
  const shareLock = useRef(false);
  const [shareUrl, setShareUrl] = useState<string | null>(initialShareUrl);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [isShareBusy, setIsShareBusy] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const retryLock = useRef(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showReadyScreen, setShowReadyScreen] = useState(false);
  const [hasSeenGeneratingThisSession, setHasSeenGeneratingThisSession] =
    useState(false);

  // Determine if we should stream
  const shouldStream =
    ITINERARY_STREAMING_ENABLED &&
    trip?.status === "generating" &&
    !!trip?.search_id;
  const tripIsComplete =
    trip?.status === "planned" ||
    trip?.status === "generated" ||
    trip?.status === "completed";

  // SSE progressive generation hook
  const generation = useTripGeneration({
    tripId,
    enabled: shouldStream,
    completed: tripIsComplete,
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
      setError(null);
      setTrip(data.trip);
      setShareUrl(
        data.trip.is_shared && data.trip.share_token
          ? `${window.location.origin}/s/${data.trip.share_token}`
          : null,
      );
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

  // Sticky booking bar scroll listener
  useEffect(() => {
    const handleScroll = () => {
      setShowStickyBar(window.scrollY > 400);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // For old workflow trips or when streaming is disabled by rollout flag,
  // fall back to polling the generate endpoint.
  useEffect(() => {
    if (
      !trip ||
      trip.status !== "generating" ||
      (trip.search_id &&
        ITINERARY_STREAMING_ENABLED &&
        generation.phase !== "error")
    ) {
      return;
    }

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    const poll = async () => {
      try {
        const res = await fetch(`/api/trips/${tripId}/generate`, {
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          if (data.status === "completed" || data.status === "failed") {
            const refreshed = await fetchTrip();
            if (
              refreshed &&
              ["planned", "generated", "completed", "failed"].includes(
                refreshed.status,
              )
            )
              return;
          }
        }
      } catch (pollError) {
        if (!(pollError instanceof Error && pollError.name === "AbortError")) {
          console.error("Trip generation status check failed", pollError);
        }
      }
      if (!cancelled) timeout = setTimeout(poll, 3000);
    };

    timeout = setTimeout(poll, 3000);
    return () => {
      cancelled = true;
      controller.abort();
      if (timeout) clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- we intentionally depend on trip?.status and trip?.search_id, not the whole trip object
  }, [trip?.status, trip?.search_id, tripId, fetchTrip, generation.phase]);

  const handleShare = async (confirmed = false) => {
    if (shareLock.current) return;
    if (!shareUrl && !confirmed) {
      setShareConsentOpen(true);
      return;
    }
    setShareConsentOpen(false);
    shareLock.current = true;
    setIsShareBusy(true);
    setShareStatus(null);
    try {
      let url = shareUrl;
      if (!url) {
        const res = await fetch(`/api/trips/${tripId}/share`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicConsent: true }),
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
        setShareStatus("Public share link copied to your clipboard.");
      }
    } catch (err) {
      setShareStatus(
        err instanceof Error && err.name === "AbortError"
          ? "Share sheet canceled. Your public link remains active; use Turn off public access to revoke it."
          : "Sharing did not finish. If a public link was created, it remains active until you turn off public access.",
      );
    } finally {
      shareLock.current = false;
      setIsShareBusy(false);
    }
  };

  const handleRevokeShare = async () => {
    if (shareLock.current) return;
    shareLock.current = true;
    setIsShareBusy(true);
    setShareStatus(null);
    try {
      const response = await fetch(`/api/trips/${tripId}/share`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to stop sharing");
      setShareUrl(null);
      setShareStatus("Public access has been turned off.");
    } catch (revokeError) {
      console.error("Share revocation failed:", revokeError);
      setShareStatus("We couldn’t turn off public access. Please try again.");
    } finally {
      shareLock.current = false;
      setIsShareBusy(false);
    }
  };

  const handleRetry = async () => {
    if (!trip || retryLock.current) return;
    retryLock.current = true;
    setIsRetrying(true);

    try {
      // Trigger new generation
      const genRes = await fetch(`/api/trips/${tripId}/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!genRes.ok && genRes.status !== 409) {
        const data = await genRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to retry generation");
      }

      // Refetch trip to pick up the new search_id
      await fetchTrip();
    } catch (err) {
      console.error("Retry failed:", err);
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      retryLock.current = false;
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

  // Keep currencies separate; itinerary totals do not establish a party quote.
  const budgetBreakdown = useMemo(() => {
    if (!itinerary?.days?.length || !trip) return null;
    const nights = Math.max(
      0,
      Math.round(
        (Date.parse(trip.end_date) - Date.parse(trip.start_date)) / 86400000,
      ),
    );
    return summarizeBudget(itinerary.days, topHotel, nights, trip.travelers);
  }, [itinerary, topHotel, trip]);

  // Trip length (days) from date range — used for nights estimate during generation / hotel card
  const skeletonDayCount = useMemo(() => {
    if (!trip) return 3;
    const start = new Date(trip.start_date);
    const end = new Date(trip.end_date);
    const diff =
      Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, Math.min(diff, 14));
  }, [trip]);

  // Determine display status
  const isComplete = tripIsComplete || generation.isComplete;
  const isGenerating =
    !isComplete && (trip?.status === "generating" || generation.isStreaming);
  const isFailed =
    !isComplete && (trip?.status === "failed" || !!generation.error);
  const tripStatus = isGenerating
    ? "generating"
    : isFailed
      ? "failed"
      : "completed";

  // Progressive data: prefer DB itinerary when available, fall back to streamed days
  const displayDays: TripDay[] | null =
    itinerary?.days || generation.days || null;
  const displayTopHotel = topHotel || generation.topHotel;
  const hasStreamedSpecBlocks = generation.specBlocks.length > 0;
  const readyScreenStopsCount = useMemo(() => {
    if (!displayDays?.length) return 0;
    let totalStops = 0;
    for (const day of displayDays) {
      for (const slot of [day.morning, day.afternoon, day.evening]) {
        if (!slot) continue;
        if (Array.isArray(slot.activities))
          totalStops += slot.activities.length;
        const slotRecord = slot as unknown as Record<string, unknown>;
        const mealsCount = Array.isArray(slot.meals)
          ? slot.meals.length
          : slotRecord.meal
            ? 1
            : 0;
        totalStops += mealsCount;
      }
    }
    return totalStops;
  }, [displayDays]);
  const readyScreenDescription =
    itinerary?.overview ||
    `We've drafted ${Math.max(1, skeletonDayCount)} days in ${trip?.destination || "your destination"}. Review your suggested stops and confirm current prices and availability before booking.`;
  const readyScreenHeroImage = displayTopHotel?.images?.[0];

  const showFullGenerationLoader =
    !!trip && isGenerating && !displayDays?.length && !hasStreamedSpecBlocks;

  useEffect(() => {
    if (isGenerating) {
      setHasSeenGeneratingThisSession(true);
      setShowReadyScreen(false);
    }
  }, [isGenerating]);

  useEffect(() => {
    if (
      hasSeenGeneratingThisSession &&
      isComplete &&
      !!displayDays?.length &&
      !showReadyScreen
    ) {
      setShowReadyScreen(true);
      setHasSeenGeneratingThisSession(false);
    }
  }, [
    hasSeenGeneratingThisSession,
    isComplete,
    displayDays?.length,
    showReadyScreen,
  ]);

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
  if (!trip) {
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

  if (showFullGenerationLoader) {
    return (
      <div>
        {error && (
          <div
            role="alert"
            className="fixed left-4 right-4 top-4 z-[120] rounded-xl bg-amber-50 p-4 text-amber-900"
          >
            {error}. Your trip is saved.{" "}
            <button
              type="button"
              className="underline"
              onClick={() => fetchTrip()}
            >
              Refresh trip
            </button>
          </div>
        )}
        <ItineraryGenerationLoader
          destination={trip.destination}
          nights={Math.max(0, skeletonDayCount - 1)}
          travelers={trip.travelers}
          phase={generation.phase}
          progress={generation.progress}
          message={generation.message}
          searchProgress={generation.searchProgress}
          activitiesCount={generation.activitiesCount}
          diningCount={generation.diningCount}
          transportCount={generation.transportCount}
        />
      </div>
    );
  }

  if (showReadyScreen && trip && displayDays?.length) {
    return (
      <TripReadyScreen
        city={trip.destination}
        heroImageUrl={readyScreenHeroImage}
        description={readyScreenDescription}
        days={displayDays.length}
        stops={readyScreenStopsCount}
        onOpenTrip={() => setShowReadyScreen(false)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Trip Header */}
      <ShareConsentDialog
        open={shareConsentOpen}
        onCancel={() => setShareConsentOpen(false)}
        onConfirm={() => handleShare(true)}
      />
      <TripHeader
        destination={trip.destination}
        startDate={trip.start_date}
        endDate={trip.end_date}
        travelers={trip.travelers}
        status={tripStatus}
        onShare={() => handleShare()}
      />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Generation Failed */}
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"
          >
            {error}. Your last loaded trip is still shown.{" "}
            <button
              type="button"
              onClick={() => fetchTrip()}
              className="underline"
            >
              Refresh trip
            </button>
          </div>
        )}
        {(isFailed || trip.status === "draft") && !isGenerating && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-red-800 mb-1">
                  {trip.status === "draft"
                    ? "Your trip is saved"
                    : "Planning was interrupted"}
                </h3>
                <p className="text-sm text-red-700 mb-4">
                  {trip.status === "draft"
                    ? "Your choices are saved. Start planning when you are ready."
                    : generation.error ||
                      "Your saved trip is still available. Try planning again."}
                </p>
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isRetrying ? "animate-spin" : ""}`}
                  />
                  {isRetrying
                    ? "Starting..."
                    : trip.status === "draft"
                      ? "Start planning"
                      : "Try Again"}
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
              nights={Math.max(
                0,
                Math.round(
                  (Date.parse(trip.end_date) - Date.parse(trip.start_date)) /
                    86400000,
                ),
              )}
            />
          </div>
        )}

        {/* Featured Flights */}
        <FeaturedFlights days={itinerary?.days || null} />

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
            <TripCheckout tripId={tripId} travelers={trip.travelers}>
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
                      tips={day.tips}
                      defaultExpanded={true}
                      hotel={
                        index === 0 && displayTopHotel
                          ? {
                              name: displayTopHotel.name,
                              starRating: displayTopHotel.starRating,
                              pricePerNight: displayTopHotel.pricePerNight,
                              currency: displayTopHotel.currency,
                              priceStatus:
                                "priceStatus" in displayTopHotel
                                  ? displayTopHotel.priceStatus
                                  : undefined,
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
            </TripCheckout>
            <PlacesExplorer key={tripId} />
            <TripWeather
              key={`${trip.destination}:${trip.start_date}:${trip.end_date}`}
              destination={trip.destination}
              start={trip.start_date}
              end={trip.end_date}
            />
          </div>
        ) : hasStreamedSpecBlocks ? (
          <StreamedSpecPreview
            blocks={generation.specBlocks}
            isGenerating={isGenerating}
          />
        ) : isComplete && !displayDays?.length ? (
          <EmptyItinerary destination={trip.destination} />
        ) : null}

        {budgetBreakdown && (
          <TripBudget budget={budgetBreakdown} travelers={trip.travelers} />
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
        {isComplete && !displayDays?.length && !itinerary && (
          <EmptyItinerary destination={trip.destination} />
        )}

        {isComplete && (!!displayDays?.length || itinerary) && (
          <TripFeedback tripId={tripId} />
        )}

        {/* Share This Trip */}
        {trip && (
          <div className="mt-8 bg-gradient-to-r from-primary-50 to-amber-50 rounded-2xl p-6 sm:p-8 text-center border border-primary-100/30">
            <h3 className="font-bold text-gray-900 mb-2 text-lg">
              Share Your Adventure
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Let friends and family know about your upcoming trip!
            </p>
            {shareUrl ? (
              <>
                <ShareButtons
                  url={shareUrl}
                  title={`My ${trip.destination} Trip Itinerary`}
                  description={`Check out my AI-generated itinerary to ${trip.destination}! Created with Faroway.`}
                  hashtags={[
                    "Faroway",
                    "Travel",
                    trip.destination.replace(/\s+/g, ""),
                  ]}
                  className="justify-center"
                />
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleShare()}
                disabled={isShareBusy}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
              >
                {isShareBusy ? "Creating link…" : "Create public share link"}
              </button>
            )}
            <button
              type="button"
              onClick={handleRevokeShare}
              disabled={isShareBusy}
              className="mt-4 text-sm font-medium text-gray-500 hover:text-red-600 disabled:opacity-50"
            >
              Turn off public access
            </button>
            {shareStatus && (
              <p className="mt-3 text-sm text-gray-600" role="status">
                {shareStatus}
              </p>
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
