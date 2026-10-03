import { describe, it, expect } from "vitest";
import { plannerDestination } from "@/lib/planner-destination";
const catalog = [{ id: "tokyo", name: "Tokyo", lat: 35.6762, lng: 139.6503 }];
describe("independent planner destination boundary", () => {
  it("uses catalog facts instead of supplied coordinates or provider metadata", () => {
    expect(
      plannerDestination(
        {
          source: "catalog",
          name: "Tokyo",
          placeId: "tokyo",
          lat: 99,
          lng: 88,
          address: "Google address",
        },
        catalog,
      ),
    ).toEqual({
      source: "catalog",
      name: "Tokyo",
      placeId: "tokyo",
      lat: 35.6762,
      lng: 139.6503,
      isRecommended: true,
    });
  });
  it("keeps user text but never associated provider fields", () => {
    expect(
      plannerDestination(
        {
          source: "user",
          name: " Kyoto ",
          placeId: "google-id",
          lat: 34,
          lng: 135,
        },
        catalog,
      ),
    ).toEqual({
      source: "user",
      name: "Kyoto",
      placeId: "",
      lat: 0,
      lng: 0,
      isRecommended: false,
    });
  });
  it("rejects unmarked legacy/provider drafts, retaining only known catalog references", () => {
    expect(
      plannerDestination(
        { name: "Google city", lat: 20, lng: 30, placeId: "google-id" },
        catalog,
      ),
    ).toBeNull();
    expect(
      plannerDestination({ source: "google", name: "Google city" }, catalog),
    ).toBeNull();
    expect(
      plannerDestination(
        { name: "Tokyo", placeId: "tokyo", isRecommended: true },
        catalog,
      )?.source,
    ).toBe("catalog");
  });
});
