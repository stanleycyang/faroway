"use client";
import { useHydrated } from "@/hooks/useHydrated";
import { getTripDuration, parseTripDate } from "@/lib/trips/date-duration";
import { requestPlanningConsent } from "@/lib/ai/planning-consent-client";
import { setPlanningConsentPrompt } from "@/lib/ai/planning-consent-prompt";
import { PlanningConsentDialog } from "@/components/trips/PlanningConsentDialog";
import {
  buildTripExportFilename,
  buildTripExportText,
} from "@/lib/trips/export";
import {
  buildTripIcsContent,
  buildTripIcsFilename,
} from "@/lib/trips/ics-export";

import { BookingChecklist } from "@/components/trips/BookingChecklist";
import { FlightLeg } from "@/components/trips/FlightLeg";
import { PlanEditor } from "@/components/trips/PlanEditor";
import { VenueEvidencePanel } from "@/components/trips/VenueEvidencePanel";
import { TripBriefEditor } from "@/components/trips/TripBriefEditor";
import { HotelQuotePanel } from "@/components/trips/HotelQuotePanel";

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
import { readSavedItinerary } from "@/lib/trips/read-itinerary";
import { MapLoading } from "@/components/trips/MapLoading";
import {
  Loader2,
  AlertCircle,
  MapPin,
  RefreshCw,
  Sparkles,
  Shield,
  ChevronUp,
  Ticket,
  Plane,
  Printer,
  Download,
  Calendar,
  Trash2,
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
import { FeaturedHotelCard } from "@/components/trips/FeaturedHotelCard";
import { ShareConsentDialog } from "@/components/trips/ShareConsentDialog";
import { LiveTripBudget } from "@/components/trips/TripBudget";
import { destinationImage } from "@/lib/trips/destination-image";
import { TripDayNavigation } from "@/components/trips/TripDayNavigation";
import { TripHeader } from "@/components/trips/TripHeader";
import {
  ItineraryDay,
  type ItineraryDayRequirements,
} from "@/components/trips/ItineraryDay";
import { TripCompanionBanner } from "@/components/trips/TripCompanionBanner";
import {
  TripCopilotBar,
  type CopilotQuickTrigger,
} from "@/components/trips/TripCopilotBar";
import { ItineraryGenerationLoader } from "@/components/trips/ItineraryGenerationLoader";
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
import { featuredStayEstimate } from "@/lib/trips/budget";

const ItineraryMap = dynamic(
  () =>
    import("@/components/trips/ItineraryMap").then((m) => ({
      default: m.ItineraryMap,
    })),
  {
    ssr: false,
    loading: () => <MapLoading className="h-64 sm:h-80" />,
  },
);

interface TripDetailClientProps {
  tripId: string;
  initialData: TripResponse;
  initialShareUrl: string | null;
  planEditingEnabled?: boolean;
  bookingChecklistEnabled?: boolean;
}

export function TripDetailClient({
  tripId,
  initialData,
  initialShareUrl,
  planEditingEnabled = false,
  bookingChecklistEnabled = false,
}: TripDetailClientProps) {
  const router = useRouter();
  const copilotBarId = `trip-${tripId}-copilot`;
  const [selectedDay, setSelectedDay] = useState(0);
  const hydrated = useHydrated();
  const [planEditorOpen, setPlanEditorOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const [initialPlan] = useState(() => {
    try {
      return {
        itinerary: readSavedItinerary(initialData.itinerary),
        error: null,
      };
    } catch (error) {
      return {
        itinerary: null,
        error:
          error instanceof Error
            ? error.message
            : "Your saved itinerary could not be read.",
      };
    }
  });
  const [trip, setTrip] = useState<Trip | null>(initialData.trip);
  const [itinerary, setItinerary] = useState<GeneratedItinerary | null>(
    initialPlan.itinerary,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialPlan.error);
  const [planningStatus, setPlanningStatus] = useState<string | null>(null);
  const planningCheckLock = useRef(false);
  const [checkingPlanning, setCheckingPlanning] = useState(false);
  const [shareConsentOpen, setShareConsentOpen] = useState(false);
  const shareLock = useRef(false);
  const [shareUrl, setShareUrl] = useState<string | null>(initialShareUrl);
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const [isShareBusy, setIsShareBusy] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(false);
  const retryLock = useRef(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [activeSection, setActiveSection] = useState<
    "trip-itinerary" | "trip-stay" | "trip-details"
  >("trip-itinerary");
  const [briefSavedNotice, setBriefSavedNotice] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteLock = useRef(false);
  const consentResolveRef = useRef<((approved: boolean) => void) | null>(null);
  const [consentDialog, setConsentDialog] = useState<{
    message: string;
  } | null>(null);
  useEffect(() => {
    const unregister = setPlanningConsentPrompt(
      (message) =>
        new Promise<boolean>((resolve) => {
          consentResolveRef.current?.(false);
          consentResolveRef.current = resolve;
          setConsentDialog({ message });
        }),
    );
    return () => {
      unregister();
      consentResolveRef.current?.(false);
      consentResolveRef.current = null;
    };
  }, []);
  const [showCompletedDossier, setShowCompletedDossier] = useState(false);
  const [peekingDayOne, setPeekingDayOne] = useState(false);
  const [hasSeenGeneratingThisSession, setHasSeenGeneratingThisSession] =
    useState(false);
  const [copilotQuickAction, setCopilotQuickAction] =
    useState<CopilotQuickTrigger | null>(null);
  const [copilotBusy, setCopilotBusy] = useState(false);
  const copilotBusyRef = useRef(false);
  useEffect(() => {
    copilotBusyRef.current = copilotBusy;
  }, [copilotBusy]);
  const copilotNonceRef = useRef(0);
  const shareUrlRef = useRef<string | null>(initialShareUrl);
  useEffect(() => {
    shareUrlRef.current = shareUrl;
  }, [shareUrl]);
  // A floating notice for actions triggered far from their result (header
  // share button, day-card co-pilot taps); the share card status is below the fold.
  const [floatingNotice, setFloatingNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showFloatingNotice = useCallback((message: string) => {
    setFloatingNotice(message);
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setFloatingNotice(null), 6000);
  }, []);
  useEffect(
    () => () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    },
    [],
  );
  const handleCopilotItineraryUpdated = useCallback(
    (
      updated: GeneratedItinerary,
      updatedAt?: string,
      planRevision?: string | null,
    ) => {
      // Applied edits revoke public access server-side so a shared link never
      // shows a plan the owner did not re-approve. Tell the owner.
      if (shareUrlRef.current) {
        const message =
          "Your edit turned off the public link so no one sees an outdated plan. Create a new link to share the updated trip.";
        setShareStatus(message);
        showFloatingNotice(message);
      }
      setItinerary(updated);
      setShareUrl(null);
      setTrip((prev) =>
        prev
          ? {
              ...prev,
              ...(updatedAt ? { updated_at: updatedAt } : {}),
              ...(planRevision !== undefined
                ? { plan_revision_id: planRevision }
                : {}),
              is_shared: false,
              share_token: null,
            }
          : prev,
      );
    },
    [],
  );
  const triggerCopilotQuickAction = useCallback(
    (action: {
      type: "swap_stop" | "relax_day" | "rain_backup";
      dayNumber: number;
      stopName?: string;
    }) => {
      if (copilotBusyRef.current) {
        showFloatingNotice(
          "Still applying your last change. Try again in a moment.",
        );
        return;
      }
      copilotNonceRef.current += 1;
      setCopilotQuickAction({
        ...action,
        nonce: copilotNonceRef.current,
      });
      // Progress and results render in the co-pilot bar; bring it into view
      // when the tap came from a day card further down the page.
      if (typeof document !== "undefined") {
        const bar = document.getElementById?.(copilotBarId);
        bar?.scrollIntoView({
          block: "nearest",
          behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        });
      }
    },
    [showFloatingNotice, copilotBarId],
  );

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
    generationId: trip?.search_id,
    enabled: shouldStream,
    completed: tripIsComplete,
    onComplete: () => {
      // Refetch trip to get updated status and DB itinerary
      fetchTrip();
    },
  });

  const refreshSequence = useRef(0);
  const refreshMounted = useRef(false);
  useEffect(() => {
    refreshMounted.current = true;
    return () => {
      refreshMounted.current = false;
      refreshSequence.current += 1;
    };
  }, []);

  // Only the latest refresh may reconcile this mounted trip.
  const fetchTrip = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const isCurrent = () =>
      refreshMounted.current && sequence === refreshSequence.current;
    try {
      const res = await fetch(`/api/trips/${tripId}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!isCurrent()) return null;
      if (!res.ok) {
        if (res.status === 401) {
          router.push("/auth/login?redirectTo=/trips/" + tripId);
          return;
        }
        throw new Error("Failed to fetch trip");
      }
      const data: TripResponse = await res.json();
      if (!isCurrent()) return null;
      if (
        data.trip?.id !== tripId ||
        data.trip?.user_id !== initialData.trip.user_id
      ) {
        throw new Error(
          "The trip response did not match your saved trip. Try refreshing again.",
        );
      }
      const savedItinerary = readSavedItinerary(data.itinerary);
      setError(null);
      setTrip(data.trip);
      setShareUrl(
        data.trip.is_shared && data.trip.share_token
          ? `${window.location.origin}/s/${data.trip.share_token}`
          : null,
      );
      setItinerary(savedItinerary);
      return data.trip;
    } catch (err) {
      if (!isCurrent()) return null;
      setError(err instanceof Error ? err.message : "Failed to load trip");
      return null;
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [tripId, router, initialData.trip.user_id]);

  const checkPlanningStatus = async () => {
    if (planningCheckLock.current || !refreshMounted.current) return;
    planningCheckLock.current = true;
    setCheckingPlanning(true);
    try {
      const response = await fetch(`/api/trips/${tripId}/generate`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok)
        throw new Error(
          "Status is temporarily unavailable. Your trip is saved; try checking again shortly.",
        );
      if (!refreshMounted.current) return;
      const status = await response.json();
      if (!refreshMounted.current) return;
      setPlanningStatus(
        status.message ||
          "Your saved trip is still being planned. You can leave and return here.",
      );
      if (status.status === "completed" || status.status === "failed")
        await fetchTrip();
    } catch (cause) {
      if (!refreshMounted.current) return;
      setPlanningStatus(
        cause instanceof Error
          ? cause.message
          : "Status is temporarily unavailable. Check again shortly.",
      );
    } finally {
      planningCheckLock.current = false;
      if (refreshMounted.current) setCheckingPlanning(false);
    }
  };

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
        generation.phase !== "error" &&
        generation.phase !== "complete")
    ) {
      return;
    }

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    const poll = async () => {
      try {
        const res = await fetch(`/api/trips/${tripId}/generate`, {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(15_000),
          ]),
        });
        if (cancelled || controller.signal.aborted) return;
        if (res.ok) {
          const data = await res.json();
          if (cancelled || controller.signal.aborted) return;
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

  const shareCardId = `trip-${tripId}-share`;
  // Share can start from the header; its status otherwise renders only in the
  // share card further down the page.
  const reportShareStatus = (message: string) => {
    setShareStatus(message);
    const rect =
      typeof document !== "undefined"
        ? document.getElementById?.(shareCardId)?.getBoundingClientRect?.()
        : null;
    const cardVisible =
      !!rect &&
      typeof window !== "undefined" &&
      rect.top < window.innerHeight &&
      rect.bottom > 0;
    if (!cardVisible) showFloatingNotice(message);
  };

  const handleShare = async (confirmed = false) => {
    if (!refreshMounted.current) return;
    if (trip?.preferences?.planNeedsRefresh) {
      reportShareStatus(
        "Update the plan for your saved brief before sharing it.",
      );
      return;
    }
    if (shareLock.current) return;
    if (!shareUrl && !confirmed) {
      setShareConsentOpen(true);
      return;
    }
    setShareConsentOpen(false);
    shareLock.current = true;
    setIsShareBusy(true);
    setShareStatus(null);
    let shareSheetOpened = false;
    try {
      let url = shareUrl;
      if (!url) {
        const res = await fetch(`/api/trips/${tripId}/share`, {
          method: "POST",
          signal: AbortSignal.timeout(20_000),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ publicConsent: true }),
        });
        if (!refreshMounted.current) return;
        if (!res.ok) throw new Error("Failed to enable sharing");
        const data = await res.json();
        if (!refreshMounted.current) return;
        if (
          typeof data?.shareUrl !== "string" ||
          typeof data?.shareToken !== "string" ||
          !/^[a-zA-Z0-9_-]+$/.test(data.shareToken)
        )
          throw new Error("Share response could not be verified");
        const shared = new URL(data.shareUrl);
        if (
          (shared.protocol !== "https:" &&
            shared.origin !== window.location.origin) ||
          shared.username ||
          shared.password ||
          shared.pathname !== `/s/${data.shareToken}` ||
          shared.search ||
          shared.hash
        )
          throw new Error("Share response could not be verified");
        url = shared.href;
        setShareUrl(url);
      }
      if (navigator.share) {
        shareSheetOpened = true;
        await navigator.share({
          title: `Trip to ${trip?.destination}`,
          text: `Check out my trip itinerary to ${trip?.destination}!`,
          url: url!,
        });
        if (refreshMounted.current)
          reportShareStatus(
            "Link ready to send. Anyone with it can view this trip.",
          );
      } else {
        await navigator.clipboard.writeText(url!);
        if (refreshMounted.current)
          reportShareStatus("Public share link copied to your clipboard.");
      }
    } catch (err) {
      if (!refreshMounted.current) return;
      reportShareStatus(
        shareSheetOpened && err instanceof Error && err.name === "AbortError"
          ? "Share sheet canceled. Your public link remains active; use Turn off public access to revoke it."
          : "Sharing did not finish. If a public link was created, it remains active until you turn off public access.",
      );
    } finally {
      shareLock.current = false;
      if (refreshMounted.current) setIsShareBusy(false);
    }
  };

  const handleRevokeShare = async () => {
    if (shareLock.current || !refreshMounted.current) return;
    shareLock.current = true;
    setIsShareBusy(true);
    setShareStatus(null);
    try {
      const response = await fetch(`/api/trips/${tripId}/share`, {
        method: "DELETE",
        signal: AbortSignal.timeout(20_000),
      });
      if (!refreshMounted.current) return;
      if (!response.ok) throw new Error("Failed to stop sharing");
      const confirmation = await response.json();
      if (!refreshMounted.current) return;
      if (confirmation?.success !== true)
        throw new Error("Revocation could not be confirmed");
      setShareUrl(null);
      setShareStatus("Public access has been turned off.");
    } catch (revokeError) {
      if (!refreshMounted.current) return;
      console.error("Share revocation failed:", revokeError);
      setShareStatus("We couldn’t turn off public access. Please try again.");
    } finally {
      shareLock.current = false;
      if (refreshMounted.current) setIsShareBusy(false);
    }
  };

  const handleRetry = async () => {
    if (!trip || retryLock.current || !refreshMounted.current) return;
    retryLock.current = true;
    setIsRetrying(true);
    setBriefSavedNotice(false);

    try {
      const planningHeaders = await requestPlanningConsent(trip.user_id);
      if (!refreshMounted.current) return;
      const headers = await planningHeaders();
      if (!refreshMounted.current) return;
      // Trigger new generation
      const genRes = await fetch(`/api/trips/${tripId}/generate`, {
        method: "POST",
        signal: AbortSignal.timeout(25_000),
        headers,
      });

      if (!refreshMounted.current) return;
      if (!genRes.ok && genRes.status !== 409) {
        const data = await genRes.json().catch(() => ({}));
        throw new Error(data.error || "Failed to retry generation");
      }

      // Refetch trip to pick up the new search_id
      await fetchTrip();
    } catch (err) {
      if (!refreshMounted.current) return;
      if (err instanceof Error && err.name === "PlanningConsentDeclinedError") {
        return;
      }
      console.error("Retry failed:", err);
      setError(err instanceof Error ? err.message : "Retry failed");
    } finally {
      retryLock.current = false;
      if (refreshMounted.current) setIsRetrying(false);
    }
  };

  const handleDownloadItinerary = () => {
    if (!trip) return;
    const text = buildTripExportText(trip, itinerary);
    const filename = buildTripExportFilename(trip);
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownloadCalendar = () => {
    if (!trip) return;
    const ics = buildTripIcsContent(trip, itinerary);
    const filename = buildTripIcsFilename(trip);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDeleteTrip = async () => {
    if (!trip || deleteLock.current || !refreshMounted.current) return;
    deleteLock.current = true;
    setIsDeleting(true);
    setError(null);
    try {
      const response = await fetch(`/api/trips/${tripId}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(15_000),
      });
      if (!refreshMounted.current) return;
      if (response.status === 401) {
        deleteLock.current = false;
        setIsDeleting(false);
        router.push("/auth/login?redirectTo=/trips/" + tripId);
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete trip");
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      deleteLock.current = false;
      if (!refreshMounted.current) return;
      setError(err instanceof Error ? err.message : "Failed to delete trip");
      setIsDeleting(false);
      setConfirmDeleteOpen(false);
    }
  };

  // Global recommendation is independent of the first occupied night.
  const topHotel = itinerary?.topHotel ?? null;

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

  // Trip length (days) from date range — used for nights estimate during generation / hotel card
  const skeletonDayCount = useMemo(() => {
    if (!trip) return 3;
    const start = parseTripDate(trip.start_date);
    const end = parseTripDate(trip.end_date);
    const diff = getTripDuration(start, end) ?? 3;
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
  const displayDays: TripDay[] | null = itinerary?.days?.length
    ? itinerary.days
    : generation.days?.length
      ? generation.days
      : itinerary?.days || null;
  const displayTopHotel = topHotel || generation.topHotel;
  const hasStreamedSpecBlocks = generation.specBlocks.length > 0;
  const readyScreenDescription =
    itinerary?.overview ||
    `We've drafted ${Math.max(1, skeletonDayCount)} days in ${trip?.destination || "your destination"}. Review your suggested stops and confirm current prices and availability before booking.`;
  const readyScreenHeroImage =
    destinationImage(trip?.destination || "") || displayTopHotel?.images?.[0];
  const activeDay = Math.min(
    selectedDay,
    Math.max(0, (displayDays?.length ?? 1) - 1),
  );
  const dayIdPrefix = `trip-${tripId}-day`;

  const tripVibes = useMemo(() => {
    if (Array.isArray(trip?.vibes) && trip.vibes.length > 0) return trip.vibes;
    const prefVibes = trip?.preferences?.vibes;
    return Array.isArray(prefVibes)
      ? prefVibes.filter((v): v is string => typeof v === "string")
      : undefined;
  }, [trip]);

  const tripRequirements = useMemo<ItineraryDayRequirements | undefined>(() => {
    const raw = trip?.preferences?.requirements;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      if (trip?.dietary_restrictions?.length || trip?.mobility_needs) {
        return {
          dietaryPreferences: trip.dietary_restrictions ?? undefined,
          mobilityNotes: trip.mobility_needs ?? undefined,
        };
      }
      return undefined;
    }
    const r = raw as Record<string, unknown>;
    return {
      allergies: Array.isArray(r.allergies)
        ? r.allergies.filter((v): v is string => typeof v === "string")
        : undefined,
      dietaryPreferences: Array.isArray(r.dietaryPreferences)
        ? r.dietaryPreferences.filter((v): v is string => typeof v === "string")
        : (trip?.dietary_restrictions ?? undefined),
      accessibility: Array.isArray(r.accessibility)
        ? r.accessibility.filter((v): v is string => typeof v === "string")
        : undefined,
      mobilityNotes:
        typeof r.mobilityNotes === "string"
          ? r.mobilityNotes
          : (trip?.mobility_needs ?? undefined),
    };
  }, [trip]);

  const showFullGenerationLoader =
    !!trip &&
    ((isGenerating && !peekingDayOne) ||
      (showCompletedDossier && tripIsComplete && !!displayDays?.length));
  const stickyBookingVisible =
    showStickyBar && !trip?.preferences?.planNeedsRefresh;

  useEffect(() => {
    if (isGenerating) {
      setHasSeenGeneratingThisSession(true);
      setShowCompletedDossier(false);
      setPeekingDayOne(false);
      setBriefSavedNotice(false);
    }
  }, [isGenerating]);

  useEffect(() => {
    if (
      showFullGenerationLoader ||
      !displayDays?.length ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }
    const sectionIds = ["trip-itinerary", "trip-stay", "trip-details"] as const;
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const topId = visible[0]?.target.id;
        if (
          topId === "trip-itinerary" ||
          topId === "trip-stay" ||
          topId === "trip-details"
        ) {
          setActiveSection(topId);
        }
      },
      { rootMargin: "-96px 0px -55% 0px", threshold: 0 },
    );

    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, [showFullGenerationLoader, displayDays?.length]);

  const planningConsentModal = (
    <PlanningConsentDialog
      open={consentDialog !== null}
      message={consentDialog?.message ?? ""}
      onConfirm={() => {
        const resolve = consentResolveRef.current;
        consentResolveRef.current = null;
        setConsentDialog(null);
        resolve?.(true);
      }}
      onCancel={() => {
        const resolve = consentResolveRef.current;
        consentResolveRef.current = null;
        setConsentDialog(null);
        resolve?.(false);
      }}
    />
  );

  useEffect(() => {
    if (
      hasSeenGeneratingThisSession &&
      tripIsComplete &&
      !!displayDays?.length &&
      !showCompletedDossier
    ) {
      setShowCompletedDossier(true);
      setHasSeenGeneratingThisSession(false);
    }
  }, [
    hasSeenGeneratingThisSession,
    tripIsComplete,
    displayDays?.length,
    showCompletedDossier,
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
            {error.replace(/\.+$/, "")}. Your trip is saved.{" "}
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
          heroImageUrl={readyScreenHeroImage}
          hotelPreview={
            displayTopHotel
              ? {
                  name: displayTopHotel.name,
                  image: displayTopHotel.images?.[0],
                  description: displayTopHotel.description,
                  amenities: displayTopHotel.amenities,
                }
              : undefined
          }
          startDate={trip.start_date}
          endDate={trip.end_date}
          days={isComplete ? displayDays : generation.days}
          specBlocks={generation.specBlocks}
          nights={Math.max(0, skeletonDayCount - 1)}
          travelers={trip.travelers}
          failureConfirmed={trip.status === "failed"}
          phase={
            isComplete ? "complete" : isFailed ? "error" : generation.phase
          }
          progress={isComplete ? 100 : generation.progress}
          message={
            generation.error ||
            (isFailed
              ? "Planning was interrupted. Your drafted chapters are preserved."
              : generation.message)
          }
          summary={readyScreenDescription}
          onOpenTrip={() => {
            setShowCompletedDossier(false);
            setPeekingDayOne(false);
          }}
          discoveries={generation.discoveries}
          onPeekDayOne={() => {
            setShowCompletedDossier(false);
            setPeekingDayOne(true);
          }}
          searchProgress={generation.searchProgress}
          activitiesCount={generation.activitiesCount}
          diningCount={generation.diningCount}
          transportCount={generation.transportCount}
        >
          <aside className="rounded-2xl bg-white p-5 text-slate-700">
            <p role="status" className="text-sm text-slate-500">
              {isComplete
                ? "Your itinerary is saved and ready to explore."
                : planningStatus ||
                  "Your trip is saved. You can leave this page and return without starting another plan."}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              {generation.phase === "error" &&
                shouldStream &&
                trip.status === "generating" && (
                  <button
                    type="button"
                    onClick={generation.reconnect}
                    className="min-h-11 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Reconnect live updates
                  </button>
                )}
              {trip.status === "failed" && (
                <button
                  type="button"
                  disabled={isRetrying}
                  onClick={handleRetry}
                  className="min-h-11 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {isRetrying ? "Starting planning…" : "Try planning again"}
                </button>
              )}
              <button
                type="button"
                disabled={checkingPlanning}
                onClick={checkPlanningStatus}
                className="font-semibold text-primary-800 underline disabled:opacity-50"
              >
                {checkingPlanning
                  ? "Checking status…"
                  : "Check planning status"}
              </button>
              <Link href="/dashboard" className="text-slate-500 underline">
                Back to saved trips
              </Link>
            </div>
            {planningStatus && (
              <p className="mt-2 break-all text-xs text-slate-500">
                If you need help, keep this trip ID: {tripId}
              </p>
            )}
          </aside>
        </ItineraryGenerationLoader>
        {planningConsentModal}
        {floatingNotice && (
          <div
            role="status"
            aria-live="polite"
            className="print-hidden fixed top-4 left-1/2 z-[110] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white shadow-xl"
          >
            <span>{floatingNotice}</span>
            <button
              type="button"
              onClick={() => setFloatingNotice(null)}
              aria-label="Dismiss notice"
              className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fa]">
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
        heroImageUrl={readyScreenHeroImage}
        status={tripStatus}
        onShare={() => handleShare()}
      />

      <main className="finished-journey max-w-4xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8 pb-28">
        {displayDays?.length ? (
          <nav
            aria-label="Trip sections"
            className="print-hidden sticky top-0 z-40 -mx-4 mb-8 flex gap-2 overflow-x-auto border-b border-slate-200 bg-[#f7f8fa]/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6"
          >
            {(
              [
                { id: "trip-itinerary", label: "Your days" },
                { id: "trip-stay", label: "Your stay" },
                { id: "trip-details", label: "Trip details" },
              ] as const
            ).map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                onClick={() => setActiveSection(section.id)}
                aria-current={activeSection === section.id ? "true" : undefined}
                className={`flex min-h-11 shrink-0 items-center rounded-full px-5 text-sm transition-colors ${
                  activeSection === section.id
                    ? "bg-slate-900 font-semibold text-white"
                    : "font-medium text-slate-600 hover:bg-white"
                }`}
              >
                {section.label}
              </a>
            ))}
          </nav>
        ) : null}
        {trip.preferences?.planNeedsRefresh === true && (
          <div
            role="status"
            className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            <p className="max-w-xl">
              Your updated brief is saved. The previous plan below uses your
              earlier dates and preferences. Start planning to update it before
              checkout or sharing.
            </p>
            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying || isGenerating}
              className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`}
                aria-hidden="true"
              />
              {isRetrying ? "Starting…" : "Regenerate itinerary"}
            </button>
          </div>
        )}
        {/* Generation Failed */}
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"
          >
            {error.replace(/\.+$/, "")}. Your last loaded trip is still shown.{" "}
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
          <div
            className={`border rounded-2xl p-6 mb-6 ${trip.status === "draft" ? "bg-primary-50 border-primary-100" : "bg-red-50 border-red-200"}`}
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0">
                {trip.status === "draft" ? (
                  <Sparkles className="w-5 h-5 text-primary" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">
                  {trip.status === "draft"
                    ? "Your trip is saved"
                    : "Planning was interrupted"}
                </h3>
                <p className="text-sm text-gray-700 mb-4">
                  {trip.status === "draft"
                    ? "Your choices are saved. Start planning when you are ready."
                    : generation.error ||
                      "Your saved trip is still available. Try planning again."}
                </p>
                <button
                  onClick={handleRetry}
                  disabled={isRetrying}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
          <section aria-label="Journey overview" className="mb-10 px-1">
            <h2 className="font-editorial text-2xl text-slate-900 mb-4 sm:text-3xl">
              A journey shaped around you
            </h2>
            <p className="text-gray-600 leading-relaxed">
              {itinerary.overview}
            </p>
          </section>
        )}

        {/* Optional map stays compact so the day plan is easy to reach. */}
        {itinerary && !isGenerating && (
          <details
            open={mapOpen}
            onToggle={(event) => setMapOpen(event.currentTarget.open)}
            className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6"
          >
            <summary className="cursor-pointer px-5 py-4 text-sm font-semibold">
              Explore your trip on the map
            </summary>
            {mapOpen && (
              <ItineraryMap itinerary={itinerary} className="h-64 sm:h-80" />
            )}
          </details>
        )}

        {/* Day-by-Day Itinerary — progressive rendering */}
        {displayDays && displayDays.length > 0 ? (
          <div id="trip-itinerary" className="space-y-5 scroll-mt-24">
            {isGenerating && peekingDayOne && (
              <div
                role="status"
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-primary-100 bg-primary-50/70 px-4 py-3 text-sm text-primary-900"
              >
                <span className="font-medium">
                  Previewing Day 1 while Faroway finishes the rest of your trip…
                </span>
                <button
                  type="button"
                  onClick={() => setPeekingDayOne(false)}
                  className="inline-flex min-h-9 items-center rounded-full bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Back to live progress
                </button>
              </div>
            )}
            {!isGenerating &&
              itinerary &&
              !trip.preferences?.planNeedsRefresh && (
                <>
                  <TripCompanionBanner
                    destination={trip.destination}
                    startDate={trip.start_date}
                    endDate={trip.end_date}
                    itinerary={itinerary}
                    activeDayNumber={
                      displayDays[activeDay]?.dayNumber ?? activeDay + 1
                    }
                    disabled={copilotBusy}
                    onTriggerRainSwap={(dayNumber) =>
                      triggerCopilotQuickAction({
                        type: "rain_backup",
                        dayNumber,
                      })
                    }
                  />
                  <TripCopilotBar
                    id={copilotBarId}
                    tripId={tripId}
                    destination={trip.destination}
                    itinerary={itinerary}
                    activeDayNumber={
                      displayDays[activeDay]?.dayNumber ?? activeDay + 1
                    }
                    expectedUpdatedAt={trip.updated_at}
                    expectedPlanRevision={trip.plan_revision_id ?? null}
                    isShared={Boolean(shareUrl)}
                    pendingAction={copilotQuickAction}
                    onBusyChange={setCopilotBusy}
                    onItineraryUpdated={handleCopilotItineraryUpdated}
                    onSyncRequested={fetchTrip}
                  />
                </>
              )}
            <div className="flex items-center justify-between">
              <h2
                tabIndex={-1}
                className="font-editorial text-2xl text-slate-900 outline-none sm:text-3xl"
              >
                Your itinerary
              </h2>
              {bookableCount > 0 && !trip.preferences?.planNeedsRefresh && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-50 text-primary-700 rounded-full text-xs font-bold">
                  <Ticket className="w-3.5 h-3.5" />
                  {bookableCount} bookable experience
                  {bookableCount > 1 ? "s" : ""}
                </span>
              )}
            </div>
            {trip.preferences?.planNeedsRefresh === true && (
              <section aria-label="Previous plan" className="space-y-4">
                {displayDays.map((day, index) => (
                  <article
                    key={day.dayNumber || index}
                    className="rounded-2xl border border-gray-200 bg-white p-5"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Previous plan · {day.date}
                    </p>
                    <h3 className="mt-1 font-semibold text-gray-900">
                      {day.title}
                    </h3>
                    <p className="mt-2 text-sm text-gray-600">{day.summary}</p>
                    <ul className="mt-3 space-y-2 text-sm text-gray-700">
                      {[day.morning, day.afternoon, day.evening]
                        .flatMap((slot) => [
                          ...(slot?.activities ?? []),
                          ...(slot?.meals ?? []),
                        ])
                        .map((item, itemIndex) => (
                          <li key={`${item.name}-${itemIndex}`}>{item.name}</li>
                        ))}
                    </ul>
                  </article>
                ))}
              </section>
            )}
            {!trip.preferences?.planNeedsRefresh && (
              <TripCheckout tripId={tripId} travelers={trip.travelers}>
                {!isGenerating && (
                  <TripDayNavigation
                    days={displayDays}
                    selectedIndex={activeDay}
                    onSelect={setSelectedDay}
                    idPrefix={dayIdPrefix}
                  />
                )}
                {displayDays.map((day, index) => (
                  <div
                    key={day.dayNumber || index}
                    id={`${dayIdPrefix}-panel-${index}`}
                    role={isGenerating ? undefined : "tabpanel"}
                    aria-labelledby={
                      isGenerating ? undefined : `${dayIdPrefix}-tab-${index}`
                    }
                    hidden={!isGenerating && index !== activeDay}
                    tabIndex={isGenerating ? undefined : 0}
                    className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-slate-900"
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
                        diningOptions={day.diningOptions}
                        timingProposal={day.timingProposal}
                        defaultExpanded={true}
                        transport={day.transport}
                        hotel={day.hotel}
                        destination={trip.destination}
                        vibes={tripVibes}
                        requirements={tripRequirements}
                        onQuickAction={
                          !isGenerating &&
                          itinerary &&
                          !trip.preferences?.planNeedsRefresh
                            ? triggerCopilotQuickAction
                            : undefined
                        }
                      />
                    </DayErrorBoundary>
                  </div>
                ))}
              </TripCheckout>
            )}
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
          <EmptyItinerary
            destination={trip.destination}
            onGenerate={handleRetry}
            isRetrying={isRetrying}
          />
        ) : null}

        <section
          id="trip-stay"
          aria-label="Your stay"
          className="mt-12 scroll-mt-24"
        >
          <h2 className="mb-5 font-editorial text-2xl text-slate-900 sm:text-3xl">
            A place to settle in
          </h2>
          <HotelQuotePanel trip={trip} />
          {/* Recommended Hotel — fades in from stream or DB */}
          {displayTopHotel && !trip.preferences?.planNeedsRefresh && (
            <div>
              <FeaturedHotelCard
                hotel={displayTopHotel}
                stayEstimate={featuredStayEstimate(
                  itinerary?.days ?? [],
                  { startDate: trip.start_date, endDate: trip.end_date },
                  displayTopHotel,
                )}
              />
            </div>
          )}
        </section>
        <section
          id="trip-details"
          aria-label="Trip details"
          className="mt-12 scroll-mt-24"
        >
          <h2 className="mb-5 font-editorial text-2xl text-slate-900 sm:text-3xl">
            The details, taken care of
          </h2>
          {itinerary?.days?.length && !trip.preferences?.planNeedsRefresh && (
            <VenueEvidencePanel
              key={`${trip.id}:${trip.updated_at}`}
              tripId={trip.id}
              ownerId={trip.user_id}
              revision={trip.updated_at}
              days={itinerary.days}
            />
          )}
          <TripBriefEditor
            key={`brief:${trip.updated_at}`}
            trip={trip}
            onReload={fetchTrip}
            onSaved={(saved) => {
              setTrip(saved);
              setBriefSavedNotice(true);
              setShareUrl(
                saved.is_shared && saved.share_token
                  ? `${window.location.origin}/s/${saved.share_token}`
                  : null,
              );
              setShareStatus(
                saved.is_shared
                  ? "Brief saved. Your public link is unchanged."
                  : "Brief saved. Public access is off until you share the updated plan.",
              );
            }}
          />
          {briefSavedNotice && !isGenerating && (
            <div
              role="status"
              className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"
            >
              <p>
                Trip brief saved. Ready to rebuild your itinerary with these
                changes?
              </p>
              <button
                type="button"
                onClick={handleRetry}
                disabled={isRetrying}
                className="inline-flex min-h-10 items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${isRetrying ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                {isRetrying ? "Starting…" : "Regenerate itinerary"}
              </button>
            </div>
          )}
          {planEditingEnabled &&
            itinerary &&
            !isGenerating &&
            !trip.preferences?.planNeedsRefresh && (
              <PlanEditor
                key={`plan:${trip.updated_at}`}
                open={planEditorOpen}
                onOpenChange={setPlanEditorOpen}
                tripId={trip.id}
                userId={trip.user_id}
                onSaved={() => {
                  void fetchTrip();
                }}
              />
            )}

          {bookingChecklistEnabled && (
            <BookingChecklist
              key={`bookings:${trip.updated_at}`}
              tripId={trip.id}
              userId={trip.user_id}
            />
          )}

          {itinerary?.days?.some((day) => day.transport) && (
            <details className="mb-6 rounded-2xl border border-slate-200 bg-white">
              <summary className="min-h-14 cursor-pointer px-5 py-4 text-sm font-semibold">
                Getting there
              </summary>
              <div className="px-5 pb-2">
                {/* Featured Flights */}
                {!trip.preferences?.planNeedsRefresh && (
                  <FeaturedFlights days={itinerary?.days || null} />
                )}
              </div>
            </details>
          )}
        </section>
        {itinerary?.days?.length ? (
          <LiveTripBudget
            days={itinerary.days}
            startDate={trip.start_date}
            endDate={trip.end_date}
            travelers={trip.travelers}
            paused={!!trip.preferences?.planNeedsRefresh}
          />
        ) : null}

        {/* General Tips */}
        {itinerary?.generalTips && itinerary.generalTips.length > 0 && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
            <h3 className="font-bold text-primary-800 mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Travel notes for{" "}
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
              <Shield className="h-4 w-4" /> Packing suggestions
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

        {isComplete && (!!displayDays?.length || itinerary) && (
          <TripFeedback tripId={tripId} />
        )}

        {/* Share This Trip */}
        {trip && (
          <div
            id={shareCardId}
            className="mt-10 rounded-3xl border border-slate-200 bg-white p-6 text-center sm:p-8"
          >
            <h3 className="font-editorial text-2xl text-slate-900 mb-2">
              Bring someone into the journey
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Share your plans with the people you’re traveling with.
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
                disabled={
                  !hydrated ||
                  isShareBusy ||
                  !!trip.preferences?.planNeedsRefresh
                }
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-600 disabled:opacity-50"
              >
                {trip.preferences?.planNeedsRefresh
                  ? "Update plan before sharing"
                  : isShareBusy
                    ? "Creating link…"
                    : "Create public share link"}
              </button>
            )}
            {shareUrl ? (
              <button
                type="button"
                onClick={handleRevokeShare}
                disabled={!hydrated || isShareBusy}
                className="mt-4 min-h-11 text-sm font-medium text-slate-600 hover:text-red-700 disabled:opacity-50"
              >
                Turn off public access
              </button>
            ) : null}
            {shareStatus && (
              <p className="mt-3 text-sm text-gray-600" role="status">
                {shareStatus}
              </p>
            )}
          </div>
        )}

        {/* Export, Print & Manage Trip */}
        {!isGenerating && (
          <div className="print-hidden mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-bold text-slate-900">
              Take your itinerary with you
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Save a print/PDF copy or plain-text file for offline access while
              traveling.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {displayDays?.length ? (
                <>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    <Printer className="h-4 w-4" aria-hidden="true" />
                    Print / Save PDF
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadItinerary}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    <Download className="h-4 w-4" aria-hidden="true" />
                    Download text (.txt)
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadCalendar}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    <Calendar className="h-4 w-4" aria-hidden="true" />
                    Download calendar (.ics)
                  </button>
                </>
              ) : null}
              {!confirmDeleteOpen ? (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteOpen(true)}
                  className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete trip
                </button>
              ) : (
                <div className="ml-auto flex flex-wrap items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-900">
                  <span>Permanently delete this trip?</span>
                  <button
                    type="button"
                    onClick={handleDeleteTrip}
                    disabled={isDeleting}
                    className="rounded-full bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    {isDeleting ? "Deleting…" : "Confirm delete"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOpen(false)}
                    disabled={isDeleting}
                    className="rounded-full border border-red-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      {planningConsentModal}
      {floatingNotice && (
        <div
          role="status"
          aria-live="polite"
          className="print-hidden fixed top-4 left-1/2 z-[110] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center justify-between gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-white shadow-xl"
        >
          <span>{floatingNotice}</span>
          <button
            type="button"
            onClick={() => setFloatingNotice(null)}
            aria-label="Dismiss notice"
            className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Sticky Booking Bar */}
      {isComplete && bookableCount > 0 && (
        <div
          role="region"
          aria-label="Booking options"
          aria-hidden={!stickyBookingVisible}
          inert={!stickyBookingVisible}
          className={`fixed bottom-0 left-0 right-0 z-50 transition-all duration-300 ${
            stickyBookingVisible
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
                    Review options and confirm availability
                  </p>
                </div>
              </div>
              <button
                disabled={!stickyBookingVisible}
                onClick={() => {
                  const section = document.getElementById("trip-itinerary");
                  section?.scrollIntoView({
                    behavior: window.matchMedia(
                      "(prefers-reduced-motion: reduce)",
                    ).matches
                      ? "instant"
                      : "smooth",
                  });
                  section
                    ?.querySelector<HTMLElement>("h2")
                    ?.focus({ preventScroll: true });
                }}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-5 py-2.5 bg-gradient-to-r from-primary to-primary-600 text-white rounded-xl text-sm font-bold shadow-md hover:shadow-lg hover:shadow-primary/25 transition-all active:scale-[0.98]"
              >
                <ChevronUp className="w-4 h-4" />
                View itinerary
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Featured Flights ────────────────────────────────────────────────────────

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
              {returnFlight
                ? "Outbound and return details"
                : "Outbound details · Return details unavailable"}
            </p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-xl font-black text-white">Estimates by flight</p>
            <p className="text-[11px] text-blue-200">
              Confirm fares with the provider
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

        <p className="mt-5 rounded-xl bg-white/95 px-4 py-3 text-sm font-medium text-blue-900">
          Flight booking unavailable. Confirm the fare, times, and cancellation
          terms with the airline or a flight seller.
        </p>
      </div>
    </div>
  );
}

// ── Empty Itinerary ─────────────────────────────────────────────────────────

function EmptyItinerary({
  destination,
  onGenerate,
  isRetrying,
}: {
  destination: string;
  onGenerate: () => void;
  isRetrying: boolean;
}) {
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
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onGenerate}
          disabled={isRetrying}
          className="inline-flex min-h-11 items-center gap-2 px-6 py-3 bg-primary text-white rounded-full font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50"
        >
          <Sparkles className="w-5 h-5" />
          {isRetrying ? "Starting…" : "Generate Itinerary"}
        </button>
        <Link
          href={`/create?destination=${encodeURIComponent(destination)}`}
          className="inline-flex min-h-11 items-center gap-2 px-5 py-3 border border-gray-300 bg-white text-gray-700 rounded-full text-sm font-semibold hover:bg-gray-50 transition-colors"
        >
          Plan a new trip
        </Link>
      </div>
    </div>
  );
}
