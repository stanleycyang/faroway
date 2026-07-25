"use client";

import React from "react";
import Image from "next/image";
import {
  MapPin,
  Clock,
  DollarSign,
  ExternalLink,
  Utensils,
  Star,
  Shield,
  Zap,
  TrendingUp,
} from "lucide-react";

export interface Activity {
  id: string;
  name: string;
  description: string;
  duration: number;
  estimatedCost: {
    amount: number;
    currency: string;
  };
  timeOfDay: "morning" | "afternoon" | "evening";
  category:
    | "sightseeing"
    | "adventure"
    | "cultural"
    | "relaxation"
    | "entertainment"
    | "shopping";
  location: {
    name: string;
    address?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  vibeMatch?: {
    matchedVibes: string[];
    reasoning: string;
  };
  bookingInfo?: {
    requiresReservation: boolean;
    bookingUrl?: string;
    affiliateId?: string;
  };
  rating?: number;
  reviewCount?: number;
  images?: string[];
  tripadvisorRating?: number;
  tripadvisorReviewCount?: number;
  tripadvisorUrl?: string;
}

export interface Restaurant {
  id: string;
  name: string;
  cuisineType: string[];
  priceLevel: 1 | 2 | 3 | 4;
  description: string;
  estimatedCost: {
    amount: number;
    currency: string;
    perPerson: boolean;
  };
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  location: {
    name: string;
    address?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  dietaryOptions: string[];
  vibeMatch?: {
    matchedVibes: string[];
    reasoning: string;
  };
  reservationInfo?: {
    recommended: boolean;
    url?: string;
  };
  rating?: number;
  reviewCount?: number;
  tripadvisorRating?: number;
  tripadvisorReviewCount?: number;
  tripadvisorUrl?: string;
}

const categoryConfig: Record<
  string,
  {
    emoji: string;
    label: string;
    gradient: string;
    border: string;
    badge: string;
  }
> = {
  sightseeing: {
    emoji: "👀",
    label: "Sightseeing",
    gradient: "from-amber-500 to-orange-500",
    border: "border-l-amber-400",
    badge: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  adventure: {
    emoji: "🏔️",
    label: "Adventure",
    gradient: "from-emerald-500 to-teal-500",
    border: "border-l-emerald-400",
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  },
  cultural: {
    emoji: "🏛️",
    label: "Cultural",
    gradient: "from-violet-500 to-purple-500",
    border: "border-l-violet-400",
    badge: "bg-violet-50 text-violet-700 ring-violet-200",
  },
  relaxation: {
    emoji: "🧘",
    label: "Relaxation",
    gradient: "from-sky-500 to-blue-500",
    border: "border-l-sky-400",
    badge: "bg-sky-50 text-sky-700 ring-sky-200",
  },
  entertainment: {
    emoji: "🎭",
    label: "Entertainment",
    gradient: "from-pink-500 to-rose-500",
    border: "border-l-pink-400",
    badge: "bg-pink-50 text-pink-700 ring-pink-200",
  },
  shopping: {
    emoji: "🛍️",
    label: "Shopping",
    gradient: "from-rose-500 to-red-500",
    border: "border-l-rose-400",
    badge: "bg-rose-50 text-rose-700 ring-rose-200",
  },
};

const mealTypeConfig: Record<
  string,
  { emoji: string; label: string; gradient: string }
> = {
  breakfast: {
    emoji: "🍳",
    label: "Breakfast",
    gradient: "from-amber-400 to-yellow-500",
  },
  lunch: {
    emoji: "🥗",
    label: "Lunch",
    gradient: "from-green-400 to-emerald-500",
  },
  dinner: {
    emoji: "🍽️",
    label: "Dinner",
    gradient: "from-indigo-400 to-violet-500",
  },
  snack: {
    emoji: "☕",
    label: "Café",
    gradient: "from-orange-400 to-amber-500",
  },
};

interface ActivityCardProps {
  activity: Activity;
  index?: number;
}

function getBadge(
  rating?: number,
  reviewCount?: number,
): { label: string; icon: React.ReactNode } | null {
  if (
    typeof rating === "number" &&
    rating >= 4.5 &&
    typeof reviewCount === "number" &&
    reviewCount >= 100
  ) {
    return { label: "Top Rated", icon: <TrendingUp className="w-3 h-3" /> };
  }
  if (
    typeof rating === "number" &&
    rating >= 4.0 &&
    typeof reviewCount === "number" &&
    reviewCount >= 50
  ) {
    return { label: "Popular", icon: <Zap className="w-3 h-3" /> };
  }
  return null;
}

export function ActivityCard({ activity }: ActivityCardProps) {
  // Guard against receiving a non-object (e.g. a plain string from inconsistent AI output)
  if (!activity || typeof activity !== "object" || !activity.name) return null;

  const config =
    categoryConfig[activity.category] || categoryConfig.sightseeing;
  const rating = activity.rating;
  const reviewCount = activity.reviewCount;
  const badge = getBadge(rating, reviewCount);
  const hasImage = activity.images && activity.images.length > 0;
  const hasBooking = !!activity.bookingInfo?.bookingUrl;

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const formatCost = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const handleBookingClick = () => {
    const url = activity.bookingInfo?.bookingUrl;
    if (!url) return;

    // Fire and forget tracking
    fetch("/api/track/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemType: "activity",
        itemId: activity.id,
        itemName: activity.name,
        affiliatePartner: activity.bookingInfo?.affiliateId || "viator",
        affiliateUrl: url,
        source: "itinerary",
      }),
    }).catch(() => {});

    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      className={`group bg-white border border-gray-100 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border-l-4 ${config.border}`}
    >
      {/* Hero Image */}
      {hasImage && (
        <div className="relative h-40 sm:h-48 overflow-hidden">
          <Image
            src={activity.images![0]}
            alt={activity.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          {/* Category badge on image */}
          <div className="absolute top-3 left-3">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${config.badge}`}
            >
              {config.emoji} {config.label}
            </span>
          </div>

          {/* Top Rated / Popular badge */}
          {badge && (
            <div className="absolute top-3 right-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-white/95 text-gray-900 shadow-sm backdrop-blur-sm">
                {badge.icon} {badge.label}
              </span>
            </div>
          )}

          {/* Rating overlay on image */}
          {typeof rating === "number" && rating > 0 && (
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-white/95 backdrop-blur-sm rounded-full shadow-sm">
              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
              <span className="text-sm font-bold text-gray-900">
                {rating.toFixed(1)}
              </span>
              {reviewCount != null && (
                <span className="text-xs text-gray-500">
                  ({reviewCount.toLocaleString()})
                </span>
              )}
            </div>
          )}
        </div>
      )}

      <div className="p-4 sm:p-5">
        {/* No-image header */}
        {!hasImage && (
          <div className="flex items-start gap-3 mb-1">
            <div
              className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${config.gradient} flex items-center justify-center text-white text-lg shadow-sm`}
            >
              {config.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-bold text-gray-900 text-base">
                  {activity.name}
                </h4>
                {badge && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                    {badge.icon} {badge.label}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Image header — name shown below image */}
        {hasImage && (
          <div className="mb-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-bold text-gray-900 text-lg leading-tight">
                {activity.name}
              </h4>
            </div>
          </div>
        )}

        <p className="text-sm text-gray-600 leading-relaxed line-clamp-2 mt-1">
          {activity.description}
        </p>

        {/* Metadata chips */}
        <div className="flex flex-wrap items-center gap-2.5 mt-3 text-xs text-gray-500">
          {activity.duration != null && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-lg font-medium">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              {formatDuration(activity.duration)}
            </span>
          )}
          {activity.estimatedCost?.amount != null && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-lg font-semibold text-gray-700">
              <DollarSign className="w-3.5 h-3.5 text-gray-400" />
              {formatCost(
                activity.estimatedCost.amount,
                activity.estimatedCost.currency || "USD",
              )}
            </span>
          )}
          {activity.location?.name && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-lg truncate max-w-[180px]">
              <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
              <span className="truncate">{activity.location.name}</span>
            </span>
          )}
          {/* Rating for non-image cards */}
          {!hasImage && typeof rating === "number" && rating > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-50 rounded-lg">
              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
              <span className="font-bold text-gray-700">
                {rating.toFixed(1)}
              </span>
              {reviewCount != null && (
                <span className="text-gray-400">
                  ({reviewCount.toLocaleString()})
                </span>
              )}
            </span>
          )}
        </div>

