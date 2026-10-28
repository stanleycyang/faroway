import { beforeEach, describe, expect, it, vi } from "vitest";

describe("Duffel affiliate client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.stubEnv("DUFFEL_API_TOKEN", "test-duffel-token");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://faroway.test");
    vi.stubEnv("DUFFEL_SUPPLIER_TIMEOUT_MS", "2000");
  });

  it("requests offers with current Duffel v2 query parameters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            offers: [
              {
                id: "off_123",
                total_amount: "129.50",
                total_currency: "USD",
                expires_at: "2026-05-01T00:10:00Z",
                slices: [
                  {
                    duration: "PT2H15M",
                    segments: [
                      {
                        origin: {
                          iata_code: "SFO",
                          city_name: "San Francisco",
                        },
                        destination: {
                          iata_code: "LAX",
                          city_name: "Los Angeles",
                        },
                        departing_at: "2026-06-01T09:00:00",
                        arriving_at: "2026-06-01T11:15:00",
                        marketing_carrier: { iata_code: "UA", name: "United" },
                        marketing_carrier_flight_number: "123",
                        passengers: [{ cabin_class: "economy" }],
                        duration: "PT2H15M",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const { searchDuffelFlights } = await import("@/lib/affiliates/duffel");
    const offers = await searchDuffelFlights({
      origin: "SFO",
      destination: "LAX",
      departureDate: "2026-06-01",
      passengers: [{ type: "adult", count: 1 }],
      limit: 1,
    });

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("/air/offer_requests");
    expect(url).toContain("return_offers=true");
    expect(url).toContain("supplier_timeout=2000");
    expect(offers[0].offerId).toBe("off_123");
    expect(offers[0].departure.airport).toBe("SFO");
  });

  it("drops flight offers with missing or invalid amount or currency", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            offers: [
              { id: "missing-currency", total_amount: "50" },
              { id: "missing-amount", total_currency: "USD" },
              { id: "valid-zero", total_amount: "0", total_currency: "EUR" },
            ],
          },
        }),
        { status: 200 },
      ),
    );
    const { searchDuffelFlights } = await import("@/lib/affiliates/duffel");
    const offers = await searchDuffelFlights({
      origin: "SFO",
      destination: "LAX",
      departureDate: "2026-06-01",
      passengers: [{ type: "adult", count: 1 }],
    });
    expect(offers.map((offer) => offer.offerId)).toEqual(["valid-zero"]);
    expect(offers[0].price).toEqual({ amount: 0, currency: "EUR" });
  });

  it("creates a Duffel Links session with the current endpoint", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: { url: "https://links.duffel.com/session_123" },
        }),
        { status: 200 },
      ),
    );

    const { generateDuffelLink } = await import("@/lib/affiliates/duffel");
    const link = await generateDuffelLink("off_123");

    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://api.duffel.com/links/sessions",
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      data: {
        reference: "off_123",
        success_url: "https://faroway.test/trips?duffel=success",
        failure_url: "https://faroway.test/trips?duffel=failure",
        abandonment_url: "https://faroway.test/trips?duffel=abandoned",
        primary_color: "#0f172a",
        traveller_currency: "USD",
        markup_amount: "5.00",
        markup_currency: "USD",
        flights: { enabled: "true" },
        stays: { enabled: "false" },
      },
    });
    expect(link).toBe("https://links.duffel.com/session_123");
  });
});

