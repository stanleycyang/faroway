import { describe, expect, it } from "vitest";
import { buildAffiliateClickRedirect } from "@/lib/affiliates/click-redirect";

describe("buildAffiliateClickRedirect", () => {
  it("keeps partner navigation same-origin and preserves attribution context", () => {
    const result = buildAffiliateClickRedirect({
      itemType: "activity",
      itemId: "tour-1",
      itemName: "Food & Market Tour",
      affiliatePartner: "viator",
      affiliateUrl:
        "https://www.viator.com/tours/123?pid=P12345678&mcid=42383&medium=api&date=2026-10-01",
      tripId: "00000000-0000-4000-8000-000000000001",
      price: 125,
      currency: "USD",
      source: "itinerary",
    });

    expect(result).toBeDefined();
    const url = new URL(result!, "https://faroway.ai");
    expect(url.origin).toBe("https://faroway.ai");
    expect(url.pathname).toBe("/api/track/click");
    expect(url.searchParams.get("affiliatePartner")).toBe("viator");
    expect(url.searchParams.get("affiliateUrl")).toBe(
      "https://www.viator.com/tours/123?pid=P12345678&mcid=42383&medium=api&date=2026-10-01",
    );
    expect(url.searchParams.get("tripId")).toBe(
      "00000000-0000-4000-8000-000000000001",
    );
    expect(url.searchParams.get("price")).toBe("125");
  });

  it("does not render a bookable redirect for malformed legacy attribution", () => {
    expect(
      buildAffiliateClickRedirect({
        itemType: "activity",
        itemId: "tour-1",
        itemName: "City Tour",
        affiliatePartner: "viator",
        affiliateUrl:
          "https://www.viator.com/tours/123?pid=faroway&mcid=click_old",
      }),
    ).toBeUndefined();
  });
});
