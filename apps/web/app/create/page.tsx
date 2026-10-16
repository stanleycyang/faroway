"use client";
import {
  CreateTripSchema,
  type PendingCreateTrip,
} from "@/lib/trips/create-trip-command";
import { requestPlanningConsent } from "@/lib/ai/planning-consent-client";

import React, { useEffect, useState, useRef } from "react";
import { ResilientImage as Image } from "@/components/ResilientImage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/hooks/useUser";
import {
  Calendar,
  Users,
  Sparkles,
  Check,
  Minus,
  Plus,
  X,
  MapPin,
  Compass,
  UserRound,
  Heart,
  Briefcase,
  Mountain,
  Palmtree,
  Landmark,
  Utensils,
  Music,
  Trees,
  ShoppingBag,
  Flower2,
  Camera,
} from "lucide-react";
import { format } from "date-fns";
import { destinations as destinationCatalog } from "@/lib/planner-destination-catalog";
import {
  IMAGE_PATHS,
  getImageUrl,
  validateHotelSearchDetails,
  hotelGuestCounts,
  type HotelSearchDetails,
} from "@faroway/constants";
import { HotelSearchFields } from "@/components/trips/HotelSearchFields";
import { hotelSearchEnabled } from "@/lib/trips/hotel-quotes";
import {
  PlacesAutocompleteInput,
  type PlaceResult,
} from "@/components/create/PlacesAutocompleteInput";
import { DatePicker } from "@/components/trips/DatePicker";
import {
  plannerDestination,
  type PlannerDestination,
} from "@/lib/planner-destination";
import {
  parseCreateDraftDate,
  saveCreateDraft,
  takeCreateDraft,
  saveEditorDraft,
  readEditorDraft,
  clearEditorDraft,
  restoreHotelSearchDraft,
} from "@/lib/create-draft";

const destinations = destinationCatalog.map((destination) => ({
  ...destination,
  image: getImageUrl(
    IMAGE_PATHS.destinations[
      destination.id as keyof typeof IMAGE_PATHS.destinations
    ],
  ),
}));

const budgetOptions = [
  { id: "budget", label: "Budget", description: "Thoughtful value" },
  { id: "moderate", label: "Comfort", description: "A little more room" },
  { id: "luxury", label: "Luxury", description: "Exceptional stays" },
] as const;

const travelerTypes = [
  { id: "solo", label: "Solo", icon: UserRound },
  { id: "couple", label: "Couple", icon: Heart },
  { id: "family", label: "Family", icon: Users },
  { id: "friends", label: "Friends", icon: Users },
  { id: "business", label: "Business", icon: Briefcase },
];

const vibes = [
  { id: "adventure", label: "Adventure", icon: Mountain },
  { id: "relaxation", label: "Relaxation", icon: Palmtree },
  { id: "cultural", label: "Cultural", icon: Landmark },
  { id: "foodie", label: "Foodie", icon: Utensils },
  { id: "nightlife", label: "Nightlife", icon: Music },
  { id: "romantic", label: "Romantic", icon: Heart },
  { id: "nature", label: "Nature", icon: Trees },
  { id: "shopping", label: "Shopping", icon: ShoppingBag },
  { id: "wellness", label: "Wellness", icon: Flower2 },
  { id: "photography", label: "Photography", icon: Camera },
];

type SelectedPlace = PlannerDestination;

interface StoredCreateDraft {
  selectedPlace: SelectedPlace;
  startDate: string;
  endDate: string;
  travelers: number;
  travelerType: string;
  selectedVibes: string[];
  showAdvanced: boolean;
  hotelSearch?: HotelSearchDetails | null;

  budget?: (typeof budgetOptions)[number]["id"];
}

export default function CreateTripPage() {
  const { session, loading, accountRevision } = useUser();
  return (
    <CreateTripPlanner
      key={`${session?.user.id ?? "guest"}:${accountRevision ?? 0}`}
      session={session}
      authLoading={loading}
    />
  );
}

