"use client";

import { useMemo } from "react";
import { Check, Plane, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SearchProgress } from "@/hooks/useTripGeneration";

const STEP_ORDER = [
  "orchestrator",
  "hotels",
  "activities",
  "dining",
  "transport",
  "enrichment",
  "aggregator",
] as const;

const STEP_LINES: Record<(typeof STEP_ORDER)[number], string> = {
  orchestrator: "Reading your preferences",
  hotels: "Scouting stays & neighborhoods",
  activities: "Finding activities & attractions",
  dining: "Discovering restaurants",
  transport: "Checking flight options",
  enrichment: "Adding local gems",
  aggregator: "Polishing your itinerary",
};

export type GenerationPhase =
  | "connecting"
  | "orchestrator"
  | "searching"
  | "composing"
  | "complete"
  | "error";

const PHASE_LABELS: Record<GenerationPhase, string> = {
  connecting: "Getting ready",
  orchestrator: "Reading your trip",
  searching: "Finding places",
  composing: "Putting it together",
  complete: "Ready",
  error: "Paused",
};

export interface ItineraryGenerationLoaderProps {
  destination: string;
  nights: number;
  travelers: number;
  phase: GenerationPhase;
  progress: number;
  message: string;
  searchProgress: SearchProgress | null;
  activitiesCount: number;
  diningCount: number;
  transportCount: number;
}

function resolveActiveStepIndex(
  searchProgress: SearchProgress | null,
  phase: GenerationPhase,
  progress: number,
): number {
  if (searchProgress) {
    const searchingIdx = STEP_ORDER.findIndex(
      (k) => searchProgress[k] === "searching",
    );
    if (searchingIdx !== -1) return searchingIdx;

    const firstOpen = STEP_ORDER.findIndex((k) => {
      const v = searchProgress[k];
      return v !== "done";
    });
    if (firstOpen !== -1) return firstOpen;

    return STEP_ORDER.length - 1;
  }

  if (phase === "composing") return STEP_ORDER.length - 1;
  if (phase === "connecting" || phase === "orchestrator") return 0;
  if (phase === "searching") {
    const approx = Math.floor((progress / 100) * (STEP_ORDER.length - 1));
    return Math.min(STEP_ORDER.length - 2, Math.max(0, approx));
  }
  return 0;
}

export function ItineraryGenerationLoader({
  destination,
  nights,
  travelers,
  phase,
  progress,
  message,
  searchProgress,
  activitiesCount,
  diningCount,
  transportCount,
}: ItineraryGenerationLoaderProps) {
  const activeIndex = useMemo(
    () => resolveActiveStepIndex(searchProgress, phase, progress),
    [searchProgress, phase, progress],
  );

  return (
    <div className="fixed inset-0 z-[100] flex flex-col overflow-hidden bg-surface-900 text-surface-50">
      {/* Soft coral glow */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-1/2 top-[30%] h-[min(100vw,500px)] w-[min(100vw,500px)] -translate-x-1/2 -translate-y-1/2 rounded-full",
          "bg-[radial-gradient(circle,rgba(249,112,102,0.35)_0%,transparent_70%)] blur-3xl",
          "motion-safe:animate-pulse motion-reduce:opacity-50",
        )}
      />

      <div className="relative z-[1] mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col justify-center px-8 py-16 sm:px-10">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary-600 shadow-lg shadow-primary/30 motion-safe:animate-glow-pulse">
          <Sparkles className="h-7 w-7 text-white" aria-hidden />
        </div>

        <p className="mb-3 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-surface-400">
          Faroway is building your trip
        </p>

        <h1 className="font-editorial text-balance text-3xl font-light italic leading-[1.08] tracking-[-0.02em] text-white sm:text-[2.35rem]">
          {destination || "Your destination"},
          <br />
          {nights} {nights === 1 ? "night" : " nights"},
          <br />
          for {travelers} {travelers === 1 ? "traveler" : "travelers"}.
        </h1>

        <p className="mt-4 text-sm leading-relaxed text-surface-300">
          {message}
        </p>

        {/* Progress bar */}
        <div className="mt-8">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-amber-400 transition-[width] duration-700 ease-out"
              style={{ width: `${Math.max(4, Math.min(100, progress))}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] font-medium uppercase tracking-wider text-surface-500">
            <span>{PHASE_LABELS[phase]}</span>
            <span className="tabular-nums">{Math.round(progress)}%</span>
          </div>
        </div>

        <ul className="mt-10 flex flex-col gap-3" aria-label="Generation steps">
          {STEP_ORDER.map((key, i) => {
            const line = STEP_LINES[key];
            const done = searchProgress
              ? searchProgress[key] === "done"
              : i < activeIndex;
            const active = done
              ? false
              : searchProgress
                ? searchProgress[key] === "searching" || i === activeIndex
                : i === activeIndex;
            const pending = !done && !active;

            return (
              <li
                key={key}
                className={cn(
                  "flex items-center gap-3 transition-opacity duration-300",
                  pending && "opacity-35",
                )}
              >
                <div
                  className={cn(
                    "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-white/35 bg-transparent",
                    done && "border-0 bg-surface-50",
                  )}
                >
                  {done ? (
                    <Check
                      className="h-2.5 w-2.5 text-surface-900"
                      strokeWidth={3}
                      aria-hidden
                    />
                  ) : null}
                  {active && !done ? (
                    <span className="motion-safe:animate-pulse h-1.5 w-1.5 rounded-full bg-primary" />
                  ) : null}
                </div>
                <span className="text-sm font-medium text-surface-100">
                  {line}
                </span>
              </li>
            );
          })}
        </ul>

        {(activitiesCount > 0 || diningCount > 0 || transportCount > 0) && (
          <div className="mt-10 flex flex-wrap gap-2 border-t border-white/10 pt-8">
            {activitiesCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {activitiesCount} activities
              </span>
            )}
            {diningCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-100">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                {diningCount} restaurants
              </span>
            )}
            {transportCount > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs font-semibold text-sky-100">
                <Plane className="h-3.5 w-3.5" aria-hidden />
                {transportCount} flight{transportCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
