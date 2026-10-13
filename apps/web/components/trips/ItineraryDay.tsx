"use client";

import { formatEstimate, knownEstimate } from "@/lib/trips/budget";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Sunrise,
  Sun,
  Moon,
  Lightbulb,
  DollarSign,
  Hotel,
  ExternalLink,
  Plane,
} from "lucide-react";
import {
  ActivityCard,
  RestaurantCard,
  type Activity,
  type Restaurant,
} from "./ActivityCard";
import type { TripDayTransport } from "@faroway/types";

interface TimeBlock {
  activities: Activity[];
  meals: Restaurant[];
}

interface HotelInfo {
  name: string;
  starRating?: number;
  pricePerNight?: number;
  currency?: string;
  priceStatus?: string;
  amenities?: string[];
  affiliateUrl?: string;
  image?: string;
}

interface ItineraryDayProps {
  dayNumber: number;
  date: string;
  title: string;
  summary: string;
  morning: TimeBlock;
  afternoon: TimeBlock;
  evening: TimeBlock;
  totalEstimatedCost?: {
    amount: number;
    currency: string;
  };
  tips?: string[];
  defaultExpanded?: boolean;
  hotel?: HotelInfo;
  transport?: TripDayTransport;
}

export function ItineraryDay({
  dayNumber,
  date,
  title,
  summary,
  morning,
  afternoon,
  evening,
  totalEstimatedCost,
  tips,
  defaultExpanded = true,
  hotel,
  transport,
}: ItineraryDayProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const formatDate = (dateStr: string) => {
    // Append T12:00:00 to avoid UTC midnight → previous day in negative-offset timezones
    const d = new Date(dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00`);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  const formatCost = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const safeBlock = (block: TimeBlock): TimeBlock => {
    const rawActivities = Array.isArray(block?.activities)
      ? block.activities
      : [];
    const blockRecord = block as unknown as Record<string, unknown>;
    const rawMeals = Array.isArray(block?.meals)
      ? block.meals
      : blockRecord?.meal && typeof blockRecord.meal === "object"
        ? [blockRecord.meal as Restaurant]
        : [];
    return {
      activities: rawActivities.filter(
        (a) => a != null && typeof a === "object" && typeof a.name === "string",
      ),
      meals: rawMeals.filter(
        (m) => m != null && typeof m === "object" && typeof m.name === "string",
      ),
    };
  };

  const hasContent = (block: TimeBlock) => {
    const safe = safeBlock(block);
    return safe.activities.length > 0 || safe.meals.length > 0;
  };

  // Count bookable items for this day
  const countBookable = () => {
    let count = 0;
    for (const block of [morning, afternoon, evening]) {
      const safe = safeBlock(block);
      count += safe.activities.filter((a) => a.bookingInfo?.bookingUrl).length;
      count += safe.meals.filter((m) => m.reservationInfo?.url).length;
    }
    return count;
  };

  const hasMorning = hasContent(morning);
  const hasAfternoon = hasContent(afternoon);
  const hasEvening = hasContent(evening);
  const bookableCount = countBookable();

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Day Header - Always visible */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="w-full px-4 sm:px-6 py-5 sm:py-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-14 sm:w-14 sm:h-16 rounded-xl bg-slate-900 flex flex-col items-center justify-center text-white flex-shrink-0">
            <span className="text-xs font-medium leading-none opacity-80">
              Day
            </span>
            <span className="text-2xl sm:text-3xl font-bold leading-none">
              {dayNumber}
            </span>
          </div>
          <div className="text-left min-w-0">
            <p className="text-xs sm:text-sm text-gray-500 font-medium">
              {formatDate(date)}
            </p>
            <h3 className="text-base sm:text-xl font-semibold text-gray-900 text-left text-balance">
              {title}
            </h3>
            {bookableCount > 0 && !isExpanded && (
              <p className="text-xs text-primary-600 font-medium mt-0.5">
                {bookableCount} bookable experience
                {bookableCount > 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          {totalEstimatedCost && totalEstimatedCost.amount > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 rounded-full text-sm text-gray-700 font-semibold">
              <DollarSign className="w-4 h-4 text-gray-400" />
              {formatCost(
                totalEstimatedCost.amount,
                totalEstimatedCost.currency,
              )}
            </div>
          )}
          <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center">
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 sm:px-6 pb-6 border-t border-gray-100">
          {/* Day Summary */}
          <p className="text-gray-600 text-sm leading-relaxed mt-4 mb-6">
            {summary}
          </p>

          {/* Hotel Card */}
          {hotel && (
            <div className="mb-6 p-4 sm:p-5 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-100 transition-shadow hover:shadow-md">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
                  <Hotel className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-gray-900 text-sm truncate">
                      {hotel.name}
                    </h4>
                    {hotel.starRating && (
                      <span className="text-xs text-yellow-500 flex-shrink-0">
                        {"★".repeat(Math.min(5, hotel.starRating))}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                    <span className="font-bold text-gray-800 text-sm">
                      {formatEstimate(
                        hotel.pricePerNight,
                        hotel.currency,
                        hotel.priceStatus,
                      )}
                      <span className="font-normal text-gray-500">
                        {knownEstimate(
                          hotel.pricePerNight,
                          hotel.currency,
                          hotel.priceStatus,
                        )
                          ? " estimated/night"
                          : ""}
                      </span>
                    </span>
                    {hotel.amenities && hotel.amenities.length > 0 && (
                      <span className="truncate text-gray-500">
                        {hotel.amenities.slice(0, 3).join(" · ")}
                      </span>
                    )}
                  </div>
                </div>
                {hotel.affiliateUrl && (
                  <button
                    disabled
                    title="This provider checkout is not available on Faroway yet."
                    className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                  >
                    Hotel booking unavailable
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Transport Card */}
          {transport && (
            <div className="mb-6 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-5 text-white shadow-lg shadow-blue-500/20 overflow-hidden relative">
              {/* Background pattern */}
              <div className="absolute inset-0 opacity-[0.06]">
                <div className="absolute -right-8 -top-8 w-40 h-40 rounded-full border-[20px] border-white" />
                <div className="absolute -left-4 -bottom-4 w-24 h-24 rounded-full border-[12px] border-white" />
              </div>

              <div className="relative">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                      <Plane className="h-4 w-4 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">{transport.provider}</p>
                      <p className="text-[11px] text-blue-200">
                        {transport.type === "flight"
                          ? "Flight"
                          : transport.type}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black">
                      {formatCost(transport.price, transport.currency)}
                    </p>
                    <p className="text-[11px] text-blue-200">per person</p>
                  </div>
                </div>

                {/* Route */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="text-center min-w-[60px]">
                    <p className="text-lg font-bold tracking-wide">
                      {transport.departure.airport}
                    </p>
                    <p className="text-xs text-blue-200">
                      {new Date(
                        transport.departure.dateTime,
                      ).toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="flex-1 flex flex-col items-center">
                    <p className="text-[11px] text-blue-200 font-medium">
                      {Math.floor(transport.duration / 60)}h{" "}
                      {transport.duration % 60}m
                    </p>
                    <div className="w-full flex items-center gap-1 my-1">
                      <div className="w-2 h-2 rounded-full bg-white/60" />
                      <div className="flex-1 h-px bg-white/30 relative">
                        <Plane className="h-3.5 w-3.5 text-white absolute -top-[7px] left-1/2 -translate-x-1/2 rotate-90" />
                      </div>
                      <div className="w-2 h-2 rounded-full bg-white/60" />
                    </div>
                    <p className="text-[11px] text-blue-200">
                      {transport.stops === 0
                        ? "Direct"
                        : `${transport.stops} stop${transport.stops > 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <div className="text-center min-w-[60px]">
                    <p className="text-lg font-bold tracking-wide">
                      {transport.arrival.airport}
                    </p>
                    <p className="text-xs text-blue-200">
                      {new Date(transport.arrival.dateTime).toLocaleTimeString(
                        "en-US",
                        {
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </p>
                  </div>
                </div>

                {/* CTA */}
                {transport.affiliateUrl && (
                  <button
                    disabled
                    title="This provider checkout is not available on Faroway yet."
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-white text-blue-700 rounded-xl text-sm font-bold hover:bg-blue-50 transition-all shadow-md active:scale-[0.98]"
                  >
                    Flight booking unavailable
                    <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Timeline with vertical connector */}
          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-[15px] top-0 bottom-0 w-0.5 bg-slate-200 rounded-full" />

            {/* Morning */}
            {hasMorning && (
              <TimeBlockSection
                icon={<Sunrise className="w-4 h-4" />}
                label="Morning"
                date={date}
                block={morning}
              />
            )}

            {/* Afternoon */}
            {hasAfternoon && (
              <TimeBlockSection
                icon={<Sun className="w-4 h-4" />}
                label="Afternoon"
                date={date}
                block={afternoon}
              />
            )}

            {/* Evening */}
            {hasEvening && (
              <TimeBlockSection
                icon={<Moon className="w-4 h-4" />}
                label="Evening"
                date={date}
                block={evening}
              />
            )}
          </div>

          {/* Daily Tips */}
          {tips && tips.length > 0 && (
            <div className="mt-6 p-4 bg-gradient-to-r from-primary-50 to-amber-50 rounded-2xl border border-primary-100/50">
              <div className="flex items-center gap-2 text-primary-700 font-bold mb-2">
                <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
                  <Lightbulb className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm">Insider Tips</span>
              </div>
              <ul className="space-y-1.5">
                {tips.map((tip, i) => (
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

          {/* Mobile cost display */}
          {totalEstimatedCost && totalEstimatedCost.amount > 0 && (
            <div className="sm:hidden mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm">
              <span className="text-gray-500">Day total</span>
              <span className="font-bold text-gray-900">
                {formatCost(
                  totalEstimatedCost.amount,
                  totalEstimatedCost.currency,
                )}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface TimeBlockSectionProps {
  date: string;
  icon: React.ReactNode;
  label: string;
  block: TimeBlock;
}

function TimeBlockSection({ date, icon, label, block }: TimeBlockSectionProps) {
  // Normalize: handle both { meals: [...] } and legacy { meal: {...} } formats
  const rawActivities = Array.isArray(block?.activities)
    ? block.activities
    : [];
  const activities = rawActivities.filter(
    (a): a is Activity =>
      a != null && typeof a === "object" && typeof a.name === "string",
  );
  const blockRecord = block as unknown as Record<string, unknown>;
  const rawMeals = Array.isArray(block?.meals)
    ? block.meals
    : blockRecord?.meal && typeof blockRecord.meal === "object"
      ? [blockRecord.meal as Restaurant]
      : [];
  const meals = rawMeals.filter(
    (m): m is Restaurant =>
      m != null && typeof m === "object" && typeof m.name === "string",
  );

  return (
    <div className="mb-8 last:mb-0 relative pl-10">
      {/* Timeline dot */}
      <div className="absolute left-[9px] top-1 z-10 h-3.5 w-3.5 rounded-full bg-slate-500 ring-4 ring-white" />

      {/* Time block header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="inline-flex items-center gap-2 py-1.5 text-xs font-semibold tracking-wide text-slate-600">
          {icon}
          <span>{label}</span>
        </div>
      </div>

      <div className="space-y-3">
        {activities.map((activity, idx) => (
          <ActivityCard
            key={activity.id || idx}
            activity={activity}
            date={date}
            index={idx}
          />
        ))}
        {meals.map((meal, idx) => (
          <RestaurantCard key={meal.id || idx} restaurant={meal} />
        ))}
      </div>
    </div>
  );
}
