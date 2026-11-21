import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AFFILIATE_DISCLOSURE_SHORT } from "@faroway/constants";
import {
  ActivityCard,
  RestaurantCard,
  type Activity,
  type Restaurant,
} from "@/components/trips/ActivityCard";
import { FeaturedHotelCard } from "@/components/trips/FeaturedHotelCard";
import { ItineraryDay } from "@/components/trips/ItineraryDay";
import { HotelQuotePanel } from "@/components/trips/HotelQuotePanel";
import { TripCheckout } from "@/components/trips/TripCheckout";
import { AffiliateTrackingProvider } from "@/components/affiliates/AffiliateTrackingContext";

vi.mock("@/hooks/useModalFocusTrap", () => ({
  useModalFocusTrap: () => undefined,
}));
vi.mock("@/lib/affiliates/viator-link", () => ({
  buildViatorHandoffUrl: (url: string) => url,
}));
vi.mock("@/components/trips/ViatorContentPolicy", () => ({
  useViatorContentEnabled: () => true,
}));
vi.mock("@/hooks/useUser", () => ({
  useUser: () => ({
    loading: false,
    session: { user: { id: "owner-1" } },
    accountRevision: 1,
  }),
}));
vi.mock("@/lib/trips/hotel-quotes", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/trips/hotel-quotes")>();
  return {
    ...actual,
    hotelSearchEnabled: () => true,
  };
});
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({
        data: { session: { user: { id: "owner-1" }, access_token: "tok" } },
        error: null,
      }),
    },
  }),
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Itinerary card affiliate CTAs (Feature #13)", () => {
  it("unblocks GetYourGuide bookingUrl in ActivityCard with disclosure and TripCheckout modal handoff", async () => {
    const activity: Activity = {
      id: "activity_gyg_987",
      name: "Tsukiji Market Food Walk",
      description: "Guided tasting tour",
      duration: 180,
      estimatedCost: { amount: 95, currency: "USD" },
      timeOfDay: "morning",
      category: "sightseeing",
      location: { name: "Tsukiji" },
      bookingInfo: {
        requiresReservation: true,
        bookingUrl:
          "https://www.getyourguide.com/tokyo-l193/tsukiji-t987/?partner_id=GYG123",
        affiliateId: "getyourguide",
      },
      tripadvisorRating: 4.9,
      tripadvisorReviewCount: 412,
      tripadvisorUrl:
        "https://www.tripadvisor.com/AttractionProductReview-g1066444-d123.html",
    };

    const html = renderToStaticMarkup(
      <TripCheckout mode="shared" travelers={2}>
        <ActivityCard activity={activity} date="2026-11-01" />
      </TripCheckout>,
    );

    expect(html).toContain("Book on GetYourGuide");
    expect(html).toContain(AFFILIATE_DISCLOSURE_SHORT);
    expect(html).not.toContain("Booking isn’t available in Faroway");
    expect(html).not.toContain("✦");
  });

  it("renders Reserve on OpenTable for allowlisted RestaurantCard URLs and grounded search fallback without raw ⚡", () => {
    const reserved: Restaurant = {
      id: "rest-1",
      name: "Narisawa",
      cuisineType: ["Japanese"],
      priceLevel: 4,
      description: "Innovative seasonal tasting menu",
      estimatedCost: { amount: 220, currency: "USD", perPerson: true },
      mealType: "dinner",
      location: { name: "Minato" },
      dietaryOptions: [],
      reservationInfo: {
        recommended: true,
        url: "https://www.opentable.com/r/narisawa-tokyo",
      },
    };

    const reservedHtml = renderToStaticMarkup(
      <RestaurantCard restaurant={reserved} date="2026-11-01" />,
    );
    expect(reservedHtml).toContain("Reserve on OpenTable");
    expect(reservedHtml).toContain(AFFILIATE_DISCLOSURE_SHORT);
    expect(reservedHtml).not.toContain("Reservations aren’t made in Faroway");

    const recommendedOnly: Restaurant = {
      ...reserved,
      id: "rest-2",
      name: "Sushi Saito",
      reservationInfo: { recommended: true },
    };
    const fallbackHtml = renderToStaticMarkup(
      <AffiliateTrackingProvider
        value={{ destination: "Tokyo", source: "itinerary" }}
      >
        <RestaurantCard restaurant={recommendedOnly} date="2026-11-01" />
      </AffiliateTrackingProvider>,
    );
    expect(fallbackHtml).toContain("Find a table on OpenTable");
    expect(fallbackHtml).toContain("Reservations recommended");
    expect(fallbackHtml).not.toContain("⚡");
  });

  it("renders Stay22 primary + comparison CTAs on FeaturedHotelCard", () => {
    const html = renderToStaticMarkup(
      <AffiliateTrackingProvider
        value={{
          destination: "Kyoto",
          startDate: "2026-11-01",
          endDate: "2026-11-04",
          source: "itinerary",
          hotelPartnerLinks: {
            primary: {
              partner: "stay22",
              label: "Check rates on Stay22",
              vertical: "hotels",
              url: "https://www.stay22.com/allez/roam?aid=test&address=Kyoto",
              configured: true,
              isSearchFallback: true,
              disclosure: AFFILIATE_DISCLOSURE_SHORT,
            },
            alternatives: [
              {
                partner: "booking",
                label: "Check availability on Booking.com",
                vertical: "hotels",
                url: "https://www.booking.com/searchresults.html?ss=Kyoto&aid=123",
                configured: true,
                isSearchFallback: true,
                disclosure: AFFILIATE_DISCLOSURE_SHORT,
              },
            ],
          },
        }}
      >
        <FeaturedHotelCard
          hotel={{
            id: "h-1",
            name: "The Ritz-Carlton Kyoto",
            pricePerNight: 450,
            currency: "USD",
            affiliateUrl:
              "https://www.stay22.com/allez/roam?aid=test&address=Ritz+Kyoto",
            affiliatePartner: "stay22",
          }}
        />
      </AffiliateTrackingProvider>,
    );

    expect(html).toContain("Check rates on Stay22");
    expect(html).toContain("Check availability on Booking.com");
    expect(html).toContain(AFFILIATE_DISCLOSURE_SHORT);
    expect(html).not.toContain("Hotel checkout is not available");
  });

  it("renders Deep Ocean Teal hotel & Duffel return-leg flight CTAs in ItineraryDay without ★ or blue gradients", () => {
    const html = renderToStaticMarkup(
      <AffiliateTrackingProvider
        value={{
          destination: "Tokyo",
          source: "itinerary",
          flightFallbackLinks: [
            {
              partner: "skyscanner",
              label: "Compare flights on Skyscanner",
              vertical: "flights",
              url: "https://www.skyscanner.com/transport/flights/hnd/sfo/261105/",
              configured: true,
              isSearchFallback: true,
              disclosure: AFFILIATE_DISCLOSURE_SHORT,
            },
          ],
        }}
      >
        <ItineraryDay
          dayNumber={5}
          date="2026-11-05"
          title="Departure"
          summary="Head home"
          defaultExpanded={true}
          morning={{ activities: [], meals: [] }}
          afternoon={{ activities: [], meals: [] }}
          evening={{ activities: [], meals: [] }}
          hotel={{
            id: "hotel-5",
            name: "Park Hyatt Tokyo",
            starRating: 5,
            pricePerNight: 500,
            currency: "USD",
            affiliateUrl:
              "https://www.booking.com/searchresults.html?ss=Park+Hyatt+Tokyo",
            affiliatePartner: "booking",
          }}
          transport={{
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...({ id: "transport_duffel_offer123__return" } as any),
            type: "flight",
            provider: "ANA",
            departure: {
              airport: "HND",
              city: "Tokyo",
              dateTime: "2026-11-05T16:00:00+09:00",
            },
            arrival: {
              airport: "SFO",
              city: "San Francisco",
              dateTime: "2026-11-05T09:00:00-08:00",
            },
            duration: 540,
            stops: 0,
            price: 920,
            currency: "USD",
            affiliatePartner: "duffel",
            affiliateUrl: "https://links.duffel.com/offer_123",
            expiresAt: "2020-01-01T00:00:00Z",
          }}
        />
      </AffiliateTrackingProvider>,
    );

    expect(html).toContain("Check rates on Booking.com");
    expect(html).toContain("Review round-trip flight on Duffel");
    expect(html).toContain("Compare flights on Skyscanner");
    expect(html).toContain("saved fare quote may have expired");
    expect(html).toContain(AFFILIATE_DISCLOSURE_SHORT);
    expect(html).toContain("#143D46");
    expect(html).not.toContain("from-blue-");
    expect(html).not.toContain("to-indigo-");
    expect(html).not.toContain("★");
  });

  it("renders live rate comparison CTA on HotelQuotePanel search results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            tripId: "trip-1",
            tripUpdatedAt: "2026-10-01T00:00:00Z",
            observedAt: "2026-10-02T00:00:00Z",
            sandbox: true,
            hotels: [
              {
                id: "lp-1",
                name: "Hotel Century Southern Tower",
                offers: [
                  {
                    id: "off-1",
                    stayAmount: 640,
                    currency: "USD",
                    roomCount: 1,
                    additionalTaxes: [],
                    cancellationNote: "Free cancellation until Oct 28",
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <AffiliateTrackingProvider
            value={{
              destination: "Tokyo",
              source: "itinerary",
              hotelPartnerLinks: {
                primary: {
                  partner: "stay22",
                  label: "Check rates on Stay22",
                  vertical: "hotels",
                  url: "https://www.stay22.com/allez/roam?aid=stay_1&address=Tokyo",
                  configured: true,
                  isSearchFallback: true,
                  disclosure: AFFILIATE_DISCLOSURE_SHORT,
                },
                alternatives: [],
              },
            }}
          >
            <HotelQuotePanel
              trip={{
                id: "trip-1",
                user_id: "owner-1",
                destination: "Tokyo",
                start_date: "2026-11-01",
                end_date: "2026-11-04",
                travelers: 2,
                budget_tier: "moderate",
                status: "completed",
                vibes: [],
                preferences: {
                  hotelSearch: {
                    consentVersion: "hotel-search-nuitee-v1",
                    countryCode: "JP",
                    guestNationality: "US",
                    rooms: [{ adults: 2, children: [] }],
                  },
                },
                created_at: "2026-10-01T00:00:00Z",
                updated_at: "2026-10-01T00:00:00Z",
                is_shared: false,
                share_token: null,
              }}
            />
          </AffiliateTrackingProvider>,
        );
      });

      const searchBtn = renderer.root
        .findAllByType("button")
        .find((b) => b.children.includes("Search hotel options"))!;
      await act(async () => {
        await searchBtn.props.onClick();
      });

      const out = JSON.stringify(renderer.toJSON());
      expect(out).toContain("Hotel Century Southern Tower");
      expect(out).toContain("Check live rates on Stay22");
      expect(out).toContain(AFFILIATE_DISCLOSURE_SHORT);
    } finally {
      await act(async () => renderer?.unmount());
    }
  });
});