        {/* Vibe match tags */}
        {activity.vibeMatch && activity.vibeMatch.matchedVibes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {activity.vibeMatch.matchedVibes.slice(0, 3).map((vibe) => (
              <span
                key={vibe}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700 ring-1 ring-primary-200/50"
              >
                {vibe}
              </span>
            ))}
          </div>
        )}

        {/* TripAdvisor badge */}
        {activity.tripadvisorRating != null &&
          activity.tripadvisorRating > 0 && (
            <div className="flex items-center gap-2 mt-3">
              {activity.tripadvisorUrl ? (
                <a
                  href={activity.tripadvisorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#34e0a1]/10 rounded-lg text-xs font-semibold text-[#00af87] hover:bg-[#34e0a1]/20 transition-colors"
                >
                  <span className="text-sm">&#9679;</span>
                  {activity.tripadvisorRating.toFixed(1)} on TripAdvisor
                  {activity.tripadvisorReviewCount != null && (
                    <span className="text-[#00af87]/70 font-normal">
                      ({activity.tripadvisorReviewCount.toLocaleString()})
                    </span>
                  )}
                </a>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#34e0a1]/10 rounded-lg text-xs font-semibold text-[#00af87]">
                  <span className="text-sm">&#9679;</span>
                  {activity.tripadvisorRating.toFixed(1)} on TripAdvisor
                  {activity.tripadvisorReviewCount != null && (
                    <span className="text-[#00af87]/70 font-normal">
                      ({activity.tripadvisorReviewCount.toLocaleString()})
                    </span>
                  )}
                </span>
              )}
            </div>
          )}

        {/* Booking CTA — Primary conversion element */}
        {hasBooking && (
          <div className="mt-4 space-y-2">
            <button
              onClick={handleBookingClick}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-primary to-primary-600 text-white rounded-xl text-sm font-bold hover:from-primary-600 hover:to-primary-700 transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-primary/25 active:scale-[0.98]"
            >
              <Shield className="w-4 h-4" />
              Reserve Your Spot
              <ExternalLink className="w-3.5 h-3.5 opacity-70" />
            </button>
            <div className="flex items-center justify-center gap-3 text-[11px] text-gray-500">
              <span className="inline-flex items-center gap-1">
                <svg
                  className="w-3 h-3 text-green-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Free cancellation
              </span>
              <span className="inline-flex items-center gap-1">
                <svg
                  className="w-3 h-3 text-green-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                Instant confirmation
              </span>
            </div>
          </div>
        )}

        {/* Reservation recommended (no URL) */}
        {activity.bookingInfo?.requiresReservation &&
          !activity.bookingInfo.bookingUrl && (
            <div className="mt-3 px-3 py-2 bg-amber-50 rounded-lg border border-amber-100">
              <span className="text-xs text-amber-700 font-semibold">
                ⚡ Reservation recommended — book early to secure your spot
              </span>
            </div>
          )}
      </div>
    </div>
  );
}

