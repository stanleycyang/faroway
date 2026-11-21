"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ExternalLink,
  Hotel,
  Plane,
  ShieldCheck,
  Ticket,
  Utensils,
  X,
} from "lucide-react";
import {
  flightQuoteIsCurrent,
  formatAffiliatePartnerName,
  isAllowedAffiliateUrl,
  itemTypeForAffiliatePartner,
  normalizeAffiliatePartner,
  readPrice,
  resolveAffiliatePartnerByUrl,
  type AffiliateClickItemType,
} from "@faroway/constants";
import type {
  AffiliateClickSource,
  HotelResult,
  TripDay,
} from "@faroway/types";
import type { AffiliateLinkResult } from "@/lib/affiliates/types";
import {
  canDisplayViatorContent,
  isViatorContent,
} from "@/lib/affiliates/viator-policy";
import { formatEstimate } from "@/lib/trips/budget";
import { useModalFocusTrap } from "@/hooks/useModalFocusTrap";
import { AffiliateDisclosure } from "@/components/affiliates/AffiliateDisclosure";
import { trackAndOpenAffiliateLink } from "@/components/affiliates/track-click-client";
import { useTripCheckout } from "./TripCheckoutContext";

export type BookingsSheetCategory =
  | "stay"
  | "flights"
  | "experiences"
  | "dining"
  | "essentials";

export interface BookingsSheetItem {
  id: string;
  category: BookingsSheetCategory;
  title: string;
  subtitle?: string;
  price?: number;
  currency?: string;
  partner: string;
  partnerLabel: string;
  affiliateUrl: string;
  itemType: AffiliateClickItemType;
  date?: string;
  dateLabel?: string;
  isViatorHosted?: boolean;
  expired?: boolean;
  ctaLabel?: string;
}

export interface BuildTripBookingItemsParams {
  days?: TripDay[] | null;
  topHotel?: HotelResult | null;
  startDate?: string;
  endDate?: string;
  hotelPartnerLinks?: {
    primary: AffiliateLinkResult | null;
    alternatives: AffiliateLinkResult[];
  };
  flightFallbackLinks?: AffiliateLinkResult[];
  essentials?: Record<string, AffiliateLinkResult>;
  viatorContentEnabled?: boolean;
}

