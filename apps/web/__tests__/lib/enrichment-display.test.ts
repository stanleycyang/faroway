import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ActivityCard,
  RestaurantCard,
  type Activity,
  type Restaurant,
} from "@/components/trips/ActivityCard";
import {
  buildHotelBlocks,
  buildItineraryBlocks,
  buildBudgetBlocks,
} from "@/lib/json-render/build-spec";

const activity: Activity = {
  id: "idea",
  name: "Neighborhood walk",
  description: "Planning idea",
  duration: 90,
  estimatedCost: { amount: 0, currency: "USD", status: "unknown" },
  timeOfDay: "morning",
  category: "sightseeing",
  location: { name: "Tokyo" },
  rating: 0,
  reviewCount: 0,
};
const restaurant: Restaurant = {
  id: "dining",
  name: "Local dining idea",
  cuisineType: ["local"],
  priceLevel: 2,
  description: "Choose a venue",
  estimatedCost: {
    amount: 0,
    currency: "USD",
    perPerson: true,
    status: "unknown",
  },
  mealType: "lunch",
  location: { name: "Tokyo" },
  dietaryOptions: [],
  rating: 0,
  reviewCount: 0,
};

describe("honest enrichment presentation", () => {
  it("renders unknown activity and dining prices without invented stars or free claims", () => {
    const html = renderToStaticMarkup(
      createElement(ActivityCard, { activity }),
    );
    const diningHtml = renderToStaticMarkup(
      createElement(RestaurantCard, { restaurant }),
    );
    for (const result of [html, diningHtml]) {
      expect(result).toContain("Price unknown");
      expect(result).not.toContain("$0");
      expect(result).not.toContain("lucide-star");
      expect(result).not.toContain("Free");
    }
    expect(diningHtml).not.toContain("$$");
  });

  it("does not display USD for a price without currency", () => {
    const html = renderToStaticMarkup(
      createElement(ActivityCard, {
        activity: { ...activity, estimatedCost: { amount: 20, currency: "" } },
      }),
    );
    expect(html).toContain("Price unknown");
    expect(html).not.toContain("$20");
  });

  it("labels positive activity amounts as estimates", () => {
    const html = renderToStaticMarkup(
      createElement(ActivityCard, {
        activity: {
          ...activity,
          estimatedCost: { amount: 20, currency: "USD" },
        },
      }),
    );
    expect(html).toContain("Est. $20");
  });

  it("does not synthesize hotel ratings or nightly prices", () => {
    const cards = buildHotelBlocks({ topHotel: { name: "Hotel" } });
    expect(cards.find((c) => c.type === "HotelCard")?.props).toMatchObject({
      rating: undefined,
      pricePerNight: undefined,
    });
  });

  it("preserves unknown status in mobile specs and avoids a default dining price band", () => {
    const cards = buildItineraryBlocks([
      {
        dayNumber: 1,
        date: "2026-11-01",
        title: "Explore",
        morning: {
          activities: [{ name: "Idea", price: 0, priceStatus: "unknown" }],
          meal: { name: "Dining", priceLevel: 2, priceStatus: "unknown" },
        },
      },
    ]);
    expect(
      cards.find((c) => c.type === "ActivityCard")?.props.priceStatus,
    ).toBe("unknown");
    expect(
      cards.find((c) => c.type === "RestaurantCard")?.props.priceLevel,
    ).toBeUndefined();
  });

  it("qualifies budget totals as planning estimates with unconfirmed prices", () => {
    const cards = buildBudgetBlocks({
      totalEstimatedCost: 100,
      nights: 1,
      currency: "USD",
    });
    expect(cards.find((c) => c.type === "Text")?.props.content).toContain(
      "some prices may be unknown",
    );
  });
});
