"use client";

import React, { useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { format } from "date-fns";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import "react-day-picker/style.css";

interface DatePickerProps {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onStartDateChange: (date: Date | undefined) => void;
  onEndDateChange: (date: Date | undefined) => void;
  startError?: string;
  endError?: string;
  className?: string;
}

export function DatePicker({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  startError,
  endError,
  className,
}: DatePickerProps) {
  const [showCalendar, setShowCalendar] = useState(false);
  // Draft state so users can adjust before confirming
  const [draftRange, setDraftRange] = useState<DateRange | undefined>(
    undefined,
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const openCalendar = () => {
    // Initialize draft from current selection
    setDraftRange(startDate ? { from: startDate, to: endDate } : undefined);
    setShowCalendar(true);
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    setDraftRange(range ?? undefined);
  };

  const handleConfirm = () => {
    onStartDateChange(draftRange?.from);
    onEndDateChange(draftRange?.to);
    setShowCalendar(false);
  };

  const handleClear = () => {
    setDraftRange(undefined);
    onStartDateChange(undefined);
    onEndDateChange(undefined);
  };

  const getDuration = () => {
    if (!startDate || !endDate) return null;
    return (
      Math.ceil(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
      ) + 1
    );
  };

  const getDraftDuration = () => {
    if (!draftRange?.from || !draftRange?.to) return null;
    return (
      Math.ceil(
        (draftRange.to.getTime() - draftRange.from.getTime()) /
          (1000 * 60 * 60 * 24),
      ) + 1
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Date inputs */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Start date
          </label>
          <button
            type="button"
            onClick={openCalendar}
            className={cn(
              "w-full px-4 py-3 bg-gray-50 border rounded-xl text-left flex items-center gap-3 transition-all",
              startError
                ? "border-red-300"
                : "border-gray-200 hover:border-gray-300",
            )}
          >
            <Calendar className="w-5 h-5 text-gray-400 shrink-0" />
            <span className={startDate ? "text-gray-900" : "text-gray-400"}>
              {startDate
                ? format(startDate, "MMM d, yyyy")
                : "Select start date"}
            </span>
          </button>
          {startError && (
            <p className="mt-1.5 text-sm text-red-500">{startError}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            End date
          </label>
          <button
            type="button"
            onClick={openCalendar}
            className={cn(
              "w-full px-4 py-3 bg-gray-50 border rounded-xl text-left flex items-center gap-3 transition-all",
              endError
                ? "border-red-300"
                : "border-gray-200 hover:border-gray-300",
            )}
          >
            <Calendar className="w-5 h-5 text-gray-400 shrink-0" />
            <span className={endDate ? "text-gray-900" : "text-gray-400"}>
              {endDate ? format(endDate, "MMM d, yyyy") : "Select end date"}
            </span>
          </button>
          {endError && (
            <p className="mt-1.5 text-sm text-red-500">{endError}</p>
          )}
        </div>
      </div>

      {/* Duration pill */}
      {getDuration() && (
        <div className="p-3 bg-primary-50 rounded-xl">
          <p className="text-sm text-primary-700 font-medium flex items-center gap-2">
            <span>🎉</span>
            {getDuration()} day{getDuration()! > 1 ? "s" : ""} trip
          </p>
        </div>
      )}

      {/* Calendar modal */}
      {showCalendar && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleConfirm();
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 max-w-fit animate-fade-in">
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900">Select dates</h3>
                {draftRange?.from && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {format(draftRange.from, "MMM d")}
                    {draftRange.to
                      ? ` – ${format(draftRange.to, "MMM d, yyyy")}`
                      : " → pick end date"}
                    {getDraftDuration() && (
                      <span className="text-primary-600 font-medium ml-1.5">
                        ({getDraftDuration()} day
                        {getDraftDuration()! > 1 ? "s" : ""})
                      </span>
                    )}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowCalendar(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-4"
                aria-label="Close calendar"
              >
                ✕
              </button>
            </div>

            {/* Override v9 CSS custom properties for our coral theme */}
            <div
              style={
                {
                  "--rdp-accent-color": "#F97066",
                  "--rdp-accent-background-color": "#FEF2F2",
                  "--rdp-range_middle-background-color": "#FFF5F4",
                  "--rdp-range_middle-color": "#BE3A34",
                  "--rdp-selected-font": "bold",
                  "--rdp-day-height": "2.5rem",
                  "--rdp-day-width": "2.5rem",
                } as React.CSSProperties
              }
            >
              <DayPicker
                mode="range"
                selected={draftRange}
                onSelect={handleRangeSelect}
                disabled={{ before: today }}
                numberOfMonths={
                  typeof window !== "undefined" && window.innerWidth >= 640
                    ? 2
                    : 1
                }
                showOutsideDays
              />
            </div>

            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={handleClear}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors font-medium"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 px-4 py-2.5 bg-primary text-white rounded-xl hover:bg-primary-600 transition-colors font-medium"
              >
                {draftRange?.from && draftRange?.to ? "Confirm" : "Done"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
