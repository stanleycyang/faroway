"use client";

import React, { useEffect, useRef, useState } from "react";
import { ResilientImage as Image } from "@/components/ResilientImage";
import {
  Sparkles,
  Compass,
  Undo2,
  Bookmark,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Plane,
  Calendar,
} from "lucide-react";
import {
  BUDGET_LABELS,
  BUDGET_TIERS,
  normalizeBudgetTier,
  normalizeVibeId,
  normalizeVibeList,
  travelVibes,
  type BudgetTierId,
  type TravelVibeId,
} from "@faroway/constants";
import type {
  AccessibilityOptionId,
  BudgetTier,
  DietaryOption,
  ParsedDreamTrip,
  VibeId,
} from "@/lib/trips/prompt-parser";
import type { DestinationSuggestion } from "@/lib/trips/destination-suggester";

const MEMORY_VIBE_TO_PARSER: Partial<Record<TravelVibeId, VibeId>> = {
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

const MEMORY_SUPPORTED_VIBES = travelVibes.filter((v) =>
  Boolean(MEMORY_VIBE_TO_PARSER[v.id as TravelVibeId]),
);

function getVibeLabel(raw: string): string {
  const canonical = normalizeVibeId(raw);
  if (!canonical) return raw;
  return travelVibes.find((v) => v.id === canonical)?.label ?? raw;
}

const VALID_DIETARY: readonly DietaryOption[] = [
  "Vegetarian",
  "Vegan",
  "Halal",
  "Kosher",
  "Gluten-free",
  "Pescatarian",
];
const VALID_ACCESSIBILITY: readonly AccessibilityOptionId[] = [
  "step_free_entrance",
  "accessible_restroom",
  "accessible_seating",
  "accessible_parking",
];
import {
  hasTravelerMemoryValues,
  type LearnedPreferenceSuggestion,
  type TravelerMemory,
  type TravelerPace,
} from "@/lib/trips/traveler-memory";

function formatTravelerMemoryChips(memory: TravelerMemory): string[] {
  const chips: string[] = [];
  if (memory.homeAirport) chips.push(`Home: ${memory.homeAirport}`);
  if (memory.defaultBudget) {
    const budgetId = normalizeBudgetTier(memory.defaultBudget) ?? "moderate";
    chips.push(BUDGET_LABELS[budgetId]);
  }
  if (memory.defaultPace) {
    chips.push(
      `${memory.defaultPace[0].toUpperCase()}${memory.defaultPace.slice(1)} pace`,
    );
  }
  if (memory.avoidEarlyStarts) chips.push("No early starts");
  if (memory.defaultVibes.length > 0) {
    chips.push(memory.defaultVibes.map((v) => getVibeLabel(v)).join(", "));
  }
  if (memory.dietaryPreferences.length > 0) {
    chips.push(memory.dietaryPreferences.join(", "));
  }
  if (memory.allergies.length > 0) {
    chips.push(`Allergies: ${memory.allergies.join(", ")}`);
  }
  if (memory.accessibility.length > 0) {
    chips.push(
      `${memory.accessibility.length} accessibility ${memory.accessibility.length === 1 ? "need" : "needs"}`,
    );
  }
  return chips;
}

function formatLearnedSuggestionLabel(
  suggestion: LearnedPreferenceSuggestion,
): string {
  if (suggestion.patch.defaultBudget || suggestion.id.startsWith("budget:")) {
    const budgetId = normalizeBudgetTier(
      suggestion.patch.defaultBudget ?? suggestion.id.slice("budget:".length),
    );
    if (budgetId) {
      return `Default to ${BUDGET_LABELS[budgetId]}`;
    }
  }
  if (suggestion.id.startsWith("vibe:")) {
    const rawVibe = suggestion.id.slice("vibe:".length);
    return `Add ${getVibeLabel(rawVibe)} as a default vibe`;
  }
  return suggestion.label;
}

const EXAMPLE_PROMPTS = [
  "5 days in Lisbon in October, foodie & cultural, relaxed mornings",
  "Anniversary in Santorini, luxury, romantic sunsets, vegetarian",
  "Family of 4 in Tokyo, May 10-15, peanut allergy, midday rest",
] as const;

const DECIDE_QUICK_IDEAS = [
  "Warm & foodie in November",
  "Short flight from NYC, walkable culture",
  "Budget adventure in spring",
] as const;

const MONTH_OPTIONS = [
  "",
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

const PACE_LABELS: Record<TravelerPace, string> = {
  relaxed: "Relaxed",
  balanced: "Balanced",
  packed: "Packed",
};

const ACCESSIBILITY_LABELS: Record<AccessibilityOptionId, string> = {
  step_free_entrance: "Step-free entrance",
  accessible_restroom: "Accessible restroom",
  accessible_seating: "Accessible seating",
  accessible_parking: "Accessible parking",
};

export interface AppliedKickoffSummary {
  chips: string[];
  hasSafetyNotice: boolean;
  sourceLabel: string;
}

export interface DreamTripPromptBarProps {
  isAuthenticated: boolean;
  disabled?: boolean;
  travelerMemory: TravelerMemory;
  memoryAppliedFields: string[];
  learnedSuggestions: LearnedPreferenceSuggestion[];
  appliedSummary: AppliedKickoffSummary | null;
  canUndo: boolean;
  onApplyParsedPrompt: (parsed: ParsedDreamTrip) => void;
  onApplySuggestion: (suggestion: DestinationSuggestion) => void;
  onUndo: () => void;
  onSaveMemory: (next: Partial<TravelerMemory>) => void;
  onSaveCurrentAsMemory: () => void;
  onClearMemory: () => void;
  onAcceptLearnedSuggestion: (suggestion: LearnedPreferenceSuggestion) => void;
  onDismissLearnedSuggestion: (id: string) => void;
}

export function DreamTripPromptBar({
  isAuthenticated,
  disabled = false,
  travelerMemory,
  memoryAppliedFields,
  learnedSuggestions,
  appliedSummary,
  canUndo,
  onApplyParsedPrompt,
  onApplySuggestion,
  onUndo,
  onSaveMemory,
  onSaveCurrentAsMemory,
  onClearMemory,
  onAcceptLearnedSuggestion,
  onDismissLearnedSuggestion,
}: DreamTripPromptBarProps) {
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const [promptText, setPromptText] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [parseFeedback, setParseFeedback] = useState<string | null>(null);

  const [showDecide, setShowDecide] = useState(false);
  const [decideQuery, setDecideQuery] = useState("");
  const [decideOrigin, setDecideOrigin] = useState(travelerMemory.homeAirport);
  const [decideMonth, setDecideMonth] = useState("");
  const [decideBudget, setDecideBudget] = useState<BudgetTier | "">(
    travelerMemory.defaultBudget ?? "",
  );
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);

  const [showMemoryEditor, setShowMemoryEditor] = useState(false);
  const [memorySavedNotice, setMemorySavedNotice] = useState<string | null>(
    null,
  );
  const [draftHomeAirport, setDraftHomeAirport] = useState(
    travelerMemory.homeAirport,
  );
  const [draftBudget, setDraftBudget] = useState<BudgetTier | null>(
    travelerMemory.defaultBudget,
  );
  const [draftPace, setDraftPace] = useState<TravelerPace | null>(
    travelerMemory.defaultPace,
  );
  const [draftAvoidEarly, setDraftAvoidEarly] = useState(
    travelerMemory.avoidEarlyStarts,
  );
  const [draftVibes, setDraftVibes] = useState<TravelVibeId[]>(() =>
    normalizeVibeList(travelerMemory.defaultVibes, 5),
  );
  const [draftDietary, setDraftDietary] = useState<DietaryOption[]>(
    travelerMemory.dietaryPreferences,
  );
  const [draftAllergies, setDraftAllergies] = useState(
    travelerMemory.allergies.join(", "),
  );
  const [draftAccessibility, setDraftAccessibility] = useState<
    AccessibilityOptionId[]
  >(travelerMemory.accessibility);
  const [draftMobilityNotes, setDraftMobilityNotes] = useState(
    travelerMemory.mobilityNotes,
  );

  const syncDraftFromMemory = (memory: TravelerMemory) => {
    setDraftHomeAirport(memory.homeAirport);
    setDraftBudget(memory.defaultBudget);
    setDraftPace(memory.defaultPace);
    setDraftAvoidEarly(memory.avoidEarlyStarts);
    setDraftVibes(normalizeVibeList(memory.defaultVibes, 5));
    setDraftDietary(memory.dietaryPreferences);
    setDraftAllergies(memory.allergies.join(", "));
    setDraftAccessibility(memory.accessibility);
    setDraftMobilityNotes(memory.mobilityNotes);
  };

  const parseLock = useRef(false);
  const suggestLock = useRef(false);

  const runPromptParse = async (textOverride?: string) => {
    const raw = (textOverride ?? promptText).trim();
    if (raw.length < 2) {
      setParseFeedback("Describe where or how you'd like to travel first.");
      return;
    }
    if (parseLock.current) return;
    parseLock.current = true;
    setIsParsing(true);
    setParseFeedback(null);

    try {
      let parsed: ParsedDreamTrip | null = null;
      if (isAuthenticated && typeof fetch === "function") {
        try {
          const response = await fetch("/api/trips/parse-prompt", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(5_000),
            body: JSON.stringify({ prompt: raw }),
          });
          if (response.ok) {
            const payload = (await response.json()) as {
              parsed?: ParsedDreamTrip;
            };
            if (payload.parsed) parsed = payload.parsed;
          }
        } catch {
          // Fall back cleanly to deterministic parser when offline or slow.
        }
      }

      if (!parsed) {
        const { parseDreamTripPrompt } =
          await import("@/lib/trips/prompt-parser");
        parsed = parseDreamTripPrompt(raw);
      }

      if (!mounted.current) return;

      const { summarizeParsedDreamTrip } =
        await import("@/lib/trips/prompt-parser");
      const summaryChips = summarizeParsedDreamTrip(parsed);
      if (summaryChips.length === 0) {
        setParseFeedback(
          "We couldn't spot specific trip details yet — try adding a city, month, or vibe, or tap Help me decide.",
        );
      } else {
        onApplyParsedPrompt(parsed);
      }
    } finally {
      parseLock.current = false;
      if (mounted.current) setIsParsing(false);
    }
  };

  const runDestinationSuggest = async (queryOverride?: string) => {
    const rawQuery = (
      queryOverride ??
      (decideQuery.trim() || promptText.trim())
    ).trim();
    if (rawQuery.length < 2) {
      setSuggestError(
        "Tell us a vibe, season, or wish (e.g., warm & foodie in November).",
      );
      return;
    }
    if (suggestLock.current) return;
    suggestLock.current = true;
    setIsSuggesting(true);
    setSuggestError(null);

    const requestBody = {
      query: rawQuery,
      ...(decideOrigin.trim() ? { origin: decideOrigin.trim() } : {}),
      ...(decideMonth ? { month: decideMonth } : {}),
      ...(decideBudget ? { budget: decideBudget } : {}),
    };

    try {
      let results: DestinationSuggestion[] | null = null;
      if (typeof fetch === "function") {
        try {
          const response = await fetch("/api/trips/suggest-destinations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: AbortSignal.timeout(5_000),
            body: JSON.stringify(requestBody),
          });
          if (response.ok) {
            const payload = (await response.json()) as {
              suggestions?: DestinationSuggestion[];
            };
            if (Array.isArray(payload.suggestions)) {
              results = payload.suggestions;
            }
          }
        } catch {
          // Fall back cleanly to local scorer when offline.
        }
      }

      if (!results) {
        const { suggestDestinations } =
          await import("@/lib/trips/destination-suggester");
        results = suggestDestinations(requestBody);
      }

      if (!mounted.current) return;
      setSuggestions(results);
    } finally {
      suggestLock.current = false;
      if (mounted.current) setIsSuggesting(false);
    }
  };

  const memoryHasValues = hasTravelerMemoryValues(travelerMemory);
  const memoryChips = formatTravelerMemoryChips(travelerMemory);

  const handleSaveMemoryDraft = () => {
    const parsedAllergies = draftAllergies
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const memoryVibes = draftVibes
      .map((v) => MEMORY_VIBE_TO_PARSER[v])
      .filter((v): v is VibeId => Boolean(v));
    onSaveMemory({
      homeAirport: draftHomeAirport.trim(),
      defaultBudget: draftBudget,
      defaultPace: draftPace,
      avoidEarlyStarts: draftAvoidEarly,
      defaultVibes: memoryVibes,
      dietaryPreferences: draftDietary,
      allergies: parsedAllergies,
      accessibility: draftAccessibility,
      mobilityNotes: draftMobilityNotes.trim(),
    });
    setShowMemoryEditor(false);
    setMemorySavedNotice("Defaults saved for future trips.");
  };

  const handleSaveCurrentClick = () => {
    onSaveCurrentAsMemory();
    setMemorySavedNotice("Saved your current planner preferences as defaults.");
  };

  const handleClearMemoryClick = () => {
    onClearMemory();
    setShowMemoryEditor(false);
    setMemorySavedNotice("Cleared your saved defaults.");
  };

  return (
    <section
      aria-label="Dream trip kickoff"
      className="rounded-2xl border border-gray-200 bg-slate-50/80 p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-50 text-primary-700">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-900 sm:text-base">
              Describe your dream trip
            </h2>
            <p className="text-xs text-slate-600">
              Type naturally and we’ll fill the planner below for you to review.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={showDecide}
          onClick={() => {
            setShowDecide((open) => {
              const next = !open;
              if (next) {
                if (!decideQuery && promptText.trim()) {
                  setDecideQuery(promptText.trim());
                }
                if (!decideOrigin && travelerMemory.homeAirport) {
                  setDecideOrigin(travelerMemory.homeAirport);
                }
                if (!decideBudget && travelerMemory.defaultBudget) {
                  setDecideBudget(travelerMemory.defaultBudget);
                }
              }
              return next;
            });
          }}
          className={`inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
            showDecide
              ? "border-primary-700 bg-primary-50 text-primary-800"
              : "border-gray-200 bg-white text-slate-700 hover:border-gray-300"
          }`}
        >
          <Compass className="h-3.5 w-3.5" aria-hidden="true" />
          Help me decide
        </button>
      </div>

      {/* Main dream trip prompt bar */}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="dream-trip-prompt-input" className="sr-only">
          Describe your dream trip
        </label>
        <input
          id="dream-trip-prompt-input"
          type="text"
          maxLength={600}
          disabled={disabled || isParsing}
          value={promptText}
          onChange={(e) => {
            setPromptText(e.target.value);
            if (parseFeedback) setParseFeedback(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void runPromptParse();
            }
          }}
          placeholder="e.g., 5 days in Kyoto in October for our anniversary, foodie, vegetarian, relaxed mornings"
          className="min-h-11 flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 outline-none focus:border-primary-700 focus:ring-2 focus:ring-primary-700/20"
        />
        <button
          type="button"
          disabled={disabled || isParsing}
          onClick={() => void runPromptParse()}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          {isParsing ? "Filling…" : "Fill my trip"}
        </button>
      </div>

      {/* Example chips */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {EXAMPLE_PROMPTS.map((example) => (
          <button
            key={example}
            type="button"
            disabled={disabled || isParsing}
            onClick={() => {
              setPromptText(example);
              void runPromptParse(example);
            }}
            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-left text-xs text-slate-600 transition-colors hover:border-primary-700/50 hover:text-slate-900"
          >
            {example}
          </button>
        ))}
      </div>

      {parseFeedback && (
        <p role="status" className="mt-2.5 text-xs font-medium text-amber-700">
          {parseFeedback}
        </p>
      )}

      {/* Confirmation pill + Undo */}
      {appliedSummary && appliedSummary.chips.length > 0 && (
        <div
          role="status"
          className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2.5 text-xs text-emerald-950"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-800">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {appliedSummary.sourceLabel}:
              </span>
              {appliedSummary.chips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full bg-white px-2.5 py-0.5 font-medium text-emerald-900 shadow-xs"
                >
                  {chip}
                </span>
              ))}
            </div>
            {canUndo && (
              <button
                type="button"
                onClick={onUndo}
                className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-900 hover:bg-emerald-100"
              >
                <Undo2 className="h-3 w-3" aria-hidden="true" />
                Undo
              </button>
            )}
          </div>
          {appliedSummary.hasSafetyNotice && (
            <p className="mt-1.5 text-[11px] text-emerald-800">
              Dietary, allergy, and accessibility notes guide your itinerary —
              always confirm directly with venues.
            </p>
          )}
        </div>
      )}

      {/* Help Me Decide panel */}
      {showDecide && (
        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Not sure where to go?
              </h3>
              <p className="text-xs text-slate-600">
                Share the vibe, climate, or flight time you want — we’ll pitch 3
                tailored destinations.
              </p>
            </div>
            <button
              type="button"
              aria-label="Close destination suggester"
              onClick={() => setShowDecide(false)}
              className="rounded-full p-1 text-slate-600 hover:bg-gray-100 hover:text-slate-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="sm:col-span-2 lg:col-span-4">
              <label htmlFor="decide-query-input" className="sr-only">
                What kind of trip are you craving?
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="decide-query-input"
                  type="text"
                  maxLength={400}
                  value={decideQuery}
                  onChange={(e) => {
                    setDecideQuery(e.target.value);
                    if (suggestError) setSuggestError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void runDestinationSuggest();
                    }
                  }}
                  placeholder="e.g., Warm coastal town with great food, walkable, under 8h from NYC"
                  className="min-h-10 flex-1 rounded-xl border border-gray-200 bg-slate-50/50 px-3.5 py-2 text-sm text-slate-900 placeholder-slate-500 outline-none focus:border-primary-700 focus:bg-white focus:ring-2 focus:ring-primary-700/20"
                />
                <button
                  type="button"
                  disabled={disabled || isSuggesting}
                  onClick={() => void runDestinationSuggest()}
                  className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary-700 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-800 disabled:opacity-50"
                >
                  <Compass className="h-3.5 w-3.5" aria-hidden="true" />
                  {isSuggesting ? "Matching…" : "Suggest 3 places"}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="decide-origin"
                className="mb-1 block text-[11px] font-medium text-slate-600"
              >
                Flying from (optional)
              </label>
              <input
                id="decide-origin"
                type="text"
                maxLength={60}
                value={decideOrigin}
                onChange={(e) => setDecideOrigin(e.target.value)}
                placeholder="e.g., SFO, NYC, London"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder-slate-500 outline-none focus:border-primary-700"
              />
            </div>

            <div>
              <label
                htmlFor="decide-month"
                className="mb-1 block text-[11px] font-medium text-slate-600"
              >
                Month (optional)
              </label>
              <select
                id="decide-month"
                value={decideMonth}
                onChange={(e) => setDecideMonth(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-primary-700"
              >
                <option value="">Any month</option>
                {MONTH_OPTIONS.filter(Boolean).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="decide-budget"
                className="mb-1 block text-[11px] font-medium text-slate-600"
              >
                Budget tier (optional)
              </label>
              <select
                id="decide-budget"
                value={decideBudget}
                onChange={(e) =>
                  setDecideBudget(e.target.value as BudgetTier | "")
                }
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-primary-700"
              >
                <option value="">Any budget tier</option>
                {BUDGET_TIERS.map((tier) => (
                  <option key={tier.id} value={tier.id}>
                    {tier.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {DECIDE_QUICK_IDEAS.map((idea) => (
              <button
                key={idea}
                type="button"
                disabled={disabled || isSuggesting}
                onClick={() => {
                  setDecideQuery(idea);
                  void runDestinationSuggest(idea);
                }}
                className="rounded-full border border-gray-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-primary-700/50 hover:text-slate-900"
              >
                {idea}
              </button>
            ))}
          </div>

          {suggestError && (
            <p
              role="status"
              className="mt-2 text-xs font-medium text-amber-700"
            >
              {suggestError}
            </p>
          )}

          {suggestions.length > 0 && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {suggestions.map((item) => (
                <article
                  key={item.slug}
                  className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white"
                >
                  <div className="relative h-28 w-full bg-slate-200">
                    <Image
                      src={item.heroImage}
                      alt={`${item.name}, ${item.country}`}
                      fallbackAlt={`Travel destination ${item.name}`}
                      fill
                      sizes="(max-width: 640px) 100vw, 240px"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                    <div className="absolute bottom-2.5 left-3 right-3 text-white">
                      <p className="text-[11px] text-white/80">
                        {item.country}
                      </p>
                      <h4 className="text-base font-bold leading-tight">
                        {item.name}
                      </h4>
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col p-3">
                    <p className="text-xs leading-5 text-slate-700">
                      {item.whyItFits}
                    </p>
                    <p className="mt-2 flex items-start gap-1 text-[11px] leading-4 text-slate-600">
                      <Calendar
                        className="mt-0.5 h-3 w-3 shrink-0"
                        aria-hidden="true"
                      />
                      <span>{item.seasonNote}</span>
                    </p>
                    {item.flightHint && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-slate-600">
                        <Plane
                          className="h-3 w-3 shrink-0"
                          aria-hidden="true"
                        />
                        <span>{item.flightHint}</span>
                      </p>
                    )}
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {item.suggestedVibes.map((vibe) => (
                        <span
                          key={vibe}
                          className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700"
                        >
                          {getVibeLabel(vibe)}
                        </span>
                      ))}
                      <span className="rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-800">
                        {
                          BUDGET_LABELS[
                            (normalizeBudgetTier(item.suggestedBudget) ??
                              "moderate") as BudgetTierId
                          ]
                        }
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        onApplySuggestion(item);
                        setShowDecide(false);
                      }}
                      className="mt-3 inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      Plan {item.name}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Transparent Traveler Memory pill */}
      <div className="mt-3 border-t border-gray-200/80 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5 text-slate-700">
            <Bookmark
              className="h-3.5 w-3.5 text-primary-700"
              aria-hidden="true"
            />
            {memoryHasValues ? (
              <>
                <span className="font-semibold text-slate-900">
                  {memoryAppliedFields.length > 0
                    ? "Using your saved defaults"
                    : "Saved traveler defaults"}
                </span>
                {memoryChips.slice(0, 3).map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11px] text-slate-700"
                  >
                    {chip}
                  </span>
                ))}
                {memoryChips.length > 3 && (
                  <span className="text-[11px] text-slate-600">
                    +{memoryChips.length - 3} more
                  </span>
                )}
              </>
            ) : (
              <span className="text-slate-600">
                <span className="font-semibold text-slate-800">
                  Traveler Memory
                </span>{" "}
                — save defaults to auto-apply on future trips
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={handleSaveCurrentClick}
              className="font-semibold text-primary-700 underline underline-offset-4 hover:text-primary-800"
            >
              Save current as defaults
            </button>
            <button
              type="button"
              disabled={disabled}
              aria-expanded={showMemoryEditor}
              onClick={() => {
                setShowMemoryEditor((open) => {
                  const next = !open;
                  if (next) syncDraftFromMemory(travelerMemory);
                  return next;
                });
                setMemorySavedNotice(null);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-gray-300"
            >
              {memoryHasValues ? "Edit defaults" : "Set defaults"}
              {showMemoryEditor ? (
                <ChevronUp className="h-3 w-3" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              )}
            </button>
            {memoryHasValues && (
              <button
                type="button"
                disabled={disabled}
                onClick={handleClearMemoryClick}
                className="text-xs font-medium text-slate-600 hover:text-red-700"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {memorySavedNotice && (
          <p
            role="status"
            className="mt-1.5 text-[11px] font-medium text-emerald-700"
          >
            {memorySavedNotice}
          </p>
        )}

        {/* Learned from your trips suggestion chips */}
        {learnedSuggestions.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-slate-600">
              Learned from your trips:
            </span>
            {learnedSuggestions.map((suggestion) => {
              const suggestionLabel = formatLearnedSuggestionLabel(suggestion);
              return (
                <div
                  key={suggestion.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-primary-700/30 bg-primary-50/70 px-2.5 py-1 text-[11px] text-primary-900"
                >
                  <span title={suggestion.reason}>{suggestionLabel}</span>
                  <button
                    type="button"
                    onClick={() => {
                      onAcceptLearnedSuggestion(suggestion);
                      setMemorySavedNotice(
                        `Added "${suggestionLabel}" to your defaults.`,
                      );
                    }}
                    className="rounded-full bg-primary-700 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-primary-800"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    aria-label={`Dismiss ${suggestionLabel}`}
                    onClick={() => onDismissLearnedSuggestion(suggestion.id)}
                    className="text-primary-700 hover:text-primary-950"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Collapsible Traveler Memory editor */}
        {showMemoryEditor && (
          <div className="mt-3 space-y-4 rounded-xl border border-gray-200 bg-white p-4 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Always apply to my trips
                </h3>
                <p className="text-[11px] text-slate-600">
                  {isAuthenticated
                    ? "Saved locally on this device for your account. Never overrides explicit links or drafts, and always clearable in one click."
                    : "Saved in this browser. Sign in to keep separate defaults for your account; always clearable in one click."}
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label
                  htmlFor="memory-home-airport"
                  className="mb-1 block font-medium text-slate-700"
                >
                  Home airport
                </label>
                <input
                  id="memory-home-airport"
                  type="text"
                  maxLength={60}
                  value={draftHomeAirport}
                  onChange={(e) => setDraftHomeAirport(e.target.value)}
                  placeholder="e.g., SFO, JFK, LHR"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-slate-900 placeholder-slate-500 outline-none focus:border-primary-700"
                />
              </div>

              <div>
                <label
                  htmlFor="memory-default-budget"
                  className="mb-1 block font-medium text-slate-700"
                >
                  Default budget
                </label>
                <select
                  id="memory-default-budget"
                  value={draftBudget ?? ""}
                  onChange={(e) =>
                    setDraftBudget(
                      e.target.value ? (e.target.value as BudgetTier) : null,
                    )
                  }
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-primary-700"
                >
                  <option value="">No default</option>
                  {BUDGET_TIERS.map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="memory-default-pace"
                  className="mb-1 block font-medium text-slate-700"
                >
                  Default pace
                </label>
                <select
                  id="memory-default-pace"
                  value={draftPace ?? ""}
                  onChange={(e) =>
                    setDraftPace(
                      e.target.value ? (e.target.value as TravelerPace) : null,
                    )
                  }
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-primary-700"
                >
                  <option value="">No default</option>
                  {(["relaxed", "balanced", "packed"] as const).map((pace) => (
                    <option key={pace} value={pace}>
                      {PACE_LABELS[pace]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 font-medium text-slate-700">
              <input
                type="checkbox"
                checked={draftAvoidEarly}
                onChange={(e) => setDraftAvoidEarly(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-700"
              />
              Avoid early morning starts by default
            </label>

            <div>
              <p className="mb-1.5 font-medium text-slate-700">
                Default travel vibes (up to 5)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {MEMORY_SUPPORTED_VIBES.map((vibe) => {
                  const vibeId = vibe.id as TravelVibeId;
                  const active = draftVibes.includes(vibeId);
                  return (
                    <button
                      key={vibeId}
                      type="button"
                      aria-pressed={active}
                      disabled={!active && draftVibes.length >= 5}
                      onClick={() =>
                        setDraftVibes((prev) =>
                          prev.includes(vibeId)
                            ? prev.filter((item) => item !== vibeId)
                            : prev.length < 5
                              ? [...prev, vibeId]
                              : prev,
                        )
                      }
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                        active
                          ? "border-primary-700 bg-primary-50 text-primary-800"
                          : "border-gray-200 bg-white text-slate-600 disabled:opacity-40"
                      }`}
                    >
                      {vibe.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-1.5 font-medium text-slate-700">
                Dietary preferences
              </p>
              <div className="flex flex-wrap gap-1.5">
                {VALID_DIETARY.map((diet) => {
                  const active = draftDietary.includes(diet);
                  return (
                    <button
                      key={diet}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setDraftDietary((prev) =>
                          prev.includes(diet)
                            ? prev.filter((item) => item !== diet)
                            : [...prev, diet],
                        )
                      }
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                        active
                          ? "border-primary-700 bg-primary-50 text-primary-800"
                          : "border-gray-200 bg-white text-slate-600"
                      }`}
                    >
                      {diet}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="memory-allergies"
                  className="mb-1 block font-medium text-slate-700"
                >
                  Allergies (comma-separated)
                </label>
                <input
                  id="memory-allergies"
                  type="text"
                  maxLength={300}
                  value={draftAllergies}
                  onChange={(e) => setDraftAllergies(e.target.value)}
                  placeholder="e.g., peanuts, shellfish"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-slate-900 placeholder-slate-500 outline-none focus:border-primary-700"
                />
              </div>
              <div>
                <label
                  htmlFor="memory-mobility-notes"
                  className="mb-1 block font-medium text-slate-700"
                >
                  Mobility or pacing notes
                </label>
                <input
                  id="memory-mobility-notes"
                  type="text"
                  maxLength={500}
                  value={draftMobilityNotes}
                  onChange={(e) => setDraftMobilityNotes(e.target.value)}
                  placeholder="e.g., Stroller-friendly routes, midday rest"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-slate-900 placeholder-slate-500 outline-none focus:border-primary-700"
                />
              </div>
            </div>

            <div>
              <p className="mb-1.5 font-medium text-slate-700">
                Accessibility needs
              </p>
              <div className="flex flex-wrap gap-1.5">
                {VALID_ACCESSIBILITY.map((need) => {
                  const active = draftAccessibility.includes(need);
                  return (
                    <button
                      key={need}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setDraftAccessibility((prev) =>
                          prev.includes(need)
                            ? prev.filter((item) => item !== need)
                            : [...prev, need],
                        )
                      }
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                        active
                          ? "border-primary-700 bg-primary-50 text-primary-800"
                          : "border-gray-200 bg-white text-slate-600"
                      }`}
                    >
                      {ACCESSIBILITY_LABELS[need]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={handleClearMemoryClick}
                className="text-xs font-medium text-red-700 hover:underline"
              >
                Clear all defaults
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowMemoryEditor(false)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveMemoryDraft}
                  className="rounded-lg bg-primary-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-800"
                >
                  Save defaults
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
