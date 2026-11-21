"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  CloudRain,
  Navigation,
  CarFront,
  ChevronDown,
  ChevronUp,
  MapPin,
  X,
} from "lucide-react";
import type { GeneratedItinerary } from "@faroway/types";
import {
  analyzeBookingReadiness,
  findOnTripUpNext,
} from "@/lib/trips/companion-radar";

export interface CompanionWeatherCue {
  rainyDayNumber?: number;
  condition?: string;
  precipMm?: number;
}

export interface TripCompanionBannerProps {
  destination: string;
  startDate: string;
  endDate: string;
  itinerary: GeneratedItinerary;
  activeDayNumber: number;
  weatherCue?: CompanionWeatherCue | null;
  onTriggerRainSwap?: (dayNumber: number) => void;
  disabled?: boolean;
  /** Optional reference clock for deterministic rendering/tests. */
  now?: Date;
}

export function TripCompanionBanner({
  destination,
  startDate,
  endDate,
  itinerary,
  activeDayNumber,
  weatherCue = null,
  onTriggerRainSwap,
  disabled = false,
  now,
}: TripCompanionBannerProps) {
  const [checklistOpen, setChecklistOpen] = useState(false);
  const [taxiModalOpen, setTaxiModalOpen] = useState(false);
  const [clientNow, setClientNow] = useState<Date | null>(null);
  const taxiCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const taxiTriggerBtnRef = useRef<HTMLButtonElement | null>(null);

  // Avoid SSR/CSR timezone hydration mismatches by resolving local clock after mount
  // when no deterministic `now` prop is provided, and refreshing periodically.
  useEffect(() => {
    if (now) return;
    const initial = setTimeout(() => setClientNow(new Date()), 0);
    const interval = setInterval(() => setClientNow(new Date()), 5 * 60_000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [now]);

  const effectiveNow = now ?? clientNow;

  const readiness = useMemo(
    () => analyzeBookingReadiness(itinerary, startDate, endDate, effectiveNow),
    [itinerary, startDate, endDate, effectiveNow],
  );

  const upNext = useMemo(
    () => findOnTripUpNext(itinerary, startDate, endDate, effectiveNow),
    [itinerary, startDate, endDate, effectiveNow],
  );

  useEffect(() => {
    if (!taxiModalOpen) return;
    const triggerBtn = taxiTriggerBtnRef.current;
    const previousFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    taxiCloseBtnRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setTaxiModalOpen(false);
        return;
      }
      if (event.key === "Tab") {
        // Keep focus trapped inside the full-screen modal (only the Close button is focusable)
        event.preventDefault();
        taxiCloseBtnRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      (triggerBtn ?? previousFocused)?.focus?.();
    };
  }, [taxiModalOpen]);

  const targetRainDay = weatherCue?.rainyDayNumber ?? activeDayNumber;
  const urgencyBadgeStyles: Record<typeof readiness.urgency, string> = {
    high: "bg-amber-100 text-amber-900 border-amber-200",
    medium: "bg-primary-50 text-primary-800 border-primary-100",
    low: "bg-slate-100 text-slate-700 border-slate-200",
    on_trip: "bg-emerald-100 text-emerald-900 border-emerald-200",
    past: "bg-slate-100 text-slate-600 border-slate-200",
  };

  return (
    <section
      aria-label="Trip companion radar"
      className="print-hidden mb-6 space-y-3"
    >
      {/* On-Trip "Up Next" Card */}
      {upNext && (
        <div className="rounded-2xl bg-slate-900 text-white p-4 sm:p-5 shadow-md">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                <Navigation className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  Up next · Day {upNext.dayNumber} {upNext.slot}
                </span>
              </div>
              <h3 className="mt-1 text-lg font-bold text-white">
                {upNext.stop.name}
              </h3>
              {(upNext.stop.address || upNext.stop.locationName) && (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-300">
                  <MapPin
                    className="h-3.5 w-3.5 shrink-0 text-slate-400"
                    aria-hidden="true"
                  />
                  <span className="truncate">
                    {upNext.stop.address || upNext.stop.locationName}
                  </span>
                </p>
              )}
            </div>

            <button
              ref={taxiTriggerBtnRef}
              type="button"
              onClick={() => setTaxiModalOpen(true)}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-slate-950 hover:bg-slate-100 transition-colors"
            >
              <CarFront className="h-4 w-4" aria-hidden="true" />
              Show taxi driver
            </button>
          </div>
        </div>
      )}

      {/* Proactive Companion Grid: Booking Readiness + Rain Swap Radar */}
      <div className="grid gap-3 sm:grid-cols-2">
        {/* Booking Readiness Radar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 min-w-0">
              <span
                className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${urgencyBadgeStyles[readiness.urgency]}`}
              >
                <CalendarClock className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Booking Readiness
                </p>
                <p className="mt-0.5 text-sm font-semibold text-slate-900">
                  {readiness.headline}
                </p>
              </div>
            </div>
          </div>

          {readiness.urgentStops.length > 0 && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setChecklistOpen((open) => !open)}
                aria-expanded={checklistOpen}
                className="inline-flex min-h-9 items-center gap-1 text-xs font-semibold text-primary-800 hover:underline"
              >
                {checklistOpen ? (
                  <>
                    Hide lead-time checklist
                    <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                  </>
                ) : (
                  <>
                    Review {readiness.urgentStops.length} stop
                    {readiness.urgentStops.length > 1 ? "s" : ""} to check early
                    <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </>
                )}
              </button>

              {checklistOpen && (
                <div className="mt-2.5 space-y-2 border-t border-slate-100 pt-2.5">
                  <ul className="space-y-1.5">
                    {readiness.urgentStops.slice(0, 6).map((stop, idx) => (
                      <li
                        key={`${stop.dayNumber}-${stop.name}-${idx}`}
                        className="flex items-start justify-between gap-2 text-xs"
                      >
                        <span className="font-medium text-slate-800">
                          Day {stop.dayNumber} · {stop.name}
                        </span>
                        <span className="shrink-0 text-slate-500 text-right">
                          {stop.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-[11px] text-slate-500">
                    Confirm ticket windows, opening hours, and reservation
                    policies directly with each venue.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Weather-Aware Rain Swap Radar */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-700">
              <CloudRain className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Rain-Swap Radar
              </p>
              <p className="mt-0.5 text-sm font-semibold text-slate-900">
                {weatherCue?.condition
                  ? `${weatherCue.condition}${typeof weatherCue.precipMm === "number" ? ` (${weatherCue.precipMm} mm)` : ""} · Day ${targetRainDay}`
                  : `Expecting rain on Day ${targetRainDay}?`}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Swap exposed outdoor stops for cached indoor venues like
                museums, galleries, or covered markets.
              </p>
            </div>
          </div>

          {onTriggerRainSwap && (
            <div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onTriggerRainSwap(targetRainDay)}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-xs font-semibold text-sky-900 hover:bg-sky-100 transition-colors disabled:opacity-50"
              >
                <CloudRain className="h-3.5 w-3.5" aria-hidden="true" />
                Swap Day {targetRainDay} for indoor backup
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Full-Screen High-Contrast Taxi Driver Address Card Modal */}
      {taxiModalOpen && upNext && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Taxi card for ${upNext.stop.name}`}
          className="fixed inset-0 z-[100] flex flex-col justify-between overflow-y-auto bg-white p-6 sm:p-10 text-slate-950"
        >
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4">
            <span className="text-sm font-bold uppercase tracking-widest text-slate-700">
              Please take me to
            </span>
            <button
              ref={taxiCloseBtnRef}
              type="button"
              onClick={() => setTaxiModalOpen(false)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-slate-950 bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Close
            </button>
          </div>

          <div className="my-auto py-8 max-w-3xl">
            <p className="text-4xl sm:text-6xl font-black tracking-tight text-slate-950 leading-tight break-words">
              {upNext.stop.name}
            </p>
            {upNext.stop.address && (
              <p className="mt-6 text-2xl sm:text-3xl font-bold text-slate-800 leading-snug break-words">
                {upNext.stop.address}
              </p>
            )}
            {upNext.stop.locationName &&
              upNext.stop.locationName !== upNext.stop.address &&
              upNext.stop.locationName !== upNext.stop.name && (
                <p className="mt-3 text-xl sm:text-2xl font-semibold text-slate-600">
                  {upNext.stop.locationName}
                </p>
              )}
            <p className="mt-4 text-lg font-semibold uppercase tracking-wide text-slate-500">
              {destination}
            </p>
            {upNext.stop.coordinates && (
              <p className="mt-3 font-mono text-sm text-slate-500">
                GPS: {upNext.stop.coordinates.lat.toFixed(5)},{" "}
                {upNext.stop.coordinates.lng.toFixed(5)}
              </p>
            )}
          </div>

          <div className="border-t border-slate-200 pt-4 text-xs text-slate-500">
            Day {upNext.dayNumber} · {upNext.dayTitle} · High-contrast driver
            view
          </div>
        </div>
      )}
    </section>
  );
}