describe("GetYourGuide affiliate client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.stubEnv("GETYOURGUIDE_API_KEY", "test-gyg-token");
    vi.stubEnv("GETYOURGUIDE_PARTNER_ID", "test-partner");
  });

  it("does not combine an amount and currency from different supplier price objects", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            tours: [
              {
                id: 1,
                title: "Unknown",
                price: { values: { amount: 10 }, currencyCode: "EUR" },
              },
              {
                id: 2,
                title: "Free",
                retail_price: { amount: 0, currency: "JPY" },
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );
    const { searchGYGActivities } =
      await import("@/lib/affiliates/getyourguide");
    const activities = await searchGYGActivities({ destination: "Tokyo" });
    expect(activities[0].price).toMatchObject({
      amount: 0,
      currencyCode: "",
      formattedPrice: "",
    });
    expect(activities[1].price).toMatchObject({
      amount: 0,
      currencyCode: "JPY",
    });
  });

  it("searches the current tours endpoint with required partner query parameters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            tours: [
              {
                tour_id: 123,
                title: "Tokyo Food Tour",
                abstract: "Taste Tokyo with a local guide",
                overall_rating: 4.8,
                number_of_ratings: 240,
                retail_price: { amount: 95, currency: "USD" },
                duration: { value: 3, unit: "hour" },
                pictures: [{ url: "https://gyg.test/photo.jpg" }],
                categories: [{ name: "Food & Gourmet Tours" }],
                location: { city: "Tokyo" },
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const { searchGYGActivities } =
      await import("@/lib/affiliates/getyourguide");
    const activities = await searchGYGActivities({
      destination: "Tokyo",
      startDate: "2026-06-01",
      endDate: "2026-06-05",
      limit: 1,
    });

    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.pathname).toBe("/1/tours");
    expect(requestUrl.searchParams.get("q")).toBe("Tokyo");
    expect(requestUrl.searchParams.get("cnt_language")).toBe("en");
    expect(requestUrl.searchParams.get("currency")).toBe("USD");
    expect(requestUrl.searchParams.get("limit")).toBe("1");
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      "X-ACCESS-TOKEN": "test-gyg-token",
    });
    expect(activities[0]).toMatchObject({
      activityId: "123",
      title: "Tokyo Food Tour",
      duration: { fixedDurationInMinutes: 180 },
    });
  });

  it("checks availability with current language/date query parameters", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            availabilities: [
              {
                date: "2026-06-01",
                available: true,
                start_times: ["09:00", "13:00"],
                retail_price: { amount: 95, currency: "USD" },
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const { checkGYGAvailability } =
      await import("@/lib/affiliates/getyourguide");
    const availability = await checkGYGAvailability("123", "2026-06-01");

    const requestUrl = new URL(String(fetchMock.mock.calls[0][0]));
    expect(requestUrl.pathname).toBe("/1/tours/123/availability");
    expect(requestUrl.searchParams.get("cnt_language")).toBe("en");
    expect(requestUrl.searchParams.get("date[]")).toBe("2026-06-01T00:00:00");
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({
      "X-ACCESS-TOKEN": "test-gyg-token",
    });
    expect(availability[0]).toMatchObject({
      activityId: "123",
      date: "2026-06-01",
      available: true,
      startTimes: ["09:00", "13:00"],
      pricing: { amount: 95, currencyCode: "USD" },
    });
  });
});

describe("TripAdvisor affiliate client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    vi.stubEnv("TRIPADVISOR_API_KEY", "test-tripadvisor-key");
    vi.stubEnv("TRIPADVISOR_ENRICHMENT_LIMIT", "2");
    vi.stubEnv("TRIPADVISOR_ENRICHMENT_TIMEOUT_MS", "1000");
  });

  it("caps enrichment work so TripAdvisor cannot delay every candidate", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            data: [
              {
                location_id: "ta_1",
                name: "Matched place",
                rating: "4.7",
                num_reviews: "120",
                web_url: "https://tripadvisor.test/place",
              },
            ],
          }),
          { status: 200 },
        ),
    );

    const { enrichWithTripAdvisor } =
      await import("@/lib/affiliates/tripadvisor");
    const items = Array.from({ length: 5 }, (_, index) => ({
      name: `Candidate ${index + 1}`,
      location: { name: "Tokyo" },
    }));

    const enriched = await enrichWithTripAdvisor(items, "attractions");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(enriched[0]).toMatchObject({
      tripadvisorRating: 4.7,
      tripadvisorReviewCount: 120,
      tripadvisorUrl: "https://tripadvisor.test/place",
    });
    expect(enriched[1]).toMatchObject({
      tripadvisorRating: 4.7,
    });
    expect(enriched[2]).not.toHaveProperty("tripadvisorRating");
    expect(enriched[4]).not.toHaveProperty("tripadvisorRating");
  });
});
