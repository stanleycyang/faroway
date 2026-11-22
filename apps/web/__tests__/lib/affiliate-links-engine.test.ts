import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  injectAffiliateSubId,
  isAllowedAffiliateUrl,
} from "@faroway/constants";
import {
  buildActivityFallbackLinks,
  buildAiraloUrl,
  buildAviasalesFlightUrl,
  buildBookingUrl,
  buildDiscoverCarsUrl,
  buildExpediaHotelUrl,
  buildFlightFallbackLinks,
  buildGYGAffiliateUrl,
  buildGYGSearchUrl,
  buildHostelworldUrl,
  buildHotelPartnerLinks,
  buildKlookActivitySearchUrl,
  buildSafetyWingUrl,
  buildSkyscannerFlightUrl,
  buildStay22Url,
  buildTiqetsActivitySearchUrl,
  buildTravelpayoutsLink,
  buildTripEssentials,
  buildViatorSearchUrl,
  buildVisaToolUrl,
  buildWiseUrl,
  generateDuffelLink,
  parseDuffelReturnStatus,
  resolveDestinationTravelMeta,
  searchDuffelFlights,
  searchViatorProducts,
} from "@/lib/affiliates";
import {
  buildDiningPartnerLinks,
  buildOpenTableSearchUrl,
  reservationUrlFromEvidence,
} from "@/lib/search/reservation-url";
import { mapAggregatorResult } from "@/lib/search/agents/aggregator";
import { createFallbackItinerary } from "@/lib/search/fallback-itinerary";
import { summarizeBudget } from "@/lib/trips/budget";
import type { SearchPlan, TransportResult, TripDay } from "@faroway/types";

