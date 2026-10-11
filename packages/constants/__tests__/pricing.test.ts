import { describe, expect, it } from "vitest";
import {
  currencyCode,
  formatPrice,
  nonNegativeAmount,
  providerAmount,
  readPrice,
  reviewRating,
} from "../src/pricing";

describe("source-honest price formatting", () => {
  it.each([undefined, null, "", "12", -1, NaN, Infinity, {}])(
    "does not turn %s into a displayed numeric price",
    (value) => {
      expect(nonNegativeAmount(value)).toBeUndefined();
      expect(formatPrice(value, "USD")).toBeUndefined();
    },
  );
  it("preserves a supplied zero but requires its currency", () => {
    expect(readPrice(0, "usd")).toEqual({ amount: 0, currency: "USD" });
    expect(formatPrice(0, "USD")).toBe("USD 0.00");
    expect(readPrice(0, undefined)).toBeUndefined();
    expect(currencyCode("$")).toBeUndefined();
  });
  it("distinguishes dollars and respects currency decimal places", () => {
    expect(formatPrice(101.25, "USD")).toBe("USD 101.25");
    expect(formatPrice(101.25, "CAD")).toBe("CAD 101.25");
    expect(formatPrice(15000, "JPY")).toBe("JPY 15,000");
    expect(formatPrice(1.234, "KWD")).toBe("KWD 1.234");
  });
  it("accepts decimal provider strings without coercing missing or invalid values", () => {
    expect(providerAmount("0.00")).toBe(0);
    expect(providerAmount("101.25")).toBe(101.25);
    for (const value of [
      "",
      " ",
      "12 euros",
      "0x10",
      null,
      false,
      "Infinity",
      "-10",
    ])
      expect(providerAmount(value)).toBeUndefined();
  });
  it("keeps review scales distinct and rejects sentinel/nonfinite scores", () => {
    expect(reviewRating(8.7, 10)).toBe(8.7);
    expect(reviewRating(8.7, 5)).toBeUndefined();
    expect(reviewRating(4.5, 5)).toBe(4.5);
    for (const value of [0, -1, Infinity, NaN, undefined, "4.5"])
      expect(reviewRating(value)).toBeUndefined();
  });
});
