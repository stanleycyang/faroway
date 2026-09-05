import { describe, expect, it } from "vitest";
import { parseViatorAffiliateUrl, normalizeAffiliatePartner } from "../src";

describe("Shared affiliate partner identity", () => {
  it.each([
    ["booking.com", "booking"],
    ["Booking.com", "booking"],
    ["BOOKINGCOM", "booking"],
    ["booking", "booking"],
    ["Viator", "viator"],
    ["GetYourGuide", "getyourguide"],
    ["Tripadvisor", "tripadvisor"],
    ["DiscoverCars", "discovercars"],
    ["Hostelworld", "hostelworld"],
    ["Duffel", "duffel"],
    ["OpenTable", "opentable"],
    ["KLOOK", "klook"],
  ])("normalizes %s to %s", (value, expected) => {
    expect(normalizeAffiliatePartner(value)).toBe(expected);
  });
  it.each([
    null,
    undefined,
    {},
    123,
    "",
    "constructor",
    "toString",
    "booking.com.evil",
  ])("rejects unknown partner %s", (value) => {
    expect(normalizeAffiliatePartner(value)).toBeNull();
  });
});

const productUrl =
  "https://www.viator.com/tours/City/Tour/d1-123?pid=P12345678&mcid=42383&medium=api&api_version=2.0&campaign=original";

describe("Viator attribution validation", () => {
  it("preserves all provider-issued parameters", () => {
    expect(parseViatorAffiliateUrl(productUrl)?.toString()).toBe(productUrl);
  });

  it("accepts locale subdomains and verifies a configured partner ID", () => {
    expect(
      parseViatorAffiliateUrl(productUrl.replace("www.", "en."), "P12345678"),
    ).not.toBeNull();
    expect(parseViatorAffiliateUrl(productUrl, "P87654321")).toBeNull();
  });

  it.each([
    "not a URL",
    "https://www.viator.com/tours/123",
    productUrl.replace("https:", "http:"),
    productUrl.replace("www.viator.com", "viator.com.attacker.example"),
    productUrl.replace("www.viator.com", "user:password@www.viator.com"),
    productUrl.replace("P12345678", "faroway"),
    productUrl.replace("42383", "click_old-id"),
    productUrl.replace("medium=api", "medium=unknown"),
    `${productUrl}&pid=P87654321`,
    `${productUrl}&mcid=99999`,
    `${productUrl}&medium=link`,
  ])("rejects malformed or ambiguous attribution: %s", (url) => {
    expect(parseViatorAffiliateUrl(url)).toBeNull();
  });
});
