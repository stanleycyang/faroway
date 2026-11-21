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
});
