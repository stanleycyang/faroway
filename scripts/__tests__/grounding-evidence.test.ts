import { test, expect } from "bun:test";
import {
  auditGroundingEvidence,
  type GroundedVenueClaim,
} from "../uat/lib/grounding-evidence";
const url = "https://official.example/visit";
const page = {
  url,
  text: "Opening hours. Closed on Mondays. Reopening date unknown.",
};
const claim: GroundedVenueClaim = {
  id: "museum",
  sourceUrl: url,
  closedWeekdays: [1],
  temporarilyClosed: true,
  evidenceQuote: "Closed on Mondays.",
};
const audit = (claims = [claim], pages = [page]) =>
  auditGroundingEvidence(claims, { museum: url }, pages, "2026-12-07");
test("links exact retrieved evidence but does not certify future availability", () => {
  const result = audit();
  expect(result.results[0]).toMatchObject({
    evidenceLinked: true,
    claimVerified: false,
  });
  expect(result.results[0].reviewFlags).toEqual([
    "reported_closed_weekday_needs_review",
    "reopening_confirmation_required",
  ]);
  expect(result.futureAvailabilityVerified).toBe(false);
});
test("rejects fabricated quotes, mismatched sources and absent retrieval", () => {
  expect(
    audit([{ ...claim, evidenceQuote: "Open all days ... including Monday" }])
      .results[0].issues,
  ).toContain("quote_not_in_source");
  expect(
    audit([{ ...claim, sourceUrl: "https://unrelated.example" }]).results[0]
      .issues,
  ).toContain("unapproved_source");
  expect(audit([claim], []).results[0].issues).toContain(
    "source_not_retrieved",
  );
});
test("rejects missing and duplicate venues and invalid weekdays", () => {
  expect(audit([]).results[0].issues).toContain("missing_venue");
  expect(
    audit([claim, claim]).results.every((r) =>
      r.issues.includes("duplicate_venue"),
    ),
  ).toBe(true);
  expect(
    audit([{ ...claim, closedWeekdays: [7] }]).results[0].issues,
  ).toContain("invalid_weekday");
});
test("matching unrelated text cannot verify claim semantics", () => {
  const result = audit([
    {
      ...claim,
      evidenceQuote: "Reopening date unknown.",
      temporarilyClosed: false,
    },
  ]);
  expect(result.results[0].evidenceLinked).toBe(true);
  expect(result.results[0].claimVerified).toBe(false);
  expect(result.futureAvailabilityVerified).toBe(false);
});
test("refuses invalid calendar dates", () => {
  expect(() =>
    auditGroundingEvidence([claim], { museum: url }, [page], "2026-02-30"),
  ).toThrow();
});

import { auditAddressExtraction } from "../uat/lib/address-extraction";
const addressFact = {
  id: "branch",
  destination: "Tokyo, Japan",
  aliases: ["Branch"],
  sourceUrl: url,
  observedAt: "2026-10-31",
  sourceAddress: "6-4-1 Roppongi",
  supportedAddresses: [],
  contradictedAddresses: [],
};
const addressPage = {
  url,
  text: "Branch address: 6-4-1 Roppongi. Other branch: 1-2-3 Shibuya.",
};
const addressClaim = {
  id: "branch",
  sourceUrl: url,
  address: "6-4-1 Roppongi",
  evidenceQuote: "Branch address: 6-4-1 Roppongi.",
};
test("address extraction links exact text without certifying branch identity", () => {
  const r = auditAddressExtraction(
    [addressClaim],
    [addressFact],
    [addressPage],
  )[0];
  expect(r.evidenceLinked).toBe(true);
  expect(r.matchesReviewedAddress).toBe(true);
  expect(r.branchIdentityVerified).toBe(false);
  expect(r.coordinatesVerified).toBe(false);
});
test("another branch's real quote cannot match the reviewed address", () => {
  const r = auditAddressExtraction(
    [
      {
        ...addressClaim,
        address: "1-2-3 Shibuya",
        evidenceQuote: "Other branch: 1-2-3 Shibuya.",
      },
    ],
    [addressFact],
    [addressPage],
  )[0];
  expect(r.evidenceLinked).toBe(true);
  expect(r.matchesReviewedAddress).toBe(false);
});
test("fabricated corrections and unavailable pages cannot link evidence", () => {
  for (const claim of [
    { ...addressClaim, address: "6-2-31 Roppongi" },
    { ...addressClaim, evidenceQuote: "Branch address: 6-2-31 Roppongi." },
    { ...addressClaim, sourceUrl: "https://other.example" },
    { ...addressClaim, address: null },
  ]) {
    expect(
      auditAddressExtraction([claim], [addressFact], [addressPage])[0]
        .evidenceLinked,
    ).toBe(false);
  }
  expect(
    auditAddressExtraction([addressClaim], [addressFact], [])[0].evidenceLinked,
  ).toBe(false);
  expect(
    auditAddressExtraction(
      [addressClaim, addressClaim],
      [addressFact],
      [addressPage],
    )[0].issues,
  ).toContain("duplicate_claim");
});