export function buildTripBookingItems({
  days,
  topHotel,
  startDate,
  endDate,
  hotelPartnerLinks,
  flightFallbackLinks,
  essentials,
  viatorContentEnabled = false,
}: BuildTripBookingItemsParams): BookingsSheetItem[] {
  const items: BookingsSheetItem[] = [];
  const seenKeys = new Set<string>();
  const dateRangeLabel =
    startDate && endDate ? `${startDate} – ${endDate}` : startDate || undefined;

  const pushUnique = (dedupeKey: string, item: BookingsSheetItem) => {
    if (seenKeys.has(dedupeKey)) return;
    seenKeys.add(dedupeKey);
    items.push(item);
  };

  // 1. Stay (topHotel + distinct day hotels + configured hotel partner search)
  if (topHotel?.affiliateUrl && isAllowedAffiliateUrl(topHotel.affiliateUrl)) {
    const partner =
      resolveAffiliatePartnerByUrl(topHotel.affiliateUrl) ??
      normalizeAffiliatePartner(topHotel.affiliatePartner) ??
      "stay22";
    const price = readPrice(topHotel.pricePerNight, topHotel.currency);
    pushUnique(`hotel:${topHotel.id || topHotel.name}`, {
      id: topHotel.id || topHotel.name,
      category: "stay",
      title: topHotel.name,
      subtitle: price ? "Estimated per night" : "Suggested stay",
      price: price?.amount,
      currency: price?.currency,
      partner,
      partnerLabel: formatAffiliatePartnerName(partner),
      affiliateUrl: topHotel.affiliateUrl,
      itemType: "hotel",
      date: startDate,
      dateLabel: dateRangeLabel,
      ctaLabel: "Check rates",
    });
  }

  for (const day of days ?? []) {
    const h = day.hotel;
    if (h?.affiliateUrl && isAllowedAffiliateUrl(h.affiliateUrl)) {
      const partner =
        resolveAffiliatePartnerByUrl(h.affiliateUrl) ??
        normalizeAffiliatePartner(h.affiliatePartner) ??
        "stay22";
      const price = readPrice(h.pricePerNight, h.currency);
      pushUnique(`hotel:${h.id || h.name}`, {
        id: h.id || `${h.name}-${day.dayNumber}`,
        category: "stay",
        title: h.name,
        subtitle: `Day ${day.dayNumber} · ${day.date}`,
        price: price?.amount,
        currency: price?.currency,
        partner,
        partnerLabel: formatAffiliatePartnerName(partner),
        affiliateUrl: h.affiliateUrl,
        itemType: "hotel",
        date: day.date,
        dateLabel: dateRangeLabel || day.date,
        ctaLabel: "Check rates",
      });
    }
  }

  const stayCandidates = [
    ...(hotelPartnerLinks?.primary ? [hotelPartnerLinks.primary] : []),
    ...(hotelPartnerLinks?.alternatives ?? []),
  ].filter((link): link is AffiliateLinkResult & { url: string } =>
    Boolean(link.url && isAllowedAffiliateUrl(link.url)),
  );

  if (
    !items.some((item) => item.category === "stay") &&
    stayCandidates.length > 0
  ) {
    const primaryStay = stayCandidates[0];
    pushUnique(`hotel-search:${primaryStay.partner}`, {
      id: `hotel-search-${primaryStay.partner}`,
      category: "stay",
      title: primaryStay.label,
      subtitle: dateRangeLabel
        ? `Compare stays · ${dateRangeLabel}`
        : "Compare stays for your dates",
      partner: primaryStay.partner,
      partnerLabel: formatAffiliatePartnerName(primaryStay.partner),
      affiliateUrl: primaryStay.url,
      itemType: "hotel",
      date: startDate,
      dateLabel: dateRangeLabel,
      ctaLabel: "Compare stays",
    });
  }

  // 2. Flights & Transport (preserve both outbound and Duffel __return legs)
  for (const day of days ?? []) {
    const t = day.transport;
    if (!t) continue;
    const tid = (t as { id?: string }).id;
    const isReturn = Boolean(tid?.endsWith("__return"));
    const route = `${t.departure?.airport || "Origin"} → ${t.arrival?.airport || "Destination"}`;
    if (t.affiliateUrl && isAllowedAffiliateUrl(t.affiliateUrl)) {
      const partner =
        resolveAffiliatePartnerByUrl(t.affiliateUrl) ??
        normalizeAffiliatePartner(t.affiliatePartner) ??
        "duffel";
      const price = readPrice(t.price, t.currency);
      const current = flightQuoteIsCurrent(t);
      const legKey = tid || `transport:${day.dayNumber}:${route}`;
      pushUnique(`flight:${legKey}`, {
        id: legKey,
        category: "flights",
        title: `${t.provider || "Flight"} · ${route}`,
        subtitle: `${isReturn ? "Return" : "Outbound"} · ${day.date}`,
        price: current ? price?.amount : undefined,
        currency: current ? price?.currency : undefined,
        partner,
        partnerLabel: formatAffiliatePartnerName(partner),
        affiliateUrl: t.affiliateUrl,
        itemType: t.type === "flight" ? "flight" : "transport",
        date: day.date,
        dateLabel: `${route} · ${day.date}`,
        expired:
          !current &&
          (partner === "duffel" || t.affiliatePartner === "liteapi"),
        ctaLabel: isReturn ? "Review return" : "Book flight",
      });
    }
  }

  const validFlightFallbacks = (flightFallbackLinks ?? []).filter(
    (link): link is AffiliateLinkResult & { url: string } =>
      Boolean(link.url && isAllowedAffiliateUrl(link.url)),
  );
  const hasAnyDirectFlight = items.some((item) => item.category === "flights");
  const hasExpiredFlight = items.some(
    (item) => item.category === "flights" && item.expired,
  );
  if (
    (!hasAnyDirectFlight || hasExpiredFlight) &&
    validFlightFallbacks.length > 0
  ) {
    for (const fallback of validFlightFallbacks.slice(0, 2)) {
      pushUnique(`flight-fallback:${fallback.partner}`, {
        id: `flight-fallback-${fallback.partner}`,
        category: "flights",
        title: fallback.label,
        subtitle: dateRangeLabel
          ? `Compare live airfares · ${dateRangeLabel}`
          : "Compare live airfares",
        partner: fallback.partner,
        partnerLabel: formatAffiliatePartnerName(fallback.partner),
        affiliateUrl: fallback.url,
        itemType: "flight",
        date: startDate,
        dateLabel: dateRangeLabel,
        ctaLabel: "Compare fares",
      });
    }
  }

  // 3. Experiences & Activities + 4. Dining
  for (const day of days ?? []) {
    for (const slot of [day.morning, day.afternoon, day.evening]) {
      if (!slot) continue;
      for (const act of Array.isArray(slot.activities) ? slot.activities : []) {
        if (!act || typeof act !== "object") continue;
        if (
          isViatorContent(act) &&
          !canDisplayViatorContent(act, viatorContentEnabled)
        ) {
          continue;
        }
        const bookingUrl = act.bookingInfo?.bookingUrl;
        const isViatorHosted =
          act.bookingInfo?.affiliateId === "viator" &&
          /^activity_v_[a-zA-Z0-9]+$/.test(act.id);
        const allowedUrl =
          bookingUrl && isAllowedAffiliateUrl(bookingUrl) ? bookingUrl : null;
        if (!allowedUrl && !isViatorHosted) continue;

        const partner = allowedUrl
          ? (resolveAffiliatePartnerByUrl(allowedUrl) ??
            normalizeAffiliatePartner(act.bookingInfo?.affiliateId) ??
            "viator")
          : "viator";
        const price = readPrice(
          act.estimatedCost?.amount,
          act.estimatedCost?.currency,
        );
        pushUnique(`act:${act.id}:${day.date}`, {
          id: act.id,
          category: "experiences",
          title: act.name,
          subtitle: `Day ${day.dayNumber} · ${day.date}`,
          price: price?.amount,
          currency: price?.currency,
          partner,
          partnerLabel: formatAffiliatePartnerName(partner),
          affiliateUrl: allowedUrl || "",
          itemType: "activity",
          date: day.date,
          dateLabel: day.date,
          isViatorHosted,
          ctaLabel: "Review & book",
        });
      }

      for (const meal of Array.isArray(slot.meals) ? slot.meals : []) {
        if (!meal || typeof meal !== "object") continue;
        const resUrl = meal.reservationInfo?.url;
        const taUrl = meal.tripadvisorUrl;
        const targetUrl =
          resUrl && isAllowedAffiliateUrl(resUrl)
            ? resUrl
            : taUrl && isAllowedAffiliateUrl(taUrl)
              ? taUrl
              : null;
        if (!targetUrl) continue;

        const partner =
          resolveAffiliatePartnerByUrl(targetUrl) ??
          (resUrl ? "opentable" : "tripadvisor");
        const price = readPrice(
          meal.estimatedCost?.amount,
          meal.estimatedCost?.currency,
        );
        pushUnique(`meal:${meal.id}:${day.date}`, {
          id: meal.id,
          category: "dining",
          title: meal.name,
          subtitle: `Day ${day.dayNumber} · ${day.date}`,
          price: price?.amount,
          currency: price?.currency,
          partner,
          partnerLabel: formatAffiliatePartnerName(partner),
          affiliateUrl: targetUrl,
          itemType: "restaurant",
          date: day.date,
          dateLabel: day.date,
          ctaLabel: resUrl ? "Reserve table" : "View dining",
        });
      }
    }
  }

  // 5. Trip Essentials (SafetyWing, Airalo, DiscoverCars, iVisa, Wise)
  if (essentials) {
    for (const [key, entry] of Object.entries(essentials)) {
      if (!entry?.url || !isAllowedAffiliateUrl(entry.url)) continue;
      pushUnique(`essential:${key}:${entry.partner}`, {
        id: `essential-${key}-${entry.partner}`,
        category: "essentials",
        title: entry.label,
        subtitle: `Trip essential · ${formatAffiliatePartnerName(entry.partner)}`,
        partner: entry.partner,
        partnerLabel: formatAffiliatePartnerName(entry.partner),
        affiliateUrl: entry.url,
        itemType: itemTypeForAffiliatePartner(entry.partner),
        date: startDate,
        dateLabel: dateRangeLabel,
        ctaLabel: "Open partner",
      });
    }
  }

  return items;
}

