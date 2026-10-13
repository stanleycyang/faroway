"use client";

import { useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  Compass,
  Hotel,
  MapPin,
  Sparkles,
  Utensils,
  Plane,
  ArrowDown,
  BookOpen,
} from "lucide-react";
import type { TripDay } from "@faroway/types";
import type {
  SearchProgress,
  StreamingSpecBlock,
} from "@/hooks/useTripGeneration";
import {
  draftChapters,
  streamStepState,
  type DraftChapter,
} from "@/lib/trips/streaming-dossier";
import { formatTripDate, parseTripDate } from "@/lib/trips/date-duration";
import { TripCoverImage } from "./TripCoverImage";

export type GenerationPhase =
  | "connecting"
  | "orchestrator"
  | "searching"
  | "composing"
  | "complete"
  | "error";
const steps = [
  { key: "orchestrator", label: "Reading your preferences", icon: Compass },
  { key: "hotels", label: "Scouting stays & neighborhoods", icon: Hotel },
  {
    key: "activities",
    label: "Finding activities & attractions",
    icon: MapPin,
  },
  { key: "dining", label: "Discovering restaurants", icon: Utensils },
  { key: "transport", label: "Checking flight options", icon: Plane },
  { key: "enrichment", label: "Adding local gems", icon: Sparkles },
  { key: "aggregator", label: "Polishing your itinerary", icon: BookOpen },
] as const;
const phases: Record<GenerationPhase, string> = {
  connecting: "Opening your dossier",
  orchestrator: "Getting to know your trip",
  searching: "Discovering your destination",
  composing: "Bringing your days together",
  complete: "Your journey is ready",
  error: "Planning interrupted",
};

export interface ItineraryGenerationLoaderProps {
  destination: string;
  heroImageUrl?: string;
  hotelPreview?: {
    name: string;
    image?: string;
    description?: string;
    amenities?: string[];
  };
  children?: ReactNode;
  nights: number;
  travelers: number;
  startDate?: string;
  endDate?: string;
  phase: GenerationPhase;
  failureConfirmed?: boolean;
  progress: number;
  message: string;
  summary?: string;
  onOpenTrip?: () => void;
  searchProgress: SearchProgress | null;
  activitiesCount: number;
  diningCount: number;
  transportCount: number;
  days?: TripDay[] | null;
  specBlocks?: StreamingSpecBlock[];
}

