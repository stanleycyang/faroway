"use client";
import {
  CreateTripSchema,
  type PendingCreateTrip,
} from "@/lib/trips/create-trip-command";
import { requestPlanningConsent } from "@/lib/ai/planning-consent-client";
import { setPlanningConsentPrompt } from "@/lib/ai/planning-consent-prompt";
import { PlanningConsentDialog } from "@/components/trips/PlanningConsentDialog";

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
  Wallet,
  Plane,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { format } from "date-fns";
import { destinations as destinationCatalog } from "@/lib/planner-destination-catalog";
import {
  BUDGET_LABELS,
  BUDGET_TIERS,
  FLIGHT_SEARCH_CONSENT_VERSION,
  FLIGHT_SEARCH_DISCLOSURE,
  IMAGE_PATHS,
  destinationCoverCatalog,
  getImageUrl,
  hotelGuestCounts,
  normalizeBudgetTier,
  normalizeVibeList,
  parseHotelChildrenAges,
  travelVibes,
  validateFlightSearchDetails,
  validateHotelSearchDetails,
  type BudgetTierId,
  type FlightSearchDetails,
  type HotelSearchDetails,
  type TravelVibeId,
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
  restoreHotelAgeTextDraft,
} from "@/lib/create-draft";
import {
  DreamTripPromptBar,
  type AppliedKickoffSummary,
} from "@/components/create/DreamTripPromptBar";
import {
  summarizeParsedDreamTrip,
  type ParsedDreamTrip,
  type VibeId,
  type DietaryOption,
} from "@/lib/trips/prompt-parser";
import type { DestinationSuggestion } from "@/lib/trips/destination-suggester";
import {
  applyLearnedSuggestion,
  clearTravelerMemory,
  computeLearnedSuggestions,
  createEmptyTravelerMemory,
  mergeTravelerMemoryIntoCreateState,
  readTravelerMemory,
  readTripPreferenceHistory,
  recordTripPreferenceSignal,
  saveTravelerMemory,
  type LearnedPreferenceSuggestion,
  type TravelerMemory,
} from "@/lib/trips/traveler-memory";

const destinations = destinationCatalog.map((destination) => ({
  ...destination,
  image: getImageUrl(
    IMAGE_PATHS.destinations[
      destination.id as keyof typeof IMAGE_PATHS.destinations
    ],
  ),
}));

const allCatalogCovers = destinationCoverCatalog.map(
  ([slug, name, country]) => ({
    slug,
    name,
    country,
    heroImage: getImageUrl(IMAGE_PATHS.destinations[slug]),
  }),
);

const allAutocompleteDestinations = [
  ...destinations.map((d) => ({ name: d.name, country: d.country })),
  ...allCatalogCovers
    .filter(
      (g) =>
        !destinations.some(
          (d) => d.name.toLowerCase() === g.name.toLowerCase(),
        ),
    )
    .map((g) => ({ name: g.name, country: g.country })),
];

const DIETARY_PREFERENCE_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "Halal",
  "Kosher",
  "Gluten-free",
  "Pescatarian",
] as const;

const ACCESSIBILITY_OPTIONS = [
  { id: "step_free_entrance", label: "Step-free entrance" },
  { id: "accessible_restroom", label: "Accessible restroom" },
  { id: "accessible_seating", label: "Accessible seating" },
  { id: "accessible_parking", label: "Accessible parking" },
] as const;

type AccessibilityOptionId = (typeof ACCESSIBILITY_OPTIONS)[number]["id"];

const budgetOptions = BUDGET_TIERS;

const travelerTypes = [
  { id: "solo", label: "Solo", icon: UserRound },
  { id: "couple", label: "Couple", icon: Heart },
  { id: "family", label: "Family", icon: Users },
  { id: "friends", label: "Friends", icon: Users },
  { id: "business", label: "Business", icon: Briefcase },
];

const VIBE_ICONS: Record<
  TravelVibeId,
  React.ComponentType<{ className?: string }>
> = {
  adventure: Mountain,
  relaxation: Palmtree,
  culture: Landmark,
  foodie: Utensils,
  nightlife: Music,
  nature: Trees,
  romantic: Heart,
  family: Users,
  budget: Wallet,
  luxury: Sparkles,
  solo: UserRound,
  wellness: Flower2,
  shopping: ShoppingBag,
  photography: Camera,
};

const vibes = travelVibes.map((vibe) => ({
  id: vibe.id as TravelVibeId,
  label: vibe.label,
  icon: VIBE_ICONS[vibe.id as TravelVibeId] ?? Compass,
}));

const PARSER_VIBE_MAP: Partial<Record<TravelVibeId, VibeId>> = {
  adventure: "adventure",
  relaxation: "relaxation",
  culture: "cultural",
  foodie: "foodie",
  nightlife: "nightlife",
  romantic: "romantic",
  nature: "nature",
  shopping: "shopping",
  wellness: "wellness",
  photography: "photography",
};

function toMemoryVibes(values: readonly string[]): VibeId[] {
  return normalizeVibeList(values, 5)
    .map((id) => PARSER_VIBE_MAP[id])
    .filter((id): id is VibeId => Boolean(id));
}

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
  hotelAgeText?: string[];
  originCity?: string;
  originAirport?: string;
  flightConsent?: boolean;
  flightChildrenCount?: number;
  flightAgeText?: string;
  budget?: BudgetTierId;
  dietaryPreferences?: string[];
  allergiesText?: string;
  accessibility?: AccessibilityOptionId[];
  mobilityNotes?: string;
}

