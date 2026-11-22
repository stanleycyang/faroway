"use client";

import { ExternalLink, Hotel, Star } from "lucide-react";
import {
  formatAffiliatePartnerName,
  isAllowedAffiliateUrl,
  normalizeAffiliatePartner,
  readPrice,
  resolveAffiliatePartnerByUrl,
} from "@faroway/constants";
import { TripCoverImage } from "./TripCoverImage";
import { useTripCheckout } from "./TripCheckoutContext";
import { AffiliateDisclosure } from "@/components/affiliates/AffiliateDisclosure";
import { TrackedAffiliateButton } from "@/components/affiliates/TrackedAffiliateButton";
import { useAffiliateTracking } from "@/components/affiliates/AffiliateTrackingContext";
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
  const checkout = useTripCheckout();
  const affiliateCtx = useAffiliateTracking();

  const nightly = knownEstimate(
    hotel.pricePerNight,
    hotel.currency,
    hotel.priceStatus,
  );
  const amenities = Array.isArray(hotel.amenities)
    ? hotel.amenities.filter((item) => typeof item === "string")
    : [];

  const hasAllowedAffiliateUrl = Boolean(
    hotel.affiliateUrl && isAllowedAffiliateUrl(hotel.affiliateUrl),
  );
  const primaryPartner = hasAllowedAffiliateUrl
    ? (resolveAffiliatePartnerByUrl(hotel.affiliateUrl!) ??
      normalizeAffiliatePartner(hotel.affiliatePartner) ??
      "stay22")
    : undefined;
  const primaryPartnerLabel = primaryPartner
    ? formatAffiliatePartnerName(primaryPartner)
    : "Partner";
  const hotelPrice = readPrice(hotel.pricePerNight, hotel.currency);

  const validContextLinks = [
    ...(affiliateCtx?.hotelPartnerLinks?.primary
      ? [affiliateCtx.hotelPartnerLinks.primary]
      : []),
    ...(affiliateCtx?.hotelPartnerLinks?.alternatives ?? []),
  ].filter((link): link is NonNullable<typeof link> & { url: string } =>
    Boolean(link.url && isAllowedAffiliateUrl(link.url)),
  );

  const primaryCta = hasAllowedAffiliateUrl
    ? {
        url: hotel.affiliateUrl!,
        partner: primaryPartner!,
        partnerLabel: primaryPartnerLabel,
        label: `Check rates on ${primaryPartnerLabel}`,
      }
    : !hotel.affiliateUrl && validContextLinks[0]
      ? {
          url: validContextLinks[0].url,
          partner: validContextLinks[0].partner,
          partnerLabel: formatAffiliatePartnerName(
            validContextLinks[0].partner,
          ),
          label: validContextLinks[0].label,
        }
      : null;

  const comparisonLinks = validContextLinks
    .filter(
      (link) =>
        !primaryCta ||
        (link.partner !== primaryCta.partner && link.url !== primaryCta.url),
    )
    .slice(0, 3);

  const openHotelCheckout = (
    url: string,
    partner: string,
    partnerLabel: string,
    placement: string,
  ) => {
    if (!checkout) return;
    checkout.review({
      id: hotel.id || hotel.name,
      name: hotel.name,
      date: affiliateCtx?.startDate || "",
      dateLabel:
        affiliateCtx?.startDate && affiliateCtx?.endDate
          ? `${affiliateCtx.startDate} – ${affiliateCtx.endDate}`
          : undefined,
      mode: "partner_click",
      itemType: "hotel",
      partner,
      partnerLabel,
      affiliateUrl: url,
      price: hotelPrice?.amount,
      currency: hotelPrice?.currency,
      source:
        affiliateCtx?.source ??
        (checkout.mode === "shared" ? "shared_trip" : "itinerary"),
      placement,
    });
  };

  return (
    <article
      aria-label={`Suggested stay: ${hotel.name}`}
      className="mb-6 overflow-hidden rounded-3xl border border-slate-200 bg-white sm:grid sm:grid-cols-[0.9fr_1.1fr]"
    >
      <div className="relative flex min-h-56 items-center justify-center overflow-hidden bg-slate-100 text-slate-500 sm:min-h-80">
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
                ? ` (${hotel.reviewCount.toLocaleString("en-US")} reviews)`
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

          {primaryCta ? (
            <div className="mt-4 space-y-3">
              {checkout ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.currentTarget.focus();
                    openHotelCheckout(
                      primaryCta.url,
                      primaryCta.partner,
                      primaryCta.partnerLabel,
                      "featured_hotel_card",
                    );
                  }}
                  className="w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary-700 px-5 py-3 text-sm font-semibold text-white hover:bg-primary-800 transition-colors"
                >
                  <span>{primaryCta.label}</span>
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : (
                <TrackedAffiliateButton
                  label={primaryCta.label}
                  affiliateUrl={primaryCta.url}
                  partner={primaryCta.partner}
                  itemType="hotel"
                  itemId={hotel.id || hotel.name}
                  itemName={hotel.name}
                  tripId={affiliateCtx?.tripId}
                  price={hotelPrice?.amount}
                  currency={hotelPrice?.currency}
                  source={affiliateCtx?.source ?? "itinerary"}
                  placement="featured_hotel_card"
                />
              )}
              {comparisonLinks.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  {comparisonLinks.map((link) => {
                    const partnerLabel = formatAffiliatePartnerName(
                      link.partner,
                    );
                    return checkout ? (
                      <button
                        key={link.partner}
                        type="button"
                        onClick={(event) => {
                          event.currentTarget.focus();
                          openHotelCheckout(
                            link.url,
                            link.partner,
                            partnerLabel,
                            "featured_hotel_compare",
                          );
                        }}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#DCE5E3] bg-[#EFF5F3] px-3.5 py-1.5 text-xs font-semibold text-[#143D46] hover:bg-[#DCE5E3]/70 transition-colors"
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
                        variant="subtle"
                        label={link.label}
                        affiliateUrl={link.url}
                        partner={link.partner}
                        itemType="hotel"
                        itemId={hotel.id || hotel.name}
                        itemName={hotel.name}
                        tripId={affiliateCtx?.tripId}
                        source={affiliateCtx?.source ?? "itinerary"}
                        placement="featured_hotel_compare"
                      />
                    );
                  })}
                </div>
              )}
              <AffiliateDisclosure className="text-xs leading-relaxed text-slate-600" />
            </div>
          ) : (
            <p className="mt-3 text-xs leading-6 text-slate-600">
              Confirm current price, room occupancy, taxes, fees, and
              cancellation terms with the hotel. Hotel checkout is not available
              in Faroway yet.
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