export function ItineraryGenerationLoader({
  destination,
  heroImageUrl,
  hotelPreview,
  children,
  nights,
  travelers,
  startDate,
  endDate,
  phase,
  failureConfirmed = false,
  progress,
  message,
  summary,
  onOpenTrip,
  searchProgress,
  activitiesCount,
  diningCount,
  transportCount,
  days,
  specBlocks,
}: ItineraryGenerationLoaderProps) {
  const percentage = Number.isFinite(progress)
    ? Math.round(Math.max(0, Math.min(100, progress)))
    : 0;
  const chapters = draftChapters(days, specBlocks);
  const discoveryCount =
    Math.max(0, activitiesCount) + Math.max(0, diningCount);
  const activeSteps = steps.filter(
    (step) => streamStepState(step.key, phase, searchProgress) === "active",
  );
  const validDates =
    startDate &&
    endDate &&
    !Number.isNaN(parseTripDate(startDate).getTime()) &&
    !Number.isNaN(parseTripDate(endDate).getTime());
  const goToChapters = () => {
    const section = document.getElementById("live-journey-chapters");
    section?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
    section?.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
  };
  return (
    <div className="concierge-dossier fixed inset-0 z-[100] overflow-y-auto bg-[#f7f8fa] text-slate-900">
      <div className="mx-auto min-h-dvh lg:grid lg:grid-cols-[minmax(340px,0.82fr)_minmax(0,1.18fr)]">
        <aside className="relative min-h-[380px] overflow-hidden bg-slate-900 text-white sm:min-h-[440px] lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto">
          {heroImageUrl && (
            <TripCoverImage src={heroImageUrl} className="object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/20 to-slate-950/95" />
          <div className="relative flex min-h-[380px] flex-col justify-between p-6 sm:min-h-[440px] sm:p-10 lg:h-full lg:p-12 xl:p-16">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-lg font-bold">
                <Compass className="h-6 w-6" />
                faroway.
              </span>
              <span className="rounded-full border border-white/30 px-3 py-1.5 text-xs font-medium">
                Your travel concierge
              </span>
            </div>
            <div className="mt-16 lg:mt-auto">
              <p className="mb-4 text-sm text-white/80">
                {phase === "complete"
                  ? "Your next chapter starts here."
                  : "A journey, coming to life."}
              </p>
              <h1 className="font-editorial break-words text-balance text-5xl leading-[1.05] tracking-[-0.045em] sm:text-6xl xl:text-7xl">
                {destination || "Your next chapter"}
              </h1>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/85">
                <span>
                  {validDates
                    ? `${formatTripDate(startDate)} – ${formatTripDate(endDate)}`
                    : `${nights} ${nights === 1 ? "night" : "nights"}`}
                </span>
                <span>
                  {travelers} {travelers === 1 ? "traveler" : "travelers"}
                </span>
              </div>
              <p className="mt-6 max-w-sm text-sm leading-7 text-white/75">
                Places to linger. Moments to remember. A little room for the
                unexpected.
              </p>
              <button
                onClick={goToChapters}
                className="mt-8 inline-flex min-h-11 items-center gap-3 rounded-full border border-white/30 px-5 py-2.5 text-sm font-medium hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
              >
                <ArrowDown className="h-4 w-4" />
                Explore your emerging journey
              </button>
            </div>
            <p className="mt-10 hidden text-xs text-white/60 lg:block">
              A personal itinerary, thoughtfully brought together.
            </p>
          </div>
        </aside>
        <main className="min-w-0 px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8 sm:px-10 sm:pt-10 lg:px-12 xl:px-16">
          <div className="mx-auto max-w-2xl">
            <div className="flex items-center justify-between gap-4">
              <p className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${phase === "error" ? "bg-amber-600" : "bg-teal-700 motion-safe:animate-pulse"}`}
                />
                {phase === "error"
                  ? "Your draft is preserved"
                  : phase === "complete"
                    ? "Your journey is ready"
                    : "Your concierge is at work"}
              </p>
              <span className="text-xs font-medium tabular-nums text-slate-600">
                {percentage}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-label="Itinerary generation progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percentage}
              aria-valuetext={
                phase === "error"
                  ? `Last received progress: ${percentage}%`
                  : undefined
              }
              className="mt-4 h-0.5 overflow-hidden rounded-full bg-slate-200"
            >
              <div
                className="h-full bg-primary-700 motion-safe:transition-[width] duration-700"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <h2 className="mt-8 font-editorial text-balance text-3xl leading-tight tracking-tight sm:text-4xl">
              {phase === "error" && !failureConfirmed
                ? "Live updates paused"
                : phases[phase]}
            </h2>
            <p
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="mt-3 min-h-12 text-sm leading-6 text-slate-600"
            >
              {(phase === "complete" ? summary : undefined) ||
                message ||
                "We’re reading your brief and shaping a journey around you."}
            </p>
            <details className="mt-4 border-y border-slate-200 py-4">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-sm">
                <span className="font-semibold">Behind the journey</span>
                <span className="ml-auto text-xs text-slate-600">
                  {activeSteps.length
                    ? `${activeSteps.length} ${activeSteps.length === 1 ? "task" : "tasks"} active`
                    : phase === "complete"
                      ? "Finished"
                      : "View activity"}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-600" />
              </summary>
              <ul
                aria-label="Generation steps"
                className="mt-4 grid gap-3 sm:grid-cols-2"
              >
                {steps.map((step) => {
                  const state = streamStepState(
                    step.key,
                    phase,
                    searchProgress,
                  );
                  return (
                    <li
                      key={step.key}
                      className="flex items-center gap-2.5 text-xs leading-5 text-slate-600"
                    >
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${state === "done" ? "bg-teal-50 text-teal-800" : state === "active" ? "bg-primary-50 text-primary-800" : "bg-slate-100 text-slate-400"}`}
                      >
                        {state === "done" ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <step.icon className="h-3.5 w-3.5" />
                        )}
                      </span>
                      {step.label}
                      <span className="sr-only">
                        :{" "}
                        {state === "done"
                          ? "Complete"
                          : state === "active"
                            ? "In progress"
                            : state === "interrupted"
                              ? "Interrupted"
                              : phase === "complete"
                                ? "No final status reported"
                                : "Waiting"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </details>
            <section aria-label="Live discoveries" className="mt-8">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold">
                  The discoveries so far
                </h2>
                <span className="text-xs text-slate-600">
                  {discoveryCount > 0
                    ? `${discoveryCount} places found`
                    : "An open canvas"}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200 rounded-2xl border border-slate-200 bg-white py-4">
                <DiscoveryCount
                  icon={MapPin}
                  count={activitiesCount}
                  label="Experiences"
                />
                <DiscoveryCount
                  icon={Utensils}
                  count={diningCount}
                  label="Places to eat"
                />
                <DiscoveryCount
                  icon={Plane}
                  count={transportCount}
                  label="Flight options"
                />
              </div>
            </section>
            <section aria-label="Suggested stay" className="mt-8">
              {hotelPreview ? (
                <div className="dossier-arrival overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  {hotelPreview.image && (
                    <div className="relative h-44 overflow-hidden sm:h-48">
                      <TripCoverImage
                        src={hotelPreview.image}
                        className="object-cover"
                      />
                      <span className="absolute bottom-3 left-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700">
                        A place to settle in
                      </span>
                    </div>
                  )}
                  <div className="p-5 sm:p-6">
                    {!hotelPreview.image && (
                      <p className="mb-2 flex items-center gap-2 text-xs text-slate-600">
                        <Hotel className="h-4 w-4" />A place to settle in
                      </p>
                    )}
                    <h3 className="font-editorial text-2xl leading-tight">
                      {hotelPreview.name}
                    </h3>
                    {hotelPreview.description && (
                      <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
                        {hotelPreview.description}
                      </p>
                    )}
                    {hotelPreview.amenities?.length ? (
                      <p className="mt-4 text-xs leading-5 text-slate-600">
                        {hotelPreview.amenities.slice(0, 4).join(" · ")}
                      </p>
                    ) : null}
                    <p className="mt-4 text-xs text-teal-800">
                      Suggested stay. Review availability in your finished plan.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4 rounded-2xl border border-dashed border-slate-300 px-5 py-6">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-slate-400">
                    <Hotel className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-medium">
                      Finding a place to settle in
                    </h3>
                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      Stay suggestions will appear here as they arrive.
                    </p>
                  </div>
                </div>
              )}
            </section>
            <section
              id="live-journey-chapters"
              aria-label="Your emerging itinerary"
              className="mt-10 scroll-mt-6"
            >
              <div className="flex items-center justify-between gap-4">
                <h2
                  tabIndex={-1}
                  className="font-editorial text-2xl tracking-tight outline-none sm:text-3xl"
                >
                  Your days, taking shape
                </h2>
                <span className="rounded-full bg-white px-3 py-1.5 text-xs text-slate-600">
                  {chapters.length
                    ? `${chapters.length} ${chapters.length === 1 ? "chapter" : "chapters"}`
                    : "In the making"}
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Explore as we plan. New chapters arrive here, without
                interrupting the one you’re reading.
              </p>
              <div className="mt-6 space-y-4">
                {chapters.length ? (
                  chapters.map((chapter) => (
                    <Chapter key={chapter.number} chapter={chapter} />
                  ))
                ) : (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6">
                    <BookOpen className="h-5 w-5 text-slate-400" />
                    <p className="mt-3 text-sm font-medium">
                      Making room for memorable days
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Your first chapter will appear when the itinerary begins
                      to arrive.
                    </p>
                    <div aria-hidden="true" className="mt-5 space-y-2">
                      <div className="h-2 w-4/5 rounded-full bg-slate-100" />
                      <div className="h-2 w-3/5 rounded-full bg-slate-100" />
                    </div>
                  </div>
                )}
              </div>
              {phase !== "complete" && chapters.length > 0 && (
                <p className="mt-5 flex items-center gap-2 text-xs text-slate-600">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-700 motion-safe:animate-pulse" />
                  {phase === "error"
                    ? "The chapters above are kept while planning reconnects."
                    : "More details are on their way. These chapters are still a draft."}
                </p>
              )}
            </section>
            <div className="mt-10 border-t border-slate-200 pt-6">
              {phase === "complete" && onOpenTrip && (
                <button
                  onClick={onOpenTrip}
                  className="mb-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-6 py-4 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  <BookOpen className="h-4 w-4" />
                  Open my trip
                </button>
              )}
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function DiscoveryCount({
  icon: Icon,
  count,
  label,
}: {
  icon: typeof MapPin;
  count: number;
  label: string;
}) {
  const value = Number.isFinite(count) ? Math.max(0, count) : 0;
  return (
    <div className="px-2 text-center">
      <Icon className="mx-auto h-4 w-4 text-slate-400" aria-hidden="true" />
      <p className="mt-2 text-xl font-semibold tabular-nums text-slate-900">
        {value > 0 ? value : "—"}
      </p>
      <p className="mt-1 text-[11px] text-slate-600">{label}</p>
    </div>
  );
}

function Chapter({ chapter }: { chapter: DraftChapter }) {
  const [open, setOpen] = useState(chapter.number === 1);
  const id = `draft-chapter-${chapter.number}`;
  const validDate =
    chapter.date && !Number.isNaN(parseTripDate(chapter.date).getTime());
  return (
    <article className="dossier-arrival overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <button
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-4 p-5 text-left focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-primary-700 sm:p-6"
      >
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-50 text-sm font-semibold tabular-nums text-slate-600">
          {chapter.number}
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-xs text-slate-600">
            Day {chapter.number}
            {validDate ? ` · ${formatTripDate(chapter.date)}` : ""}
          </span>
          <span className="mt-1 block font-editorial text-xl leading-snug">
            {chapter.title || `A day in your destination`}
          </span>
        </span>
        <ChevronDown
          className={`mt-2 h-4 w-4 shrink-0 text-slate-600 motion-safe:transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div id={id} hidden={!open} className="px-5 pb-6 sm:px-6">
        {chapter.summary && (
          <p className="mb-5 text-sm leading-7 text-slate-600">
            {chapter.summary}
          </p>
        )}
        {chapter.stops.length ? (
          <ol className="space-y-5 border-l border-slate-200 pl-5">
            {chapter.stops.map((stop, index) => (
              <li
                key={`${stop.period}:${stop.name}:${index}`}
                className="relative"
              >
                <span
                  aria-hidden="true"
                  className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full border border-slate-300 bg-white"
                />
                {stop.period && (
                  <p className="text-xs capitalize text-slate-600">
                    {stop.period}
                  </p>
                )}
                <h4 className="mt-1 text-sm font-semibold">{stop.name}</h4>
                {stop.description && (
                  <p className="mt-1 text-xs leading-6 text-slate-600">
                    {stop.description}
                  </p>
                )}
                {stop.pickedForYou && (
                  <details className="mt-3 rounded-xl bg-teal-50/60 px-3 py-2">
                    <summary className="min-h-8 cursor-pointer text-xs font-medium text-teal-900">
                      Why this fits your trip
                    </summary>
                    <p className="mt-2 text-xs leading-6 text-teal-900/80">
                      {stop.pickedForYou}
                    </p>
                  </details>
                )}
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-slate-600">
            The finer details are still arriving.
          </p>
        )}
      </div>
    </article>
  );
}
