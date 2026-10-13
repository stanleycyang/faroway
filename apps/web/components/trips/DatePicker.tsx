"use client";

import React, { useEffect, useRef, useState } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import { format } from "date-fns";
import { getTripDuration } from "@/lib/trips/date-duration";
import { Calendar } from "lucide-react";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
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
  const [numberOfMonths, setNumberOfMonths] = useState(1);
  const dialogRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  useEffect(() => {
    const query = window.matchMedia("(min-width: 640px)");
    const updateMonthCount = () => setNumberOfMonths(query.matches ? 2 : 1);
    updateMonthCount();
    query.addEventListener("change", updateMonthCount);
    return () => query.removeEventListener("change", updateMonthCount);
  }, []);

  useEffect(() => {
    if (!showCalendar) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showCalendar]);

  useModalFocusTrap({
    open: showCalendar,
    dialogRef,
    onClose: () => setShowCalendar(false),
  });

  const closeCalendar = () => {
    setShowCalendar(false);
  };

  const openCalendar = (trigger: HTMLButtonElement) => {
    // Safari does not focus buttons on pointer activation. Establish the return
    // target before the dialog's focus trap records the active element.
    trigger.focus({ preventScroll: true });
    // Initialize draft from current selection
    setDraftRange(startDate ? { from: startDate, to: endDate } : undefined);
    setShowCalendar(true);
  };

  const handleRangeSelect = (range: DateRange | undefined) => {
    setDraftRange(range ?? undefined);
  };

  const handleConfirm = () => {
    if (!draftRange?.from || !draftRange.to) return;
    onStartDateChange(draftRange?.from);
    onEndDateChange(draftRange?.to);
    closeCalendar();
  };

  const handleClear = () => {
    setDraftRange(undefined);
    onStartDateChange(undefined);
    onEndDateChange(undefined);
    closeCalendar();
  };

  const getDuration = () => getTripDuration(startDate, endDate);
  const getDraftDuration = () =>
    getTripDuration(draftRange?.from, draftRange?.to);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Date inputs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Start date
          </label>
          <button
            type="button"
            onClick={(event) => openCalendar(event.currentTarget)}
            aria-label={
              startDate ? format(startDate, "MMM d, yyyy") : "Select start date"
            }
            className={cn(
              "w-full px-3 sm:px-4 py-3.5 bg-white border rounded-xl text-left flex items-center gap-2 sm:gap-3 text-sm sm:text-base transition-all",
              startError
                ? "border-red-300"
                : "border-gray-200 hover:border-gray-300",
            )}
          >
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0" />
            <span className={startDate ? "text-gray-900" : "text-gray-400"}>
              <span className="sm:hidden">
                {startDate ? format(startDate, "MMM d") : "Add start"}
              </span>
              <span className="hidden sm:inline">
                {startDate
                  ? format(startDate, "MMM d, yyyy")
                  : "Select start date"}
              </span>
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
            onClick={(event) => openCalendar(event.currentTarget)}
            aria-label={
              endDate ? format(endDate, "MMM d, yyyy") : "Select end date"
            }
            className={cn(
              "w-full px-3 sm:px-4 py-3.5 bg-white border rounded-xl text-left flex items-center gap-2 sm:gap-3 text-sm sm:text-base transition-all",
              endError
                ? "border-red-300"
                : "border-gray-200 hover:border-gray-300",
            )}
          >
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 shrink-0" />
            <span className={endDate ? "text-gray-900" : "text-gray-400"}>
              <span className="sm:hidden">
                {endDate ? format(endDate, "MMM d") : "Add end"}
              </span>
              <span className="hidden sm:inline">
                {endDate ? format(endDate, "MMM d, yyyy") : "Select end date"}
              </span>
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
            <Calendar className="h-4 w-4" aria-hidden="true" />
            {getDuration()} day{getDuration()! > 1 ? "s" : ""} trip
          </p>
        </div>
      )}

      {/* Calendar modal */}
      {showCalendar && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end justify-center z-50 sm:items-center sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeCalendar();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="date-picker-title"
            aria-describedby="date-picker-description"
            tabIndex={-1}
            className="bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-6 w-full sm:w-auto sm:max-w-fit max-h-[90dvh] overflow-y-auto overscroll-contain motion-safe:animate-fade-in outline-none"
          >
            <div
              aria-hidden="true"
              className="mx-auto mb-5 h-1 w-10 rounded-full bg-gray-200 sm:hidden"
            />
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-100">
              <div>
                <h3
                  id="date-picker-title"
                  className="font-semibold text-gray-900"
                >
                  Select dates
                </h3>
                <span id="date-picker-description" className="sr-only">
                  Choose a start date and end date for your trip.
                </span>
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
                onClick={closeCalendar}
                className="flex h-10 w-10 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 text-xl leading-none ml-4"
                aria-label="Close calendar"
              >
                ✕
              </button>
            </div>

            {/* Override v9 CSS custom properties for our coral theme */}
            <div
              style={
                {
                  "--rdp-accent-color": "#BE3A34",
                  "--rdp-accent-background-color": "#FEF2F2",
                  "--rdp-range_middle-background-color": "#FFF5F4",
                  "--rdp-range_middle-color": "#BE3A34",
                  "--rdp-selected-font": "bold",
                  "--rdp-day-height": "2.75rem",
                  "--rdp-day-width": "min(2.75rem, calc((100vw - 2.5rem) / 7))",
                  "--rdp-day_button-width":
                    "min(2.5rem, calc((100vw - 2.75rem) / 7))",
                } as React.CSSProperties
              }
            >
              <DayPicker
                mode="range"
                selected={draftRange}
                onSelect={handleRangeSelect}
                disabled={{ before: today }}
                numberOfMonths={numberOfMonths}
                showOutsideDays
              />
            </div>

            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-100">
              <button
                type="button"
                onClick={handleClear}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors font-medium"
              >
                Clear dates
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={!draftRange?.from || !draftRange.to}
                className="flex-1 px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-700 transition-colors font-medium disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed"
              >
                {draftRange?.from && draftRange?.to
                  ? "Confirm dates"
                  : draftRange?.from
                    ? "Choose an end date"
                    : "Choose a start date"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
