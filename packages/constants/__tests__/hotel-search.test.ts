import { describe, expect, it } from "vitest";
import {
  HOTEL_SEARCH_CONSENT_VERSION,
  hotelChildrenAgeText,
  hotelGuestCounts,
  parseHotelChildrenAges,
  validateHotelSearchDetails,
} from "../src/hotel-search";

const party = {
  countryCode: "US",
  guestNationality: "CA",
  rooms: [{ adults: 2, children: [0, 17] }],
  consentVersion: HOTEL_SEARCH_CONSENT_VERSION,
};

describe("hotel party contract", () => {
  it("counts infants and children toward the saved trip party", () => {
    expect(hotelGuestCounts(party)).toEqual({
      adults: 2,
      children: 2,
      travelers: 4,
    });
    expect(validateHotelSearchDetails(party, 4)).toBe(true);
    expect(validateHotelSearchDetails(party, 2)).toBe(false);
  });

  it.each([
    { ...party, guestNationality: "" },
    { ...party, consentVersion: "old" },
    { ...party, unexpected: true },
    { ...party, rooms: [] },
    { ...party, rooms: Array(5).fill(party.rooms[0]) },
    { ...party, rooms: [{ adults: 0, children: [] }] },
    { ...party, rooms: [{ adults: 2, children: [18] }] },
    { ...party, rooms: [{ adults: 2, children: [1.5] }] },
    {
      ...party,
      rooms: Array(4).fill({ adults: 8, children: [1, 2, 3, 4, 5, 6] }),
    },
  ])("rejects incomplete, unconsented or unsupported parties", (value) => {
    expect(validateHotelSearchDetails(value)).toBe(false);
  });

  it("rejects malformed age input instead of silently changing the party", () => {
    expect(parseHotelChildrenAges("0, 17")).toEqual([0, 17]);
    expect(parseHotelChildrenAges("")).toEqual([]);
    for (const value of ["1,", "1.5", "-1", "1e1", "2 years"])
      expect(parseHotelChildrenAges(value).some(Number.isNaN)).toBe(true);
  });

  it("discards stale text when a recovered draft changes the children", () => {
    expect(hotelChildrenAgeText([3], "4")).toBe("3");
    expect(hotelChildrenAgeText([3, 4], "3,4")).toBe("3,4");
  });
});
