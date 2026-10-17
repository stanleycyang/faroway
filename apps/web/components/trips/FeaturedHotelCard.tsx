"use client";
import { Hotel, Star } from "lucide-react";
import { TripCoverImage } from "./TripCoverImage";
import { formatEstimate, knownEstimate } from "@/lib/trips/budget";

export interface FeaturedHotel {
  id?: string;
  name: string;
  images?: string[];
  affiliateUrl?: string;
  affiliatePartner?: string;
  pricePerNight?: number;
  currency?: string;
  priceStatus?: string;
  starRating?: number;
  userRating?: number;
  reviewCount?: number;
  description?: string;
  amenities?: string[];
}

export function FeaturedHotelCard({
  hotel,
  stayEstimate,
}: {
  hotel: FeaturedHotel;
  stayEstimate?: { amount: number; currency: string; nights: number } | null;
}) {
  const nightly = knownEstimate(
    hotel.pricePerNight,
    hotel.currency,
    hotel.priceStatus,
  );
  const amenities = Array.isArray(hotel.amenities)
    ? hotel.amenities.filter((item) => typeof item === "string")
    : [];
  return (
    <article
      aria-label={`Suggested stay: ${hotel.name}`}
      className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white sm:grid sm:grid-cols-[0.9fr_1.1fr]"
    >
      <div className="relative flex min-h-56 items-center justify-center overflow-hidden bg-slate-100 text-slate-300 sm:min-h-80">
        <Hotel className="h-12 w-12" aria-hidden="true" />
        {hotel.images?.[0] && (
          <TripCoverImage src={hotel.images[0]} className="object-cover" />
        )}
        <span className="absolute left-4 top-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700">
          Suggested for your journey
        </span>
      </div>
      <div className="p-6 sm:p-8">
        <h3 className="font-editorial text-2xl leading-tight tracking-tight text-slate-900 sm:text-3xl">
          {hotel.name}
        </h3>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
          {typeof hotel.starRating === "number" && hotel.starRating > 0 && (
            <span>{hotel.starRating}-star hotel</span>
          )}
          {typeof hotel.userRating === "number" && hotel.userRating > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <Star className="h-3.5 w-3.5 text-amber-700" />
              {hotel.userRating.toFixed(1)}
              {hotel.reviewCount != null
                ? ` (${hotel.reviewCount.toLocaleString()} reviews)`
                : ""}
            </span>
          )}
        </div>
        {hotel.description && (
          <p className="mt-4 text-sm leading-7 text-slate-600">
            {hotel.description}
          </p>
        )}
        {amenities.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {amenities.slice(0, 6).map((amenity, index) => (
              <span
                key={`${amenity}-${index}`}
                className="rounded-full bg-slate-50 px-3 py-1.5 text-xs text-slate-600"
              >
                {amenity}
              </span>
            ))}
          </div>
        )}
        <div className="mt-6 border-t border-slate-200 pt-5">
          <p className="text-lg font-semibold text-slate-900">
            {formatEstimate(
              hotel.pricePerNight,
              hotel.currency,
              hotel.priceStatus,
            )}
            {nightly && (
              <span className="ml-1 text-xs font-normal text-slate-600">
                estimated per night
              </span>
            )}
          </p>
          {stayEstimate &&
            knownEstimate(stayEstimate.amount, stayEstimate.currency) &&
            Number.isInteger(stayEstimate.nights) &&
            stayEstimate.nights > 0 && (
              <p className="mt-2 text-xs text-slate-600">
                {formatEstimate(stayEstimate.amount, stayEstimate.currency)} for{" "}
                {stayEstimate.nights} assigned{" "}
                {stayEstimate.nights === 1 ? "night" : "nights"}. Room occupancy
                is unconfirmed.
              </p>
            )}
          <p className="mt-3 text-xs leading-6 text-slate-600">
            Confirm current price, room occupancy, taxes, fees, and cancellation
            terms with the hotel. Hotel checkout is not available in Faroway
            yet.
          </p>
        </div>
      </div>
    </article>
  );
}
