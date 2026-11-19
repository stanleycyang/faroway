import { expect, it } from "vitest";
import {
  extractDatedHoursSections,
  parsePublishedHoursPeriod,
  selectDatedHoursSection,
} from "../../../../scripts/uat/lib/dated-hours-sections";
import { evidenceTextSha256 } from "../../../../scripts/uat/lib/activity-hours-evidence";

// The calendar/hours pattern observed in the retained Skydeck retrieval.
// Facts and delimiters only; this fixture does not adjudicate source authority.
const excerpt = `🏙️ Hours
Current to Sunday, 1 November 2026

* Open daily from 12pm to 9pm\\*, last entry 8:30pm

Monday, 2 November  2026 to Sunday, 4 April 2027

* Open daily from 12pm to 10pm\\*, last entry 9:30pm

Public Holidays & Special Dates
...
`;

it("selects the applicable published period while retaining unresolved context", () => {
  const result = selectDatedHoursSection(excerpt, "2027-01-11");
  expect(result).toMatchObject({
    status: "candidate",
    reason: "one_explicit_period",
    qualityAccepted: false,
  });
  expect(result.sections).toHaveLength(1);
  expect(result.sections[0]).toMatchObject({
    period: { from: "2026-11-02", through: "2027-04-04" },
    hours: { opens: 720, closes: 1320, lastEntry: 1290 },
    unresolvedFootnote: true,
    exceptionContextPresent: true,
    omittedContextPresent: true,
  });
});

it("binds original heading and hours spans, including Unicode and CRLF", () => {
  for (const text of [excerpt, excerpt.replaceAll("\n", "\r\n")]) {
    const sections = extractDatedHoursSections(text);
    expect(sections).toHaveLength(2);
    for (const section of sections) {
      expect(text.slice(section.periodStart, section.periodEnd)).toBe(
        section.periodQuote,
      );
      expect(text.slice(section.hoursStart, section.hoursEnd)).toBe(
        section.hoursQuote,
      );
      expect(section.excerptSha256).toBe(evidenceTextSha256(text));
    }
    expect(sections[0].hours.closes).toBe(1260);
    expect(sections[1].hours.closes).toBe(1320);
  }
});

it("does not invent the beginning of a current-to period or extrapolate past expiry", () => {
  expect(selectDatedHoursSection(excerpt, "2026-11-01").reason).toBe(
    "period_start_not_established",
  );
  expect(selectDatedHoursSection(excerpt, "2026-11-02").status).toBe(
    "candidate",
  );
  expect(selectDatedHoursSection(excerpt, "2027-04-04").status).toBe(
    "candidate",
  );
  expect(selectDatedHoursSection(excerpt, "2027-04-05")).toMatchObject({
    status: "unresolved",
    reason: "no_period_for_date",
    qualityAccepted: false,
  });
});

it.each([
  "Sunday, 2 November 2026 to Sunday, 4 April 2027",
  "29 February 2027 to 1 March 2027",
  "31 April 2027 to 1 May 2027",
  "4 April 2027 to 2 November 2026",
  "November 2026 onwards",
  "Current to 4 April",
])("rejects inconsistent or unsupported calendar text: %s", (text) => {
  expect(parsePublishedHoursPeriod(text)).toBeNull();
});

it("validates leap dates and does not use locale-dependent date parsing", () => {
  expect(
    parsePublishedHoursPeriod(
      "Tuesday, 29 February 2028 to Wednesday, 1 March 2028",
    ),
  ).toEqual({ from: "2028-02-29", through: "2028-03-01" });
  expect(() => selectDatedHoursSection(excerpt, "2027-02-29")).toThrow();
});

it("does not join hours across omitted, unrelated or unsupported intervening text", () => {
  const heading = "2 November 2026 to 4 April 2027";
  for (const intervening of [
    "...",
    "Guided tours",
    "Summer 2027 only",
    "Another venue",
  ]) {
    expect(
      extractDatedHoursSections(
        `${heading}\n${intervening}\nOpen daily 12pm–10pm`,
      ),
    ).toEqual([]);
  }
  expect(extractDatedHoursSections(heading)).toEqual([]);
  expect(extractDatedHoursSections("Open daily 12pm–10pm")).toEqual([]);
});

it("preserves overlapping periods as ambiguous even if their hours agree", () => {
  const text =
    "1 January 2027 to 31 January 2027\nOpen daily 12pm–10pm\n10 January 2027 to 20 January 2027\nOpen daily 12pm–10pm";
  expect(selectDatedHoursSection(text, "2027-01-11")).toMatchObject({
    status: "unresolved",
    reason: "overlapping_periods",
  });
});
