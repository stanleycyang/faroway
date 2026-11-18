import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TripCoverImage } from "@/components/trips/TripCoverImage";
import { TripHeader } from "@/components/trips/TripHeader";

const cover = "https://images.unsplash.com/photo-trip-hero";

describe("trip hero image sizing", () => {
  it("asks for a full-viewport image on the trip header", () => {
    const html = renderToStaticMarkup(
      createElement(TripHeader, {
        destination: "Tokyo",
        heroImageUrl: cover,
        startDate: "2099-06-01",
        endDate: "2099-06-03",
        travelers: 2,
      }),
    );
    expect(html).toContain('sizes="100vw"');
    expect(html).not.toContain("42vw");
  });

  it("keeps the narrower size for covers that do not fill the page", () => {
    const html = renderToStaticMarkup(
      createElement(TripCoverImage, { src: cover }),
    );
    expect(html).toContain('sizes="(min-width: 1024px) 42vw, 100vw"');
  });
});
