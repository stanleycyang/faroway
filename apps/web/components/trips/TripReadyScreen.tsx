"use client";

import Image from "next/image";
import { ArrowRight, Sparkles } from "lucide-react";

interface TripReadyScreenProps {
  city: string;
  heroImageUrl?: string | null;
  description: string;
  days: number;
  stops: number;
  estimatedCost?: number | null;
  onOpenTrip: () => void;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function TripReadyScreen({
  city,
  heroImageUrl,
  description,
  days,
  stops,
  estimatedCost,
  onOpenTrip,
}: TripReadyScreenProps) {
  return (
    <div className="fixed inset-0 z-[105] overflow-hidden bg-surface-900 text-white">
      <div className="absolute inset-0">
        {heroImageUrl ? (
          <Image
            src={heroImageUrl}
            alt={city}
            fill
            className="object-cover"
            unoptimized
            priority
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-primary-600 via-primary to-amber-500" />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/35 to-black/85" />
      </div>

      <div className="relative z-[1] mx-auto flex min-h-full w-full max-w-3xl flex-col px-7 pb-10 pt-16 sm:px-10">
        <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          Your trip is ready
        </div>

        <div className="mt-auto">
          <h1 className="font-editorial text-balance text-[54px] font-light italic leading-[0.95] tracking-[-0.03em] sm:text-[72px]">
            {city}
          </h1>

          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/85 sm:text-[15px]">
            {description}
          </p>

          <div className="mt-7 flex items-center gap-5 border-t border-white/25 pt-5">
            <Stat value={days} label="Days" />
            <Stat value={stops} label="Stops" />
            <Stat
              value={
                estimatedCost && estimatedCost > 0
                  ? formatCurrency(estimatedCost)
                  : "--"
              }
              label="Est. cost"
            />
          </div>

          <button
            type="button"
            onClick={onOpenTrip}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-bold text-surface-900 transition hover:bg-white/90"
          >
            <Sparkles className="h-4 w-4" />
            Open my trip
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="min-w-[72px]">
      <p className="text-2xl font-black leading-none">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">
        {label}
      </p>
    </div>
  );
}
