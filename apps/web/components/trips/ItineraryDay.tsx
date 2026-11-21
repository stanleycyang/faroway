"use client";

import {
  flightQuoteIsCurrent,
  formatAffiliatePartnerName,
  isAllowedAffiliateUrl,
  normalizeAffiliatePartner,
  readPrice,
  resolveAffiliatePartnerByUrl,
} from "@faroway/constants";
import {
  readDayTiming,
  dayTimingTips,
  isTimingNote,
  type DayTimingProposal,
  type TripDay,
  type TripDayTransport,
} from "@faroway/types";
import { SourceNote } from "./SourceNote";
import { ProposedTiming } from "./ProposedTiming";
import { DiningReviewOptions } from "./DiningReviewOptions";
import { parseTripDate } from "@/lib/trips/date-duration";
import { formatEstimate, knownEstimate } from "@/lib/trips/budget";
import {
  buildAppleMapsDayRouteUrl,
  buildGoogleMapsDayRouteUrl,
  summarizeDayClustering,
} from "@/lib/trips/maps-route";
import { explainStopSelection } from "@/lib/trips/explain-stop";

import { FlightLeg } from "./FlightLeg";
import { useTripCheckout } from "./TripCheckoutContext";
import { AffiliateDisclosure } from "@/components/affiliates/AffiliateDisclosure";
import { TrackedAffiliateButton } from "@/components/affiliates/TrackedAffiliateButton";
import { useAffiliateTracking } from "@/components/affiliates/AffiliateTrackingContext";
import React, { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Sunrise,
  Sun,
  Moon,
  Lightbulb,
  DollarSign,
  Hotel,
  MapPin,
  Navigation,
  CloudRain,
  Coffee,
  Star,
  ExternalLink,
} from "lucide-react";
import {
  ActivityCard,
  RestaurantCard,
  type Activity,
  type Restaurant,
} from "./ActivityCard";

interface TimeBlock {
  activities: Activity[];
  meals: Restaurant[];
}

interface HotelInfo {
  id?: string;
  name: string;
  starRating?: number;
  pricePerNight?: number;
  currency?: string;
  priceStatus?: string;
  amenities?: string[];
  affiliateUrl?: string;
  affiliatePartner?: string;
  image?: string;
}

export interface ItineraryDayRequirements {
  allergies?: string[];
  dietaryPreferences?: string[];
  accessibility?: string[];
  mobilityNotes?: string;
}

export interface ItineraryDayQuickAction {
  type: "swap_stop" | "relax_day" | "rain_backup";
  dayNumber: number;
  stopName?: string;
}

interface ItineraryDayProps {
  diningOptions?: import("@faroway/types").DiningReviewOption[];
  timingProposal?: DayTimingProposal;
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
  destination?: string;
  vibes?: string[];
  requirements?: ItineraryDayRequirements;
  onQuickAction?: (action: ItineraryDayQuickAction) => void;
}

function safeBlock(block: TimeBlock): TimeBlock {
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
}