const SECTION_META: Array<{
  key: BookingsSheetCategory;
  title: string;
  icon: typeof Hotel;
}> = [
  { key: "stay", title: "Stay", icon: Hotel },
  { key: "flights", title: "Flights & transport", icon: Plane },
  { key: "experiences", title: "Experiences", icon: Ticket },
  { key: "dining", title: "Dining", icon: Utensils },
  { key: "essentials", title: "Trip essentials", icon: ShieldCheck },
];

export interface BookingsSheetProps {
  open: boolean;
  onClose: () => void;
  items: BookingsSheetItem[];
  tripId?: string;
  source?: AffiliateClickSource;
  destination?: string;
}

export function BookingsSheet({
  open,
  onClose,
  items,
  tripId,
  source = "itinerary",
  destination,
}: BookingsSheetProps) {
  const checkout = useTripCheckout();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useModalFocusTrap({ open, dialogRef, onClose });

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  const handleItemClick = async (item: BookingsSheetItem) => {
    const canUseViatorHosted =
      Boolean(item.isViatorHosted) &&
      checkout?.mode === "owner" &&
      checkout.enabled;

    if (checkout) {
      if (!canUseViatorHosted && !isAllowedAffiliateUrl(item.affiliateUrl)) {
        return;
      }
      onClose();
      checkout.review({
        id: item.id,
        name: item.title,
        date: item.date || "",
        dateLabel: item.dateLabel,
        mode: canUseViatorHosted ? "viator_hosted" : "partner_click",
        itemType: item.itemType,
        partner: item.partner,
        partnerLabel: item.partnerLabel,
        affiliateUrl: item.affiliateUrl || undefined,
        price: item.price,
        currency: item.currency,
        source,
        placement: "bookings_sheet",
      });
      return;
    }

    if (!isAllowedAffiliateUrl(item.affiliateUrl)) return;
    setBusyId(item.id);
    try {
      await trackAndOpenAffiliateLink({
        affiliateUrl: item.affiliateUrl,
        partner: item.partner,
        itemType: item.itemType,
        itemId: item.id,
        itemName: item.title,
        tripId,
        price: item.price,
        currency: item.currency,
        source,
        placement: "bookings_sheet",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-slate-950/60 sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bookings-sheet-title"
        className="relative flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-[#FAF8F3] shadow-2xl outline-none sm:rounded-3xl"
      >
        <div className="border-b border-slate-200 bg-white px-6 py-5">
          <div
            aria-hidden="true"
            className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden"
          />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-700">
                Trip bookings
              </p>
              <h2
                id="bookings-sheet-title"
                className="mt-1 font-editorial text-2xl text-slate-900 sm:text-3xl"
              >
                {destination
                  ? `Book your ${destination} trip`
                  : "Review & book your trip"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close bookings drawer"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <AffiliateDisclosure
            variant="full"
            className="mt-2 text-xs text-slate-600"
          />
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] space-y-6 sm:p-6">
          {items.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
              No direct booking links are ready for this itinerary yet. Review
              individual stops in your day-by-day plan for venue details.
            </div>
          ) : (
            SECTION_META.map((section) => {
              const sectionItems = items.filter(
                (item) => item.category === section.key,
              );
              if (sectionItems.length === 0) return null;
              const SectionIcon = section.icon;
              return (
                <section key={section.key} aria-label={section.title}>
                  <div className="mb-2.5 flex items-center gap-2">
                    <SectionIcon
                      className="h-4 w-4 text-[#143D46]"
                      aria-hidden="true"
                    />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      {section.title} ({sectionItems.length})
                    </h3>
                  </div>
                  <ul className="space-y-2.5">
                    {sectionItems.map((item) => {
                      const canAct =
                        (Boolean(item.isViatorHosted) &&
                          checkout?.mode === "owner" &&
                          checkout.enabled) ||
                        isAllowedAffiliateUrl(item.affiliateUrl);
                      return (
                        <li
                          key={`${item.category}:${item.id}:${item.partner}`}
                          className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-900">
                                {item.title}
                              </p>
                              <span className="rounded-full bg-[#EFF5F3] px-2.5 py-0.5 text-[11px] font-semibold text-[#143D46]">
                                {item.partnerLabel}
                              </span>
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                              {item.subtitle && <span>{item.subtitle}</span>}
                              {item.price != null && item.currency && (
                                <span className="font-semibold text-slate-900">
                                  Est.{" "}
                                  {formatEstimate(item.price, item.currency)}
                                </span>
                              )}
                              {item.expired && (
                                <span className="font-medium text-amber-800">
                                  Confirm live fare
                                </span>
                              )}
                            </div>
                          </div>
                          {canAct && (
                            <button
                              type="button"
                              disabled={busyId === item.id}
                              onClick={() => void handleItemClick(item)}
                              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-primary-700 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-800 transition-colors disabled:opacity-60"
                            >
                              <span>
                                {busyId === item.id
                                  ? "Opening…"
                                  : item.ctaLabel ||
                                    `Book on ${item.partnerLabel}`}
                              </span>
                              <ExternalLink
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
