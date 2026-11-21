"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import {
  formatAffiliatePartnerName,
  isAllowedAffiliateUrl,
  validateHotelSearchDetails,
} from "@faroway/constants";
import { useUser } from "@/hooks/useUser";
import { createClient } from "@/lib/supabase/client";
import { withAuthRequestDeadline } from "@/lib/auth/request-deadline";
import {
  HotelQuoteResultSchema,
  hotelSearchEnabled,
} from "@/lib/trips/hotel-quotes";
import type { HotelQuoteResult } from "@faroway/types";
import type { Trip } from "@/lib/trips/load-trip";
import { useTripCheckout } from "./TripCheckoutContext";
import { AffiliateDisclosure } from "@/components/affiliates/AffiliateDisclosure";
import { TrackedAffiliateButton } from "@/components/affiliates/TrackedAffiliateButton";
import { useAffiliateTracking } from "@/components/affiliates/AffiliateTrackingContext";

function buildHotelSpecificPartnerUrl(
  baseUrl: string | null | undefined,
  hotelName: string,
  destination: string,
  checkIn?: string,
  checkOut?: string,
  adults?: number,
): { url: string; partner: string } | null {
  if (baseUrl && isAllowedAffiliateUrl(baseUrl)) {
    try {
      const parsed = new URL(baseUrl);
      const query = `${hotelName}, ${destination}`.trim();
      if (parsed.hostname.includes("stay22.com")) {
        parsed.searchParams.set("address", query);
      } else if (parsed.hostname.includes("booking.com")) {
        parsed.searchParams.set("ss", `${hotelName} ${destination}`.trim());
      } else if (parsed.hostname.includes("expedia.com")) {
        parsed.searchParams.set("destination", query);
      }
      const adjusted = parsed.toString();
      if (isAllowedAffiliateUrl(adjusted)) {
        return {
          url: adjusted,
          partner: parsed.hostname.includes("stay22.com")
            ? "stay22"
            : parsed.hostname.includes("booking.com")
              ? "booking"
              : parsed.hostname.includes("expedia.com")
                ? "expedia"
                : "stay22",
        };
      }
    } catch {
      // Fall through to Booking search link
    }
  }

  const fallback = new URL("https://www.booking.com/searchresults.html");
  fallback.searchParams.set("ss", `${hotelName} ${destination}`.trim());
  if (checkIn) fallback.searchParams.set("checkin", checkIn);
  if (checkOut) fallback.searchParams.set("checkout", checkOut);
  if (adults && adults > 0) {
    fallback.searchParams.set("group_adults", String(adults));
  }
  const fallbackStr = fallback.toString();
  return isAllowedAffiliateUrl(fallbackStr)
    ? { url: fallbackStr, partner: "booking" }
    : null;
}

export function HotelQuotePanel({ trip }: { trip: Trip }) {
  return hotelSearchEnabled() ? <HotelQuoteActor trip={trip} /> : null;
}

function HotelQuoteActor({ trip }: { trip: Trip }) {
  const account = useUser();
  return (
    <HotelQuoteSession
      key={`${trip.user_id}:${trip.id}:${trip.updated_at}:${account.session?.user.id}:${account.accountRevision}`}
      trip={trip}
      authenticated={
        !account.loading && account.session?.user.id === trip.user_id
      }
    />
  );
}