interface PlannerUndoSnapshot {
  selectedPlace: SelectedPlace | null;
  showDestinations: boolean;
  startDate: Date | undefined;
  endDate: Date | undefined;
  travelers: number;
  travelerType: string;
  budget: BudgetTierId;
  selectedVibes: string[];
  dietaryPreferences: string[];
  allergiesText: string;
  accessibility: AccessibilityOptionId[];
  mobilityNotes: string;
  showAdvanced: boolean;
  originCity: string;
  originAirport: string;
  flightConsent: boolean;
  flightChildrenCount: number;
  flightAgeText: string;
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
  const [hotelAgeText, setHotelAgeText] = useState<string[]>([]);
  const [originCity, setOriginCity] = useState("");
  const [originAirport, setOriginAirport] = useState("");
  const [flightConsent, setFlightConsent] = useState(false);
  const [flightChildrenCount, setFlightChildrenCount] = useState(0);
  const [flightAgeText, setFlightAgeText] = useState("");
  const [travelers, setTravelers] = useState(2);
  const [budget, setBudget] = useState<BudgetTierId>("moderate");
  const [travelerType, setTravelerType] = useState("couple");
  const [selectedVibes, setSelectedVibes] = useState<string[]>([]);
  const [dietaryPreferences, setDietaryPreferences] = useState<string[]>([]);
  const [allergiesText, setAllergiesText] = useState("");
  const [accessibility, setAccessibility] = useState<AccessibilityOptionId[]>(
    [],
  );
  const [mobilityNotes, setMobilityNotes] = useState("");
  const memoryScopeId = session?.user.id ?? "guest";
  const [travelerMemory, setTravelerMemory] = useState<TravelerMemory>(() =>
    createEmptyTravelerMemory(),
  );
  const [memoryAppliedFields, setMemoryAppliedFields] = useState<string[]>([]);
  const [learnedSuggestions, setLearnedSuggestions] = useState<
    LearnedPreferenceSuggestion[]
  >([]);
  const [appliedKickoffSummary, setAppliedKickoffSummary] =
    useState<AppliedKickoffSummary | null>(null);
  const [undoSnapshot, setUndoSnapshot] = useState<PlannerUndoSnapshot | null>(
    null,
  );
  const consentResolveRef = useRef<((approved: boolean) => void) | null>(null);
  const [consentDialog, setConsentDialog] = useState<{
    message: string;
  } | null>(null);
  useEffect(() => {
    if (typeof setPlanningConsentPrompt !== "function") return;
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
  const submissionLock = useRef(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [progressMessage, setProgressMessage] = useState("");
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setDraftLoaded(true);
    const loadedMemory = readTravelerMemory(memoryScopeId);
    setTravelerMemory(loadedMemory);
    const history = readTripPreferenceHistory(memoryScopeId);
    setLearnedSuggestions(computeLearnedSuggestions(history, loadedMemory));

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
        setSelectedVibes(normalizeVibeList(draft.selectedVibes, 5));
      }
      const restoredBudget = normalizeBudgetTier(draft.budget);
      if (restoredBudget) setBudget(restoredBudget);
      setShowAdvanced(draft.showAdvanced === true);
      if (typeof draft.originCity === "string") {
        setOriginCity(draft.originCity.slice(0, 200));
      }
      if (typeof draft.originAirport === "string") {
        setOriginAirport(draft.originAirport.trim().toUpperCase().slice(0, 10));
      }
      if (typeof draft.flightConsent === "boolean") {
        setFlightConsent(draft.flightConsent);
      }
      if (
        typeof draft.flightChildrenCount === "number" &&
        Number.isInteger(draft.flightChildrenCount) &&
        draft.flightChildrenCount >= 0 &&
        draft.flightChildrenCount <= 49
      ) {
        setFlightChildrenCount(draft.flightChildrenCount);
      }
      if (typeof draft.flightAgeText === "string") {
        setFlightAgeText(draft.flightAgeText.slice(0, 200));
      }
      if (Array.isArray(draft.dietaryPreferences)) {
        setDietaryPreferences(
          [
            ...new Set(
              draft.dietaryPreferences.filter(
                (value): value is string =>
                  typeof value === "string" &&
                  DIETARY_PREFERENCE_OPTIONS.some((option) => option === value),
              ),
            ),
          ].slice(0, DIETARY_PREFERENCE_OPTIONS.length),
        );
      }
      if (typeof draft.allergiesText === "string") {
        setAllergiesText(draft.allergiesText.slice(0, 500));
      }
      if (Array.isArray(draft.accessibility)) {
        setAccessibility(
          [
            ...new Set(
              draft.accessibility.filter(
                (value): value is AccessibilityOptionId =>
                  ACCESSIBILITY_OPTIONS.some((option) => option.id === value),
              ),
            ),
          ].slice(0, ACCESSIBILITY_OPTIONS.length),
        );
      }
      if (typeof draft.mobilityNotes === "string") {
        setMobilityNotes(draft.mobilityNotes.slice(0, 500));
      }
      if (hotelSearchEnabled()) {
        const restoredHotelSearch = restoreHotelSearchDraft(draft.hotelSearch);
        setHotelSearch(restoredHotelSearch);
        setHotelAgeText(
          restoreHotelAgeTextDraft(draft.hotelAgeText, restoredHotelSearch),
        );
        if (validateHotelSearchDetails(restoredHotelSearch))
          setTravelers(hotelGuestCounts(restoredHotelSearch).travelers);
      }
      return;
    }

    const requestedDestination = params.get("destination");
    if (requestedDestination) {
      const normalized = requestedDestination.trim().toLowerCase();
      const recommended = destinations.find(
        (destination) =>
          destination.id === normalized ||
          destination.name.toLowerCase() === normalized,
      );
      const guideMatch = !recommended
        ? allCatalogCovers.find(
            (guide) =>
              guide.slug.toLowerCase() === normalized ||
              guide.name.toLowerCase() === normalized,
          )
        : undefined;
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
          : guideMatch
            ? {
                name: guideMatch.name,
                lat: 0,
                lng: 0,
                placeId: guideMatch.slug,
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
    }

    const validRequestedBudget =
      normalizeBudgetTier(params.get("budget")) ?? null;
    if (validRequestedBudget) {
      setBudget(validRequestedBudget);
    }
    const requestedTravelers = Number(params.get("travelers"));
    if (
      Number.isInteger(requestedTravelers) &&
      requestedTravelers >= 1 &&
      requestedTravelers <= 50
    ) {
      setTravelers(requestedTravelers);
      if (requestedTravelers === 1) setTravelerType("solo");
    }
    const requestedVibes = params.get("vibes");
    let parsedUrlVibes: TravelVibeId[] = [];
    if (requestedVibes) {
      parsedUrlVibes = normalizeVibeList(requestedVibes.split(","), 5);
      if (parsedUrlVibes.length > 0) setSelectedVibes(parsedUrlVibes);
    }

    if (loadedMemory.homeAirport) {
      const trimmedHome = loadedMemory.homeAirport.trim();
      if (/^[A-Za-z]{3}$/.test(trimmedHome)) {
        setOriginAirport(trimmedHome.toUpperCase());
      } else if (trimmedHome) {
        setOriginCity(trimmedHome.slice(0, 200));
      }
    }

    // Apply saved Traveler Memory defaults without clobbering explicit URL params or drafts.
    const { merged, appliedFields } = mergeTravelerMemoryIntoCreateState(
      {
        budget: validRequestedBudget ?? "moderate",
        selectedVibes: parsedUrlVibes,
        dietaryPreferences: [],
        allergiesText: "",
        accessibility: [],
        mobilityNotes: "",
      },
      loadedMemory,
      {
        hasDraft: false,
        urlHasBudget: Boolean(validRequestedBudget),
        urlHasVibes: parsedUrlVibes.length > 0,
      },
    );
    if (appliedFields.length > 0) {
      if (!validRequestedBudget && merged.budget !== "moderate") {
        setBudget(merged.budget);
      }
      if (parsedUrlVibes.length === 0 && merged.selectedVibes.length > 0) {
        setSelectedVibes(normalizeVibeList(merged.selectedVibes, 5));
      }
      if (merged.dietaryPreferences.length > 0) {
        setDietaryPreferences(merged.dietaryPreferences);
      }
      if (merged.allergiesText) {
        setAllergiesText(merged.allergiesText);
      }
      if (merged.accessibility.length > 0) {
        setAccessibility(merged.accessibility);
      }
      if (merged.mobilityNotes) {
        setMobilityNotes(merged.mobilityNotes);
      }
      setMemoryAppliedFields(appliedFields);
    }
  }, [memoryScopeId]);

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
        hotelAgeText,
        originCity,
        originAirport,
        flightConsent,
        flightChildrenCount,
        flightAgeText,
        budget,
        dietaryPreferences,
        allergiesText,
        accessibility,
        mobilityNotes,
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
    hotelAgeText,
    originCity,
    originAirport,
    flightConsent,
    flightChildrenCount,
    flightAgeText,
    budget,
    dietaryPreferences,
    allergiesText,
    accessibility,
    mobilityNotes,
  ]);

  const selectedRecommendedDest = selectedPlace
    ? (destinations.find(
        (d) => d.name.toLowerCase() === selectedPlace.name.toLowerCase(),
      ) ??
      (() => {
        const guide = allCatalogCovers.find(
          (g) => g.name.toLowerCase() === selectedPlace.name.toLowerCase(),
        );
        return guide
          ? {
              id: guide.slug,
              name: guide.name,
              country: guide.country,
              lat: 0,
              lng: 0,
              image: guide.heroImage,
            }
          : null;
      })())
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

  const resolvedHotelCounts = hotelSearch
    ? hotelGuestCounts(hotelSearch)
    : null;
  const safeFlightChildrenCount =
    hotelSearch === null && travelers > 1
      ? Math.max(0, Math.min(travelers - 1, flightChildrenCount))
      : 0;
  const resolvedAdults = resolvedHotelCounts
    ? resolvedHotelCounts.adults
    : Math.max(1, travelers - safeFlightChildrenCount);
  const resolvedChildren = resolvedHotelCounts
    ? resolvedHotelCounts.children
    : safeFlightChildrenCount;
  const resolvedChildAges = resolvedHotelCounts
    ? hotelSearch!.rooms.flatMap((room) => room.children)
    : safeFlightChildrenCount > 0
      ? parseHotelChildrenAges(flightAgeText)
      : [];
  const flightSearchPayload: FlightSearchDetails | null = flightConsent
    ? {
        childAges: resolvedChildAges,
        consentVersion: FLIGHT_SEARCH_CONSENT_VERSION,
      }
    : null;
  const isFlightDetailsValid =
    !flightConsent ||
    (resolvedAdults >= 1 &&
      resolvedAdults + resolvedChildren === travelers &&
      validateFlightSearchDetails(flightSearchPayload, resolvedChildren));

  const canGenerate =
    selectedPlace &&
    startDate &&
    endDate &&
    (hotelSearch === null ||
      validateHotelSearchDetails(hotelSearch, travelers)) &&
    isFlightDetailsValid;

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

  const resolveKickoffDestination = (
    name: string,
    slug?: string,
  ): SelectedPlace => {
    const normalizedName = name.trim().toLowerCase();
    const normalizedSlug = slug?.trim().toLowerCase();
    const recommended = destinations.find(
      (d) =>
        (normalizedSlug && d.id === normalizedSlug) ||
        d.name.toLowerCase() === normalizedName,
    );
    if (recommended) {
      return {
        name: recommended.name,
        lat: recommended.lat,
        lng: recommended.lng,
        placeId: recommended.id,
        isRecommended: true,
        source: "catalog",
      };
    }
    const cover = allCatalogCovers.find(
      (g) =>
        (normalizedSlug && g.slug.toLowerCase() === normalizedSlug) ||
        g.name.toLowerCase() === normalizedName,
    );
    if (cover) {
      return {
        name: cover.name,
        lat: 0,
        lng: 0,
        placeId: cover.slug,
        isRecommended: true,
        source: "catalog",
      };
    }
    return {
      name: name.trim().slice(0, 120),
      lat: 0,
      lng: 0,
      placeId: "",
      isRecommended: false,
      source: "user",
    };
  };

  const captureUndoSnapshot = (): PlannerUndoSnapshot => ({
    selectedPlace,
    showDestinations,
    startDate,
    endDate,
    travelers,
    travelerType,
    budget,
    selectedVibes: [...selectedVibes],
    dietaryPreferences: [...dietaryPreferences],
    allergiesText,
    accessibility: [...accessibility],
    mobilityNotes,
    showAdvanced,
    originCity,
    originAirport,
    flightConsent,
    flightChildrenCount,
    flightAgeText,
  });

  const handleApplyParsedPrompt = (parsed: ParsedDreamTrip) => {
    setUndoSnapshot(captureUndoSnapshot());
    if (parsed.destination) {
      setSelectedPlace(
        resolveKickoffDestination(
          parsed.destination.name,
          parsed.destination.slug,
        ),
      );
      setShowDestinations(false);
    }
    if (parsed.startDate && parsed.endDate) {
      const nextStart = parseCreateDraftDate(parsed.startDate);
      const nextEnd = parseCreateDraftDate(parsed.endDate);
      if (nextStart && nextEnd && nextEnd >= nextStart) {
        setStartDate(nextStart);
        setEndDate(nextEnd);
      }
    }
    if (hotelSearch === null) {
      if (
        typeof parsed.travelers === "number" &&
        Number.isInteger(parsed.travelers) &&
        parsed.travelers >= 1 &&
        parsed.travelers <= 50
      ) {
        setTravelers(parsed.travelers);
      }
      if (
        parsed.travelerType &&
        travelerTypes.some((type) => type.id === parsed.travelerType)
      ) {
        setTravelerType(parsed.travelerType);
      }
    }
    if (parsed.originHint) {
      const hint = parsed.originHint.trim();
      if (/^[A-Za-z]{3}$/.test(hint)) {
        setOriginAirport(hint.toUpperCase());
      } else if (hint) {
        setOriginCity(hint.slice(0, 200));
      }
    }
    const parsedBudget = normalizeBudgetTier(parsed.budget);
    if (parsedBudget) {
      setBudget(parsedBudget);
    }
    if (parsed.vibes.length > 0) {
      setSelectedVibes(normalizeVibeList(parsed.vibes, 5));
    }
    // Replace prompt-derived requirement fields cleanly when re-applying a prompt,
    // while keeping previously saved requirements if the new prompt didn't mention any.
    const promptMentionsRequirements =
      parsed.dietaryPreferences.length > 0 ||
      parsed.allergies.length > 0 ||
      parsed.accessibility.length > 0 ||
      Boolean(parsed.mobilityNotes);
    if (promptMentionsRequirements) {
      setDietaryPreferences([...new Set(parsed.dietaryPreferences)]);
      setAllergiesText([...new Set(parsed.allergies)].join(", ").slice(0, 500));
      setAccessibility([...new Set(parsed.accessibility)]);
      setMobilityNotes((parsed.mobilityNotes ?? "").slice(0, 500));
      setShowAdvanced(true);
    }
    setAppliedKickoffSummary({
      chips: summarizeParsedDreamTrip(parsed),
      hasSafetyNotice:
        parsed.dietaryPreferences.length > 0 ||
        parsed.allergies.length > 0 ||
        parsed.accessibility.length > 0,
      sourceLabel: "Filled from your prompt",
    });
  };

  const handleApplySuggestion = (suggestion: DestinationSuggestion) => {
    setUndoSnapshot(captureUndoSnapshot());
    setSelectedPlace(
      resolveKickoffDestination(suggestion.name, suggestion.slug),
    );
    setShowDestinations(false);
    const sugBudget =
      normalizeBudgetTier(suggestion.prefillParams.budget) ?? "moderate";
    setBudget(sugBudget);
    if (suggestion.prefillParams.vibes.length > 0) {
      setSelectedVibes(normalizeVibeList(suggestion.prefillParams.vibes, 5));
    }
    const chips = [
      `${suggestion.name}, ${suggestion.country}`,
      BUDGET_LABELS[sugBudget],
    ];
    if (
      suggestion.prefillParams.startDate &&
      suggestion.prefillParams.endDate
    ) {
      const nextStart = parseCreateDraftDate(
        suggestion.prefillParams.startDate,
      );
      const nextEnd = parseCreateDraftDate(suggestion.prefillParams.endDate);
      if (nextStart && nextEnd && nextEnd >= nextStart) {
        setStartDate(nextStart);
        setEndDate(nextEnd);
        chips.push(`${format(nextStart, "MMM d")}–${format(nextEnd, "MMM d")}`);
      }
    }
    setAppliedKickoffSummary({
      chips,
      hasSafetyNotice: false,
      sourceLabel: "Selected suggestion",
    });
  };

  const handleUndoKickoff = () => {
    if (!undoSnapshot) return;
    setSelectedPlace(undoSnapshot.selectedPlace);
    setShowDestinations(undoSnapshot.showDestinations);
    setStartDate(undoSnapshot.startDate);
    setEndDate(undoSnapshot.endDate);
    setTravelers(undoSnapshot.travelers);
    setTravelerType(undoSnapshot.travelerType);
    setBudget(undoSnapshot.budget);
    setSelectedVibes(undoSnapshot.selectedVibes);
    setDietaryPreferences(undoSnapshot.dietaryPreferences);
    setAllergiesText(undoSnapshot.allergiesText);
    setAccessibility(undoSnapshot.accessibility);
    setMobilityNotes(undoSnapshot.mobilityNotes);
    setShowAdvanced(undoSnapshot.showAdvanced);
    setOriginCity(undoSnapshot.originCity);
    setOriginAirport(undoSnapshot.originAirport);
    setFlightConsent(undoSnapshot.flightConsent);
    setFlightChildrenCount(undoSnapshot.flightChildrenCount);
    setFlightAgeText(undoSnapshot.flightAgeText);
    setUndoSnapshot(null);
    setAppliedKickoffSummary(null);
  };

  const handleSaveMemory = (next: Partial<TravelerMemory>) => {
    const saved = saveTravelerMemory(memoryScopeId, next);
    setTravelerMemory(saved);
    const history = readTripPreferenceHistory(memoryScopeId);
    setLearnedSuggestions(computeLearnedSuggestions(history, saved));
  };

  const handleSaveCurrentAsMemory = () => {
    const parsedAllergies = allergiesText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const validVibes = toMemoryVibes(selectedVibes);
    const validDietary = dietaryPreferences.filter((d): d is DietaryOption =>
      DIETARY_PREFERENCE_OPTIONS.some((option) => option === d),
    );
    const homeOrigin = (originAirport.trim() || originCity.trim()).slice(0, 60);
    const saved = saveTravelerMemory(memoryScopeId, {
      ...(homeOrigin ? { homeAirport: homeOrigin } : {}),
      defaultBudget: budget,
      defaultVibes: validVibes,
      dietaryPreferences: validDietary,
      allergies: parsedAllergies,
      accessibility,
      mobilityNotes: mobilityNotes.trim(),
      avoidEarlyStarts:
        travelerMemory.avoidEarlyStarts ||
        /\b(?:no|avoid|skip|without|hate|relaxed)\s+(?:early\s+)?(?:starts?|mornings?)\b/i.test(
          mobilityNotes,
        ),
    });
    setTravelerMemory(saved);
    setMemoryAppliedFields(["Current planner preferences"]);
    const history = readTripPreferenceHistory(memoryScopeId);
    setLearnedSuggestions(computeLearnedSuggestions(history, saved));
  };

  const handleClearMemory = () => {
    clearTravelerMemory(memoryScopeId);
    const empty = createEmptyTravelerMemory();
    setTravelerMemory(empty);
    setMemoryAppliedFields([]);
    const history = readTripPreferenceHistory(memoryScopeId);
    setLearnedSuggestions(computeLearnedSuggestions(history, empty));
  };

  const handleAcceptLearnedSuggestion = (
    suggestion: LearnedPreferenceSuggestion,
  ) => {
    const updated = applyLearnedSuggestion(travelerMemory, suggestion);
    const saved = saveTravelerMemory(memoryScopeId, updated);
    setTravelerMemory(saved);
    setLearnedSuggestions((prev) =>
      prev.filter((item) => item.id !== suggestion.id),
    );
  };

  const handleDismissLearnedSuggestion = (id: string) => {
    setLearnedSuggestions((prev) => prev.filter((item) => item.id !== id));
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
        hotelAgeText,
        originCity,
        originAirport,
        flightConsent,
        flightChildrenCount,
        flightAgeText,
        budget,
        dietaryPreferences,
        allergiesText,
        accessibility,
        mobilityNotes,
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
      const parsedAllergies = allergiesText
        .split(",")
        .map((item) => item.trim().slice(0, 100))
        .filter(Boolean)
        .slice(0, 20);
      const hasRequirements =
        dietaryPreferences.length > 0 ||
        parsedAllergies.length > 0 ||
        accessibility.length > 0 ||
        mobilityNotes.trim().length > 0;
      const trimmedOriginCity = originCity.trim().slice(0, 200);
      const normalizedOriginAirport = originAirport
        .trim()
        .toUpperCase()
        .slice(0, 10);
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
          ...(trimmedOriginCity ? { originCity: trimmedOriginCity } : {}),
          ...(normalizedOriginAirport
            ? { originAirport: normalizedOriginAirport }
            : {}),
          flightSearch: flightSearchPayload,
          ...(hasRequirements
            ? {
                requirements: {
                  allergies: parsedAllergies,
                  dietaryPreferences,
                  accessibility,
                  mobilityNotes: mobilityNotes.trim(),
                },
              }
            : {}),
          ...(hotelSearch !== null || flightConsent
            ? {
                ...(hotelSearch ? { hotelSearch } : {}),
                adults: resolvedAdults,
                children: resolvedChildren,
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
      try {
        recordTripPreferenceSignal(memoryScopeId, {
          budget: payload.budget ?? budget,
          vibes: toMemoryVibes(payload.preferences?.vibes ?? selectedVibes),
          dietaryPreferences:
            payload.preferences?.requirements?.dietaryPreferences ??
            dietaryPreferences,
          accessibility:
            payload.preferences?.requirements?.accessibility ?? accessibility,
          avoidEarlyStarts:
            /\b(?:no|avoid|skip|without|hate|relaxed)\s+(?:early\s+)?(?:starts?|mornings?)\b/i.test(
              payload.preferences?.requirements?.mobilityNotes ?? mobilityNotes,
            ),
        });
      } catch {
        /* Preference history is optional local storage. */
      }

      setProgressMessage("Starting AI trip planner...");

      const generationHeaders = await planningHeaders();
      if (!mounted.current) return;
      const genOriginCity = payload.preferences?.originCity;
      const genOriginAirport = payload.preferences?.originAirport;
      const genResponse = await fetch(`/api/trips/${trip.id}/generate`, {
        method: "POST",
        signal: AbortSignal.timeout(25_000),
        headers: generationHeaders,
        body: JSON.stringify({
          preferences: {
            vibes: pendingRequest?.preferences?.vibes ?? selectedVibes,
            ...(genOriginCity ? { originCity: genOriginCity } : {}),
            ...(genOriginAirport ? { originAirport: genOriginAirport } : {}),
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
      if (err instanceof Error && err.name === "PlanningConsentDeclinedError") {
        setIsGenerating(false);
        setProgressMessage("");
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
          localDestinations={allAutocompleteDestinations}
        />

        <div className="flex gap-3 overflow-x-auto snap-x snap-proximity pb-3 mt-4">
          {destinations.map((dest, index) => (
            <button
              key={dest.id}
              aria-label={`Select ${dest.name}, ${dest.country}`}
              aria-pressed={selectedPlace?.name === dest.name}
              onClick={() => handleSelectRecommended(dest)}
              className={`relative h-40 w-40 shrink-0 snap-start rounded-2xl overflow-hidden group text-left sm:h-44 sm:w-48 ${selectedPlace?.name === dest.name ? "ring-2 ring-primary-700 ring-offset-2" : ""}`}
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
                <p className="text-white/75 text-xs">{dest.country}</p>
              </div>
              {selectedPlace?.name === dest.name && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-primary-700 rounded-full flex items-center justify-center">
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
  const hotelDetailsInvalid =
    hotelSearch !== null && !validateHotelSearchDetails(hotelSearch, travelers);
  const missingMessage = !selectedPlace
    ? "Choose a destination to get started"
    : !startDate || !endDate
      ? "Choose your dates to continue"
      : hotelDetailsInvalid
        ? "Complete your hotel room details or turn off hotel searches"
        : !isFlightDetailsValid
          ? "Complete children's ages (0–17) or turn off live flight search"
          : "Your trip is ready to plan";

  return (
    <div
      aria-busy={!draftLoaded}
      className="trip-planner min-h-screen bg-[#FAF8F3] text-slate-900"
    >
      <header className="sticky top-0 z-40 border-b border-gray-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:h-20 lg:px-10">
          <button
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                router.back();
              } else {
                router.push("/");
              }
            }}
            aria-label="Close trip planner"
            className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-gray-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
          <Logo size="md" variant="dark" className="hidden lg:flex" />
          <p className="text-base font-bold lg:hidden">Plan your trip</p>
          <Link
            href="/dashboard"
            className="flex min-h-11 items-center text-sm font-semibold text-slate-700 hover:text-slate-900"
          >
            My trips
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-5 pb-44 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        <div className="mb-6 lg:mb-8">
          <h1 className="font-editorial text-3xl tracking-[-0.04em] text-slate-900 sm:text-4xl lg:text-5xl">
            Your next chapter starts here.
          </h1>
          <p className="mt-2 text-sm text-slate-600 lg:mt-3 lg:text-base">
            Tell us where you want to go. We’ll bring the journey together.
          </p>
        </div>
        <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1fr)_360px] xl:gap-20">
          <fieldset
            disabled={!draftLoaded || isGenerating}
            className="min-w-0 space-y-8 sm:space-y-10"
          >
            <DreamTripPromptBar
              isAuthenticated={Boolean(session)}
              disabled={!draftLoaded || authLoading || isGenerating}
              travelerMemory={travelerMemory}
              memoryAppliedFields={memoryAppliedFields}
              learnedSuggestions={learnedSuggestions}
              appliedSummary={appliedKickoffSummary}
              canUndo={undoSnapshot !== null}
              onApplyParsedPrompt={handleApplyParsedPrompt}
              onApplySuggestion={handleApplySuggestion}
              onUndo={handleUndoKickoff}
              onSaveMemory={handleSaveMemory}
              onSaveCurrentAsMemory={handleSaveCurrentAsMemory}
              onClearMemory={handleClearMemory}
              onAcceptLearnedSuggestion={handleAcceptLearnedSuggestion}
              onDismissLearnedSuggestion={handleDismissLearnedSuggestion}
            />
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
                      type="button"
                      aria-label="Decrease travelers"
                      onClick={() => {
                        setTravelers((current) => Math.max(1, current - 1));
                        setTravelerType((currentType) =>
                          travelers - 1 <= 1 && currentType === "couple"
                            ? "solo"
                            : currentType,
                        );
                      }}
                      disabled={travelers <= 1 || hotelSearch !== null}
                      className="w-11 h-11 rounded-full bg-white border border-gray-200 flex items-center justify-center text-slate-600 hover:border-primary-700 hover:text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
                      type="button"
                      aria-label="Increase travelers"
                      onClick={() => {
                        setTravelers((current) => Math.min(50, current + 1));
                        setTravelerType((currentType) =>
                          currentType === "solo"
                            ? travelers + 1 === 2
                              ? "couple"
                              : "friends"
                            : currentType,
                        );
                      }}
                      disabled={travelers >= 50 || hotelSearch !== null}
                      className="w-11 h-11 rounded-full bg-white border border-gray-200 flex items-center justify-center text-slate-600 hover:border-primary-700 hover:text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {hotelSearch !== null && (
                  <p className="mt-2 text-xs text-slate-600">
                    Traveler count is currently managed by your hotel room
                    details below.
                  </p>
                )}
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Travel group
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {travelerTypes.map((type) => (
                    <button
                      type="button"
                      key={type.id}
                      onClick={() => {
                        setTravelerType(type.id);
                        if (hotelSearch === null) {
                          if (type.id === "solo") setTravelers(1);
                          else if (type.id === "couple" && travelers === 1)
                            setTravelers(2);
                        }
                      }}
                      aria-pressed={travelerType === type.id}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-full border-2 transition-all ${
                        travelerType === type.id
                          ? "border-primary-700 bg-primary-50 text-primary-800"
                          : "border-gray-200 bg-white text-slate-700 hover:border-gray-300"
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
              className="scroll-mt-24 border-t border-gray-200/80 pt-8"
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
                    className={`min-h-24 rounded-2xl border px-2 py-4 text-center transition-colors sm:px-4 ${budget === option.id ? "border-primary-700 bg-primary-50 text-primary-800" : "border-gray-200 bg-white text-slate-700 hover:border-slate-400"}`}
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
              <p className="mt-3 text-xs leading-5 text-slate-600">
                Guides hotel, dining, and activity recommendations across your
                itinerary.
              </p>
            </section>
            <section
              id="planner-vibes"
              aria-label="Travel preferences"
              className="scroll-mt-24 border-t border-gray-200/80 pt-8"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2
                    tabIndex={-1}
                    className="text-lg font-bold outline-none sm:text-xl"
                  >
                    What’s your travel vibe?
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Choose up to 5, or leave it open to discovery.
                  </p>
                </div>
                <span
                  role="status"
                  aria-label={`${selectedVibes.length} of 5 interests selected`}
                  className="shrink-0 rounded-full bg-white border border-gray-200 px-3 py-1.5 text-xs font-semibold tabular-nums text-slate-700"
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
                        ? "border-primary-700 bg-primary-50 text-primary-800"
                        : "border-gray-200 bg-white text-slate-700 hover:border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="scroll-mt-24 border-t border-gray-200/80 pt-8"
              >
                <h2 tabIndex={-1} className="text-lg font-bold outline-none">
                  Your stay preferences
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Optional room details to tailor hotel picks and live rates to
                  your group.
                </p>
                <HotelSearchFields
                  value={hotelSearch}
                  ageText={hotelAgeText}
                  onAgeTextChange={setHotelAgeText}
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
            <section
              id="planner-flights"
              aria-label="Departure and flights"
              className="scroll-mt-24 border-t border-gray-200/80 pt-8"
            >
              <h2
                tabIndex={-1}
                className="text-lg font-bold outline-none sm:text-xl"
              >
                Departure &amp; flight options
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Optional — add your departure city or airport to tailor route
                suggestions and flight links.
              </p>
              <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-5 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="create-origin-city"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Departure city (optional)
                    </label>
                    <input
                      id="create-origin-city"
                      type="text"
                      maxLength={200}
                      value={originCity}
                      onChange={(e) => setOriginCity(e.target.value)}
                      placeholder="e.g., San Francisco"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-500 outline-none focus:border-primary-700 focus:ring-2 focus:ring-primary-700/20"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="create-origin-airport"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Departure airport (IATA, optional)
                    </label>
                    <input
                      id="create-origin-airport"
                      type="text"
                      maxLength={10}
                      value={originAirport}
                      onChange={(e) =>
                        setOriginAirport(e.target.value.toUpperCase())
                      }
                      placeholder="e.g., SFO"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm uppercase text-slate-900 placeholder-slate-500 outline-none focus:border-primary-700 focus:ring-2 focus:ring-primary-700/20"
                    />
                    {originAirport.trim().length > 0 &&
                      !/^[A-Z]{3}$/.test(
                        originAirport.trim().toUpperCase(),
                      ) && (
                        <p className="mt-1.5 text-xs text-slate-600">
                          Enter a 3-letter IATA airport code (e.g., SFO, JFK,
                          LHR) for exact flight routes.
                        </p>
                      )}
                  </div>
                </div>

                <div className="border-t border-gray-100 pt-4">
                  <label
                    htmlFor="create-flight-consent"
                    className="flex items-start gap-3 cursor-pointer"
                  >
                    <input
                      id="create-flight-consent"
                      type="checkbox"
                      checked={flightConsent}
                      onChange={(e) => setFlightConsent(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-700"
                    />
                    <span className="text-sm font-medium text-slate-800">
                      Include live flight options via Duffel
                    </span>
                  </label>
                  <p className="mt-1.5 pl-7 text-xs leading-5 text-slate-600">
                    {FLIGHT_SEARCH_DISCLOSURE}
                  </p>

                  {flightConsent && hotelSearch === null && travelers > 1 && (
                    <div className="mt-4 grid gap-4 rounded-xl border border-gray-200 bg-[#FAF8F3] p-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor="create-flight-children"
                          className="mb-1.5 block text-xs font-medium text-slate-700"
                        >
                          Children under 18
                        </label>
                        <input
                          id="create-flight-children"
                          type="number"
                          min={0}
                          max={travelers - 1}
                          value={safeFlightChildrenCount}
                          onChange={(e) => {
                            const nextCount = Number(e.target.value);
                            setFlightChildrenCount(
                              Number.isFinite(nextCount)
                                ? Math.max(
                                    0,
                                    Math.min(
                                      travelers - 1,
                                      Math.trunc(nextCount),
                                    ),
                                  )
                                : 0,
                            );
                          }}
                          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary-700 focus:ring-2 focus:ring-primary-700/20"
                        />
                      </div>
                      {safeFlightChildrenCount > 0 && (
                        <div>
                          <label
                            htmlFor="create-flight-child-ages"
                            className="mb-1.5 block text-xs font-medium text-slate-700"
                          >
                            Children’s ages (comma-separated, 0–17)
                          </label>
                          <input
                            id="create-flight-child-ages"
                            type="text"
                            maxLength={200}
                            value={flightAgeText}
                            onChange={(e) => setFlightAgeText(e.target.value)}
                            placeholder="e.g., 6, 10"
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-500 outline-none focus:border-primary-700 focus:ring-2 focus:ring-primary-700/20"
                          />
                          {!isFlightDetailsValid && (
                            <p
                              role="status"
                              className="mt-1.5 text-xs text-amber-800"
                            >
                              Enter {safeFlightChildrenCount}{" "}
                              {safeFlightChildrenCount === 1 ? "age" : "ages"}{" "}
                              between 0 and 17.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
            <section
              id="planner-requirements"
              aria-label="Dietary and accessibility needs"
              className="scroll-mt-24 border-t border-gray-200/80 pt-8"
            >
              <button
                type="button"
                aria-expanded={showAdvanced}
                onClick={() => setShowAdvanced((open) => !open)}
                className="flex w-full items-center justify-between text-left"
              >
                <div>
                  <h2 className="text-lg font-bold text-slate-900 sm:text-xl">
                    Dietary, allergies &amp; accessibility
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Optional — add dietary preferences, allergies, or mobility
                    notes before we plan.
                  </p>
                </div>
                <span className="ml-4 shrink-0 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {showAdvanced ? "Hide" : "Add details"}
                </span>
              </button>
              {showAdvanced && (
                <div className="mt-5 space-y-5 rounded-2xl border border-gray-200 bg-white p-5">
                  <div>
                    <p className="mb-2.5 text-sm font-medium text-slate-700">
                      Dietary preferences
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {DIETARY_PREFERENCE_OPTIONS.map((option) => {
                        const active = dietaryPreferences.includes(option);
                        return (
                          <button
                            key={option}
                            type="button"
                            aria-pressed={active}
                            onClick={() =>
                              setDietaryPreferences((prev) =>
                                prev.includes(option)
                                  ? prev.filter((item) => item !== option)
                                  : [...prev, option],
                              )
                            }
                            className={`rounded-full border px-3.5 py-2 text-xs font-medium transition-colors ${
                              active
                                ? "border-primary-700 bg-primary-50 text-primary-800"
                                : "border-gray-200 bg-white text-slate-700 hover:border-gray-300"
                            }`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="create-allergies"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Food allergies (comma-separated)
                    </label>
                    <input
                      id="create-allergies"
                      type="text"
                      maxLength={500}
                      value={allergiesText}
                      onChange={(e) => setAllergiesText(e.target.value)}
                      placeholder="e.g. peanuts, shellfish, sesame"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-slate-500 outline-none focus:border-primary-700 focus:ring-2 focus:ring-primary-700/20"
                    />
                  </div>
                  <div>
                    <p className="mb-2.5 text-sm font-medium text-slate-700">
                      Accessibility needs
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {ACCESSIBILITY_OPTIONS.map((option) => {
                        const active = accessibility.includes(option.id);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            aria-pressed={active}
                            onClick={() =>
                              setAccessibility((prev) =>
                                prev.includes(option.id)
                                  ? prev.filter((item) => item !== option.id)
                                  : [...prev, option.id],
                              )
                            }
                            className={`rounded-full border px-3.5 py-2 text-xs font-medium transition-colors ${
                              active
                                ? "border-primary-700 bg-primary-50 text-primary-800"
                                : "border-gray-200 bg-white text-slate-700 hover:border-gray-300"
                            }`}
                          >
                            {option.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="create-mobility-notes"
                      className="mb-1.5 block text-sm font-medium text-slate-700"
                    >
                      Mobility or pacing notes
                    </label>
                    <textarea
                      id="create-mobility-notes"
                      rows={2}
                      maxLength={500}
                      value={mobilityNotes}
                      onChange={(e) => setMobilityNotes(e.target.value)}
                      placeholder="e.g. Stroller-friendly routes, midday rest every day, arrive on day 1 at 14:00"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder-slate-500 outline-none focus:border-primary-700 focus:ring-2 focus:ring-primary-700/20"
                    />
                  </div>
                </div>
              )}
            </section>
            <div id="planner-notices" className="scroll-mt-24">
              {pendingRequest && (
                <p role="status" className="mt-3 text-sm text-gray-700">
                  Unfinished request: {pendingRequest.destination},{" "}
                  {pendingRequest.start_date} to {pendingRequest.end_date}. Use
                  Resume saved trip below to resume this same trip; your changed
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
            className="overflow-hidden rounded-3xl border border-[#DCE5E3] bg-[#EFF5F3] lg:sticky lg:top-8 hidden lg:block"
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
                  <MapPin className="mt-0.5 h-4 w-4 text-slate-600" />
                  <div>
                    <dt className="text-slate-600">
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
                {(originAirport.trim() || originCity.trim()) && (
                  <div className="flex gap-3">
                    <Plane className="mt-0.5 h-4 w-4 text-slate-600" />
                    <div>
                      <dt className="text-slate-600">
                        Departing{" "}
                        <button
                          onClick={() => scrollToSection("planner-flights")}
                          className="ml-2 text-xs font-semibold underline underline-offset-4"
                        >
                          Edit
                        </button>
                      </dt>
                      <dd className="mt-1 font-semibold">
                        {[originCity.trim(), originAirport.trim().toUpperCase()]
                          .filter(Boolean)
                          .join(" · ")}
                      </dd>
                    </div>
                  </div>
                )}
                <div className="flex gap-3">
                  <Calendar className="mt-0.5 h-4 w-4 text-slate-600" />
                  <div>
                    <dt className="text-slate-600">
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
                  <Users className="mt-0.5 h-4 w-4 text-slate-600" />
                  <div>
                    <dt className="text-slate-600">Travelers</dt>
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
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-800"
                    >
                      {vibes.find((v) => v.id === id)?.label}
                    </span>
                  ))}
                </div>
              )}
              <p className="mt-6 border-t border-[#DCE5E3] pt-5 text-sm leading-6 text-slate-600">
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
            <p className="truncate text-sm font-semibold">
              {pendingRequest?.destination ||
                selectedPlace?.name ||
                "Your next adventure"}
              {datesReady && !pendingRequest
                ? ` · ${format(startDate!, "MMM d")} – ${format(endDate!, "MMM d")} · ${travelers} ${travelers === 1 ? "traveler" : "travelers"}`
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
                          ? hotelDetailsInvalid
                            ? "planner-hotels"
                            : "planner-flights"
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
    </div>
  );
}
