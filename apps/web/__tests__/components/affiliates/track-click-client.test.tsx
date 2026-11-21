import React from "react";
import { act, create } from "react-test-renderer";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AFFILIATE_DISCLOSURE_SHORT } from "@faroway/constants";
import {
  trackAffiliateClick,
  trackAndOpenAffiliateLink,
} from "@/components/affiliates/track-click-client";
import { TrackedAffiliateButton } from "@/components/affiliates/TrackedAffiliateButton";

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("track-click-client", () => {
  it("rejects non-allowlisted URLs without calling fetch or navigating", async () => {
    const fetchMock = vi.fn();
    const openMock = vi.fn();
    const assignMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {
      open: openMock,
      location: { assign: assignMock },
    });

    const result = await trackAndOpenAffiliateLink({
      affiliateUrl: "https://evil.example/checkout",
      partner: "viator",
      itemType: "activity",
      itemId: "act-1",
      itemName: "Evil Tour",
    });

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(openMock).not.toHaveBeenCalled();
    expect(assignMock).not.toHaveBeenCalled();
  });

  it("posts affiliatePartner payload with valid UUID tripId and opens in _blank", async () => {
    const tripUuid = "11111111-1111-4111-8111-111111111111";
    const trackedUrl =
      "https://www.getyourguide.com/tokyo-l193/tour-t42/?cmp=click-123";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        clickId: "click-123",
        partner: "getyourguide",
        redirectUrl: trackedUrl,
      }),
    });
    const openMock = vi.fn().mockReturnValue({ closed: false });
    const assignMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {
      open: openMock,
      location: { assign: assignMock },
    });

    const result = await trackAndOpenAffiliateLink({
      affiliateUrl: "https://www.getyourguide.com/tokyo-l193/tour-t42/",
      partner: "gyg",
      itemType: "activity",
      itemId: "activity_gyg_42",
      itemName: "Tokyo Food Tour",
      tripId: tripUuid,
      source: "itinerary",
      placement: "activity_card",
      price: 85,
      currency: "USD",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetchMock.mock.calls[0];
    expect(endpoint).toBe("/api/track/click");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      itemType: "activity",
      itemId: "activity_gyg_42",
      itemName: "Tokyo Food Tour",
      affiliatePartner: "getyourguide",
      tripId: tripUuid,
      source: "itinerary",
      placement: "activity_card",
      price: 85,
      currency: "USD",
    });
    expect(body).not.toHaveProperty("partner");

    expect(openMock).toHaveBeenCalledWith(
      trackedUrl,
      "_blank",
      "noopener,noreferrer",
    );
    expect(assignMock).not.toHaveBeenCalled();
    expect(result).toEqual({
      tracked: true,
      url: trackedUrl,
      clickId: "click-123",
      partner: "getyourguide",
      openedInNewTab: true,
    });
  });

  it("omits non-UUID tripId and falls back to location.assign when popup is blocked", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("Network error"));
    const openMock = vi.fn().mockReturnValue(null);
    const assignMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("window", {
      open: openMock,
      location: { assign: assignMock },
    });

    const rawUrl = "https://www.booking.com/searchresults.html?ss=Kyoto";
    const result = await trackAndOpenAffiliateLink({
      affiliateUrl: rawUrl,
      itemType: "hotel",
      itemId: "hotel-1",
      itemName: "Kyoto Ryokan",
      tripId: "not-a-uuid",
      source: "shared_trip",
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.tripId).toBeUndefined();
    expect(openMock).toHaveBeenCalledWith(
      rawUrl,
      "_blank",
      "noopener,noreferrer",
    );
    expect(assignMock).toHaveBeenCalledWith(rawUrl);
    expect(result).toEqual({
      tracked: false,
      url: rawUrl,
      clickId: undefined,
      partner: "booking",
      openedInNewTab: false,
    });
  });

  it("trackAffiliateClick rejects redirectUrl outside the host allowlist", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        clickId: "click-999",
        redirectUrl: "https://phishing.example/redirect",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const original = "https://www.airalo.com/japan-esim";
    const res = await trackAffiliateClick({
      affiliateUrl: original,
      itemType: "activity",
      itemId: "esim-jp",
      itemName: "Japan eSIM",
    });

    expect(res?.url).toBe(original);
  });
});

describe("TrackedAffiliateButton", () => {
  it("returns null for unallowlisted URLs and renders disclosure + tracks click for valid URLs", async () => {
    let blocked!: ReturnType<typeof create>;
    await act(async () => {
      blocked = create(
        <TrackedAffiliateButton
          label="Book"
          affiliateUrl="https://untrusted.example/tour"
          itemType="activity"
          itemId="x"
          itemName="Tour"
        />,
      );
    });
    expect(blocked.toJSON()).toBeNull();

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        clickId: "c1",
        redirectUrl: "https://www.klook.com/activity/123?sub_id=c1",
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
          <TrackedAffiliateButton
            label="Book on Klook"
            affiliateUrl="https://www.klook.com/activity/123"
            itemType="activity"
            itemId="act-klook-123"
            itemName="TeamLab Tickets"
            source="itinerary"
            showDisclosure
          />,
        );
      });

      const json = JSON.stringify(renderer.toJSON());
      expect(json).toContain("Book on Klook");
      expect(json).toContain(AFFILIATE_DISCLOSURE_SHORT);

      const button = renderer.root.findByType("button");
      await act(async () => {
        await button.props.onClick({
          currentTarget: { focus: vi.fn() },
        });
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(openMock).toHaveBeenCalledWith(
        "https://www.klook.com/activity/123?sub_id=c1",
        "_blank",
        "noopener,noreferrer",
      );
    } finally {
      await act(async () => renderer?.unmount());
    }
  });
});
