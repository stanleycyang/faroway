import { readFile } from "node:fs/promises";
import { searchLiteApiFlights } from "../lib/affiliates/liteapi-flights";

// Explicit sandbox-only search. Never creates holds, payments or bookings.
const path = process.argv[2];
if (!path || path === "--help") {
  console.log(
    "Usage: bun scripts/rehearse-liteapi-flights.ts search.json\nRequires LITEAPI_FLIGHTS_SANDBOX_ENABLED=true and a sandbox LITEAPI_API_KEY.\nInput: origin, destination, departureDate, optional returnDate, adults, childAges, currency.\nSandbox fares cannot establish which supplier is cheaper.",
  );
} else {
  try {
    const result = await searchLiteApiFlights(
      JSON.parse(await readFile(path, "utf8")),
      "sandbox",
    );
    console.log(
      JSON.stringify(
        {
          sandbox: result.sandbox,
          matchedOffers: result.offers.length,
          offers: result.offers.map((o) => ({
            provider: o.provider,
            departure: o.departure,
            arrival: o.arrival,
            amount: o.price,
            currency: o.currency,
            expiresAt: o.expiresAt,
          })),
        },
        null,
        2,
      ),
    );
  } catch {
    console.error(
      "Sandbox search failed. Check activation, sandbox credentials, request dates and supplier access. No booking was attempted.",
    );
    process.exitCode = 1;
  }
}