export function ItineraryDay({
  diningOptions,
  dayNumber,
  timingProposal,
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
  destination,
  vibes,
  requirements,
  onQuickAction,
}: ItineraryDayProps) {
  const checkout = useTripCheckout();
  const affiliateCtx = useAffiliateTracking();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const timingDay = { date, morning, afternoon, evening, tips, timingProposal };
  const validTiming = readDayTiming(timingDay);
  const displayTips = dayTimingTips(timingDay).filter(
    (tip) => !validTiming || !isTimingNote(tip),
  );
  // Reorder an existing compiler note without interpreting it as verified timing.
  const availabilityTips = displayTips.filter((tip) =>
    tip.startsWith("Your local-time availability:"),
  );
  const generalTips = displayTips.filter(
    (tip) => !tip.startsWith("Your local-time availability:"),
  );
  const timingNames: Record<string, string> = {};
  for (const [slot, block] of Object.entries({ morning, afternoon, evening })) {
    for (const activity of Array.isArray(block?.activities)
      ? block.activities
      : [])
      if (activity) timingNames[`activity:${activity.id}`] = activity.name;
    for (const meal of Array.isArray(block?.meals) ? block.meals : [])
      if (meal) timingNames[`meal:${slot}:${meal.id}`] = meal.name;
  }

  const formatDate = (value: string) => {
    const parsed = parseTripDate(value);
    return Number.isNaN(parsed.getTime())
      ? "Date unavailable"
      : parsed.toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
        });
  };
  const formatCost = formatEstimate;

  const safeMorning = useMemo(() => safeBlock(morning), [morning]);
  const safeAfternoon = useMemo(() => safeBlock(afternoon), [afternoon]);
  const safeEvening = useMemo(() => safeBlock(evening), [evening]);

  // Count bookable items for this day
  const countBookable = () => {
    let count = 0;
    for (const block of [safeMorning, safeAfternoon, safeEvening]) {
      count += block.activities.filter((a) => a.bookingInfo?.bookingUrl).length;
      count += block.meals.filter((m) => m.reservationInfo?.url).length;
    }
    return count;
  };

  const hasMorning =
    safeMorning.activities.length > 0 || safeMorning.meals.length > 0;
  const hasAfternoon =
    safeAfternoon.activities.length > 0 || safeAfternoon.meals.length > 0;
  const hasEvening =
    safeEvening.activities.length > 0 || safeEvening.meals.length > 0;
  const bookableCount = countBookable();

  const routeDay = useMemo(
    () =>
      ({
        dayNumber,
        date,
        title,
        summary,
        morning: safeMorning,
        afternoon: safeAfternoon,
        evening: safeEvening,
        tips: Array.isArray(tips) ? tips : [],
      }) as unknown as TripDay,
    [
      dayNumber,
      date,
      title,
      summary,
      safeMorning,
      safeAfternoon,
      safeEvening,
      tips,
    ],
  );

  const clustering = useMemo(
    () => summarizeDayClustering(routeDay),
    [routeDay],
  );
  const googleMapsUrl = useMemo(
    () => buildGoogleMapsDayRouteUrl(routeDay, destination),
    [routeDay, destination],
  );
  const appleMapsUrl = useMemo(
    () => buildAppleMapsDayRouteUrl(routeDay, destination),
    [routeDay, destination],
  );

  // Precompute strictly factual per-stop rationale pills sequentially so each
  // stop can reference walking proximity from the preceding stop on this day.
  const stopRationales = useMemo(() => {
    const map = new Map<string, string[]>();
    let previousStop: { name: string; lat?: number; lng?: number } | undefined;

    const recordStop = (
      key: string,
      stop: Activity | Restaurant,
      isMeal: boolean,
    ) => {
      const coords = stop.location?.coordinates;
      const locRecord = stop.location as
        | {
            name?: string;
            address?: string;
            neighborhood?: string;
            lat?: number;
            lng?: number;
            coordinates?: { lat?: number; lng?: number };
          }
        | undefined;
      const lat = coords?.lat ?? locRecord?.lat;
      const lng = coords?.lng ?? locRecord?.lng;

      const reasons = explainStopSelection(
        {
          name: stop.name,
          description: stop.description,
          category: isMeal ? undefined : (stop as Activity).category,
          location: {
            name: locRecord?.name,
            address: locRecord?.address,
            neighborhood: locRecord?.neighborhood,
            lat,
            lng,
          },
          rating: stop.rating,
          duration: isMeal ? undefined : (stop as Activity).duration,
          vibeMatch: stop.vibeMatch,
          cuisineType: isMeal ? (stop as Restaurant).cuisineType : undefined,
          mealType: isMeal ? (stop as Restaurant).mealType : undefined,
        },
        {
          vibes,
          previousStop,
          requirements,
        },
      );

      map.set(key, reasons);
      previousStop = { name: stop.name, lat, lng };
    };

    const blocks: Array<["morning" | "afternoon" | "evening", TimeBlock]> = [
      ["morning", safeMorning],
      ["afternoon", safeAfternoon],
      ["evening", safeEvening],
    ];
    for (const [slotName, block] of blocks) {
      block.activities.forEach((act, idx) =>
        recordStop(`act:${slotName}:${act.id || idx}`, act, false),
      );
      block.meals.forEach((meal, idx) =>
        recordStop(`meal:${slotName}:${meal.id || idx}`, meal, true),
      );
    }
    return map;
  }, [safeMorning, safeAfternoon, safeEvening, vibes, requirements]);

  const hasAllowedHotelUrl = Boolean(
    hotel?.affiliateUrl && isAllowedAffiliateUrl(hotel.affiliateUrl),
  );
  const hotelPartner = hasAllowedHotelUrl
    ? (resolveAffiliatePartnerByUrl(hotel!.affiliateUrl!) ??
      normalizeAffiliatePartner(hotel?.affiliatePartner) ??
      "stay22")
    : undefined;
  const hotelPartnerLabel = hotelPartner
    ? formatAffiliatePartnerName(hotelPartner)
    : "Partner";
  const hotelPrice = readPrice(hotel?.pricePerNight, hotel?.currency);
  const fallbackHotelLink =
    !hotel?.affiliateUrl &&
    affiliateCtx?.hotelPartnerLinks?.primary?.url &&
    isAllowedAffiliateUrl(affiliateCtx.hotelPartnerLinks.primary.url)
      ? affiliateCtx.hotelPartnerLinks.primary
      : null;

  const transportId = (transport as { id?: string } | undefined)?.id;
  const isReturnLeg = Boolean(transportId?.endsWith("__return"));
  const hasAllowedTransportUrl = Boolean(
    transport?.affiliateUrl && isAllowedAffiliateUrl(transport.affiliateUrl),
  );
  const transportPartner = hasAllowedTransportUrl
    ? (resolveAffiliatePartnerByUrl(transport!.affiliateUrl!) ??
      normalizeAffiliatePartner(transport?.affiliatePartner) ??
      "duffel")
    : undefined;
  const transportPartnerLabel = transportPartner
    ? formatAffiliatePartnerName(transportPartner)
    : "Partner";
  const transportPrice = readPrice(transport?.price, transport?.currency);
  const transportCurrent = transport ? flightQuoteIsCurrent(transport) : false;
  const flightFallbackLinks = (affiliateCtx?.flightFallbackLinks ?? []).filter(
    (link): link is NonNullable<typeof link> & { url: string } =>
      Boolean(link.url && isAllowedAffiliateUrl(link.url)),
  );
  const transportRouteLabel = transport
    ? `${transport.departure?.airport || "Origin"} → ${transport.arrival?.airport || "Destination"}`
    : "";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Day Header - Always visible */}
      <div className="border-b border-transparent">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className="w-full px-4 sm:px-6 py-5 sm:py-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="w-12 h-14 sm:w-14 sm:h-16 rounded-xl bg-[#143D46] flex flex-col items-center justify-center text-white flex-shrink-0">
              <span className="text-xs font-medium leading-none opacity-85">
                Day
              </span>
              <span className="text-2xl sm:text-3xl font-bold leading-none">
                {dayNumber}
              </span>
            </div>
            <div className="text-left min-w-0">
              <p className="text-xs sm:text-sm text-slate-600 font-medium">
                {formatDate(date)}
              </p>
              <h3 className="text-base sm:text-xl font-semibold text-gray-900 text-left text-balance">
                {title}
              </h3>
              {clustering.summaryLabel && (
                <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-slate-600">
                  <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  <span>{clustering.summaryLabel}</span>
                </p>
              )}
              {bookableCount > 0 && !isExpanded && (
                <p className="text-xs text-primary-700 font-medium mt-0.5">
                  {bookableCount} bookable experience
                  {bookableCount > 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {totalEstimatedCost && totalEstimatedCost.amount > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 rounded-full text-sm text-slate-700 font-semibold">
                <DollarSign className="w-4 h-4 text-slate-500" />
                {formatCost(
                  totalEstimatedCost.amount,
                  totalEstimatedCost.currency,
                )}
              </div>
            )}
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center">
              {isExpanded ? (
                <ChevronUp className="w-5 h-5 text-slate-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-slate-600" />
              )}
            </div>
          </div>
        </button>

        {/* Day header action bar: Maps route links + optional quick remix controls */}
        {(googleMapsUrl || appleMapsUrl || onQuickAction) && (
          <div className="px-4 sm:px-6 pb-3.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {googleMapsUrl && (
                <a
                  href={googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5 text-slate-600" />
                  Google Maps route
                </a>
              )}
              {appleMapsUrl && (
                <a
                  href={appleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 hover:bg-slate-200 transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5 text-slate-600" />
                  Apple Maps
                </a>
              )}
            </div>

            {onQuickAction && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onQuickAction({ type: "relax_day", dayNumber })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-900 ring-1 ring-amber-200/80 hover:bg-amber-100 transition-colors"
                >
                  <Coffee className="w-3.5 h-3.5 text-amber-700" />
                  Relax this day
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onQuickAction({ type: "rain_backup", dayNumber })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-sky-50 text-sky-900 ring-1 ring-sky-200/80 hover:bg-sky-100 transition-colors"
                >
                  <CloudRain className="w-3.5 h-3.5 text-sky-700" />
                  Rainy-day backup
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 sm:px-6 pb-6 border-t border-gray-100">
          {/* Day Summary */}
          <p className="text-gray-600 text-sm leading-relaxed mt-4 mb-6">
            {summary}
          </p>

          {availabilityTips.length > 0 && (
            <section
              aria-label="Your available hours"
              className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <h4 className="mb-2 text-sm font-semibold text-slate-900">
                Your available hours
              </h4>
              {availabilityTips.map((tip, index) => (
                <p
                  key={index}
                  className="text-sm leading-relaxed text-slate-600 break-words"
                >
                  <SourceNote text={tip} />
                </p>
              ))}
            </section>
          )}

          {/* Hotel Card */}
          {hotel && (
            <div className="mb-6 p-4 sm:p-5 bg-[#EFF5F3] rounded-2xl border border-[#DCE5E3] transition-shadow hover:shadow-md">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className="w-12 h-12 rounded-xl bg-[#143D46] flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Hotel className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <h4 className="font-bold text-slate-900 text-sm break-words">
                        {hotel.name}
                      </h4>
                      {typeof hotel.starRating === "number" &&
                        Number.isInteger(hotel.starRating) &&
                        hotel.starRating >= 1 &&
                        hotel.starRating <= 5 && (
                          <span
                            aria-label={`${hotel.starRating} out of 5 stars`}
                            className="inline-flex items-center gap-0.5 flex-shrink-0"
                          >
                            {Array.from(
                              { length: hotel.starRating },
                              (_, starIdx) => (
                                <Star
                                  key={starIdx}
                                  className="h-3.5 w-3.5 fill-amber-600 text-amber-600"
                                  aria-hidden="true"
                                />
                              ),
                            )}
                          </span>
                        )}
                    </div>
                    <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-3 mt-0.5 text-xs text-slate-600">
                      <span className="font-bold text-slate-900 text-sm">
                        {formatEstimate(
                          hotel.pricePerNight,
                          hotel.currency,
                          hotel.priceStatus,
                        )}
                        <span className="font-normal text-slate-600">
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
                        <span className="max-w-full truncate text-slate-600">
                          {hotel.amenities.slice(0, 3).join(" · ")}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {hasAllowedHotelUrl ? (
                  <div className="flex flex-col items-start sm:items-end gap-1.5 flex-shrink-0">
                    {checkout ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.currentTarget.focus();
                          checkout.review({
                            id: hotel.id || `${hotel.name}-${dayNumber}`,
                            name: hotel.name,
                            date,
                            mode: "partner_click",
                            itemType: "hotel",
                            partner: hotelPartner,
                            partnerLabel: hotelPartnerLabel,
                            affiliateUrl: hotel.affiliateUrl!,
                            price: hotelPrice?.amount,
                            currency: hotelPrice?.currency,
                            source:
                              affiliateCtx?.source ??
                              (checkout.mode === "shared"
                                ? "shared_trip"
                                : "itinerary"),
                            placement: "day_hotel_card",
                          });
                        }}
                        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-700 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-800 transition-colors"
                      >
                        <span>Check rates on {hotelPartnerLabel}</span>
                        <ExternalLink
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      </button>
                    ) : (
                      <TrackedAffiliateButton
                        variant="secondary"
                        label={`Check rates on ${hotelPartnerLabel}`}
                        affiliateUrl={hotel.affiliateUrl!}
                        partner={hotelPartner}
                        itemType="hotel"
                        itemId={hotel.id || `${hotel.name}-${dayNumber}`}
                        itemName={hotel.name}
                        tripId={affiliateCtx?.tripId}
                        price={hotelPrice?.amount}
                        currency={hotelPrice?.currency}
                        source={affiliateCtx?.source ?? "itinerary"}
                        placement="day_hotel_card"
                      />
                    )}
                    <AffiliateDisclosure className="text-[11px] text-slate-600" />
                  </div>
                ) : fallbackHotelLink ? (
                  <div className="flex flex-col items-start sm:items-end gap-1.5 flex-shrink-0">
                    {checkout ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.currentTarget.focus();
                          checkout.review({
                            id: hotel.id || `${hotel.name}-${dayNumber}`,
                            name: hotel.name,
                            date,
                            mode: "partner_click",
                            itemType: "hotel",
                            partner: fallbackHotelLink.partner,
                            partnerLabel: formatAffiliatePartnerName(
                              fallbackHotelLink.partner,
                            ),
                            affiliateUrl: fallbackHotelLink.url!,
                            source:
                              affiliateCtx?.source ??
                              (checkout.mode === "shared"
                                ? "shared_trip"
                                : "itinerary"),
                            placement: "day_hotel_fallback",
                          });
                        }}
                        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary-700 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-800 transition-colors"
                      >
                        <span>{fallbackHotelLink.label}</span>
                        <ExternalLink
                          className="h-3.5 w-3.5"
                          aria-hidden="true"
                        />
                      </button>
                    ) : (
                      <TrackedAffiliateButton
                        variant="secondary"
                        label={fallbackHotelLink.label}
                        affiliateUrl={fallbackHotelLink.url!}
                        partner={fallbackHotelLink.partner}
                        itemType="hotel"
                        itemId={hotel.id || `${hotel.name}-${dayNumber}`}
                        itemName={hotel.name}
                        tripId={affiliateCtx?.tripId}
                        source={affiliateCtx?.source ?? "itinerary"}
                        placement="day_hotel_fallback"
                      />
                    )}
                    <AffiliateDisclosure className="text-[11px] text-slate-600" />
                  </div>
                ) : hotel.affiliateUrl ? (
                  <p className="max-w-xs flex-shrink-0 rounded-xl bg-white px-3 py-2 text-xs font-medium leading-5 text-slate-700 border border-[#DCE5E3]">
                    Hotel booking unavailable. Confirm the room and rate on the
                    hotel’s site.
                  </p>
                ) : null}
              </div>
            </div>
          )}

          {/* Transport estimates preserve provider-local times and missing facts. */}
          {transport && (
            <div className="mb-6 rounded-2xl bg-gradient-to-br from-[#143D46] to-[#0E2C33] p-5 text-white">
              <FlightLeg
                transport={transport}
                label={
                  isReturnLeg
                    ? "Return flight"
                    : transport.type === "flight"
                      ? "Outbound flight"
                      : "Transport option"
                }
              />
              <p className="mt-3 text-xs text-[#EFF5F3]/90">
                Planning estimate. Confirm the party size, current price, and
                availability with the provider.
              </p>
              {hasAllowedTransportUrl ? (
                <div className="mt-4 space-y-2">
                  {!transportCurrent && transportPartner === "duffel" && (
                    <p className="text-xs text-amber-200">
                      This saved fare quote may have expired — check live
                      availability or compare carriers below.
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {checkout ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.currentTarget.focus();
                          checkout.review({
                            id: transportId || `flight-day-${dayNumber}`,
                            name: `${transport.provider || "Flight"} (${transportRouteLabel})`,
                            date,
                            dateLabel: `${transportRouteLabel} · ${formatDate(date)}`,
                            mode: "partner_click",
                            itemType:
                              transport.type === "flight"
                                ? "flight"
                                : "transport",
                            partner: transportPartner,
                            partnerLabel: transportPartnerLabel,
                            affiliateUrl: transport.affiliateUrl!,
                            price: transportPrice?.amount,
                            currency: transportPrice?.currency,
                            source:
                              affiliateCtx?.source ??
                              (checkout.mode === "shared"
                                ? "shared_trip"
                                : "itinerary"),
                            placement: "day_transport_card",
                          });
                        }}
                        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#143D46] hover:bg-[#EFF5F3] transition-colors"
                      >
                        <span>
                          {transportPartner === "duffel"
                            ? isReturnLeg
                              ? "Review round-trip flight on Duffel"
                              : "Book flight on Duffel"
                            : `Book ${transport.type === "flight" ? "flight" : "ticket"} on ${transportPartnerLabel}`}
                        </span>
                        <ExternalLink className="h-4 w-4" aria-hidden="true" />
                      </button>
                    ) : (
                      <TrackedAffiliateButton
                        variant="onDark"
                        label={
                          transportPartner === "duffel"
                            ? isReturnLeg
                              ? "Review round-trip flight on Duffel"
                              : "Book flight on Duffel"
                            : `Book ${transport.type === "flight" ? "flight" : "ticket"} on ${transportPartnerLabel}`
                        }
                        affiliateUrl={transport.affiliateUrl!}
                        partner={transportPartner}
                        itemType={
                          transport.type === "flight" ? "flight" : "transport"
                        }
                        itemId={transportId || `flight-day-${dayNumber}`}
                        itemName={`${transport.provider || "Flight"} (${transportRouteLabel})`}
                        tripId={affiliateCtx?.tripId}
                        price={transportPrice?.amount}
                        currency={transportPrice?.currency}
                        source={affiliateCtx?.source ?? "itinerary"}
                        placement="day_transport_card"
                      />
                    )}
                    {(!transportCurrent || transportPartner !== "duffel") &&
                      flightFallbackLinks.slice(0, 2).map((link) => {
                        const partnerLabel = formatAffiliatePartnerName(
                          link.partner,
                        );
                        return checkout ? (
                          <button
                            key={link.partner}
                            type="button"
                            onClick={(event) => {
                              event.currentTarget.focus();
                              checkout.review({
                                id: `${transportId || `flight-day-${dayNumber}`}-${link.partner}`,
                                name: `${transportRouteLabel} · ${partnerLabel}`,
                                date,
                                dateLabel: `${transportRouteLabel} · ${formatDate(date)}`,
                                mode: "partner_click",
                                itemType: "flight",
                                partner: link.partner,
                                partnerLabel,
                                affiliateUrl: link.url,
                                source:
                                  affiliateCtx?.source ??
                                  (checkout.mode === "shared"
                                    ? "shared_trip"
                                    : "itinerary"),
                                placement: "day_transport_fallback",
                              });
                            }}
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-xs font-semibold text-white hover:bg-white/20 transition-colors"
                          >
                            <span>{link.label}</span>
                            <ExternalLink
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          </button>
                        ) : (
                          <TrackedAffiliateButton
                            key={link.partner}
                            variant="onDark"
                            label={link.label}
                            affiliateUrl={link.url}
                            partner={link.partner}
                            itemType="flight"
                            itemId={`${transportId || `flight-day-${dayNumber}`}-${link.partner}`}
                            itemName={`${transportRouteLabel} · ${partnerLabel}`}
                            tripId={affiliateCtx?.tripId}
                            source={affiliateCtx?.source ?? "itinerary"}
                            placement="day_transport_fallback"
                          />
                        );
                      })}
                  </div>
                  <AffiliateDisclosure className="text-xs text-[#EFF5F3]/90" />
                </div>
              ) : !transport.affiliateUrl && flightFallbackLinks.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {flightFallbackLinks.slice(0, 2).map((link) => {
                      const partnerLabel = formatAffiliatePartnerName(
                        link.partner,
                      );
                      return checkout ? (
                        <button
                          key={link.partner}
                          type="button"
                          onClick={(event) => {
                            event.currentTarget.focus();
                            checkout.review({
                              id: `${transportId || `flight-day-${dayNumber}`}-${link.partner}`,
                              name: `${transportRouteLabel} · ${partnerLabel}`,
                              date,
                              dateLabel: `${transportRouteLabel} · ${formatDate(date)}`,
                              mode: "partner_click",
                              itemType: "flight",
                              partner: link.partner,
                              partnerLabel,
                              affiliateUrl: link.url,
                              source:
                                affiliateCtx?.source ??
                                (checkout.mode === "shared"
                                  ? "shared_trip"
                                  : "itinerary"),
                              placement: "day_transport_fallback",
                            });
                          }}
                          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#143D46] hover:bg-[#EFF5F3] transition-colors"
                        >
                          <span>{link.label}</span>
                          <ExternalLink
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        </button>
                      ) : (
                        <TrackedAffiliateButton
                          key={link.partner}
                          variant="onDark"
                          label={link.label}
                          affiliateUrl={link.url}
                          partner={link.partner}
                          itemType="flight"
                          itemId={`${transportId || `flight-day-${dayNumber}`}-${link.partner}`}
                          itemName={`${transportRouteLabel} · ${partnerLabel}`}
                          tripId={affiliateCtx?.tripId}
                          source={affiliateCtx?.source ?? "itinerary"}
                          placement="day_transport_fallback"
                        />
                      );
                    })}
                  </div>
                  <AffiliateDisclosure className="text-xs text-[#EFF5F3]/90" />
                </div>
              ) : transport.affiliateUrl ? (
                <p className="mt-3 rounded-xl bg-white px-4 py-3 text-sm font-medium text-[#143D46]">
                  {transport.type === "flight"
                    ? "Flight booking unavailable. Confirm the fare with the airline or a flight seller."
                    : "Transport booking unavailable. Confirm the ticket with the operator."}
                </p>
              ) : null}
            </div>
          )}

          {validTiming && (
            <ProposedTiming proposal={validTiming} names={timingNames} />
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
                slotName="morning"
                date={date}
                block={morning}
                stopRationales={stopRationales}
              />
            )}

            {/* Afternoon */}
            {hasAfternoon && (
              <TimeBlockSection
                icon={<Sun className="w-4 h-4" />}
                label="Afternoon"
                slotName="afternoon"
                date={date}
                block={afternoon}
                stopRationales={stopRationales}
              />
            )}

            {/* Evening */}
            {hasEvening && (
              <TimeBlockSection
                icon={<Moon className="w-4 h-4" />}
                label="Evening"
                slotName="evening"
                date={date}
                block={evening}
                stopRationales={stopRationales}
              />
            )}
          </div>

          <DiningReviewOptions options={diningOptions} />
          {/* Daily Tips */}
          {generalTips.length > 0 && (
            <div className="mt-6 p-4 bg-slate-50 rounded-2xl border border-slate-200">
              <div className="flex items-center gap-2 text-slate-900 font-semibold mb-3">
                <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
                  <Lightbulb className="w-3.5 h-3.5" />
                </div>
                <span className="text-sm">Before you go</span>
              </div>
              <ul className="space-y-1.5">
                {generalTips.map((tip, i) => (
                  <li
                    key={i}
                    className="text-sm leading-relaxed text-slate-600 flex items-start gap-2"
                  >
                    <span className="text-slate-500 mt-0.5">•</span>
                    <span className="min-w-0 break-words">
                      <SourceNote text={tip} />
                    </span>
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
  slotName: "morning" | "afternoon" | "evening";
  block: TimeBlock;
  stopRationales: Map<string, string[]>;
}

function TimeBlockSection({
  date,
  icon,
  label,
  slotName,
  block,
  stopRationales,
}: TimeBlockSectionProps) {
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
            rationale={stopRationales.get(
              `act:${slotName}:${activity.id || idx}`,
            )}
          />
        ))}
        {meals.map((meal, idx) => (
          <RestaurantCard
            key={meal.id || idx}
            restaurant={meal}
            date={date}
            rationale={stopRationales.get(`meal:${slotName}:${meal.id || idx}`)}
          />
        ))}
      </div>
    </div>
  );
}
