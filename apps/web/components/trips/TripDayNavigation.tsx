"use client";

import { useRef } from "react";
import { formatTripDate } from "@/lib/trips/date-duration";

interface TripDayNavigationProps {
  days: { dayNumber: number; date: string }[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  idPrefix: string;
}

export function TripDayNavigation({
  days,
  selectedIndex,
  onSelect,
  idPrefix,
}: TripDayNavigationProps) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const select = (index: number) => {
    onSelect(index);
    tabs.current[index]?.focus({ preventScroll: true });
    tabs.current[index]?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "instant",
    });
  };
  return (
    <div
      role="tablist"
      aria-label="Itinerary days"
      className="flex gap-2 overflow-x-auto py-2"
    >
      {days.map((day, index) => (
        <button
          key={`${day.dayNumber}:${day.date}`}
          ref={(element) => {
            tabs.current[index] = element;
          }}
          id={`${idPrefix}-tab-${index}`}
          role="tab"
          aria-selected={index === selectedIndex}
          aria-controls={`${idPrefix}-panel-${index}`}
          tabIndex={index === selectedIndex ? 0 : -1}
          onClick={() => onSelect(index)}
          onKeyDown={(event) => {
            let next: number | undefined;
            if (event.key === "ArrowRight") next = (index + 1) % days.length;
            if (event.key === "ArrowLeft")
              next = (index - 1 + days.length) % days.length;
            if (event.key === "Home") next = 0;
            if (event.key === "End") next = days.length - 1;
            if (next !== undefined) {
              event.preventDefault();
              select(next);
            }
          }}
          className={`min-w-28 shrink-0 rounded-xl border px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 ${index === selectedIndex ? "border-primary-700 bg-primary-50 text-primary-800" : "border-gray-200 bg-white text-gray-600 hover:border-gray-400"}`}
        >
          <span className="block text-sm font-semibold">
            Day {day.dayNumber}
          </span>
          <span className="mt-1 block text-xs">{formatTripDate(day.date)}</span>
        </button>
      ))}
    </div>
  );
}
