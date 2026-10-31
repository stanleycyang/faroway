import { describe, expect, it } from "vitest";
import {
  isOpenTableReservationUrl,
  reservationUrlFromEvidence,
} from "@/lib/search/reservation-url";

describe("reservation URLs", () => {
  it("omits a model-invented OpenTable slug", () => {
    expect(
      reservationUrlFromEvidence("https://opentable.com/r/invented-bistro", {
        kind: "none",
      }),
    ).toBeUndefined();
    expect(
      reservationUrlFromEvidence("https://evil.example/r/invented"),
    ).toBeUndefined();
  });

  it("constructs a link only from a numeric OpenTable restaurant id", () => {
    const url = reservationUrlFromEvidence(
      "https://opentable.com/r/invented-bistro",
      { kind: "opentable_rid", restaurantId: "123456" },
    );
    expect(url).toBe(
      "https://www.opentable.com/booking/restref/availability?rid=123456",
    );
    expect(isOpenTableReservationUrl(url!)).toBe(true);
    expect(
      isOpenTableReservationUrl(
        "https://www.opentable.com/booking/restref/availability/",
      ),
    ).toBe(false);
    expect(
      reservationUrlFromEvidence(undefined, {
        kind: "opentable_rid",
        restaurantId: "not-an-id",
      }),
    ).toBeUndefined();
  });

  it("keeps a URL only after that exact reservation URL was verified", () => {
    const verified = "https://www.opentable.com/r/real-bistro";
    expect(
      reservationUrlFromEvidence(verified, {
        kind: "verified_head",
        url: verified,
        ok: true,
      }),
    ).toBe(verified);
    expect(
      reservationUrlFromEvidence(verified, {
        kind: "verified_head",
        url: verified,
        ok: false,
      }),
    ).toBeUndefined();
    expect(
      reservationUrlFromEvidence("https://www.opentable.com/", {
        kind: "verified_head",
        url: "https://www.opentable.com/",
        ok: true,
      }),
    ).toBeUndefined();
    expect(
      reservationUrlFromEvidence(verified, {
        kind: "verified_head",
        url: "https://www.opentable.com/r/someone-else",
        ok: true,
      }),
    ).toBeUndefined();
  });
});
