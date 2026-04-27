import { describe, it, expect } from "vitest";
import { toRoman, toWords } from "@/lib/tools/world-map/typography";

describe("toWords", () => {
  it("keeps 0 numeric", () => {
    expect(toWords(0)).toBe("0");
  });

  it("spells single digits", () => {
    expect(toWords(1)).toBe("One");
    expect(toWords(7)).toBe("Seven");
  });

  it("spells the teens", () => {
    expect(toWords(13)).toBe("Thirteen");
    expect(toWords(19)).toBe("Nineteen");
  });

  it("spells exact tens", () => {
    expect(toWords(20)).toBe("Twenty");
    expect(toWords(50)).toBe("Fifty");
    expect(toWords(90)).toBe("Ninety");
  });

  it("hyphenates compound numbers", () => {
    expect(toWords(21)).toBe("Twenty-One");
    expect(toWords(43)).toBe("Forty-Three");
    expect(toWords(99)).toBe("Ninety-Nine");
  });

  it("falls back to numeric at 100+", () => {
    expect(toWords(100)).toBe("100");
    expect(toWords(157)).toBe("157");
  });
});

describe("toRoman", () => {
  it("renders single-glyph numerals", () => {
    expect(toRoman(1)).toBe("I");
    expect(toRoman(5)).toBe("V");
    expect(toRoman(10)).toBe("X");
  });

  it("uses subtractive forms", () => {
    expect(toRoman(4)).toBe("IV");
    expect(toRoman(9)).toBe("IX");
  });

  it("composes additive forms", () => {
    expect(toRoman(2)).toBe("II");
    expect(toRoman(7)).toBe("VII");
    expect(toRoman(13)).toBe("XIII");
    expect(toRoman(39)).toBe("XXXIX");
  });

  it("saturates at 39 (sanity cap on profile count)", () => {
    expect(toRoman(40)).toBe("XXXIX");
    expect(toRoman(999)).toBe("XXXIX");
  });

  it("returns empty for non-positive input", () => {
    expect(toRoman(0)).toBe("");
    expect(toRoman(-1)).toBe("");
  });
});