function CreateTripPlanner({
  session,
  authLoading,
}: {
  session: ReturnType<typeof useUser>["session"];
  authLoading: boolean;
}) {
  const router = useRouter();
  const [draftLoaded, setDraftLoaded] = useState(false);
  const scrollToSection = (id: string) => {
    const section = document.getElementById(id);
    section?.scrollIntoView({ behavior: "instant", block: "start" });
    section?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  };
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(
    null,
  );
  const [showDestinations, setShowDestinations] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [hotelSearch, setHotelSearch] = useState<HotelSearchDetails | null>(
    null,
  );
  const [travelers, setTravelers] = useState(2);
  const [budget, setBudget] =
    useState<(typeof budgetOptions)[number]["id"]>("moderate");
  const [travelerType, setTravelerType] = useState("couple");
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const submissionLock = useRef(false);
  const [pendingRequest, setPendingRequest] =
    useState<PendingCreateTrip | null>(null);
  useEffect(() => {
    setPendingRequest(null);
    if (!session?.user.id) return;
    try {
      const saved = localStorage.getItem(
        `faroway:pending-create:${session.user.id}`,
      );
      const value = saved ? JSON.parse(saved) : null;
      const parsed = CreateTripSchema.safeParse(value);
      if (parsed.success && parsed.data.requestId) {
        setPendingRequest({ ...parsed.data, requestId: parsed.data.requestId });
      } else if (saved) {
        setGenerateError(
          "Your previous request couldn’t be read. Check My Trips before starting a new trip.",
        );
      }
    } catch {
      setGenerateError(
        "Your unfinished request couldn’t be read. Check My Trips before starting a new trip.",
      );
    }
  }, [session?.user.id]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setDraftLoaded(true);
    const draftId = params.get("draft");
    let draft: Partial<StoredCreateDraft> | null = null;

    if (draftId) {
      try {
        draft = takeCreateDraft<StoredCreateDraft>(localStorage, draftId);
      } catch {
        draft = null;
      }
      params.delete("draft");
      const query = params.toString();
      window.history.replaceState(
        null,
        "",
        `/create${query ? `?${query}` : ""}`,
      );
    }

    if (!draft && !params.has("destination")) {
      try {
        draft = readEditorDraft<StoredCreateDraft>(sessionStorage);
      } catch {
        /* Setup still works when browser storage is unavailable. */
      }
    }

    if (draft) {
      const restoredStart = parseCreateDraftDate(draft.startDate);
      const restoredEnd = parseCreateDraftDate(draft.endDate);

      setSelectedPlace(plannerDestination(draft.selectedPlace, destinations));
      if (restoredStart && !Number.isNaN(restoredStart.getTime())) {
        setStartDate(restoredStart);
      }
      if (restoredEnd && (!restoredStart || restoredEnd >= restoredStart)) {
        setEndDate(restoredEnd);
      }
      if (
        typeof draft.travelers === "number" &&
        Number.isInteger(draft.travelers) &&
        draft.travelers >= 1 &&
        draft.travelers <= 50
      ) {
        setTravelers(draft.travelers);
      }
      if (
        typeof draft.travelerType === "string" &&
        travelerTypes.some((type) => type.id === draft.travelerType)
      ) {
        setTravelerType(draft.travelerType);
      }
      if (Array.isArray(draft.selectedVibes)) {
        setSelectedVibes(
          [
            ...new Set(
              draft.selectedVibes.filter(
                (value): value is string =>
                  typeof value === "string" &&
                  vibes.some((vibe) => vibe.id === value),
              ),
            ),
          ].slice(0, 5),
        );
      }
      if (
        draft.budget === "budget" ||
        draft.budget === "moderate" ||
        draft.budget === "luxury"
      )
        setBudget(draft.budget);
      setShowAdvanced(draft.showAdvanced === true);
      if (hotelSearchEnabled()) {
        const restoredHotelSearch = restoreHotelSearchDraft(draft.hotelSearch);
        setHotelSearch(restoredHotelSearch);
        if (validateHotelSearchDetails(restoredHotelSearch))
          setTravelers(hotelGuestCounts(restoredHotelSearch).travelers);
      }
      return;
    }

    const requestedDestination = params.get("destination");
    if (!requestedDestination) return;
    const normalized = requestedDestination.trim().toLowerCase();
    const recommended = destinations.find(
      (destination) =>
        destination.id === normalized ||
        destination.name.toLowerCase() === normalized,
    );
    setSelectedPlace(
      recommended
        ? {
            name: recommended.name,
            lat: recommended.lat,
            lng: recommended.lng,
            placeId: recommended.id,
            isRecommended: true,
            source: "catalog",
          }
        : {
            name: requestedDestination
              .replace(/-/g, " ")
              .replace(/\b\w/g, (letter) => letter.toUpperCase()),
            lat: 0,
            lng: 0,
            placeId: "",
            isRecommended: false,
            source: "user",
          },
    );
  }, []);

  useEffect(() => {
    if (!draftLoaded || !selectedPlace) return;
    try {
      saveEditorDraft(sessionStorage, {
        selectedPlace,
        startDate: startDate ? format(startDate, "yyyy-MM-dd") : "",
        endDate: endDate ? format(endDate, "yyyy-MM-dd") : "",
        travelers,
        travelerType,
        selectedVibes,
        showAdvanced,
        hotelSearch,
        budget,
      } satisfies StoredCreateDraft);
    } catch {
      /* Autosave is optional; creating a trip still works. */
    }
  }, [
    draftLoaded,
    selectedPlace,
    startDate,
    endDate,
    travelers,
    travelerType,
    selectedVibes,
    showAdvanced,
    hotelSearch,
    budget,
  ]);

  const selectedRecommendedDest = selectedPlace?.isRecommended
    ? destinations.find((d) => d.name === selectedPlace.name)
    : null;

  const toggleVibe = (vibeId: string) => {
    setSelectedVibes((prev) =>
      prev.includes(vibeId)
        ? prev.filter((v) => v !== vibeId)
        : prev.length < 5
          ? [...prev, vibeId]
          : prev,
    );
  };

  const canGenerate =
    selectedPlace &&
    startDate &&
    endDate &&
    (hotelSearch === null ||
      validateHotelSearchDetails(hotelSearch, travelers));

  const handleSelectRecommended = (dest: (typeof destinations)[number]) => {
    setSelectedPlace({
      name: dest.name,
      lat: dest.lat,
      lng: dest.lng,
      placeId: dest.id,
      isRecommended: true,
      source: "catalog",
    });
    setShowDestinations(false);
  };

  const handleSelectFromAutocomplete = (place: PlaceResult) => {
    const entry =
      place.source === "catalog"
        ? destinations.find((d) => d.name === place.name)
        : undefined;
    setSelectedPlace(
      plannerDestination(
        entry
          ? { source: "catalog", name: entry.name, placeId: entry.id }
          : { source: "user", name: place.name },
        destinations,
      ),
    );
    setShowDestinations(false);
  };

  const handleChangeDestination = () => {
    setShowDestinations(true);
  };

  const handleGenerate = async () => {
    if ((!canGenerate && !pendingRequest) || submissionLock.current) return;
    if (!session) {
      if (!canGenerate) return;
      const draft: StoredCreateDraft = {
        selectedPlace,
        startDate: format(startDate, "yyyy-MM-dd"),
        endDate: format(endDate, "yyyy-MM-dd"),
        travelers,
        travelerType,
        selectedVibes,
        showAdvanced,
        hotelSearch,
        budget,
      };
      try {
        const draftId = saveCreateDraft(localStorage, draft);
        const returnPath = `/create?draft=${encodeURIComponent(draftId)}`;
        router.push(`/auth/login?redirectTo=${encodeURIComponent(returnPath)}`);
      } catch {
        setGenerateError(
          "We couldn’t preserve this trip for sign-in. Please check your browser storage settings and try again.",
        );
      }
      return;
    }
    submissionLock.current = true;
    setIsGenerating(true);
    setGenerateError(null);
    setProgressMessage("Creating your trip...");
    let createdTripId: string | null = null;
    const storageKey = `faroway:pending-create:${session.user.id}`;
    try {
      const candidate = pendingRequest ?? {
        requestId: crypto.randomUUID(),
        destination: selectedPlace!.name,
        start_date: format(startDate!, "yyyy-MM-dd"),
        end_date: format(endDate!, "yyyy-MM-dd"),
        travelers,
        budget,
        preferences: {
          travelerType,
          vibes: selectedVibes,
          ...(hotelSearch
            ? {
                hotelSearch,
                adults: hotelGuestCounts(hotelSearch).adults,
                children: hotelGuestCounts(hotelSearch).children,
              }
            : {}),
        },
      };
      const validated = CreateTripSchema.safeParse(candidate);
      if (!validated.success || !validated.data.requestId)
        throw new Error("Review your trip details before planning.");
      const payload: PendingCreateTrip = {
        ...validated.data,
        requestId: validated.data.requestId,
      };
      const planningHeaders = await requestPlanningConsent(session.user.id);
      if (!mounted.current) return;
      // Persist before any write: a lost response or reload reuses the same ID.
      localStorage.setItem(storageKey, JSON.stringify(payload));
      setPendingRequest(payload);
      const createHeaders = await planningHeaders();
      if (!mounted.current) return;
      const response = await fetch("/api/trips", {
        method: "POST",
        signal: AbortSignal.timeout(25_000),
        headers: createHeaders,
        body: JSON.stringify(payload),
      });

      if (!mounted.current) return;
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create trip");
      }

      const { trip } = await response.json();
      if (!mounted.current) return;
      if (
        typeof trip?.id !== "string" ||
        trip.id !== payload.requestId ||
        trip.user_id !== session.user.id
      )
        throw new Error(
          "Trip creation could not be confirmed. Check My Trips before retrying.",
        );
      createdTripId = trip.id;
      try {
        clearEditorDraft(sessionStorage);
      } catch {
        /* The server trip is already saved. */
      }

      setProgressMessage("Starting AI trip planner...");

      const generationHeaders = await planningHeaders();
      if (!mounted.current) return;
      const genResponse = await fetch(`/api/trips/${trip.id}/generate`, {
        method: "POST",
        signal: AbortSignal.timeout(25_000),
        headers: generationHeaders,
        body: JSON.stringify({
          preferences: {
            vibes: pendingRequest?.preferences?.vibes ?? selectedVibes,
          },
        }),
      });

      if (!mounted.current) return;
      if (!genResponse.ok) {
        const genData = await genResponse.json().catch(() => ({}));
        if (!mounted.current) return;
        if (genResponse.status !== 409) {
          throw new Error(
            genData.error || "Failed to start itinerary generation",
          );
        }
      }

      // Redirect to trip detail page — real progress happens there via SSE
      localStorage.removeItem(storageKey);
      setPendingRequest(null);
      router.push(`/trips/${trip.id}`);
    } catch (err) {
      if (!mounted.current) return;
      if (createdTripId) {
        // The trip exists even if starting generation failed or its reply was lost.
        try {
          localStorage.removeItem(storageKey);
        } catch {
          /* Replaying this ID remains safe. */
        }
        setPendingRequest(null);
        router.push(`/trips/${createdTripId}`);
        return;
      }
      setGenerateError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
      setIsGenerating(false);
      setProgressMessage("");
    } finally {
      submissionLock.current = false;
      if (mounted.current) setIsGenerating(false);
    }
  };

  const renderSelectedDestination = () => {
    if (!selectedPlace || showDestinations) return null;

    return (
      <div className="relative h-48 overflow-hidden rounded-2xl sm:h-56">
        {selectedRecommendedDest ? (
          <Image
            src={selectedRecommendedDest.image}
            alt={`${selectedPlace.name}, ${selectedRecommendedDest.country}`}
            fallbackAlt={`Illustrated travel route for ${selectedPlace.name}`}
            fill
            sizes="(max-width: 1024px) 100vw, 760px"
            className="object-cover"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-slate-800">
            <MapPin className="h-16 w-16 text-white/20" aria-hidden="true" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <div className="absolute bottom-5 left-5 text-white">
          <p className="text-sm text-white/85">
            {selectedRecommendedDest?.country}
          </p>
          <h3 className="font-editorial mt-1 text-3xl tracking-tight">
            {selectedPlace.name}
          </h3>
        </div>
        <button
          onClick={handleChangeDestination}
          className="absolute right-4 top-4 min-h-11 rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900"
        >
          Change
        </button>
      </div>
    );
  };

  const renderDestinationSearch = () => {
    if (selectedPlace && !showDestinations) return null;

    return (
      <>
        {selectedPlace && (
          <button
            onClick={() => setShowDestinations(false)}
            className="mb-3 min-h-11 text-sm font-semibold underline underline-offset-4"
          >
            Keep {selectedPlace.name}
          </button>
        )}
        <PlacesAutocompleteInput
          onSelect={handleSelectFromAutocomplete}
          localDestinations={destinations.map((d) => ({
            name: d.name,
            country: d.country,
          }))}
        />

        <div className="flex gap-3 overflow-x-auto snap-x snap-proximity pb-3 mt-4">
          {destinations.map((dest, index) => (
            <button
              key={dest.id}
              aria-label={`Select ${dest.name}, ${dest.country}`}
              aria-pressed={selectedPlace?.name === dest.name}
              onClick={() => handleSelectRecommended(dest)}
              className={`relative h-40 w-40 shrink-0 snap-start rounded-2xl overflow-hidden group text-left sm:h-44 sm:w-48 ${selectedPlace?.name === dest.name ? "ring-2 ring-primary ring-offset-2" : ""}`}
            >
              <Image
                src={dest.image}
                alt={`${dest.name}, ${dest.country}`}
                fallbackAlt={`Illustrated travel route for ${dest.name}`}
                fill
                priority={index < 2}
                sizes="192px"
                className="object-cover motion-safe:group-hover:scale-105 motion-safe:transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-3 left-3">
                <p className="text-white font-semibold">{dest.name}</p>
                <p className="text-white/70 text-xs">{dest.country}</p>
              </div>
              {selectedPlace?.name === dest.name && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </button>
          ))}
        </div>
      </>
    );
  };

  const datesReady = Boolean(selectedPlace && startDate && endDate);
  const preview = selectedRecommendedDest || destinations[0];
  const missingMessage = !selectedPlace
    ? "Choose a destination to get started"
    : !startDate || !endDate
      ? "Choose your dates to continue"
      : !canGenerate
        ? "Complete your hotel room details or turn off hotel searches"
        : "Your trip is ready to plan";

  return (
    <div
      aria-busy={!draftLoaded}
      className="trip-planner min-h-screen bg-white text-slate-900"
    >
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:h-20 lg:px-10">
          <button
            onClick={() => router.back()}
            aria-label="Close trip planner"
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-gray-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
          <Link
            href="/"
            aria-label="Faroway home"
            className="hidden items-center gap-2 text-xl font-extrabold tracking-tight lg:flex"
          >
            <Compass className="h-7 w-7 text-primary-700" />
            faroway<span className="text-primary-700">.</span>
          </Link>
          <p className="text-base font-bold lg:hidden">Plan your trip</p>
          <Link
            href="/dashboard"
            className="flex min-h-11 items-center text-sm font-semibold text-gray-600"
          >
            My trips
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 pb-44 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        <div className="mb-8 hidden lg:block">
          <h1 className="font-editorial text-4xl tracking-[-0.04em] sm:text-5xl">
            Your next chapter starts here.
          </h1>
          <p className="mt-3 text-gray-500">
            Tell us where you want to go. We’ll bring the journey together.
          </p>
        </div>
        <h1 className="sr-only lg:hidden">Plan your trip</h1>
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_360px] xl:gap-20">
          <fieldset
            disabled={!draftLoaded || isGenerating}
            className="min-w-0 space-y-8 sm:space-y-10"
          >
            <section
              id="planner-destination"
              aria-label="Choose destination"
              className="scroll-mt-24"
            >
              <h2
                tabIndex={-1}
                className="mb-4 text-lg font-bold outline-none sm:text-xl"
              >
                Where do you want to go?
              </h2>
              {renderSelectedDestination()}
              {renderDestinationSearch()}
            </section>
            <section
              id="planner-dates"
              aria-label="Trip dates"
              className="scroll-mt-24 border-t border-gray-100 pt-8"
            >
              <h2
                tabIndex={-1}
                className="mb-4 text-lg font-bold outline-none sm:text-xl"
              >
                When are you traveling?
              </h2>
              <DatePicker
                startDate={startDate}
                endDate={endDate}
                onStartDateChange={setStartDate}
                onEndDateChange={setEndDate}
              />
            </section>
            <section
              id="planner-travelers"
              aria-label="Travelers"
              className="scroll-mt-24 border-t border-gray-100 pt-8"
            >
              <h2
                tabIndex={-1}
                className="mb-4 text-lg font-bold outline-none sm:text-xl"
              >
                Who’s traveling?
              </h2>
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Number of travelers
                </label>
                <div className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                  <span className="text-gray-700 font-medium">Travelers</span>
                  <div className="flex items-center gap-4">
                    <button
                      aria-label="Decrease travelers"
                      onClick={() =>
                        setTravelers((current) => Math.max(1, current - 1))
                      }
                      disabled={travelers <= 1 || hotelSearch !== null}
                      className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span
                      className="text-xl font-semibold text-gray-900 w-8 text-center"
                      aria-live="polite"
                    >
                      {travelers}
                    </span>
                    <button
                      aria-label="Increase travelers"
                      onClick={() =>
                        setTravelers((current) => Math.min(50, current + 1))
                      }
                      disabled={travelers >= 50 || hotelSearch !== null}
                      className="w-10 h-10 rounded-full bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Travel group
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {travelerTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setTravelerType(type.id)}
                      aria-pressed={travelerType === type.id}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all ${
                        travelerType === type.id
                          ? "border-primary bg-primary-50 text-primary-700"
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      <type.icon className="h-4 w-4" aria-hidden="true" />
                      <span className="font-medium">{type.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </section>
            <section
              id="planner-comfort"
              aria-label="Travel comfort"
              className="scroll-mt-24 border-t border-gray-100 pt-8"
            >
              <h2
                tabIndex={-1}
                className="mb-4 text-lg font-bold outline-none sm:text-xl"
              >
                Your kind of comfort
              </h2>
              <div
                role="group"
                aria-label="Travel budget"
                className="grid grid-cols-3 gap-2 sm:gap-3"
              >
                {budgetOptions.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => setBudget(option.id)}
                    aria-pressed={budget === option.id}
                    className={`min-h-24 rounded-2xl border px-2 py-4 text-center transition-colors sm:px-4 ${budget === option.id ? "border-primary-700 bg-primary-50 text-primary-800" : "border-gray-200 bg-white text-slate-600 hover:border-slate-400"}`}
                  >
                    <span className="block text-sm font-semibold">
                      {option.label}
                    </span>
                    <span className="mt-2 block text-[11px] leading-5 sm:text-xs">
                      {option.description}
                    </span>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">
                A preference to guide your plan. No bookings or payments are
                made.
              </p>
            </section>
            <section
              id="planner-vibes"
              aria-label="Travel preferences"
              className="scroll-mt-24 border-t border-gray-100 pt-8"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2
                    tabIndex={-1}
                    className="text-lg font-bold outline-none sm:text-xl"
                  >
                    What’s your travel vibe?
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Choose up to 5, or leave it open to discovery.
                  </p>
                </div>
                <span
                  role="status"
                  aria-label={`${selectedVibes.length} of 5 interests selected`}
                  className="shrink-0 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold tabular-nums"
                >
                  {selectedVibes.length}/5
                </span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {vibes.map((vibe) => (
                  <button
                    key={vibe.id}
                    onClick={() => toggleVibe(vibe.id)}
                    aria-pressed={selectedVibes.includes(vibe.id)}
                    disabled={
                      !selectedVibes.includes(vibe.id) &&
                      selectedVibes.length >= 5
                    }
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all ${
                      selectedVibes.includes(vibe.id)
                        ? "border-primary bg-primary-50 text-primary-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    }`}
                  >
                    <vibe.icon className="h-4 w-4" aria-hidden="true" />
                    <span className="font-medium">{vibe.label}</span>
                  </button>
                ))}
              </div>
            </section>
            {hotelSearchEnabled() && (
              <section
                id="planner-hotels"
                aria-label="Hotel preferences"
                className="scroll-mt-24 border-t border-gray-100 pt-8"
              >
                <h2 tabIndex={-1} className="text-lg font-bold outline-none">
                  Your stay preferences
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Optional room details for hotel quotes. No booking is made.
                </p>
                <HotelSearchFields
                  value={hotelSearch}
                  travelers={travelers}
                  onChange={(value) => {
                    setHotelSearch(value);
                    if (
                      value &&
                      hotelSearch &&
                      JSON.stringify(value.rooms) !==
                        JSON.stringify(hotelSearch.rooms)
                    ) {
                      const count = hotelGuestCounts(value).travelers;
                      if (Number.isInteger(count) && count >= 1 && count <= 50)
                        setTravelers(count);
                    }
                  }}
                />
              </section>
            )}
            <div id="planner-notices" className="scroll-mt-24">
              {pendingRequest && (
                <p role="status" className="mt-3 text-sm text-gray-700">
                  Unfinished request: {pendingRequest.destination},{" "}
                  {pendingRequest.start_date} to {pendingRequest.end_date}. Use
                  Resume saved trip above to resume this same trip; your changed
                  form choices will not replace it.{" "}
                  <button
                    type="button"
                    className="underline"
                    disabled={isGenerating}
                    onClick={() => {
                      if (!session) return;
                      try {
                        localStorage.removeItem(
                          `faroway:pending-create:${session.user.id}`,
                        );
                        setPendingRequest(null);
                      } catch {
                        setGenerateError(
                          "Could not clear the saved request. Check browser storage permissions.",
                        );
                      }
                    }}
                  >
                    Clear this unfinished request
                  </button>
                  . Any trip already saved remains in your dashboard.
                </p>
              )}
              {generateError && (
                <div
                  className="mt-3 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm text-center"
                  role="alert"
                >
                  {generateError}
                  <Link
                    href="/dashboard"
                    className="mt-2 block font-semibold underline underline-offset-4"
                  >
                    Check My Trips
                  </Link>
                </div>
              )}
            </div>
          </fieldset>
          <aside
            aria-label="Your trip summary"
            className={`overflow-hidden rounded-3xl bg-[#f5f7f8] lg:sticky lg:top-8 hidden lg:block`}
          >
            <div className="relative h-52 sm:h-64">
              {!selectedPlace || selectedRecommendedDest ? (
                <Image
                  src={preview.image}
                  alt={`${preview.name}, ${preview.country}`}
                  fallbackAlt={`Illustrated travel route for ${preview.name}`}
                  fill
                  priority
                  sizes="(max-width: 1024px) 90vw, 360px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center bg-slate-800">
                  <Compass
                    className="h-24 w-24 text-white/20"
                    aria-hidden="true"
                  />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 text-white">
                <p className="text-sm text-white/85">
                  {selectedPlace
                    ? "Your next adventure"
                    : "A little inspiration"}
                </p>
                <p className="mt-1 text-3xl font-bold tracking-tight">
                  {selectedPlace?.name || preview.name}
                </p>
              </div>
            </div>
            <div className="p-6 sm:p-7">
              <h2 className="text-lg font-bold">Your trip, taking shape</h2>
              <dl className="mt-5 space-y-5 text-sm">
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 text-gray-500" />
                  <div>
                    <dt className="text-gray-500">
                      Destination{" "}
                      <button
                        onClick={() => scrollToSection("planner-destination")}
                        className="ml-2 text-xs font-semibold underline underline-offset-4"
                      >
                        Edit
                      </button>
                    </dt>
                    <dd className="mt-1 font-semibold">
                      {selectedPlace?.name || "Anywhere you want to go"}
                    </dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Calendar className="mt-0.5 h-4 w-4 text-gray-500" />
                  <div>
                    <dt className="text-gray-500">
                      Dates{" "}
                      <button
                        onClick={() => scrollToSection("planner-dates")}
                        className="ml-2 text-xs font-semibold underline underline-offset-4"
                      >
                        Edit
                      </button>
                    </dt>
                    <dd className="mt-1 font-semibold">
                      {startDate && endDate
                        ? `${format(startDate, "MMM d")} – ${format(endDate, "MMM d, yyyy")}`
                        : "Choose your dates"}
                    </dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Users className="mt-0.5 h-4 w-4 text-gray-500" />
                  <div>
                    <dt className="text-gray-500">Travelers</dt>
                    <dd className="mt-1 font-semibold">
                      {travelers} {travelers === 1 ? "traveler" : "travelers"}
                    </dd>
                  </div>
                </div>
              </dl>
              {selectedVibes.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {selectedVibes.map((id) => (
                    <span
                      key={id}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-medium"
                    >
                      {vibes.find((v) => v.id === id)?.label}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-6 border-t border-gray-200 pt-5 text-sm leading-6 text-gray-500">
                We’ll bring together places to explore, food to try, and a
                day-by-day itinerary built around you.
              </p>
            </div>
          </aside>
        </div>
      </main>
      <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:px-4">
          <div className="min-w-0">
            <p className="hidden text-sm font-semibold lg:block">
              {pendingRequest?.destination ||
                selectedPlace?.name ||
                "Your next adventure"}
              {datesReady && !pendingRequest
                ? ` · ${format(startDate!, "MMM d")} – ${format(endDate!, "MMM d")} · ${travelers} travelers`
                : ""}
            </p>
            <button
              onClick={() =>
                scrollToSection(
                  pendingRequest || generateError
                    ? "planner-notices"
                    : !selectedPlace
                      ? "planner-destination"
                      : !startDate || !endDate
                        ? "planner-dates"
                        : !canGenerate
                          ? "planner-hotels"
                          : "planner-destination",
                )
              }
              className="block w-full text-center text-xs leading-5 text-gray-600 lg:mt-1 lg:text-left"
              aria-live="polite"
            >
              {isGenerating
                ? "Creating your saved trip…"
                : generateError
                  ? "Planning couldn’t start. View details and try again."
                  : pendingRequest
                    ? `Unfinished trip to ${pendingRequest.destination}. Review saved request.`
                    : missingMessage}
            </button>
          </div>
          <button
            onClick={handleGenerate}
            disabled={
              (!canGenerate && !pendingRequest) || isGenerating || authLoading
            }
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-700 px-6 py-3.5 text-sm font-semibold text-white hover:bg-primary-800 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-500 lg:w-auto lg:min-w-64"
          >
            {isGenerating ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                {progressMessage || "Creating your itinerary…"}
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                {pendingRequest
                  ? "Resume saved trip"
                  : session
                    ? "Generate itinerary"
                    : "Sign in & generate itinerary"}
              </>
            )}
          </button>
        </div>
      </footer>
    </div>
  );
}