describe("Multi-Partner Affiliate Deep-Link & Essentials Engine", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("never fabricates credentials when env vars are unset and passes allowlist on all non-null URLs", () => {
    const essentials = buildTripEssentials({
      destination: "Tokyo, Japan",
      startDate: "2026-07-01",
      endDate: "2026-07-07",
    });

    // SafetyWing must return url: null when neither SAFETYWING_REFERENCE_ID nor TRAVELPAYOUTS_MARKER is set
    expect(essentials.insurance.url).toBeNull();
    expect(essentials.insurance.configured).toBe(false);

    for (const item of [
      essentials.esim,
      essentials.carRental,
      essentials.visa,
      essentials.fx,
    ]) {
      expect(item.configured).toBe(false);
      expect(item.url).toBeTruthy();
      expect(isAllowedAffiliateUrl(item.url!)).toBe(true);
    }

    // Tiqets is not in ALLOWED_AFFILIATE_DOMAINS directly, so it stays null without Travelpayouts
    const tiqetsUnconfigured = buildTiqetsActivitySearchUrl({
      destination: "Rome",
    });
    expect(tiqetsUnconfigured.url).toBeNull();
    expect(tiqetsUnconfigured.configured).toBe(false);

    // Stay22 requires STAY22_AID
    expect(buildStay22Url({ destination: "Paris" }).url).toBeNull();
    // Viator search requires VIATOR_CONTENT_ENABLED + approval + pid + mcid
    expect(buildViatorSearchUrl({ destination: "Tokyo" })).toBeNull();
  });

  it("builds configured links with partner params preserved across injectAffiliateSubId", () => {
    vi.stubEnv("STAY22_AID", "stay22_prod");
    vi.stubEnv("BOOKING_AFFILIATE_ID", "987654");
    vi.stubEnv("EXPEDIA_AFFCID", "exp_aff");
    vi.stubEnv("HOSTELWORLD_AFFILIATE_ID", "hw_src");
    vi.stubEnv("TRAVELPAYOUTS_MARKER", "tp_mark_1");
    vi.stubEnv("TRAVELPAYOUTS_TRS", "12345");
    vi.stubEnv("SAFETYWING_REFERENCE_ID", "sw_ref_1");
    vi.stubEnv("AIRALO_AFFILIATE_ID", "air_ref_1");
    vi.stubEnv("DISCOVERCARS_AFFILIATE_ID", "dc_aid_1");
    vi.stubEnv("IVISA_AFFILIATE_ID", "iv_aff_1");
    vi.stubEnv("WISE_IR_CLICK_ID", "wise_ir_1");
    vi.stubEnv("KLOOK_AFFILIATE_ID", "klook_1");
    vi.stubEnv("SKYSCANNER_ASSOCIATE_ID", "sky_1");
    vi.stubEnv("GETYOURGUIDE_PARTNER_ID", "gyg_1");
    vi.stubEnv("VIATOR_CONTENT_ENABLED", "true");
    vi.stubEnv("VIATOR_CONTENT_APPROVAL_REF", "approved-ref");
    vi.stubEnv("VIATOR_PARTNER_ID", "P001234");
    vi.stubEnv("VIATOR_MCID", "42383");
    vi.stubEnv("OPENTABLE_AFFILIATE_ID", "ot_aid_1");

    const hotelLinks = buildHotelPartnerLinks({
      hotelName: "Park Hyatt",
      destination: "Tokyo",
      checkIn: "2026-07-01",
      checkOut: "2026-07-05",
      adults: 2,
      rooms: 1,
      lat: 35.685,
      lng: 139.69,
    });
    expect(hotelLinks.primary?.partner).toBe("stay22");
    expect(hotelLinks.primary?.url).toContain("aid=stay22_prod");
    expect(hotelLinks.liteapiLiveCheckoutEnabled).toBe(false);

    const budgetHotels = buildHotelPartnerLinks({
      destination: "Bangkok",
      budgetTier: "budget",
    });
    expect(budgetHotels.primary?.partner).toBe("hostelworld");

    const stay22 = buildStay22Url({ destination: "Paris" });
    const booking = buildBookingUrl({ destination: "Paris" });
    const expedia = buildExpediaHotelUrl({ destination: "Paris" });
    const hostelworld = buildHostelworldUrl({ destination: "Paris" });
    const tp = buildTravelpayoutsLink({
      targetUrl: "https://www.klook.com/search/",
      programId: "4110",
    });
    const sw = buildSafetyWingUrl({ destination: "Paris" });
    const airalo = buildAiraloUrl({ countryOrDestination: "Tokyo, Japan" });
    const dc = buildDiscoverCarsUrl({
      destination: "Lisbon",
      startDate: "2026-07-01",
      endDate: "2026-07-05",
    });
    const visa = buildVisaToolUrl({
      nationality: "US",
      destinationCountry: "Vietnam",
    });
    const wise = buildWiseUrl({ destination: "Tokyo, Japan" });
    const klook = buildKlookActivitySearchUrl({ destination: "Kyoto" });
    const tiqets = buildTiqetsActivitySearchUrl({ destination: "Rome" });
    const sky = buildSkyscannerFlightUrl({
      originAirport: "SFO",
      destinationAirport: "NRT",
      departureDate: "2026-07-01",
      returnDate: "2026-07-10",
      adults: 2,
    });
    const avia = buildAviasalesFlightUrl({
      originAirport: "SFO",
      destinationAirport: "NRT",
      departureDate: "2026-07-01",
      returnDate: "2026-07-10",
      adults: 2,
    });
    const gygSearch = buildGYGSearchUrl({
      destination: "Rome",
      query: "Colosseum",
      startDate: "2026-07-01",
      endDate: "2026-07-03",
      trackingId: "track-1",
    });
    const viatorSearch = buildViatorSearchUrl({
      destination: "Porto",
      startDate: "2026-07-01",
      campaign: "camp-1",
    });
    const activityFallbacks = buildActivityFallbackLinks({
      destination: "Rome",
      activityName: "Colosseum",
      date: "2026-07-01",
    });
    const flightFallbacks = buildFlightFallbackLinks({
      originAirport: "SFO",
      destinationAirport: "NRT",
      departureDate: "2026-07-01",
    });
    const openTableRid = reservationUrlFromEvidence(undefined, {
      kind: "opentable_rid",
      restaurantId: "123456",
    });
    const openTableSearch = buildOpenTableSearchUrl({
      restaurantName: "Narisawa",
      destination: "Tokyo",
      date: "2026-07-02",
      partySize: 2,
    });
    const diningLinks = buildDiningPartnerLinks({
      restaurantName: "Narisawa",
      destination: "Tokyo",
      tripadvisorUrl: "https://www.tripadvisor.com/Restaurant_Review-d123.html",
    });

    expect(airalo.url).toContain("japan-esim");
    expect(airalo.url).toContain("ref=air_ref_1");
    expect(sw.url).toContain("referenceID=sw_ref_1");
    expect(dc.url).toContain("a_aid=dc_aid_1");
    expect(visa.url).toContain("affid=iv_aff_1");
    expect(wise.url).toContain("usd-to-jpy-rate");
    expect(wise.url).toContain("irclickid=wise_ir_1");
    expect(tiqets.partner).toBe("travelpayouts");
    expect(tiqets.url).toContain("tp.media/r");
    expect(sky.url).toContain("/transport/flights/sfo/nrt/260701/260710/");
    expect(avia.url).toContain("tp.media/r");
    expect(viatorSearch).toContain("pid=P001234");
    expect(viatorSearch).toContain("mcid=42383");
    expect(activityFallbacks.length).toBe(4);
    expect(flightFallbacks.length).toBe(2);
    expect(openTableRid).toContain("aid=ot_aid_1");
    expect(openTableSearch.url).toContain("aid=ot_aid_1");
    expect(diningLinks.map((d) => d.partner)).toEqual([
      "opentable",
      "tripadvisor",
    ]);

    const allLinks = [
      stay22,
      booking,
      expedia,
      hostelworld,
      tp,
      sw,
      airalo,
      dc,
      visa,
      wise,
      klook,
      tiqets,
      sky,
      avia,
      gygSearch,
      openTableSearch,
    ];
    for (const link of allLinks) {
      expect(link.url).toBeTruthy();
      expect(isAllowedAffiliateUrl(link.url!)).toBe(true);
      const tracked = injectAffiliateSubId(
        link.url!,
        link.partner,
        "click-uuid-1",
      );
      expect(tracked).toBeTruthy();
      if (link.partner === "safetywing") {
        expect(tracked).toContain("referenceID=sw_ref_1");
        expect(tracked).toContain("click_id=click-uuid-1");
      }
      if (link.partner === "travelpayouts") {
        expect(tracked).toContain("marker=tp_mark_1");
        expect(tracked).toContain("sub_id=click-uuid-1");
      }
    }
  });

  it("supports Duffel trip-scoped return URLs, return slice parsing, and budget deduplication", async () => {
    vi.stubEnv("DUFFEL_API_TOKEN", "duffel_test_token");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.faroway.ai");

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: {
            offers: [
              {
                id: "off_rt_1",
                total_amount: "950.00",
                total_currency: "USD",
                expires_at: "2099-06-01T00:00:00Z",
                slices: [
                  {
                    duration: "PT11H",
                    segments: [
                      {
                        marketing_carrier: { iata_code: "JL", name: "JAL" },
                        marketing_carrier_flight_number: "1",
                        origin: {
                          iata_code: "SFO",
                          city_name: "San Francisco",
                        },
                        destination: { iata_code: "HND", city_name: "Tokyo" },
                        departing_at: "2026-07-01T12:00:00Z",
                        arriving_at: "2026-07-02T15:00:00Z",
                        duration: "PT11H",
                      },
                    ],
                  },
                  {
                    duration: "PT10H",
                    segments: [
                      {
                        marketing_carrier: { iata_code: "JL", name: "JAL" },
                        marketing_carrier_flight_number: "2",
                        origin: { iata_code: "HND", city_name: "Tokyo" },
                        destination: {
                          iata_code: "SFO",
                          city_name: "San Francisco",
                        },
                        departing_at: "2026-07-07T16:00:00Z",
                        arriving_at: "2026-07-07T10:00:00Z",
                        duration: "PT10H",
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

    const offers = await searchDuffelFlights({
      origin: "SFO",
      destination: "HND",
      departureDate: "2026-07-01",
      returnDate: "2026-07-07",
      passengers: [{ type: "adult", count: 1 }],
    });
    expect(offers[0]?.returnLeg?.departure.airport).toBe("HND");
    expect(offers[0]?.returnLeg?.arrival.airport).toBe("SFO");

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: { url: "https://links.duffel.com/s1" } }),
        { status: 200 },
      ),
    );
    await generateDuffelLink("off_rt_1", 5, "USD", {
      tripId: "trip-abc-123",
      clickId: "clk-777",
    });
    const sent = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(sent.data.success_url).toBe(
      "https://www.faroway.ai/trips/trip-abc-123?duffel=success&click_id=clk-777",
    );
    expect(sent.data.reference).toBe("clk-777");
    expect(parseDuffelReturnStatus("success")).toBe("success");
    expect(parseDuffelReturnStatus("bad")).toBeNull();

    const outbound: TransportResult = {
      id: "transport_duffel_off_rt_1",
      type: "flight",
      provider: "JAL",
      departure: {
        airport: "SFO",
        city: "San Francisco",
        dateTime: "2026-07-01T12:00:00Z",
      },
      arrival: {
        airport: "HND",
        city: "Tokyo",
        dateTime: "2026-07-02T15:00:00Z",
      },
      duration: 660,
      stops: 0,
      price: 950,
      currency: "USD",
      expiresAt: "2099-06-01T00:00:00Z",
      airlines: ["JAL"],
      segments: [],
      affiliateUrl: "https://links.duffel.com/s1",
      affiliatePartner: "duffel",
      source: "duffel",
      vibeScore: 0,
      vibeMatch: [],
    };
    const ret: TransportResult = {
      ...outbound,
      id: "transport_duffel_off_rt_1__return",
      departure: {
        airport: "HND",
        city: "Tokyo",
        dateTime: "2026-07-07T16:00:00Z",
      },
      arrival: {
        airport: "SFO",
        city: "San Francisco",
        dateTime: "2026-07-07T10:00:00Z",
      },
    };

    const plan = {
      destination: "Tokyo",
      country: "Japan",
      dates: { start: "2026-07-01", end: "2026-07-02", nights: 1 },
      searchPriorities: ["hotels", "activities", "dining", "transport"],
      hotelCriteria: {
        priceRange: { min: 100, max: 300 },
        starRating: [4],
        amenities: [],
        neighborhoods: [],
      },
      activityCriteria: {
        categories: [],
        pacePreference: "moderate",
        mustSee: [],
        interests: [],
      },
      diningCriteria: {
        cuisineTypes: [],
        priceRange: "moderate",
        dietaryNeeds: [],
        mealPriorities: ["dinner"],
      },
      vibeInterpretation: {
        vibes: [],
        searchKeywords: [],
        avoidKeywords: [],
      },
    } satisfies SearchPlan;

    const fallback = createFallbackItinerary(plan, [], [], [], [outbound, ret]);
    expect(fallback.days[0].transport?.id).toBe("transport_duffel_off_rt_1");
    expect(fallback.days[1].transport?.id).toBe(
      "transport_duffel_off_rt_1__return",
    );

    const agg = mapAggregatorResult(
      {
        days: [
          {
            dayNumber: 1,
            date: "2026-07-01",
            title: "Day 1",
            summary: "Arrive",
            morning: { activityIds: [] },
            afternoon: { activityIds: [] },
            evening: { activityIds: [] },
            transportId: outbound.id,
            tips: [],
          },
          {
            dayNumber: 2,
            date: "2026-07-02",
            title: "Day 2",
            summary: "Depart",
            morning: { activityIds: [] },
            afternoon: { activityIds: [] },
            evening: { activityIds: [] },
            tips: [],
          },
        ],
      },
      "2026-07-01",
      [],
      [],
      [],
      [outbound, ret],
    );
    expect(agg.days[0].transport?.id).toBe(outbound.id);
    expect(agg.days[1].transport?.id).toBe(ret.id);

    // Budget must count round-trip fare ONCE, not double-count Day 1 + Day 2
    const budget = summarizeBudget(
      agg.days as unknown as TripDay[],
      null,
      1,
      Date.parse("2026-06-01T00:00:00Z"),
    );
    expect(budget.groups).toEqual([
      {
        currency: "USD",
        accommodation: 0,
        activities: 0,
        dining: 0,
        transport: 950,
        total: 950,
      },
    ]);
    expect(budget.unknownItems).toBe(0);
  });

  it("uses Viator /search/freetext fallback for unmapped destinations when configured", async () => {
    vi.stubEnv("VIATOR_API_KEY", "test-key");
    vi.stubEnv("VIATOR_PARTNER_ID", "P123");
    vi.stubEnv("VIATOR_CONTENT_ENABLED", "true");
    vi.stubEnv("VIATOR_CONTENT_APPROVAL_REF", "ref-1");

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ destinations: { results: [{ id: 25662 }] } }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            products: [
              {
                productCode: "999P1",
                title: "Chiang Rai White Temple Tour",
                productUrl:
                  "https://www.viator.com/tours/Chiang-Rai/White-Temple/d25662-999P1?pid=P123&mcid=42383&medium=api",
              },
            ],
          }),
          { status: 200 },
        ),
      );

    const results = await searchViatorProducts({
      destination: "Chiang Rai, Thailand",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/search/freetext");
    expect(results[0]?.productCode).toBe("999P1");
  });

  it("counts distinct flight IDs sharing fallback affiliateUrl and price while deduplicating __return legs", () => {
    const day1Transport = {
      id: "flight_a",
      type: "flight" as const,
      provider: "Skyscanner",
      departure: {
        airport: "SFO",
        city: "SF",
        dateTime: "2026-07-01T10:00:00Z",
      },
      arrival: {
        airport: "NRT",
        city: "Tokyo",
        dateTime: "2026-07-02T14:00:00Z",
      },
      duration: 600,
      stops: 0,
      price: 300,
      currency: "USD",
      affiliatePartner: "skyscanner",
      affiliateUrl: "https://www.skyscanner.com/flights",
    };
    const day5DistinctFlight = {
      ...day1Transport,
      id: "flight_b",
    };
    const day6ReturnLeg = {
      ...day1Transport,
      id: "flight_a__return",
    };

    const makeDay = (dayNumber: number, transport: typeof day1Transport) =>
      ({
        dayNumber,
        date: `2026-07-0${dayNumber}`,
        title: `Day ${dayNumber}`,
        summary: "Travel",
        morning: { activities: [], meals: [] },
        afternoon: { activities: [], meals: [] },
        evening: { activities: [], meals: [] },
        transport,
        tips: [],
      }) as unknown as TripDay;

    const budget = summarizeBudget(
      [
        makeDay(1, day1Transport),
        makeDay(5, day5DistinctFlight),
        makeDay(6, day6ReturnLeg),
      ],
      null,
      1,
      Date.parse("2026-06-01T00:00:00Z"),
    );

    expect(budget.groups).toEqual([
      {
        currency: "USD",
        accommodation: 0,
        activities: 0,
        dining: 0,
        transport: 600,
        total: 600,
      },
    ]);
  });

  it("guards non-finite markupAmount in generateDuffelLink instead of sending NaN or Infinity", async () => {
    vi.stubEnv("DUFFEL_API_TOKEN", "duffel_test_token");
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(
        async () =>
          new Response(
            JSON.stringify({ data: { url: "https://links.duffel.com/s_ok" } }),
            { status: 200 },
          ),
      );

    await generateDuffelLink("off_1", Number.NaN, "USD");
    await generateDuffelLink("off_1", Number.POSITIVE_INFINITY, "USD");
    await generateDuffelLink("off_1", Number.NEGATIVE_INFINITY, "USD");

    for (const call of fetchMock.mock.calls) {
      const sent = JSON.parse(String(call[1]?.body));
      expect(sent.data.markup_amount).toBe("5.00");
    }
  });

  it("disambiguates homonymous US/Canadian/Australian cities and subregions in resolveDestinationTravelMeta", () => {
    expect(resolveDestinationTravelMeta("Paris, Texas")).toMatchObject({
      iso2: "US",
      currency: "USD",
    });
    expect(resolveDestinationTravelMeta("Paris, TX")).toMatchObject({
      iso2: "US",
      currency: "USD",
    });
    expect(
      resolveDestinationTravelMeta("London, Ontario, Canada"),
    ).toMatchObject({
      iso2: "CA",
      currency: "CAD",
    });
    expect(resolveDestinationTravelMeta("London, Ontario, CA")).toMatchObject({
      iso2: "CA",
      currency: "CAD",
    });
    expect(resolveDestinationTravelMeta("Ontario, California")).toMatchObject({
      iso2: "US",
      currency: "USD",
    });
    expect(resolveDestinationTravelMeta("Ontario, CA")).toMatchObject({
      iso2: "US",
      currency: "USD",
    });
    expect(resolveDestinationTravelMeta("Paris, France")).toMatchObject({
      iso2: "FR",
      currency: "EUR",
    });
    expect(resolveDestinationTravelMeta("Paris")).toMatchObject({
      iso2: "FR",
      currency: "EUR",
    });
    expect(resolveDestinationTravelMeta("Georgia")).toMatchObject({
      iso2: "US",
      currency: "USD",
    });
    expect(resolveDestinationTravelMeta("Atlanta, Georgia")).toMatchObject({
      iso2: "US",
      currency: "USD",
    });
    expect(resolveDestinationTravelMeta("Atlanta, GA")).toMatchObject({
      iso2: "US",
      currency: "USD",
    });
    expect(resolveDestinationTravelMeta("Paris, Ontario")).toMatchObject({
      iso2: "CA",
      currency: "CAD",
    });
    expect(resolveDestinationTravelMeta("Paris, Ontario, CA")).toMatchObject({
      iso2: "CA",
      currency: "CAD",
    });
    expect(resolveDestinationTravelMeta("Tokyo, Japan")).toMatchObject({
      iso2: "JP",
      currency: "JPY",
    });
    expect(resolveDestinationTravelMeta("Tokyo")).toMatchObject({
      iso2: "JP",
      currency: "JPY",
    });

    // 1. New Mexico must resolve to US, while explicit Mexico suffixes stay MX
    for (const usNewMexico of [
      "Santa Fe, New Mexico",
      "Albuquerque, New Mexico",
      "New Mexico",
      "Boston, New England",
      "New England",
      "New England, USA",
    ]) {
      expect(resolveDestinationTravelMeta(usNewMexico)).toMatchObject({
        iso2: "US",
        airaloSlug: "united-states-esim",
        currency: "USD",
      });
    }
    expect(resolveDestinationTravelMeta("New Mexico, Mexico")).toMatchObject({
      iso2: "MX",
      airaloSlug: "mexico-esim",
      currency: "MXN",
    });
    expect(resolveDestinationTravelMeta("Mexico City, Mexico")).toMatchObject({
      iso2: "MX",
      airaloSlug: "mexico-esim",
      currency: "MXN",
    });

    const santaFeEssentials = buildTripEssentials({
      destination: "Santa Fe, New Mexico",
      sourceCurrency: "USD",
    });
    expect(santaFeEssentials.esim.url).toBe(
      "https://www.airalo.com/united-states-esim",
    );
    expect(santaFeEssentials.visa.url).toBe(
      "https://www.ivisa.com/apply-online?destination=United+States",
    );
    expect(santaFeEssentials.fx.url).toBe("https://wise.com/us/travel-money/");

    // 2. US cities named after countries + explicit US state must resolve to US
    for (const usCountryHomonymCity of [
      "Mexico, Missouri",
      "Norway, Maine",
      "Sweden, Maine",
      "Denmark, South Carolina",
      "Peru, Illinois",
      "Brazil, Indiana",
    ]) {
      expect(resolveDestinationTravelMeta(usCountryHomonymCity)).toMatchObject({
        iso2: "US",
        airaloSlug: "united-states-esim",
        currency: "USD",
      });
    }

    // 3. Canadian province codes NL / PE resolve to CA while standalone NL / PE stay NL / PE
    expect(resolveDestinationTravelMeta("St. John's, NL")).toMatchObject({
      iso2: "CA",
      airaloSlug: "canada-esim",
      currency: "CAD",
    });
    expect(resolveDestinationTravelMeta("Charlottetown, PE")).toMatchObject({
      iso2: "CA",
      airaloSlug: "canada-esim",
      currency: "CAD",
    });
    expect(resolveDestinationTravelMeta("NL")).toMatchObject({
      iso2: "NL",
      currency: "EUR",
    });
    expect(resolveDestinationTravelMeta("PE")).toMatchObject({
      iso2: "PE",
      currency: "PEN",
    });

    // 4. Australian subregions (including New South Wales) resolve to AU, not GB, while Wales/England stay GB
    expect(
      resolveDestinationTravelMeta("Sydney, New South Wales"),
    ).toMatchObject({
      iso2: "AU",
      airaloSlug: "australia-esim",
      currency: "AUD",
    });
    expect(resolveDestinationTravelMeta("New South Wales")).toMatchObject({
      iso2: "AU",
      airaloSlug: "australia-esim",
      currency: "AUD",
    });
    expect(
      resolveDestinationTravelMeta("Sydney, New South Wales, Australia"),
    ).toMatchObject({
      iso2: "AU",
      airaloSlug: "australia-esim",
      currency: "AUD",
    });
    expect(resolveDestinationTravelMeta("Cardiff, Wales")).toMatchObject({
      iso2: "GB",
      airaloSlug: "united-kingdom-esim",
      currency: "GBP",
    });
    expect(resolveDestinationTravelMeta("London, England")).toMatchObject({
      iso2: "GB",
      airaloSlug: "united-kingdom-esim",
      currency: "GBP",
    });
    expect(resolveDestinationTravelMeta("Victoria, BC")).toMatchObject({
      iso2: "CA",
      airaloSlug: "canada-esim",
      currency: "CAD",
    });
    expect(resolveDestinationTravelMeta("Melbourne, Victoria")).toMatchObject({
      iso2: "AU",
      airaloSlug: "australia-esim",
      currency: "AUD",
    });

    // 5. "<City>, <CanadianProvinceAbbr>, CA" must resolve to Canada, not California ("ca"),
    // while "<City>, CA" ("Ontario, CA", "Los Angeles, CA") and explicit US suffixes stay US
    for (const canadianCityProvCa of [
      "London, ON, CA",
      "Toronto, ON, CA",
      "Vancouver, BC, CA",
      "Montreal, QC, CA",
      "St. John's, NL, CA",
      "Charlottetown, PE, CA",
      "Halifax, NS, CA",
    ]) {
      expect(resolveDestinationTravelMeta(canadianCityProvCa)).toMatchObject({
        iso2: "CA",
        airaloSlug: "canada-esim",
        currency: "CAD",
      });
    }

    const torontoEssentials = buildTripEssentials({
      destination: "Toronto, ON, CA",
      sourceCurrency: "USD",
    });
    expect(torontoEssentials.esim.url).toBe(
      "https://www.airalo.com/canada-esim",
    );
    expect(torontoEssentials.visa.url).toBe(
      "https://www.ivisa.com/apply-online?destination=Canada",
    );
    expect(torontoEssentials.fx.url).toBe(
      "https://wise.com/us/currency-converter/usd-to-cad-rate?source=USD&target=CAD",
    );

    for (const usCaDisambig of [
      "Ontario, CA",
      "Los Angeles, CA",
      "Los Angeles, CA, US",
      "Los Angeles, CA, USA",
      "Ontario, CA, US",
      "Portland, ME, US",
      "Austin, TX, US",
    ]) {
      expect(resolveDestinationTravelMeta(usCaDisambig)).toMatchObject({
        iso2: "US",
        airaloSlug: "united-states-esim",
        currency: "USD",
      });
    }

    // 6. Space-separated North American postal/ZIP multi-segment disambiguation
    for (const canadianPostalDest of [
      "Toronto, ON M5V 2T6, CA",
      "London, ON N6A 3K7, CA",
      "Montreal, QC H2Y 1C6, CA",
      "Vancouver, BC V6B 1A1, CA",
      "Calgary, AB T2P 1J9, CA",
      "Toronto, ON M5V2T6, CA",
      "London, ON N6A 3K7",
      "Victoria, BC V8W 1P6",
    ]) {
      expect(resolveDestinationTravelMeta(canadianPostalDest)).toMatchObject({
        iso2: "CA",
        airaloSlug: "canada-esim",
        currency: "CAD",
      });
    }

    const torontoPostalEssentials = buildTripEssentials({
      destination: "Toronto, ON M5V 2T6, CA",
      sourceCurrency: "USD",
    });
    expect(torontoPostalEssentials.esim.url).toBe(
      "https://www.airalo.com/canada-esim",
    );
    expect(torontoPostalEssentials.visa.url).toBe(
      "https://www.ivisa.com/apply-online?destination=Canada",
    );
    expect(torontoPostalEssentials.fx.url).toBe(
      "https://wise.com/us/currency-converter/usd-to-cad-rate?source=USD&target=CAD",
    );

    for (const usZipDest of [
      "Ontario, CA 91764",
      "Paris, TX 75460",
      "Los Angeles, CA 90001",
      "Los Angeles, CA 90001-1234",
      "New Brunswick, NJ 08901",
    ]) {
      expect(resolveDestinationTravelMeta(usZipDest)).toMatchObject({
        iso2: "US",
        airaloSlug: "united-states-esim",
        currency: "USD",
      });
    }

    const ontarioCaZipEssentials = buildTripEssentials({
      destination: "Ontario, CA 91764",
      sourceCurrency: "USD",
    });
    expect(ontarioCaZipEssentials.esim.url).toBe(
      "https://www.airalo.com/united-states-esim",
    );
    expect(ontarioCaZipEssentials.visa.url).toBe(
      "https://www.ivisa.com/apply-online?destination=United+States",
    );
    expect(ontarioCaZipEssentials.fx.url).toBe(
      "https://wise.com/us/travel-money/",
    );

    // Non-postal phrases starting with 2-letter tokens (e.g. "la", "on", "in") must not false-match
    for (const nonPostalPhrase of ["Paris, la Défense", "Paris, in 2026"]) {
      expect(resolveDestinationTravelMeta(nonPostalPhrase)).toMatchObject({
        iso2: "FR",
        airaloSlug: "france-esim",
        currency: "EUR",
      });
    }
    expect(resolveDestinationTravelMeta("London, on the Thames")).toBeNull();
    expect(
      resolveDestinationTravelMeta("London, on the Thames, UK"),
    ).toMatchObject({
      iso2: "GB",
      airaloSlug: "united-kingdom-esim",
      currency: "GBP",
    });
    expect(resolveDestinationTravelMeta("New York, in 2026")).toMatchObject({
      iso2: "US",
      airaloSlug: "united-states-esim",
      currency: "USD",
    });
  });

  it("rejects impossible calendar dates in buildGYGAffiliateUrl and omits inverted end/return dates across builders", () => {
    vi.stubEnv("VIATOR_CONTENT_ENABLED", "true");
    vi.stubEnv("VIATOR_CONTENT_APPROVAL_REF", "approved-ref");
    vi.stubEnv("VIATOR_PARTNER_ID", "P001234");
    vi.stubEnv("VIATOR_MCID", "42383");
    vi.stubEnv("TRAVELPAYOUTS_MARKER", "tp_mark_1");
    vi.stubEnv("TRAVELPAYOUTS_TRS", "12345");
    vi.stubEnv("SKYSCANNER_ASSOCIATE_ID", "sky-assoc");

    const gygInvalidDate = buildGYGAffiliateUrl(
      "12345",
      "camp-1",
      "GYG123",
      "2026-02-30",
    );
    expect(gygInvalidDate).toBe(
      "https://www.getyourguide.com/activity-t12345/?partner_id=GYG123&cmp=camp-1",
    );

    const skyInverted = buildSkyscannerFlightUrl({
      originAirport: "SFO",
      destinationAirport: "NRT",
      departureDate: "2026-06-10",
      returnDate: "2026-06-05",
      adults: 2,
    });
    expect(skyInverted.url).toContain("/transport/flights/sfo/nrt/260610/");
    expect(skyInverted.url).not.toContain("260605");

    const aviaInverted = buildAviasalesFlightUrl({
      originAirport: "SFO",
      destinationAirport: "NRT",
      departureDate: "2026-06-10",
      returnDate: "2026-06-05",
      adults: 2,
    });
    const aviaTarget = new URL(aviaInverted.url!).searchParams.get("u") ?? "";
    expect(aviaTarget).toBe("https://www.aviasales.com/search/SFO1006NRT2");

    const dcInverted = buildDiscoverCarsUrl({
      destination: "Tokyo",
      startDate: "2026-06-10",
      endDate: "2026-06-05",
    });
    const dcTarget = new URL(dcInverted.url!).searchParams.get("u") ?? "";
    expect(dcTarget).toContain("from=2026-06-10");
    expect(dcTarget).not.toContain("to=2026-06-05");

    const gygInverted = buildGYGSearchUrl({
      destination: "Tokyo",
      startDate: "2026-06-10",
      endDate: "2026-06-05",
    });
    expect(gygInverted.url).toContain("date_from=2026-06-10");
    expect(gygInverted.url).not.toContain("date_to=2026-06-05");

    const viatorInverted = buildViatorSearchUrl({
      destination: "Tokyo",
      startDate: "2026-06-10",
      endDate: "2026-06-05",
    });
    expect(viatorInverted).toContain("startDate=2026-06-10");
    expect(viatorInverted).not.toContain("endDate=2026-06-05");
  });

  it("covers Travelpayouts fallbacks (Hotellook p=4115, Klook p=4110, SafetyWing) and Stay22/Booking sanitizers", () => {
    vi.stubEnv("TRAVELPAYOUTS_MARKER", "999999");

    const hotelFallback = buildHotelPartnerLinks({
      destination: "Tokyo",
      campaign: "camp-tp-hotel",
    });
    expect(hotelFallback.primary?.partner).toBe("travelpayouts");
    expect(hotelFallback.primary?.configured).toBe(true);
    expect(hotelFallback.primary?.url).toContain("marker=999999");
    expect(hotelFallback.primary?.url).toContain("p=4115");

    const bookingStrict = buildBookingUrl(
      { destination: "Tokyo" },
      { allowDirectSearchFallback: false },
    );
    expect(bookingStrict).toMatchObject({
      partner: "booking",
      url: null,
      configured: false,
    });

    vi.stubEnv("STAY22_AID", "stay22-test");
    const stay22Sanitized = buildStay22Url({
      destination: "Tokyo",
      lat: 0,
      lng: 0,
      checkIn: "2026-07-10",
      checkOut: "2026-07-05",
    });
    expect(stay22Sanitized.url).toBeTruthy();
    const stay22Parsed = new URL(stay22Sanitized.url!);
    expect(stay22Parsed.searchParams.has("lat")).toBe(false);
    expect(stay22Parsed.searchParams.has("lng")).toBe(false);
    expect(stay22Parsed.searchParams.get("checkin")).toBe("2026-07-10");
    expect(stay22Parsed.searchParams.has("checkout")).toBe(false);

    const klookFallback = buildKlookActivitySearchUrl({
      destination: "Tokyo",
      query: "Tokyo Tower",
      trackingId: "clk-klk",
    });
    expect(klookFallback.partner).toBe("travelpayouts");
    expect(klookFallback.configured).toBe(true);
    expect(klookFallback.url).toContain("marker=999999");
    expect(klookFallback.url).toContain("p=4110");

    const safetyWingFallback = buildSafetyWingUrl({
      destination: "Japan",
      trackingId: "clk-sw",
    });
    expect(safetyWingFallback.partner).toBe("travelpayouts");
    expect(safetyWingFallback.configured).toBe(true);
    expect(safetyWingFallback.url).toContain("marker=999999");
    expect(safetyWingFallback.url).toContain("safetywing.com");
  });

  it("sanitizes path traversal tripId and clamps negative markupAmount in generateDuffelLink", async () => {
    vi.stubEnv("DUFFEL_API_TOKEN", "duffel_test_token");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://www.faroway.ai");

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: { url: "https://links.duffel.com/s_guard" } }),
          { status: 200 },
        ),
      );

    const link = await generateDuffelLink("off_1", -10, "USD", {
      tripId: "../admin",
      clickId: "clk-guard",
    });
    expect(link).toBe("https://links.duffel.com/s_guard");
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(sent.data.markup_amount).toBe("0.00");
    expect(sent.data.success_url).toBe(
      "https://www.faroway.ai/dashboard?duffel=success&click_id=clk-guard",
    );
    expect(sent.data.failure_url).toBe(
      "https://www.faroway.ai/dashboard?duffel=failure&click_id=clk-guard",
    );
    expect(sent.data.abandonment_url).toBe(
      "https://www.faroway.ai/dashboard?duffel=abandoned&click_id=clk-guard",
    );
  });

  it("falls back to Viator PRODUCTS freetext search on empty or non-200 DESTINATIONS and marks catalogOnly when dated", async () => {
    vi.stubEnv("VIATOR_API_KEY", "test-key");
    vi.stubEnv("VIATOR_PARTNER_ID", "P123");
    vi.stubEnv("VIATOR_CONTENT_ENABLED", "true");
    vi.stubEnv("VIATOR_CONTENT_APPROVAL_REF", "ref-1");

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      // Case 1: empty DESTINATIONS -> PRODUCTS freetext with dates -> catalogOnly: true
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ destinations: { results: [] } }), {
          status: 200,
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            products: {
              results: [
                {
                  productCode: "FT100",
                  title: "Freetext Fallback Tour",
                  productUrl:
                    "https://www.viator.com/tours/Chiang-Rai/Tour/d1-FT100?pid=P123&mcid=42383&medium=api",
                },
              ],
            },
          }),
          { status: 200 },
        ),
      )
      // Case 2: non-200 DESTINATIONS -> PRODUCTS freetext without dates -> no catalogOnly
      .mockResolvedValueOnce(new Response("upstream error", { status: 500 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            products: {
              results: [
                {
                  productCode: "FT200",
                  title: "Undated Freetext Tour",
                  productUrl:
                    "https://www.viator.com/tours/Chiang-Rai/Tour/d1-FT200?pid=P123&mcid=42383&medium=api",
                },
              ],
            },
          }),
          { status: 200 },
        ),
      );

    const datedResults = await searchViatorProducts({
      destination: "Unknown Hamlet",
      startDate: "2026-08-01",
      endDate: "2026-08-03",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(datedResults).toHaveLength(1);
    expect(datedResults[0]).toMatchObject({
      productCode: "FT100",
      catalogOnly: true,
    });

    const undatedResults = await searchViatorProducts({
      destination: "Unknown Hamlet",
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(undatedResults).toHaveLength(1);
    expect(undatedResults[0]?.productCode).toBe("FT200");
    expect(undatedResults[0]?.catalogOnly).toBeUndefined();
  });
});
