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