interface RestaurantCardProps {
  restaurant: Restaurant;
}

export function RestaurantCard({ restaurant }: RestaurantCardProps) {
  // Guard against receiving a non-object (e.g. a plain string from inconsistent AI output)
  if (!restaurant || typeof restaurant !== "object" || !restaurant.name)
    return null;

  const rating = restaurant.rating;
  const reviewCount = restaurant.reviewCount;
  const mealConfig =
    mealTypeConfig[restaurant.mealType] || mealTypeConfig.dinner;
  const badge = getBadge(rating, reviewCount);
  const hasReservation = !!restaurant.reservationInfo?.url;

  const formatCost = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const renderPriceLevel = (level: number) => {
    return (
      <span className="inline-flex items-center gap-0.5 px-2 py-1 bg-emerald-50 rounded-lg">
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={`text-xs font-bold ${i <= level ? "text-emerald-600" : "text-gray-300"}`}
          >
            $
          </span>
        ))}
      </span>
    );
  };

  const handleReserveClick = () => {
    const url = restaurant.reservationInfo?.url;
    if (!url) return;

    fetch("/api/track/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        itemType: "restaurant",
        itemId: restaurant.id,
        itemName: restaurant.name,
        affiliatePartner: "opentable",
        affiliateUrl: url,
        source: "itinerary",
      }),
    }).catch(() => {});

    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="group bg-white border border-gray-100 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 border-l-4 border-l-orange-400">
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br ${mealConfig.gradient} flex items-center justify-center text-white text-lg shadow-sm`}
          >
            {mealConfig.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h4 className="font-bold text-gray-900 text-base">
                {restaurant.name}
              </h4>
              {badge && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 ring-1 ring-orange-200">
                  {badge.icon} {badge.label}
                </span>
              )}
            </div>

            <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
              {restaurant.description}
            </p>

            {/* Metadata chips */}
            <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-gray-500">
              {restaurant.priceLevel != null &&
                renderPriceLevel(restaurant.priceLevel)}
              {restaurant.estimatedCost?.amount != null && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-lg font-semibold text-gray-700">
                  <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                  {formatCost(
                    restaurant.estimatedCost.amount,
                    restaurant.estimatedCost.currency || "USD",
                  )}
                  {restaurant.estimatedCost.perPerson && (
                    <span className="text-gray-400">/pp</span>
                  )}
                </span>
              )}
              {restaurant.location?.name && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-50 rounded-lg truncate max-w-[180px]">
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" />
                  <span className="truncate">{restaurant.location.name}</span>
                </span>
              )}
              {typeof rating === "number" && rating > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-50 rounded-lg">
                  <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                  <span className="font-bold text-gray-700">
                    {rating.toFixed(1)}
                  </span>
                  {reviewCount != null && (
                    <span className="text-gray-400">
                      ({reviewCount.toLocaleString()})
                    </span>
                  )}
                </span>
              )}
            </div>

            {/* Cuisine pills */}
            {Array.isArray(restaurant.cuisineType) &&
              restaurant.cuisineType.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {restaurant.cuisineType.slice(0, 3).map((cuisine) => (
                    <span
                      key={cuisine}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700 ring-1 ring-orange-200/50"
                    >
                      {cuisine}
                    </span>
                  ))}
                </div>
              )}

            {/* TripAdvisor badge */}
            {restaurant.tripadvisorRating != null &&
              restaurant.tripadvisorRating > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  {restaurant.tripadvisorUrl ? (
                    <a
                      href={restaurant.tripadvisorUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#34e0a1]/10 rounded-lg text-xs font-semibold text-[#00af87] hover:bg-[#34e0a1]/20 transition-colors"
                    >
                      <span className="text-sm">&#9679;</span>
                      {restaurant.tripadvisorRating.toFixed(1)} on TripAdvisor
                      {restaurant.tripadvisorReviewCount != null && (
                        <span className="text-[#00af87]/70 font-normal">
                          ({restaurant.tripadvisorReviewCount.toLocaleString()})
                        </span>
                      )}
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#34e0a1]/10 rounded-lg text-xs font-semibold text-[#00af87]">
                      <span className="text-sm">&#9679;</span>
                      {restaurant.tripadvisorRating.toFixed(1)} on TripAdvisor
                      {restaurant.tripadvisorReviewCount != null && (
                        <span className="text-[#00af87]/70 font-normal">
                          ({restaurant.tripadvisorReviewCount.toLocaleString()})
                        </span>
                      )}
                    </span>
                  )}
                </div>
              )}

            {/* Reserve CTA */}
            {hasReservation && (
              <div className="mt-4 space-y-2">
                <button
                  onClick={handleReserveClick}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl text-sm font-bold hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-md hover:shadow-lg hover:shadow-orange-500/25 active:scale-[0.98]"
                >
                  <Utensils className="w-4 h-4" />
                  Reserve a Table
                  <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                </button>
                <div className="flex items-center justify-center gap-3 text-[11px] text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <svg
                      className="w-3 h-3 text-green-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Confirmed instantly
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <svg
                      className="w-3 h-3 text-green-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Free to cancel
                  </span>
                </div>
              </div>
            )}

            {/* Reservation recommended (no URL) */}
            {restaurant.reservationInfo?.recommended &&
              !restaurant.reservationInfo?.url && (
                <div className="mt-3 px-3 py-2 bg-amber-50 rounded-lg border border-amber-100">
                  <span className="text-xs text-amber-700 font-semibold">
                    ⚡ Reservations recommended — this spot fills up fast
                  </span>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
