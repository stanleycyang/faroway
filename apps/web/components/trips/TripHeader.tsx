"use client";
import { useHydrated } from "@/hooks/useHydrated";
import {
  formatTripDate,
  getTripDuration,
  parseTripDate,
} from "@/lib/trips/date-duration";

import React from "react";
import { TripCoverImage } from "./TripCoverImage";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Users,
  Share2,
  DollarSign,
  Compass,
} from "lucide-react";

interface TripHeaderProps {
  destination: string;
  heroImageUrl?: string;
  startDate: string;
  endDate: string;
  travelers: number;
  totalCost?: {
    amount: number;
    currency: string;
  };
  status?: "generating" | "completed" | "failed";
  onShare?: () => void;
  backUrl?: string;
  showActions?: boolean;
}

export function TripHeader({
  destination,
  heroImageUrl,
  startDate,
  endDate,
  travelers,
  totalCost,
  status = "completed",
  onShare,
  backUrl = "/dashboard",
  showActions = true,
}: TripHeaderProps) {
  const hydrated = useHydrated();
  const formatDate = formatTripDate;

  const formatCost = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const duration = getTripDuration(
    parseTripDate(startDate),
    parseTripDate(endDate),
  );

  return (
    <header className="relative overflow-hidden bg-slate-900 text-white">
      {heroImageUrl && (
        <TripCoverImage src={heroImageUrl} className="object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/20 to-black/80" />
      <div className="relative mx-auto max-w-4xl px-5 sm:px-6">
        <div className="flex h-20 items-center justify-between">
          <Link
            href={backUrl}
            aria-label={
              backUrl === "/" ? "Faroway home" : "Back to saved trips"
            }
            className="flex min-h-11 items-center gap-2 rounded-full bg-black/20 px-3 text-sm font-semibold backdrop-blur"
          >
            <ArrowLeft className="h-4 w-4" />
            {backUrl === "/" ? "Home" : "My trips"}
          </Link>
          <Link
            href="/"
            aria-label="Faroway home"
            className="flex items-center gap-2 text-lg font-bold"
          >
            <Compass className="h-6 w-6" />
            <span className="hidden sm:inline">faroway.</span>
          </Link>
          {showActions ? (
            <button
              type="button"
              onClick={onShare}
              disabled={!hydrated || !onShare}
              aria-label="Share trip"
              className="flex h-11 w-11 items-center justify-center rounded-full bg-black/20 backdrop-blur hover:bg-black/40 disabled:cursor-wait disabled:opacity-50"
            >
              <Share2 className="h-5 w-5" />
            </button>
          ) : (
            <span className="w-11" />
          )}
        </div>
        <div className="pb-8 pt-16 sm:pt-24 sm:pb-10">
          {status !== "completed" && (
            <p
              role="status"
              className="mb-4 inline-flex rounded-full bg-black/30 px-3 py-2 text-xs font-semibold backdrop-blur"
            >
              {status === "generating"
                ? "Your itinerary is taking shape"
                : "Planning interrupted. Your trip is saved."}
            </p>
          )}
          <h1 className="font-editorial text-balance text-4xl tracking-[-0.04em] sm:text-6xl">
            {destination}
          </h1>
          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-white/90">
            <span className="inline-flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              {formatDate(startDate)} – {formatDate(endDate)}
              {duration !== null && (
                <span className="text-white/70">({duration} days)</span>
              )}
            </span>
            <span className="inline-flex items-center gap-2">
              <Users className="h-4 w-4" />
              {travelers} {travelers === 1 ? "traveler" : "travelers"}
            </span>
            {totalCost && totalCost.amount > 0 && (
              <span className="inline-flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                {formatCost(totalCost.amount, totalCost.currency)} estimated
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