function HotelQuoteSession({
  trip,
  authenticated,
}: {
  trip: Trip;
  authenticated: boolean;
}) {
  const checkout = useTripCheckout();
  const affiliateCtx = useAffiliateTracking();
  const [quotes, setQuotes] = useState<HotelQuoteResult | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const active = useRef(true);
  const requestLock = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
      controllerRef.current?.abort();
    };
  }, []);
  const ready =
    authenticated &&
    validateHotelSearchDetails(trip.preferences?.hotelSearch, trip.travelers) &&
    trip.end_date > trip.start_date;
  async function search() {
    if (!active.current || requestLock.current || !ready) return;
    requestLock.current = true;
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setMessage("");
    setQuotes(null);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    try {
      const { data, error } = await withAuthRequestDeadline(
        createClient().auth.getSession(),
      );
      if (!active.current) return;
      if (error || data.session?.user.id !== trip.user_id)
        throw new Error(
          "Your account changed. Sign in again before searching.",
        );
      const accessToken = data.session.access_token;
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          controller.abort();
          reject(new Error("Hotel search took too long. Try again."));
        }, 15_000);
      });
      const request = (async () => {
        const response = await fetch(
          `/api/trips/${encodeURIComponent(trip.id)}/hotels`,
          {
            method: "POST",
            signal: controller.signal,
            cache: "no-store",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ expectedUpdatedAt: trip.updated_at }),
          },
        );
        if (!active.current) return null;
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(
            response.status === 409
              ? "Your brief changed. Load the latest version before searching."
              : "Hotel options couldn’t load. Please try again.",
          );
        const parsed = HotelQuoteResultSchema.safeParse(payload);
        if (
          !parsed.success ||
          parsed.data.tripId !== trip.id ||
          parsed.data.tripUpdatedAt !== trip.updated_at
        )
          throw new Error(
            "Hotel options could not be verified. Your saved trip is kept.",
          );
        return parsed.data;
      })();
      void request.catch(() => {});
      void timeout.catch(() => {});
      const result = await Promise.race([request, timeout]);
      if (active.current && !controller.signal.aborted && result)
        setQuotes(result);
    } catch (failure) {
      if (active.current) {
        const aborted =
          timedOut ||
          (failure instanceof Error && failure.name === "AbortError");
        const readable =
          failure instanceof Error &&
          failure.message &&
          failure.name !== "SyntaxError"
            ? failure.message
            : "Hotel options couldn’t load. Try again.";
        setMessage(
          aborted ? "Hotel search took too long. Try again." : readable,
        );
      }
    } finally {
      clearTimeout(timer);
      requestLock.current = false;
      if (active.current) setLoading(false);
    }
  }

  const primaryPartnerBaseUrl = affiliateCtx?.hotelPartnerLinks?.primary?.url;

  return (
    <section
      aria-label="Hotel options"
      className="my-6 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6"
    >
      <h3 className="font-editorial text-xl text-slate-900">
        Hotel options for your stay
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        {ready
          ? "Search with your saved dates and room details. Your nationality and room guests will be shared with Nuitee. No reservation is made."
          : "Add room details and hotel-search consent in your trip brief to search. At least one overnight stay is required."}
      </p>
      <button
        type="button"
        disabled={!ready || loading}
        onClick={search}
        className="mt-4 min-h-12 rounded-full bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? "Searching hotels…" : "Search hotel options"}
      </button>
      <div aria-live="polite" className="mt-4">
        {message && (
          <p role="alert" className="text-sm text-amber-900">
            {message}
          </p>
        )}
        {quotes && (
          <>
            <p className="text-sm text-amber-900">
              Sandbox quotes for testing; these cannot be booked.
            </p>
            {quotes.hotels.length === 0 && (
              <p className="mt-3 text-sm text-slate-600">
                No hotel quotes were available. Try another search or adjust
                your saved room details.
              </p>
            )}
            {quotes.hotels.map((hotel) => {
              const target = buildHotelSpecificPartnerUrl(
                primaryPartnerBaseUrl,
                hotel.name,
                trip.destination,
                trip.start_date,
                trip.end_date,
                trip.travelers,
              );
              const partnerLabel = target
                ? formatAffiliatePartnerName(target.partner)
                : "Partner";
              const firstOffer = hotel.offers[0];
              return (
                <article
                  key={hotel.id}
                  className="mt-4 border-t border-gray-100 pt-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h4 className="font-semibold text-slate-900">
                      {hotel.name}
                    </h4>
                    {target && (
                      <div className="flex flex-col items-start sm:items-end gap-1">
                        {checkout ? (
                          <button
                            type="button"
                            onClick={(event) => {
                              event.currentTarget.focus();
                              checkout.review({
                                id: hotel.id,
                                name: hotel.name,
                                date: trip.start_date,
                                dateLabel: `${trip.start_date} – ${trip.end_date}`,
                                mode: "partner_click",
                                itemType: "hotel",
                                partner: target.partner,
                                partnerLabel,
                                affiliateUrl: target.url,
                                price: firstOffer?.stayAmount,
                                currency: firstOffer?.currency,
                                source: affiliateCtx?.source ?? "itinerary",
                                placement: "hotel_quote_panel",
                              });
                            }}
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-primary-700 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-800 transition-colors"
                          >
                            <span>Check live rates on {partnerLabel}</span>
                            <ExternalLink
                              className="h-3.5 w-3.5"
                              aria-hidden="true"
                            />
                          </button>
                        ) : (
                          <TrackedAffiliateButton
                            variant="secondary"
                            label={`Check live rates on ${partnerLabel}`}
                            affiliateUrl={target.url}
                            partner={target.partner}
                            itemType="hotel"
                            itemId={hotel.id}
                            itemName={hotel.name}
                            tripId={trip.id}
                            price={firstOffer?.stayAmount}
                            currency={firstOffer?.currency}
                            source={affiliateCtx?.source ?? "itinerary"}
                            placement="hotel_quote_panel"
                          />
                        )}
                        <AffiliateDisclosure className="text-[11px] text-slate-600" />
                      </div>
                    )}
                  </div>
                  {hotel.offers.map((offer) => (
                    <div
                      key={offer.id}
                      className="mt-2 space-y-1 text-sm text-slate-600"
                    >
                      <p className="font-semibold text-slate-900">
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: offer.currency,
                        }).format(offer.stayAmount)}{" "}
                        for the stay · {offer.roomCount} room(s)
                      </p>
                      {offer.additionalTaxes.map((tax, i) => (
                        <p key={i}>
                          Additional {tax.description}: {tax.amount}{" "}
                          {tax.currency}
                        </p>
                      ))}
                      <p>{offer.cancellationNote}</p>
                    </div>
                  ))}
                </article>
              );
            })}
          </>
        )}
      </div>
    </section>
  );
}
