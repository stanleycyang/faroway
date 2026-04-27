// Editorial typography helpers for the world-map atlas.
//
// `toWords` spells out integers 1–99 in title case with hyphenation
// ("Forty-Three"). Used as the magazine-cover hero numeral in
// StatsHeader.tsx — looks unmistakably designed when a user has visited a
// countable number of places. Falls back to the bare digit string for 0
// (a poster reading "ZERO" feels off) and 100+ (longhand stops being
// scannable past two words).
//
// `toRoman` returns a roman numeral for 1–39 (covers way more profiles
// than anyone will realistically create). Used for the per-profile
// "Plate I / Plate II / …" eyebrow.

const ONES = [
  "Zero",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

export function toWords(n: number): string {
  if (!Number.isFinite(n) || n < 0) return String(n);
  // Keep numeric for 0 and 100+ — see file header for reasoning.
  if (n === 0 || n >= 100) return String(n);
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  if (o === 0) return TENS[t];
  return `${TENS[t]}-${ONES[o]}`;
}

const ROMAN_PAIRS: Array<[number, string]> = [
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

export function toRoman(n: number): string {
  if (!Number.isInteger(n) || n < 1) return "";
  let remaining = Math.min(n, 39); // saturate; nobody needs Plate XL.
  let out = "";
  for (const [value, glyph] of ROMAN_PAIRS) {
    while (remaining >= value) {
      out += glyph;
      remaining -= value;
    }
  }
  return out;
}
