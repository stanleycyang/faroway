"use client";
import React from "react";
import Image from "next/image";
import { Sparkles, Star, Shield, ExternalLink } from "lucide-react";
import { formatEstimate, knownEstimate } from "@/lib/trips/budget";

// ── Featured Hotel Card ──────────────────────────────────────────────────────

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
  nights,
}: {
  hotel: FeaturedHotel;
  nights: number;
}) {
  const nightly = knownEstimate(
    hotel.pricePerNight,
    hotel.currency,
    hotel.priceStatus,
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6 group hover:shadow-lg transition-shadow">
      {hotel.images?.[0] && (
        <div className="relative h-56 sm:h-72 overflow-hidden">
          <Image
            src={hotel.images[0]}
            alt={hotel.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          <div className="absolute top-3 left-3 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full text-xs font-bold text-white flex items-center gap-1.5 shadow-lg">
            <Sparkles className="w-3.5 h-3.5" />
            Faroway Pick
          </div>
          {/* Price overlay on image */}
          <div className="absolute bottom-4 right-4 text-right">
            <div className="text-3xl font-black text-white drop-shadow-lg">
              {formatEstimate(
                hotel.pricePerNight,
                hotel.currency,
                hotel.priceStatus,
              )}
            </div>
            <div className="text-xs text-white/80 font-medium">
              {nightly ? "estimated per night" : "Check with the hotel"}
            </div>
          </div>
        </div>
      )}
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-black text-xl text-gray-900">{hotel.name}</h3>
            <div className="flex items-center gap-2 mt-1.5">
              {hotel.starRating && (
                <span className="text-yellow-500 text-sm">
                  {"★".repeat(Math.min(5, hotel.starRating))}
                </span>
              )}
              {hotel.userRating && (
                <span className="flex items-center gap-1 text-sm">
                  <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                  <span className="font-bold text-gray-700">
                    {hotel.userRating.toFixed(1)}
                  </span>
                  {hotel.reviewCount && (
                    <span className="text-gray-400 text-xs">
                      ({hotel.reviewCount.toLocaleString()} reviews)
                    </span>
                  )}
                </span>
              )}
            </div>
          </div>
          {!hotel.images?.[0] && (
            <div className="text-right flex-shrink-0">
              <div className="text-2xl font-black text-gray-900">
                {formatEstimate(
                  hotel.pricePerNight,
                  hotel.currency,
                  hotel.priceStatus,
                )}
              </div>
              <div className="text-xs text-gray-500">
                {nightly ? "estimated per night" : "Check with the hotel"}
              </div>
            </div>
          )}
        </div>

        {hotel.description && (
          <p className="text-sm text-gray-600 mb-4 leading-relaxed line-clamp-2">
            {hotel.description}
          </p>
        )}

        {hotel.amenities && hotel.amenities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-5">
            {hotel.amenities.slice(0, 6).map((amenity: string, i: number) => (
              <span
                key={i}
                className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs bg-gray-50 text-gray-600 font-medium border border-gray-100"
              >
                {amenity}
              </span>
            ))}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-gray-100">
          <div className="text-sm text-gray-500">
            {nightly && nights > 0 && (
              <span>
                Stay estimate:{" "}
                <span className="font-black text-lg text-gray-900">
                  {formatEstimate(
                    nightly.amount * nights,
                    hotel.currency,
                    hotel.priceStatus,
                  )}
                </span>{" "}
                for {nights} night{nights !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          {hotel.affiliateUrl && (
            <button
              disabled
              title="Hotel checkout is not available on Faroway yet."
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-bold text-sm hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg hover:shadow-blue-500/25 active:scale-[0.98]"
            >
              <Shield className="w-4 h-4" />
              Hotel booking unavailable
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </button>
          )}
        </div>

        <p className="mt-3 text-xs text-gray-500">
          Confirm room occupancy, current price, taxes, fees and cancellation
          terms with the hotel before booking.
        </p>
      </div>
    </div>
  );
}
