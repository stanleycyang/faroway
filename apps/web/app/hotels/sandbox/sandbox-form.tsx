"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import type { LiteApiRatesResponse } from "@/lib/affiliates/liteapi";

export function HotelSandbox() {
  const [result, setResult] = useState<LiteApiRatesResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    const fields = new FormData(event.currentTarget);
    const children = String(fields.get("children") || "").trim();
    setResult(null);
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/hotels/liteapi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          cityName: fields.get("city"),
          countryCode: String(fields.get("country")).toUpperCase(),
          guestNationality: String(fields.get("nationality")).toUpperCase(),
          checkin: fields.get("checkin"),
          checkout: fields.get("checkout"),
          currency: "USD",
          occupancies: [
            {
              adults: Number(fields.get("adults")),
              children: children
                ? children
                    .split(",")
                    .map((age) => (age.trim() ? Number(age) : -1))
                : [],
            },
          ],
          limit: 3,
        }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 429
            ? "Search limit reached. Try again later."
            : "Hotel search failed. Check the fields and try again.",
        );
      const data: LiteApiRatesResponse = await response.json();
      if (data.sandbox !== true || !Array.isArray(data.data))
        throw new Error("No valid sandbox quotes returned.");
      setResult(data);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Hotel search failed.",
      );
    } finally {
      setLoading(false);
    }
  }
  const inputStyle = "block w-full rounded-lg border border-gray-300 p-2 mt-1";
  return (
    <main className="max-w-3xl mx-auto px-6 py-10">
      <Link href="/dashboard" className="text-sm underline">
        Back to dashboard
      </Link>
      <h1 className="text-3xl font-semibold mt-6">Hotel sandbox</h1>
      <p className="mt-2 text-gray-600">
        Test hotel quotes from LiteAPI. These are sandbox results; no
        reservation or payment is made.
      </p>
      <form onSubmit={search} className="grid sm:grid-cols-2 gap-4 mt-6">
        <label>
          City
          <input
            name="city"
            required
            defaultValue="Paris"
            maxLength={120}
            className={inputStyle}
          />
        </label>
        <label>
          Destination country (two-letter code)
          <input
            name="country"
            required
            defaultValue="FR"
            pattern="[A-Za-z]{2}"
            className={inputStyle}
          />
        </label>
        <label>
          Check-in
          <input
            type="date"
            name="checkin"
            required
            defaultValue="2026-11-08"
            className={inputStyle}
          />
        </label>
        <label>
          Check-out
          <input
            type="date"
            name="checkout"
            required
            defaultValue="2026-11-10"
            className={inputStyle}
          />
        </label>
        <label>
          Guest nationality (two-letter code)
          <input
            name="nationality"
            required
            defaultValue="US"
            pattern="[A-Za-z]{2}"
            className={inputStyle}
          />
        </label>
        <label>
          Adults in one room
          <input
            type="number"
            name="adults"
            required
            min={1}
            max={8}
            defaultValue={2}
            className={inputStyle}
          />
        </label>
        <label className="sm:col-span-2">
          Children’s ages, separated by commas (optional)
          <input
            name="children"
            placeholder="For example: 6, 10"
            className={inputStyle}
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-gray-900 text-white px-4 py-3 disabled:opacity-50"
        >
          {loading ? "Searching…" : "Search sandbox hotels"}
        </button>
      </form>
      <div aria-live="polite" className="mt-6">
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        {result && (
          <>
            <p>
              {result.data.length} hotels returned. USD quotes for the selected
              stay; supplier checkout must confirm final price and terms.
            </p>
            {result.data.map((hotel) => (
              <article
                key={hotel.hotelId}
                className="border rounded-xl p-5 mt-4"
              >
                <h2 className="text-xl font-semibold">
                  {result.hotels?.find(
                    (details) => details.id === hotel.hotelId,
                  )?.name || "Hotel quote"}
                </h2>
                {hotel.roomTypes.map((offer) => (
                  <div key={offer.offerId} className="mt-3">
                    {offer.rates.map((rate, index) => (
                      <div key={index} className="mt-2">
                        <p>
                          Room {index + 1}:{" "}
                          {rate.retailRate.total
                            .map((price) => `${price.amount} ${price.currency}`)
                            .join(" / ")}
                        </p>
                        {rate.retailRate.suggestedSellingPrice?.map(
                          (price, i) => (
                            <p key={i} className="text-sm">
                              Supplier public selling minimum: {price.amount}{" "}
                              {price.currency}
                            </p>
                          ),
                        )}
                        {rate.retailRate.taxesAndFees?.map((tax, i) => (
                          <p key={i} className="text-sm">
                            {tax.description}: {tax.amount} {tax.currency} (
                            {tax.included ? "included" : "additional"})
                          </p>
                        ))}
                        <p className="text-sm text-gray-600">
                          Cancellation conditions must be checked before
                          booking.
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
              </article>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
