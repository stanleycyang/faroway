import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StreamedSpecPreview } from "@/components/trips/StreamedSpecPreview";
import { describe, expect, it } from "vitest";
import {
  buildHotelBlocks,
  buildItineraryBlocks,
  buildBudgetBlocks,
} from "@/lib/json-render/build-spec";

describe("streamed price currency contracts", () => {
  it("preserves a hotel's currency on cards and inert booking previews", () => {
    const blocks = buildHotelBlocks({
      topHotel: {
        name: "Test",
        pricePerNight: 101.25,
        currency: "EUR",
        affiliateUrl: "https://example.invalid",
        affiliatePartner: "recorded",
      },
    });
    expect(
      blocks.filter((b) => b.type !== "Section").map((b) => b.props.currency),
    ).toEqual(["EUR", "EUR"]);
  });
  it("preserves an activity's currency", () => {
    const blocks = buildItineraryBlocks([
      {
        dayNumber: 1,
        date: "2099-06-01",
        title: "Test",
        morning: {
          activities: [{ name: "Test", price: 25, currency: "JPY" }],
        },
      },
    ]);
    expect(blocks.find((b) => b.type === "ActivityCard")?.props.currency).toBe(
      "JPY",
    );
  });
  it("does not assume USD for a total with no currency", () => {
    expect(buildBudgetBlocks({ totalEstimatedCost: 500, nights: 2 })).toEqual(
      [],
    );
  });
  it("never labels mixed currencies as a complete total or invented dining cost", () => {
    const blocks = buildBudgetBlocks({
      totalEstimatedCost: 500,
      currency: "USD",
      nights: 2,
      topHotel: { name: "Test", pricePerNight: 100.5, currency: "EUR" },
      activities: [{ name: "Test", price: 10, currency: "JPY" }],
    });
    expect(
      blocks.filter((b) => b.type === "PriceTag").map((b) => b.props.currency),
    ).toEqual(["EUR", "JPY"]);
    expect(blocks.some((b) => b.props.period === "dining")).toBe(false);
    expect(blocks.find((b) => b.type === "Text")?.props.content).toContain(
      "Total unavailable",
    );
  });
  it("formats an explicit same-currency estimate with decimal precision", () => {
    const blocks = buildBudgetBlocks({
      totalEstimatedCost: 500.25,
      currency: "EUR",
      nights: 2,
      topHotel: { name: "Test", pricePerNight: 100.5, currency: "EUR" },
    });
    expect(blocks.find((b) => b.type === "Text")?.props.content).toContain(
      "EUR 500.25",
    );
  });
});

it("does not invent clock times or durations when only day parts are supplied", () => {
  const blocks = buildItineraryBlocks([
    {
      dayNumber: 1,
      date: "2027-01-11",
      title: "Day",
      morning: {
        activities: [
          { name: "Long visit", duration: 3 },
          { name: "Unknown duration" },
        ],
        meal: { name: "Breakfast" },
      },
      afternoon: { activities: [{ name: "Museum", duration: 1.5 }] },
      evening: { meal: { name: "Dinner" } },
    },
  ]);
  const cards = blocks.filter(
    (b) => b.type === "ActivityCard" || b.type === "RestaurantCard",
  );
  expect(cards.map((b) => b.props.time)).toEqual([
    "Morning",
    "Morning",
    "Morning",
    "Afternoon",
    "Evening",
  ]);
  expect(
    cards.filter((b) => b.type === "ActivityCard").map((b) => b.props.duration),
  ).toEqual(["3 hours", "Duration not set", "1.5 hours"]);
  expect(JSON.stringify(blocks)).not.toMatch(/\d{1,2}:\d{2}/);
});
it.each([undefined, 0, -1, NaN, Infinity])(
  "does not invent a duration from %s",
  (duration) => {
    const blocks = buildItineraryBlocks([
      {
        dayNumber: 1,
        date: "2027-01-11",
        title: "Day",
        morning: { activities: [{ name: "Visit", duration }] },
      },
    ]);
    expect(blocks.find((b) => b.type === "ActivityCard")?.props.duration).toBe(
      "Duration not set",
    );
  },
);

it.each(["ActivityCard", "HotelCard", "PriceTag"])(
  "renders %s using supplied currency and preserves unknown prices",
  (type) => {
    const render = (props: Record<string, unknown>) =>
      renderToStaticMarkup(
        React.createElement(StreamedSpecPreview, { blocks: [{ type, props }] }),
      );
    const price = {
      price: 25.5,
      pricePerNight: 25.5,
      amount: 25.5,
      currency: "EUR",
    };
    expect(render(price)).toContain("EUR 25.50");
    expect(render(price)).not.toContain("$25");
    expect(render({ ...price, currency: undefined })).toContain(
      "Price unknown",
    );
    expect(render({ ...price, priceStatus: "unknown" })).toContain(
      "Price unknown",
    );
  },
);
it.each(["ActivityCard", "RestaurantCard"])(
  "keeps validated source attribution in the web %s preview",
  (type) => {
    const source = {
      url: "https://example.org/source",
      retrievedOn: "2026-11-02",
    };
    const render = (value: unknown) =>
      renderToStaticMarkup(
        React.createElement(StreamedSpecPreview, {
          blocks: [{ type, props: { name: "Visit", source: value } }],
        }),
      );
    expect(render(source)).toContain('href="https://example.org/source"');
    expect(render(source)).toContain("Confirm opening hours and availability");
    expect(render({ ...source, url: "javascript:alert(1)" })).not.toContain(
      "href=",
    );
  },
);
