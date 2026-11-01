import { reviewHotelSourceRefresh } from "../uat/lib/hotel-evidence-refresh";
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

test("hotel source refresh prepares review without renewing policy on matching text", () => {
  const facts = [
    {
      id: "hotel",
      name: "Example Hotel",
      destination: "Example City",
      sourceUrl: url,
      observedAt: "2026-10-01",
      reviewAfter: "2026-10-31",
      sourceNote: "Reviewed policy",
      reviewChecks: ["Minimum guest age is 18."],
    },
  ];
  const before = JSON.stringify(facts);
  const result = reviewHotelSourceRefresh(
    facts,
    [
      {
        url,
        observedAt: "2026-11-01T11:00:00Z",
        text: "Example Hotel. Minimum guest age is 18. Other conditions may override this statement.",
      },
    ],
    "2026-11-01T12:00:00Z",
  );
  expect(result.rows[0].status).toBe("ready_for_policy_review");
  expect(result.rows[0].canRenewAutomatically).toBe(false);
  expect(result.policyVerified).toBe(false);
  expect(result.evidenceUpdated).toBe(false);
  expect(JSON.stringify(facts)).toBe(before);
});

test("hotel refresh flags failed, ambiguous, stale, future and changed sources", () => {
  const fact = {
    id: "hotel",
    name: "Example Hotel",
    destination: "Example City",
    sourceUrl: url,
    observedAt: "2026-10-01",
    sourceNote: "Reviewed policy",
    reviewChecks: ["Minimum guest age is 18."],
  };
  const fresh = {
    url,
    observedAt: "2026-11-01T11:00:00Z",
    text: "Minimum guest age is 18.",
  };
  for (const pages of [
    [],
    [fresh, fresh],
    [{ ...fresh, error: "HTTP 403" }],
    [{ ...fresh, url: "https://another.example/visit" }],
    [{ ...fresh, text: "Guests of all ages are welcome." }],
    [{ ...fresh, observedAt: "2026-10-31T11:59:59Z" }],
    [{ ...fresh, observedAt: "2026-11-01T12:00:01Z" }],
    [{ ...fresh, observedAt: "invalid" }],
    [{ ...fresh, observedAt: "2026-02-31T11:00:00Z" }],
  ]) {
    const result = reviewHotelSourceRefresh(
      [fact],
      pages,
      "2026-11-01T12:00:00Z",
    );
    expect(result.rows[0].status).toBe("needs_investigation");
    expect(result.rows[0].canRenewAutomatically).toBe(false);
    expect(result.policyVerified).toBe(false);
  }
  expect(
    reviewHotelSourceRefresh(
      [{ ...fact, reviewChecks: [] }],
      [fresh],
      "2026-11-01T12:00:00Z",
    ).rows[0].issues,
  ).toContain("review_anchors_missing_or_invalid");
  expect(() =>
    reviewHotelSourceRefresh([], [fresh], "2026-11-01T12:00:00Z"),
  ).toThrow("Nonempty hotel evidence");
});

import { auditHotelSourceDiscovery } from "../uat/lib/hotel-source-discovery";

test("hotel source leads never authorize fetching or certify policy", () => {
  const result = auditHotelSourceDiscovery(
    {
      hotels: [
        { id: "a", homepageUrl: "https://example.com/hotel" },
        { id: "b", homepageUrl: null },
      ],
    },
    ["a", "b"],
  );
  expect(result.shapeValid).toBe(true);
  expect(result.automaticFetchAllowed).toBe(false);
  expect(result.policyVerified).toBe(false);
  expect(result.qualityAccepted).toBe(false);
});

test("hotel discovery refuses policy fields, duplicate identities and unsafe URL shapes", () => {
  for (const hotels of [
    [{ id: "a", homepageUrl: "https://example.com", accessible: true }],
    [
      { id: "a", homepageUrl: null },
      { id: "a", homepageUrl: null },
    ],
    [{ id: "other", homepageUrl: null }],
    [],
    ...[
      "http://example.com",
      "https://user:pass@example.com",
      "https://example.com/a.jpg",
      "https://example.com/?redirect=elsewhere",
      "https://example.com/#fragment",
      undefined,
    ].map((homepageUrl) => [{ id: "a", homepageUrl }]),
  ]) {
    expect(auditHotelSourceDiscovery({ hotels }, ["a"]).shapeValid).toBe(false);
  }
});

import { evaluateHotelFacts } from "../uat/lib/hotel-fact-extraction";

