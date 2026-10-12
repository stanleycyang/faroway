"use client";
import { useEffect, useRef, useState } from "react";
import { validateHotelSearchDetails } from "@faroway/constants";
import type { HotelQuoteResult } from "@faroway/types";
import type { Trip } from "@/lib/trips/load-trip";

export function HotelQuotePanel({ trip }: { trip: Trip }) {
  const [quotes, setQuotes] = useState<HotelQuoteResult | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const active = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      active.current?.abort();
      active.current = null;
    },
    [],
  );
  const ready = validateHotelSearchDetails(
    trip.preferences?.hotelSearch,
    trip.travelers,
  );
  async function search() {
    if (loading || !ready) return;
    const controller = new AbortController();
    active.current = controller;
    setLoading(true);
    setMessage("");
    setQuotes(null);
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(
        `/api/trips/${encodeURIComponent(trip.id)}/hotels`,
        {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expectedUpdatedAt: trip.updated_at }),
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.error === "string" ? data.error : "Hotel search failed.",
        );
      if (
        data.tripId !== trip.id ||
        data.tripUpdatedAt !== trip.updated_at ||
        !Array.isArray(data.hotels)
      )
        throw new Error("Your trip changed. Reload hotel options.");
      if (!controller.signal.aborted) setQuotes(data);
    } catch (failure) {
      if (active.current === controller)
        setMessage(
          controller.signal.aborted
            ? "Hotel search timed out. Try again."
            : failure instanceof Error
              ? failure.message
              : "Hotel search failed.",
        );
    } finally {
      clearTimeout(timeout);
      if (active.current === controller) {
        setLoading(false);
        active.current = null;
      }
    }
  }
  return (
    <section
      className="rounded-2xl border bg-white p-6 my-6"
      aria-label="Hotel options"
    >
      <h2 className="text-xl font-semibold">Hotel options for your stay</h2>
      <p className="text-sm text-gray-600 mt-2">
        {ready
          ? "Search using your saved dates, nationality and room guests. No reservation is made."
          : "Add hotel room details and consent in your trip brief to search."}
      </p>
      <button
        type="button"
        disabled={!ready || loading}
        onClick={search}
        className="mt-4 rounded-lg bg-primary px-4 py-2 text-white disabled:opacity-50"
      >
        {loading ? "Searching hotels…" : "Search hotel options"}
      </button>
      <div aria-live="polite" className="mt-4">
        {message && <p role="alert">{message}</p>}
        {quotes && (
          <>
            {quotes.sandbox && (
              <p className="text-amber-800">
                Sandbox quotes for testing; these cannot be booked.
              </p>
            )}
            {quotes.hotels.length === 0 && (
              <p>No hotel quotes were available for these details.</p>
            )}
            {quotes.hotels.map((hotel) => (
              <article key={hotel.id} className="border-t mt-4 pt-4">
                <h3 className="font-semibold">{hotel.name}</h3>
                {hotel.offers.map((offer) => (
                  <div key={offer.id} className="mt-2 text-sm">
                    <p>
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: offer.currency,
                      }).format(offer.stayAmount)}{" "}
                      for the stay · {offer.roomCount} room(s)
                    </p>
                    {offer.additionalTaxes.map((tax, index) => (
                      <p key={index}>
                        Additional {tax.description}: {tax.amount}{" "}
                        {tax.currency}
                      </p>
                    ))}
                    <p className="text-gray-600">{offer.cancellationNote}</p>
                  </div>
                ))}
              </article>
            ))}
          </>
        )}
      </div>
    </section>
  );
}
