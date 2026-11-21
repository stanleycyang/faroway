import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AFFILIATE_DISCLOSURE_FULL,
  AFFILIATE_DISCLOSURE_SHORT,
} from "@faroway/constants";
import { TripCheckout } from "@/components/trips/TripCheckout";
import { useTripCheckout } from "@/components/trips/TripCheckoutContext";
import {
  BookingsSheet,
  buildTripBookingItems,
} from "@/components/trips/BookingsSheet";
import { BookingChecklist } from "@/components/trips/BookingChecklist";
import type { TripDay } from "@faroway/types";

vi.mock("@/hooks/useModalFocusTrap", () => ({
  useModalFocusTrap: () => undefined,
}));
vi.mock("@/lib/affiliates/viator-link", () => ({
  buildViatorHandoffUrl: (url: string) => url,
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function textOf(node: unknown): string {
  const collect = (value: unknown): string => {
    if (typeof value === "string" || typeof value === "number") {
      return String(value);
    }
    if (Array.isArray(value)) return value.map(collect).join("");
    if (value && typeof value === "object" && "children" in value) {
      return collect((value as { children: unknown }).children);
    }
    return "";
  };
  return collect(node).replace(/\s+/g, " ").trim();
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function SharedViatorTrigger() {
  const checkout = useTripCheckout();
  return (
    <button
      type="button"
      onClick={() =>
        checkout?.review({
          id: "activity_v_ABC123",
          name: "Shared Colosseum Tour",
          date: "2026-11-02",
          mode: "partner_click",
          itemType: "activity",
          partner: "viator",
          partnerLabel: "Viator",
          affiliateUrl:
            "https://www.viator.com/tours/Rome/Colosseum/d511-123?pid=P1&mcid=42383&medium=api",
          price: 75,
          currency: "USD",
          source: "shared_trip",
          placement: "activity_card",
        })
      }
    >
      Book shared Viator
    </button>
  );
}

describe("TripCheckout shared & partner modes (Feature #14 & #15)", () => {
  it("skips GET /api/trips/[id]/checkout in mode='shared', shows 3-row summary, and opens new tab via /api/track/click", async () => {
    const trackedRedirect =
      "https://www.viator.com/tours/Rome/Colosseum/d511-123?pid=P1&mcid=42383&medium=api&campaign=shared-click-1";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        clickId: "shared-click-1",
        partner: "viator",
        redirectUrl: trackedRedirect,
      }),
    });
    const openMock = vi.fn().mockReturnValue({ closed: false });
    const assignMock = vi.fn();

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {
      open: openMock,
      location: { assign: assignMock },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("document", { body: { style: { overflow: "auto" } } });

    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <TripCheckout mode="shared" source="shared_trip" travelers={2}>
            <SharedViatorTrigger />
          </TripCheckout>,
        );
      });

      // Must NOT fetch owner /checkout on mount (prevents 401 on /s/[token])
      expect(fetchMock).not.toHaveBeenCalled();

      await act(async () => {
        renderer.root.findByType("button").props.onClick();
      });

      const dialogText = textOf(renderer.root.findByProps({ role: "dialog" }));
      expect(dialogText).toContain("Your next step, with Viator");
      expect(dialogText).toContain("Shared Colosseum Tour");
      expect(dialogText).toContain("Opens Viator in a new tab");
      expect(dialogText).toContain(AFFILIATE_DISCLOSURE_SHORT);

      const continueBtn = renderer.root
        .findAllByType("button")
        .find((b) => textOf(b).includes("Continue to Viator"))!;

      await act(async () => {
        await continueBtn.props.onClick();
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe("/api/track/click");
      const payload = JSON.parse(fetchMock.mock.calls[0][1].body as string);
      expect(payload).toMatchObject({
        itemType: "activity",
        itemId: "activity_v_ABC123",
        affiliatePartner: "viator",
        source: "shared_trip",
        price: 75,
        currency: "USD",
      });
      expect(payload.tripId).toBeUndefined();
      expect(openMock).toHaveBeenCalledWith(
        trackedRedirect,
        "_blank",
        "noopener,noreferrer",
      );
      expect(assignMock).not.toHaveBeenCalled();
      // Modal closes when new tab opens successfully
      expect(renderer.root.findAllByProps({ role: "dialog" })).toHaveLength(0);
    } finally {
      await act(async () => renderer?.unmount());
    }
  });
});