test("hotel extraction separates shared-room restrictions from property-wide bans", () => {
  const sourceUrl = "https://example.com/rooms";
  const evidenceQuote =
    "Guests under 18 must stay in private rooms with a guardian.";
  const fact = {
    id: "age",
    sourceUrl,
    expectedValue: 18,
    expectedScope: "shared_rooms",
    expectedRoom: null,
    quoteAnchors: ["under 18", "private rooms", "guardian"],
  };
  const claim = {
    id: "age",
    sourceUrl,
    value: 18,
    scope: "shared_rooms",
    room: null,
    evidenceQuote,
  };
  const pages = [{ url: sourceUrl, text: evidenceQuote }];
  expect(evaluateHotelFacts([claim], [fact], pages).passed).toBe(true);
  expect(
    evaluateHotelFacts([{ ...claim, scope: "all_guests" }], [fact], pages)
      .passed,
  ).toBe(false);
  expect(
    evaluateHotelFacts(
      [{ ...claim, evidenceQuote: "Guests under 18" }],
      [fact],
      pages,
    ).passed,
  ).toBe(false);
  expect(evaluateHotelFacts([claim, claim], [fact], pages).passed).toBe(false);
  expect(evaluateHotelFacts([claim], [fact], [...pages, ...pages]).passed).toBe(
    false,
  );
  expect(
    evaluateHotelFacts([claim, { ...claim, id: "other" }], [fact], pages)
      .passed,
  ).toBe(false);
});

test("absent hotel accessibility information stays unknown, never false or true", () => {
  const sourceUrl = "https://example.com/rooms";
  const fact = {
    id: "lift",
    sourceUrl,
    expectedValue: null,
    expectedScope: "unknown",
    expectedRoom: null,
    quoteAnchors: [],
  };
  const claim = {
    id: "lift",
    sourceUrl,
    value: null,
    scope: "unknown",
    room: null,
    evidenceQuote: "",
  };
  const pages = [{ url: sourceUrl, text: "Rooms have comfortable beds." }];
  expect(evaluateHotelFacts([claim], [fact], pages).passed).toBe(true);
  for (const value of [true, false]) {
    expect(
      evaluateHotelFacts(
        [{ ...claim, value, scope: "property" }],
        [fact],
        pages,
      ).passed,
    ).toBe(false);
  }
  expect(evaluateHotelFacts([claim], [fact], []).passed).toBe(false);
});

test("room capacity requires the named room and its source evidence", () => {
  const sourceUrl = "https://example.com/rooms";
  const evidenceQuote =
    "Family Room: up to 3 guests. Double Room: up to 2 guests.";
  const fact = {
    id: "capacity",
    sourceUrl,
    expectedValue: 3,
    expectedScope: "named_room",
    expectedRoom: "Family Room",
    quoteAnchors: ["Family Room", "3 guests"],
  };
  const claim = {
    id: "capacity",
    sourceUrl,
    value: 3,
    scope: "named_room",
    room: "Family Room",
    evidenceQuote,
  };
  const pages = [{ url: sourceUrl, text: evidenceQuote }];
  expect(evaluateHotelFacts([claim], [fact], pages).passed).toBe(true);
  for (const change of [
    { room: "Double Room" },
    { scope: "property" },
    { value: 6 },
    { sourceUrl: "https://other.example.com" },
    { evidenceQuote: "Family Room accommodates three." },
  ]) {
    expect(
      evaluateHotelFacts([{ ...claim, ...change }], [fact], pages).passed,
    ).toBe(false);
  }
});

test("reviewed alternative quotes retain scope context rather than matching an age alone", () => {
  const sourceUrl = "https://example.com/faq";
  const evidenceQuote =
    "Not suitable for families with children: minimum age requirement is 18 years old.";
  const fact = {
    id: "age",
    sourceUrl,
    expectedValue: 18,
    expectedScope: "all_guests",
    expectedRoom: null,
    quoteAnchors: ["minimum age to stay is 18"],
    quoteAnchorAlternatives: [
      ["families with children", "minimum age requirement is 18 years old"],
    ],
  };
  const claim = {
    id: "age",
    sourceUrl,
    value: 18,
    scope: "all_guests",
    room: null,
    evidenceQuote,
  };
  const pages = [{ url: sourceUrl, text: evidenceQuote }];
  expect(evaluateHotelFacts([claim], [fact], pages).passed).toBe(true);
  expect(
    evaluateHotelFacts(
      [{ ...claim, evidenceQuote: "minimum age requirement is 18 years old" }],
      [fact],
      pages,
    ).passed,
  ).toBe(false);
});
