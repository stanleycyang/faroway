"use client";

import { VenueSourceNote } from "./VenueSourceNote";

import { canDisplayViatorContent } from "@/lib/affiliates/viator-policy";
import { useViatorContentEnabled } from "./ViatorContentPolicy";

import React from "react";
import {
  proposedVisitNote,
  type ActivityResult,
  type VenueSource,
} from "@faroway/types";
import {
  formatAffiliatePartnerName,
  isAllowedAffiliateUrl,
  normalizeAffiliatePartner,
  readPrice,
  resolveAffiliatePartnerByUrl,
} from "@faroway/constants";
import Image from "next/image";
import { useTripCheckout } from "./TripCheckoutContext";
import { AffiliateDisclosure } from "@/components/affiliates/AffiliateDisclosure";
import { TrackedAffiliateButton } from "@/components/affiliates/TrackedAffiliateButton";
import { useAffiliateTracking } from "@/components/affiliates/AffiliateTrackingContext";
import {
  MapPin,
  Clock,
  DollarSign,
  Utensils,
  Star,
  Shield,
  Zap,
  TrendingUp,
  Compass,
  Sparkles,
  ExternalLink,
} from "lucide-react";

export interface Activity {
  source?: VenueSource;
  proposedVisitType?: ActivityResult["proposedVisitType"];
  id: string;
  name: string;
  description: string;
  duration: number;
  estimatedCost: {
    amount: number;
    status?: "unknown" | "estimate";
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
  source?: VenueSource;
  id: string;
  name: string;
  cuisineType: string[];
  priceLevel?: 1 | 2 | 3 | 4;
  description: string;
  estimatedCost: {
    amount: number;
    status?: "unknown" | "estimate";
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

const categoryConfig: Record<string, { label: string; badge: string }> = {
  sightseeing: {
    label: "Sightseeing",
    badge: "bg-amber-50 text-amber-800 ring-amber-200",
  },
  adventure: {
    label: "Adventure",
    badge: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  },
  cultural: {
    label: "Cultural",
    badge: "bg-violet-50 text-violet-800 ring-violet-200",
  },
  relaxation: {
    label: "Relaxation",
    badge: "bg-sky-50 text-sky-800 ring-sky-200",
  },
  entertainment: {
    label: "Entertainment",
    badge: "bg-pink-50 text-pink-800 ring-pink-200",
  },
  shopping: {
    label: "Shopping",
    badge: "bg-rose-50 text-rose-800 ring-rose-200",
  },
};

const mealTypeConfig: Record<string, { label: string }> = {
  breakfast: { label: "Breakfast" },
  lunch: { label: "Lunch" },
  dinner: { label: "Dinner" },
  snack: { label: "Café" },
};

interface ActivityCardProps {
  activity: Activity;
  date?: string;
  index?: number;
  rationale?: string[];
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

export function ActivityCard({ activity, date, rationale }: ActivityCardProps) {
  const checkout = useTripCheckout();
  const affiliateCtx = useAffiliateTracking();
  const viatorContentEnabled = useViatorContentEnabled();
  if (!canDisplayViatorContent(activity, viatorContentEnabled)) return null;
  // Guard against receiving a non-object (e.g. a plain string from inconsistent AI output)
  if (!activity || typeof activity !== "object" || !activity.name) return null;

  const visitNote = proposedVisitNote(activity.proposedVisitType);
  const config =
    categoryConfig[activity.category] || categoryConfig.sightseeing;
  const rating = activity.rating;
  const reviewCount = activity.reviewCount;
  const badge = getBadge(rating, reviewCount);
  const hasImage = activity.images && activity.images.length > 0;

  const rawBookingUrl = activity.bookingInfo?.bookingUrl;
  const hasAllowedBookingUrl = Boolean(
    rawBookingUrl && isAllowedAffiliateUrl(rawBookingUrl),
  );
  const isViatorHostedItem = Boolean(
    checkout &&
    checkout.mode === "owner" &&
    date &&
    activity.bookingInfo?.affiliateId === "viator" &&
    /^activity_v_[a-zA-Z0-9]+$/.test(activity.id),
  );
  const hasBooking = Boolean(rawBookingUrl) || isViatorHostedItem;

  const resolvedBookingPartner = hasAllowedBookingUrl
    ? (resolveAffiliatePartnerByUrl(rawBookingUrl!) ??
      normalizeAffiliatePartner(activity.bookingInfo?.affiliateId))
    : undefined;
  const resolvedBookingPartnerLabel = resolvedBookingPartner
    ? formatAffiliatePartnerName(resolvedBookingPartner)
    : "Partner";
  const activityPrice = readPrice(
    activity.estimatedCost?.amount,
    activity.estimatedCost?.currency,
  );
  const hasAllowedTripadvisorUrl = Boolean(
    activity.tripadvisorUrl && isAllowedAffiliateUrl(activity.tripadvisorUrl),
  );

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

  const handleViatorHostedClick = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.currentTarget.focus();
    if (isViatorHostedItem && checkout && date) {
      checkout.review({
        id: activity.id,
        name: activity.name,
        date,
        mode: "viator_hosted",
        price: activityPrice?.amount,
        currency: activityPrice?.currency,
      });
    }
  };

  const handlePartnerCheckoutClick = (
    event: React.MouseEvent<HTMLButtonElement>,
  ) => {
    event.currentTarget.focus();
    if (!checkout || !hasAllowedBookingUrl || !rawBookingUrl) return;
    checkout.review({
      id: activity.id,
      name: activity.name,
      date: date || "",
      mode: "partner_click",
      itemType: "activity",
      partner: resolvedBookingPartner,
      partnerLabel: resolvedBookingPartnerLabel,
      affiliateUrl: rawBookingUrl,
      price: activityPrice?.amount,
      currency: activityPrice?.currency,
      source:
        affiliateCtx?.source ??
        (checkout.mode === "shared" ? "shared_trip" : "itinerary"),
      placement: "activity_card",
    });
  };

  return (
    <div className="group rounded-2xl border border-slate-200 bg-white overflow-hidden">
      {/* Hero Image */}
      {hasImage && (
        <div className="relative h-40 sm:h-48 overflow-hidden">
          <Image
            src={activity.images![0]}
            alt={activity.name}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            className="object-cover"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

          {/* Category badge on image */}
          <div className="absolute top-3 left-3">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ${config.badge}`}
            >
              {config.label}
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
              <Star className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
              <span className="text-sm font-bold text-gray-900">
                {rating.toFixed(1)}
              </span>
              {reviewCount != null && (
                <span className="text-xs text-slate-600">
                  ({reviewCount.toLocaleString("en-US")})
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
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Compass className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="font-editorial text-slate-900 text-xl">
                  {activity.name}
                </h4>
                {badge && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 ring-1 ring-amber-200">
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
              <h4 className="font-editorial text-slate-900 text-xl leading-snug">
                {activity.name}
              </h4>
            </div>
          </div>
        )}

        <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap mt-1">
          {activity.description}
        </p>

        {rationale && rationale.length > 0 && (
          <div
            className="flex flex-wrap items-center gap-1.5 mt-2.5"
            aria-label="Why we picked this"
          >
            {rationale.slice(0, 2).map((reason, idx) => (
              <span
                key={`${reason}-${idx}`}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/70"
              >
                <Sparkles
                  aria-hidden="true"
                  className="h-3 w-3 text-emerald-700"
                />
                {reason}
              </span>
            ))}
          </div>
        )}

        {visitNote && (
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            {visitNote}
          </p>
        )}

        <VenueSourceNote value={activity.source} />

        {/* Metadata chips */}
        <div className="flex flex-wrap items-center gap-2.5 mt-3 text-xs text-slate-600">
          {activity.duration != null && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 rounded-lg font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              {formatDuration(activity.duration)}
            </span>
          )}
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 rounded-lg font-semibold text-slate-700">
            <DollarSign className="w-3.5 h-3.5 text-slate-500" />
            {activity.estimatedCost?.status !== "unknown" &&
            activity.estimatedCost?.amount > 0 &&
            readPrice(
              activity.estimatedCost.amount,
              activity.estimatedCost.currency,
            )
              ? `Est. ${formatCost(activity.estimatedCost.amount, activity.estimatedCost.currency)}`
              : "Price unknown"}
          </span>
          {activity.location?.name && (
            <span
              className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 rounded-lg max-w-full"
              title={
                activity.location.address &&
                activity.location.address !== activity.location.name
                  ? `${activity.location.name} — ${activity.location.address}`
                  : activity.location.name
              }
            >
              <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
              <span className="truncate max-w-[260px]">
                {activity.location.address &&
                activity.location.address !== activity.location.name
                  ? `${activity.location.name} · ${activity.location.address}`
                  : activity.location.name}
              </span>
            </span>
          )}
          {/* Rating for non-image cards */}
          {!hasImage && typeof rating === "number" && rating > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-lg">
              <Star className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
              <span className="font-bold text-slate-800">
                {rating.toFixed(1)}
              </span>
              {reviewCount != null && (
                <span className="text-slate-600">
                  ({reviewCount.toLocaleString("en-US")})
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
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-800 ring-1 ring-primary-200/50"
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
              {hasAllowedTripadvisorUrl ? (
                <TrackedAffiliateButton
                  variant="badge"
                  label={`${activity.tripadvisorRating.toFixed(1)} on TripAdvisor${
                    activity.tripadvisorReviewCount != null
                      ? ` (${activity.tripadvisorReviewCount.toLocaleString("en-US")})`
                      : ""
                  }`}
                  affiliateUrl={activity.tripadvisorUrl!}
                  partner="tripadvisor"
                  itemType="activity"
                  itemId={activity.id}
                  itemName={activity.name}
                  tripId={affiliateCtx?.tripId}
                  source={affiliateCtx?.source ?? "itinerary"}
                  placement="activity_tripadvisor_badge"
                />
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#EFF5F3] rounded-lg text-xs font-semibold text-[#0F766E]">
                  <span className="text-sm" aria-hidden="true">
                    &#9679;
                  </span>
                  {activity.tripadvisorRating.toFixed(1)} on TripAdvisor
                  {activity.tripadvisorReviewCount != null && (
                    <span className="text-slate-600 font-normal">
                      ({activity.tripadvisorReviewCount.toLocaleString("en-US")}
                      )
                    </span>
                  )}
                </span>
              )}
            </div>
          )}

        {/* Booking CTA — Primary conversion element */}
        {hasBooking && (
          <div className="mt-4 space-y-2">
            {isViatorHostedItem && checkout?.enabled ? (
              <>
                <button
                  type="button"
                  onClick={handleViatorHostedClick}
                  className="w-full inline-flex min-h-11 items-center justify-center gap-2 px-5 py-3 bg-primary-700 text-white rounded-full text-sm font-semibold hover:bg-primary-800 transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  Review on Viator
                </button>
                <AffiliateDisclosure className="text-center text-xs text-slate-600" />
              </>
            ) : hasAllowedBookingUrl ? (
              checkout ? (
                <>
                  <button
                    type="button"
                    onClick={handlePartnerCheckoutClick}
                    className="w-full inline-flex min-h-11 items-center justify-center gap-2 px-5 py-3 bg-primary-700 text-white rounded-full text-sm font-semibold hover:bg-primary-800 transition-colors"
                  >
                    <span>Book on {resolvedBookingPartnerLabel}</span>
                    <ExternalLink className="w-4 h-4" aria-hidden="true" />
                  </button>
                  <AffiliateDisclosure className="text-center text-xs text-slate-600" />
                </>
              ) : (
                <TrackedAffiliateButton
                  label={`Book on ${resolvedBookingPartnerLabel}`}
                  affiliateUrl={rawBookingUrl!}
                  partner={resolvedBookingPartner}
                  itemType="activity"
                  itemId={activity.id}
                  itemName={activity.name}
                  tripId={affiliateCtx?.tripId}
                  price={activityPrice?.amount}
                  currency={activityPrice?.currency}
                  source={affiliateCtx?.source ?? "itinerary"}
                  placement="activity_card"
                  showDisclosure
                />
              )
            ) : (
              <>
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
                  {isViatorHostedItem
                    ? "Viator checkout unavailable. Refresh this trip and try again. Your plan stays saved."
                    : "Booking isn’t available in Faroway for this stop. Check the provider for price and availability."}
                </p>
                <p className="text-center text-xs text-slate-600">
                  Final price, availability and cancellation terms are confirmed
                  by the provider.
                </p>
              </>
            )}
          </div>
        )}

        {/* Reservation recommended (no URL) */}
        {!visitNote &&
          activity.bookingInfo?.requiresReservation &&
          !activity.bookingInfo.bookingUrl && (
            <div className="mt-3 px-3 py-2 bg-amber-50 rounded-lg border border-amber-100">
              <span className="text-xs text-amber-800 font-semibold">
                Check reservation requirements with the venue.
              </span>
            </div>
          )}
      </div>
    </div>
  );
}

interface RestaurantCardProps {
  restaurant: Restaurant;
  date?: string;
  rationale?: string[];
}

export function RestaurantCard({
  restaurant,
  date,
  rationale,
}: RestaurantCardProps) {
  const checkout = useTripCheckout();
  const affiliateCtx = useAffiliateTracking();
  // Guard against receiving a non-object (e.g. a plain string from inconsistent AI output)
  if (!restaurant || typeof restaurant !== "object" || !restaurant.name)
    return null;

  const rating = restaurant.rating;
  const reviewCount = restaurant.reviewCount;
  const mealConfig =
    mealTypeConfig[restaurant.mealType] || mealTypeConfig.dinner;
  const badge = getBadge(rating, reviewCount);
  const rawReservationUrl = restaurant.reservationInfo?.url;
  const hasAllowedReservationUrl = Boolean(
    rawReservationUrl && isAllowedAffiliateUrl(rawReservationUrl),
  );
  const hasAllowedTripadvisorUrl = Boolean(
    restaurant.tripadvisorUrl &&
    isAllowedAffiliateUrl(restaurant.tripadvisorUrl),
  );
  const restaurantPrice = readPrice(
    restaurant.estimatedCost?.amount,
    restaurant.estimatedCost?.currency,
  );
  const reservationPartner = hasAllowedReservationUrl
    ? (resolveAffiliatePartnerByUrl(rawReservationUrl!) ?? "opentable")
    : undefined;
  const reservationPartnerLabel = reservationPartner
    ? formatAffiliatePartnerName(reservationPartner)
    : "Partner";

  const openTableSearchFallbackUrl =
    !rawReservationUrl &&
    restaurant.reservationInfo?.recommended &&
    affiliateCtx?.destination
      ? `https://www.opentable.com/s?term=${encodeURIComponent(
          `${restaurant.name} ${affiliateCtx.destination}`.trim(),
        )}`
      : undefined;
  const hasAllowedOpenTableFallback = Boolean(
    openTableSearchFallbackUrl &&
    isAllowedAffiliateUrl(openTableSearchFallbackUrl),
  );

  const handleReservationCheckout = (
    event: React.MouseEvent<HTMLButtonElement>,
    url: string,
    partner: string,
    partnerLabel: string,
    placement: string,
  ) => {
    event.currentTarget.focus();
    if (!checkout) return;
    checkout.review({
      id: restaurant.id,
      name: restaurant.name,
      date: date || "",
      mode: "partner_click",
      itemType: "restaurant",
      partner,
      partnerLabel,
      affiliateUrl: url,
      price: restaurantPrice?.amount,
      currency: restaurantPrice?.currency,
      source:
        affiliateCtx?.source ??
        (checkout.mode === "shared" ? "shared_trip" : "itinerary"),
      placement,
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

  const renderPriceLevel = (level: number) => {
    return (
      <span
        aria-label={`Price tier ${level} of 4`}
        className="inline-flex items-center gap-0.5 px-2 py-1 bg-emerald-50 rounded-lg"
      >
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            aria-hidden="true"
            className={`text-xs font-bold ${i <= level ? "text-emerald-700" : "text-emerald-800/45"}`}
          >
            $
          </span>
        ))}
      </span>
    );
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div
            aria-label={mealConfig.label}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"
          >
            <Utensils className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h4 className="font-editorial text-slate-900 text-xl">
                {restaurant.name}
              </h4>
              {badge && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-800 ring-1 ring-orange-200">
                  {badge.icon} {badge.label}
                </span>
              )}
            </div>

            <p className="text-sm text-gray-600 leading-relaxed line-clamp-2">
              {restaurant.description}
            </p>

            {rationale && rationale.length > 0 && (
              <div
                className="flex flex-wrap items-center gap-1.5 mt-2"
                aria-label="Why we picked this"
              >
                {rationale.slice(0, 2).map((reason, idx) => (
                  <span
                    key={`${reason}-${idx}`}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/70"
                  >
                    <Sparkles
                      aria-hidden="true"
                      className="h-3 w-3 text-emerald-700"
                    />
                    {reason}
                  </span>
                ))}
              </div>
            )}

            {/* Metadata chips */}
            <div className="flex flex-wrap items-center gap-2 mt-3 text-xs text-slate-600">
              {restaurant.estimatedCost?.status !== "unknown" &&
                restaurant.priceLevel != null &&
                renderPriceLevel(restaurant.priceLevel)}
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 rounded-lg font-semibold text-slate-700">
                <DollarSign className="w-3.5 h-3.5 text-slate-500" />
                {restaurant.estimatedCost?.status !== "unknown" &&
                restaurant.estimatedCost?.amount > 0 &&
                readPrice(
                  restaurant.estimatedCost.amount,
                  restaurant.estimatedCost.currency,
                )
                  ? `Est. ${formatCost(restaurant.estimatedCost.amount, restaurant.estimatedCost.currency)}`
                  : "Price unknown"}
                {restaurant.estimatedCost?.status !== "unknown" &&
                  restaurant.estimatedCost?.amount > 0 &&
                  readPrice(
                    restaurant.estimatedCost.amount,
                    restaurant.estimatedCost.currency,
                  ) &&
                  restaurant.estimatedCost.perPerson && (
                    <span className="text-slate-500">/pp</span>
                  )}
              </span>
              {restaurant.location?.name && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-1 bg-slate-50 rounded-lg max-w-full"
                  title={
                    restaurant.location.address &&
                    restaurant.location.address !== restaurant.location.name
                      ? `${restaurant.location.name} — ${restaurant.location.address}`
                      : restaurant.location.name
                  }
                >
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-slate-500" />
                  <span className="truncate max-w-[260px]">
                    {restaurant.location.address &&
                    restaurant.location.address !== restaurant.location.name
                      ? `${restaurant.location.name} · ${restaurant.location.address}`
                      : restaurant.location.name}
                  </span>
                </span>
              )}
              {typeof rating === "number" && rating > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 rounded-lg">
                  <Star className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
                  <span className="font-bold text-slate-800">
                    {rating.toFixed(1)}
                  </span>
                  {reviewCount != null && (
                    <span className="text-slate-600">
                      ({reviewCount.toLocaleString("en-US")})
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
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-800 ring-1 ring-orange-200/50"
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
                  {hasAllowedTripadvisorUrl ? (
                    <TrackedAffiliateButton
                      variant="badge"
                      label={`${restaurant.tripadvisorRating.toFixed(1)} on TripAdvisor${
                        restaurant.tripadvisorReviewCount != null
                          ? ` (${restaurant.tripadvisorReviewCount.toLocaleString("en-US")})`
                          : ""
                      }`}
                      affiliateUrl={restaurant.tripadvisorUrl!}
                      partner="tripadvisor"
                      itemType="restaurant"
                      itemId={restaurant.id}
                      itemName={restaurant.name}
                      tripId={affiliateCtx?.tripId}
                      source={affiliateCtx?.source ?? "itinerary"}
                      placement="restaurant_tripadvisor_badge"
                    />
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#EFF5F3] rounded-lg text-xs font-semibold text-[#0F766E]">
                      <span className="text-sm" aria-hidden="true">
                        &#9679;
                      </span>
                      {restaurant.tripadvisorRating.toFixed(1)} on TripAdvisor
                      {restaurant.tripadvisorReviewCount != null && (
                        <span className="text-slate-600 font-normal">
                          (
                          {restaurant.tripadvisorReviewCount.toLocaleString(
                            "en-US",
                          )}
                          )
                        </span>
                      )}
                    </span>
                  )}
                </div>
              )}

            <VenueSourceNote value={restaurant.source} />

            {/* Reserve CTA */}
            {hasAllowedReservationUrl ? (
              <div className="mt-4 space-y-2">
                {checkout ? (
                  <>
                    <button
                      type="button"
                      onClick={(event) =>
                        handleReservationCheckout(
                          event,
                          rawReservationUrl!,
                          reservationPartner ?? "opentable",
                          reservationPartnerLabel,
                          "restaurant_card",
                        )
                      }
                      className="w-full inline-flex min-h-11 items-center justify-center gap-2 px-5 py-2.5 bg-primary-700 text-white rounded-full text-sm font-semibold hover:bg-primary-800 transition-colors"
                    >
                      <span>Reserve on {reservationPartnerLabel}</span>
                      <ExternalLink className="w-4 h-4" aria-hidden="true" />
                    </button>
                    <AffiliateDisclosure className="text-center text-xs text-slate-600" />
                  </>
                ) : (
                  <TrackedAffiliateButton
                    label={`Reserve on ${reservationPartnerLabel}`}
                    affiliateUrl={rawReservationUrl!}
                    partner={reservationPartner ?? "opentable"}
                    itemType="restaurant"
                    itemId={restaurant.id}
                    itemName={restaurant.name}
                    tripId={affiliateCtx?.tripId}
                    price={restaurantPrice?.amount}
                    currency={restaurantPrice?.currency}
                    source={affiliateCtx?.source ?? "itinerary"}
                    placement="restaurant_card"
                    showDisclosure
                  />
                )}
              </div>
            ) : rawReservationUrl ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-medium text-slate-800">
                  Reservations aren’t made in Faroway
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  No reservation has been made. Confirm availability and
                  cancellation terms with the restaurant.
                </p>
              </div>
            ) : null}

            {/* Reservation recommended / TripAdvisor fallback (no direct reservation URL) */}
            {!rawReservationUrl &&
              (restaurant.reservationInfo?.recommended ||
                hasAllowedTripadvisorUrl) && (
                <div className="mt-3 space-y-2">
                  {restaurant.reservationInfo?.recommended && (
                    <div className="px-3 py-2 bg-amber-50 rounded-lg border border-amber-100">
                      <span className="inline-flex items-center gap-1.5 text-xs text-amber-800 font-semibold">
                        <Clock
                          className="h-3.5 w-3.5 shrink-0 text-amber-800"
                          aria-hidden="true"
                        />
                        Reservations recommended — this spot fills up fast
                      </span>
                    </div>
                  )}
                  {(hasAllowedOpenTableFallback ||
                    hasAllowedTripadvisorUrl) && (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap gap-2">
                        {hasAllowedOpenTableFallback &&
                          (checkout ? (
                            <button
                              type="button"
                              onClick={(event) =>
                                handleReservationCheckout(
                                  event,
                                  openTableSearchFallbackUrl!,
                                  "opentable",
                                  "OpenTable",
                                  "restaurant_search_fallback",
                                )
                              }
                              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-[#DCE5E3] bg-[#EFF5F3] px-3.5 py-1.5 text-xs font-semibold text-[#143D46] hover:bg-[#DCE5E3]/70 transition-colors"
                            >
                              <span>Find a table on OpenTable</span>
                              <ExternalLink
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            </button>
                          ) : (
                            <TrackedAffiliateButton
                              variant="subtle"
                              label="Find a table on OpenTable"
                              affiliateUrl={openTableSearchFallbackUrl!}
                              partner="opentable"
                              itemType="restaurant"
                              itemId={restaurant.id}
                              itemName={restaurant.name}
                              tripId={affiliateCtx?.tripId}
                              source={affiliateCtx?.source ?? "itinerary"}
                              placement="restaurant_search_fallback"
                            />
                          ))}
                        {hasAllowedTripadvisorUrl &&
                          (checkout ? (
                            <button
                              type="button"
                              onClick={(event) =>
                                handleReservationCheckout(
                                  event,
                                  restaurant.tripadvisorUrl!,
                                  "tripadvisor",
                                  "Tripadvisor",
                                  "restaurant_tripadvisor_cta",
                                )
                              }
                              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition-colors"
                            >
                              <span>View on Tripadvisor</span>
                              <ExternalLink
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            </button>
                          ) : (
                            <TrackedAffiliateButton
                              variant="secondary"
                              label="View on Tripadvisor"
                              affiliateUrl={restaurant.tripadvisorUrl!}
                              partner="tripadvisor"
                              itemType="restaurant"
                              itemId={restaurant.id}
                              itemName={restaurant.name}
                              tripId={affiliateCtx?.tripId}
                              source={affiliateCtx?.source ?? "itinerary"}
                              placement="restaurant_tripadvisor_cta"
                            />
                          ))}
                      </div>
                      <AffiliateDisclosure className="text-xs text-slate-600" />
                    </div>
                  )}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
