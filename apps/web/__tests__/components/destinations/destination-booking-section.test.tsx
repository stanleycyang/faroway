import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AFFILIATE_DISCLOSURE_FULL,
  AFFILIATE_DISCLOSURE_SHORT,
} from "@faroway/constants";
import { DestinationBookingSection } from "@/components/destinations/DestinationBookingSection";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("DestinationBookingSection component", () => {
  it("renders Stays, Activities, Flights, and Essentials while omitting null/unallowlisted links", () => {
    const html = renderToStaticMarkup(
      <DestinationBookingSection
        destinationName="Tokyo"
        country="Japan"
        slug="tokyo"
        stays={[
          {
            partner: "booking",
            label: "Check availability on Booking.com",
            vertical: "hotels",
            url: "https://www.booking.com/searchresults.html?ss=Tokyo",
            configured: true,
            isSearchFallback: true,
            disclosure: AFFILIATE_DISCLOSURE_SHORT,
          },
          {
            partner: "stay22",
            label: "Unconfigured Stay22",
            vertical: "hotels",
            url: null,
            configured: false,
            isSearchFallback: true,
            disclosure: AFFILIATE_DISCLOSURE_SHORT,
          },
        ]}
        activities={[
          {
            partner: "getyourguide",
            label: "Browse tours on GetYourGuide",
            vertical: "activities",
            url: "https://www.getyourguide.com/s/?q=Tokyo",
            configured: true,
            isSearchFallback: true,
            disclosure: AFFILIATE_DISCLOSURE_SHORT,
          },
        ]}
        flights={[
          {
            partner: "travelpayouts",
            label: "Compare flights on Aviasales",
            vertical: "flights",
            url: "https://www.aviasales.com/",
            configured: true,
            isSearchFallback: true,
            disclosure: AFFILIATE_DISCLOSURE_SHORT,
          },
        ]}
        essentials={[
          {
            key: "esim",
            title: "eSIM",
            link: {
              partner: "airalo",
              label: "Get Japan eSIM data on Airalo",
              vertical: "esim",
              url: "https://www.airalo.com/japan-esim",
              configured: true,
              isSearchFallback: true,
              disclosure: AFFILIATE_DISCLOSURE_SHORT,
            },
          },
          {
            key: "insurance",
            title: "Insurance",
            link: {
              partner: "safetywing",
              label: "Hidden Unallowlisted",
              vertical: "insurance",
              url: "https://untrusted.example/x",
              configured: false,
              isSearchFallback: false,
              disclosure: AFFILIATE_DISCLOSURE_SHORT,
            },
          },
        ]}
      />,
    );

    expect(html).toContain("Where to Stay");
    expect(html).toContain("Tours &amp; Experiences");
    expect(html).toContain("Compare Flights");
    expect(html).toContain("Trip Essentials");
    expect(html).toContain("Check availability on Booking.com");
    expect(html).toContain("Browse tours on GetYourGuide");
    expect(html).toContain("Compare flights on Aviasales");
    expect(html).toContain("Get Japan eSIM data on Airalo");
    expect(html).not.toContain("Unconfigured Stay22");
    expect(html).not.toContain("Hidden Unallowlisted");
    expect(html).toContain(AFFILIATE_DISCLOSURE_SHORT);
    expect(html).toContain(AFFILIATE_DISCLOSURE_FULL);
  });

  it("tracks clicks with source=destination_guide and explicit itemType=flight for Aviasales", async () => {
    const popupMock = {
      opener: {} as unknown,
      closed: false,
      location: { replace: vi.fn() },
      close: vi.fn(),
    };
    vi.stubGlobal(
      "open",
      vi.fn(() => popupMock),
    );
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        clickId: "22222222-2222-4222-8222-222222222222",
        trackedUrl: "https://www.aviasales.com/?sub_id=clk2",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    let root!: ReturnType<typeof create>;
    await act(async () => {
      root = create(
        <DestinationBookingSection
          destinationName="Tokyo"
          country="Japan"
          slug="tokyo"
          stays={[]}
          activities={[]}
          flights={[
            {
              partner: "travelpayouts",
              label: "Compare flights on Aviasales",
              vertical: "flights",
              url: "https://www.aviasales.com/",
              configured: true,
              isSearchFallback: true,
              disclosure: AFFILIATE_DISCLOSURE_SHORT,
            },
          ]}
          essentials={[]}
        />,
      );
    });

    const btn = root.root.findByType("button");
    await act(async () => {
      await btn.props.onClick({ currentTarget: { focus: vi.fn() } });
    });

    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(payload.source).toBe("destination_guide");
    expect(payload.itemType).toBe("flight");
    expect(payload.campaign).toBe("destination-guide-tokyo");
  });
});
