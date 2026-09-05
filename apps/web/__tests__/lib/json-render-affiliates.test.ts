import { describe, expect, it } from "vitest";
import {
  buildHotelBlocks,
  buildItineraryBlocks,
} from "@/lib/json-render/build-spec";

describe("json-render affiliate metadata", () => {
  it("emits one hotel CTA with its verified provider metadata", () => {
    const blocks = buildHotelBlocks({
      topHotel: {
        id: "hotel-1",
        name: "Hotel One",
        affiliateUrl: "https://www.booking.com/hotel/1",
        affiliatePartner: "booking",
        pricePerNight: 220,
      },
    });

    expect(blocks.filter((block) => block.type === "HotelCard")).toHaveLength(
      1,
    );
    expect(
      blocks.filter((block) => block.type === "BookingButton"),
    ).toHaveLength(0);
    expect(
      blocks.find((block) => block.type === "HotelCard")?.props,
    ).toMatchObject({
      id: "hotel-1",
      bookingUrl: "https://www.booking.com/hotel/1",
      affiliatePartner: "booking",
    });
  });

  it("preserves activity and restaurant partners for tracked renderers", () => {
    const blocks = buildItineraryBlocks([
      {
        dayNumber: 1,
        date: "2026-10-01",
        title: "Arrival",
        morning: {
          activities: [
            {
              id: "tour-1",
              name: "City Tour",
              affiliateUrl:
                "https://www.viator.com/tours/123?pid=P12345678&mcid=42383&medium=api",
              affiliatePartner: "viator",
            },
          ],
          meal: {
            id: "restaurant-1",
            name: "Local Bistro",
            reservationUrl: "https://www.opentable.com/r/local-bistro",
            affiliatePartner: "opentable",
          },
        },
      },
    ]);

    expect(
      blocks.find((block) => block.type === "ActivityCard")?.props,
    ).toMatchObject({
      id: "tour-1",
      affiliatePartner: "viator",
      bookingUrl:
        "https://www.viator.com/tours/123?pid=P12345678&mcid=42383&medium=api",
    });
    expect(
      blocks.find((block) => block.type === "RestaurantCard")?.props,
    ).toMatchObject({
      id: "restaurant-1",
      affiliatePartner: "opentable",
    });
  });

  it("keeps legacy activities informational when their Viator URL is malformed", () => {
    const blocks = buildItineraryBlocks([
      {
        dayNumber: 1,
        date: "2026-10-01",
        title: "Arrival",
        morning: {
          activities: [
            {
              id: "old-tour",
              name: "City Tour",
              affiliateUrl:
                "https://www.viator.com/tours/123?pid=faroway&mcid=click_old",
              affiliatePartner: "viator",
            },
          ],
        },
      },
    ]);
    const activity = blocks.find((block) => block.type === "ActivityCard");
    expect(activity?.props.name).toBe("City Tour");
    expect(activity?.props.bookingUrl).toBeFalsy();
  });
});