describe("BookingsSheet & BookingChecklist", () => {
  it("builds Stay, Flights (incl. Duffel return), Experiences, Dining, and Trip Essentials and renders BookingsSheet", async () => {
    const days: TripDay[] = [
      {
        dayNumber: 1,
        date: "2026-11-01",
        title: "Arrival",
        summary: "Arrive",
        morning: {
          activities: [
            {
              id: "activity_gyg_10",
              name: "TeamLab Planets",
              description: "Museum",
              duration: 120,
              estimatedCost: { amount: 35, currency: "USD" },
              category: "cultural",
              timeOfDay: "morning",
              location: { name: "Toyosu" },
              vibeMatch: {
                matchedVibes: ["culture"],
                reasoning: "Popular museum",
              },
              bookingInfo: {
                requiresReservation: true,
                bookingUrl:
                  "https://www.getyourguide.com/tokyo-l193/teamlab-t10/",
                affiliateId: "getyourguide",
              },
            },
          ],
          meals: [
            {
              id: "meal-1",
              name: "Sushi Dai",
              cuisineType: ["Sushi"],
              priceLevel: 3,
              description: "Fresh sushi",
              estimatedCost: { amount: 60, currency: "USD", perPerson: true },
              mealType: "lunch",
              location: { name: "Toyosu" },
              dietaryOptions: [],
              vibeMatch: { matchedVibes: ["foodie"], reasoning: "Top sushi" },
              reservationInfo: {
                recommended: true,
                url: "https://www.opentable.com/r/sushi-dai",
              },
            },
          ],
        },
        afternoon: { activities: [], meals: [] },
        evening: { activities: [], meals: [] },
        hotel: {
          id: "hotel-1",
          name: "Hoshinoya Tokyo",
          description: "Luxury ryokan",
          pricePerNight: 420,
          currency: "USD",
          reviewCount: 250,
          amenities: ["Onsen"],
          images: [],
          location: {
            name: "Otemachi",
            address: "1-9-1 Otemachi",
            lat: 35.68,
            lng: 139.76,
          },
          affiliatePartner: "stay22",
          affiliateUrl: "https://www.stay22.com/allez/roam?aid=1&address=Tokyo",
          vibeScore: 95,
          vibeMatch: ["culture"],
        },
        transport: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...({ id: "transport_duffel_out" } as any),
          type: "flight",
          provider: "JAL",
          departure: {
            airport: "SFO",
            city: "San Francisco",
            dateTime: "2026-11-01T10:00:00-08:00",
          },
          arrival: {
            airport: "HND",
            city: "Tokyo",
            dateTime: "2026-11-02T14:00:00+09:00",
          },
          duration: 660,
          stops: 0,
          price: 900,
          currency: "USD",
          affiliatePartner: "duffel",
          affiliateUrl: "https://links.duffel.com/out",
          expiresAt: "2099-01-01T00:00:00Z",
        },
        tips: [],
      },
      {
        dayNumber: 2,
        date: "2026-11-05",
        title: "Departure",
        summary: "Fly home",
        morning: { activities: [], meals: [] },
        afternoon: { activities: [], meals: [] },
        evening: { activities: [], meals: [] },
        transport: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...({ id: "transport_duffel_out__return" } as any),
          type: "flight",
          provider: "JAL",
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
          price: 900,
          currency: "USD",
          affiliatePartner: "duffel",
          affiliateUrl: "https://links.duffel.com/out",
          expiresAt: "2099-01-01T00:00:00Z",
        },
        tips: [],
      },
    ];

    const items = buildTripBookingItems({
      days,
      startDate: "2026-11-01",
      endDate: "2026-11-05",
      essentials: {
        insurance: {
          partner: "safetywing",
          label: "Travel medical insurance",
          vertical: "insurance",
          url: null,
          configured: false,
          isSearchFallback: true,
          disclosure: AFFILIATE_DISCLOSURE_SHORT,
        },
        esim: {
          partner: "airalo",
          label: "Japan eSIM data via Airalo",
          vertical: "esim",
          url: "https://www.airalo.com/japan-esim",
          configured: true,
          isSearchFallback: true,
          disclosure: AFFILIATE_DISCLOSURE_SHORT,
        },
      },
      viatorContentEnabled: true,
    });

    expect(items.map((i) => i.category)).toEqual([
      "stay",
      "flights",
      "flights",
      "experiences",
      "dining",
      "essentials",
    ]);

    vi.stubGlobal("document", { body: { style: { overflow: "auto" } } });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        clickId: "c-sheet",
        redirectUrl: "https://www.airalo.com/japan-esim?sub_id=c-sheet",
      }),
    });
    const openMock = vi.fn().mockReturnValue({ closed: false });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {
      open: openMock,
      location: { assign: vi.fn() },
    });

    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <BookingsSheet
            open={true}
            onClose={vi.fn()}
            items={items}
            destination="Tokyo"
            source="itinerary"
          />,
        );
      });

      const out = JSON.stringify(renderer.toJSON());
      expect(out).toContain("Book your Tokyo trip");
      expect(out).toContain(AFFILIATE_DISCLOSURE_FULL);
      expect(out).toContain("Hoshinoya Tokyo");
      expect(out).toContain("Review return");
      expect(out).toContain("TeamLab Planets");
      expect(out).toContain("Sushi Dai");
      expect(out).toContain("Japan eSIM data via Airalo");
      expect(out).not.toContain("Travel medical insurance");

      const esimBtn = renderer.root
        .findAllByType("button")
        .find((b) => textOf(b).includes("Open partner"))!;
      await act(async () => {
        await esimBtn.props.onClick();
      });

      expect(fetchMock).toHaveBeenCalledWith(
        "/api/track/click",
        expect.anything(),
      );
      expect(openMock).toHaveBeenCalled();
    } finally {
      await act(async () => renderer?.unmount());
    }
  });

  it("BookingChecklist removes commission jargon and renders direct Book now CTA for unbooked activities", async () => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    });
    vi.stubGlobal("window", {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      open: vi.fn().mockReturnValue({ closed: false }),
      location: { assign: vi.fn() },
    });
    vi.stubGlobal("document", { body: { style: { overflow: "auto" } } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async (url: string) => {
        if (url.includes("/bookings")) {
          return new Response(
            JSON.stringify({
              revision: "rev-1",
              generationId: "11111111-1111-4111-8111-111111111111",
              editable: true,
              receipt: false,
              earlier: [],
              items: [
                {
                  id: "item_" + "a".repeat(32),
                  name: "TeamLab Planets",
                  date: "2026-11-01",
                  status: "needed",
                  reportId: null,
                  needsReview: false,
                },
                {
                  id: "item_" + "b".repeat(32),
                  name: "Booked Tour",
                  date: "2026-11-02",
                  status: "traveler_booked",
                  reportId: null,
                  needsReview: false,
                },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ enabled: false, attempts: [] }), {
          status: 200,
        });
      }),
    );

    const days: TripDay[] = [
      {
        dayNumber: 1,
        date: "2026-11-01",
        title: "Day 1",
        summary: "Explore",
        morning: {
          activities: [
            {
              id: "activity_gyg_10",
              name: "TeamLab Planets",
              description: "Museum",
              duration: 90,
              estimatedCost: { amount: 40, currency: "USD" },
              category: "cultural",
              timeOfDay: "morning",
              location: { name: "Toyosu" },
              vibeMatch: {
                matchedVibes: ["culture"],
                reasoning: "Popular museum",
              },
              bookingInfo: {
                requiresReservation: true,
                bookingUrl:
                  "https://www.getyourguide.com/tokyo-l193/teamlab-t10/",
                affiliateId: "getyourguide",
              },
            },
          ],
          meals: [],
        },
        afternoon: { activities: [], meals: [] },
        evening: { activities: [], meals: [] },
        tips: [],
      },
    ];

    let renderer!: ReturnType<typeof create>;
    try {
      await act(async () => {
        renderer = create(
          <TripCheckout
            tripId="11111111-1111-4111-8111-111111111111"
            travelers={2}
          >
            <BookingChecklist
              tripId="11111111-1111-4111-8111-111111111111"
              userId="owner-1"
              days={days}
            />
          </TripCheckout>,
        );
      });

      const out = JSON.stringify(renderer.toJSON());
      expect(out).not.toContain("proof of commission");
      expect(out).not.toContain("Provider verification is not connected");
      expect(out).not.toContain("commissions");
      expect(out).toContain("Book now");
      expect(out).toContain(AFFILIATE_DISCLOSURE_SHORT);

      const bookNowButtons = renderer.root
        .findAllByType("button")
        .filter((b) => textOf(b).includes("Book now"));
      expect(bookNowButtons).toHaveLength(1);

      await act(async () => {
        bookNowButtons[0].props.onClick({
          currentTarget: { focus: vi.fn() },
        });
      });

      expect(renderer.root.findByProps({ role: "dialog" })).toBeTruthy();
      expect(textOf(renderer.root.findByProps({ role: "dialog" }))).toContain(
        "Continue to GetYourGuide",
      );
    } finally {
      await act(async () => renderer?.unmount());
    }
  });
});
