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

import {
  auditAddressExtraction,
  validateAddressRequests,
} from "../uat/lib/address-extraction";
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
test("generic requests do not manufacture a reviewed reference address", () => {
  const requests = validateAddressRequests([
    {
      id: "branch",
      destination: "Tokyo, Japan",
      aliases: ["Branch"],
      sourceUrl: url,
    },
  ]);
  const result = auditAddressExtraction([addressClaim], requests, [
    addressPage,
  ])[0];
  expect(result.evidenceLinked).toBe(true);
  expect(result.referenceAddressProvided).toBe(false);
  expect(result.matchesReviewedAddress).toBe(null);
  expect(result.branchIdentityVerified).toBe(false);
  for (const invalid of [
    [],
    Array(9).fill(requests[0]),
    [requests[0], requests[0]],
    [{ ...requests[0], aliases: [] }],
    [{ ...requests[0], sourceUrl: "http://example.com" }],
    [{ ...requests[0], sourceUrl: "https://user:password@example.com" }],
  ])
    expect(() => validateAddressRequests(invalid)).toThrow();
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

import {
  validateVenueDiscoveryRequests,
  auditVenueSourceDiscovery,
  venueDiscoveryPrompt,
  parallelVenueSources,
} from "../uat/lib/venue-source-discovery";
const publicVenue = {
  id: "venue-a",
  name: "Museum A",
  destination: "Example City",
  address: "1 Example Street",
};
const venueLead = {
  id: "venue-a",
  status: "candidate",
  officialUrl: "https://museum.example/visit",
  matchedName: "Museum A",
  matchedAddress: "1 Example Street",
  note: "Official page candidate; identity needs review.",
};

test("venue discovery accepts only bounded public identity inputs", () => {
  expect(validateVenueDiscoveryRequests([publicVenue])).toEqual([publicVenue]);
  for (const invalid of [
    [],
    Array(7).fill(publicVenue),
    [publicVenue, publicVenue],
    [{ ...publicVenue, dietaryPreferences: ["vegan"] }],
    [{ ...publicVenue, name: "" }],
    [{ ...publicVenue, address: "x".repeat(501) }],
  ])
    expect(() => validateVenueDiscoveryRequests(invalid)).toThrow();
  expect(venueDiscoveryPrompt([publicVenue])).toContain(
    "Do not silently replace",
  );
});

test("venue discovery preserves uncertainty and source linkage without certifying facts", () => {
  const audit = auditVenueSourceDiscovery(
    { venues: [venueLead] },
    [publicVenue],
    [{ sourceType: "url", url: venueLead.officialUrl }],
  );
  expect(audit.shapeValid).toBe(true);
  expect(audit.leads[0].returnedUrlInSources).toBe(true);
  expect(audit.identityVerified).toBe(false);
  expect(audit.factsVerified).toBe(false);
  expect(audit.automaticFetchAllowed).toBe(false);
  const changed = auditVenueSourceDiscovery(
    { venues: [{ ...venueLead, matchedName: "Museum B" }] },
    [publicVenue],
    [],
  );
  expect(changed.leads[0].nameDiffersFromCandidate).toBe(true);
  expect(changed.leads[0].returnedUrlInSources).toBe(false);
  for (const status of ["ambiguous", "unresolved"])
    expect(
      auditVenueSourceDiscovery(
        {
          venues: [
            {
              ...venueLead,
              status,
              officialUrl: null,
              matchedName: null,
              matchedAddress: null,
            },
          ],
        },
        [publicVenue],
        [],
      ).shapeValid,
    ).toBe(true);
});

test("venue discovery rejects missing, duplicate, substituted and malformed claims", () => {
  for (const venues of [
    [],
    [venueLead, venueLead],
    [{ ...venueLead, id: "another-id" }],
    [{ ...venueLead, status: ["candidate"] }],
    [
      {
        ...venueLead,
        status: ["unresolved"],
        officialUrl: null,
        matchedName: null,
        matchedAddress: null,
      },
    ],
    [{ ...venueLead, openingHours: "9-5" }],
    [{ ...venueLead, status: "unresolved" }],
    [{ ...venueLead, matchedName: null }],
    ...[
      "http://museum.example",
      "https://user:pass@museum.example",
      "https://127.0.0.1",
      "https://site.localhost",
      "https://museum.example/#fragment",
    ].map((officialUrl) => [{ ...venueLead, officialUrl }]),
  ])
    expect(
      auditVenueSourceDiscovery({ venues }, [publicVenue], []).shapeValid,
    ).toBe(false);
});

test("venue discovery requires URL retrieval evidence independently of valid output", () => {
  const output = { venues: [venueLead] };
  for (const sources of [[], [{ title: "Claimed official source" }]]) {
    const audit = auditVenueSourceDiscovery(output, [publicVenue], sources);
    expect(audit.shapeValid).toBe(true);
    expect(audit.retrievalEvidencePresent).toBe(false);
    expect(audit.qualityAccepted).toBe(false);
  }
  const audit = auditVenueSourceDiscovery(
    output,
    [publicVenue],
    [{ url: "https://search.example/redirect" }],
  );
  expect(audit.retrievalEvidencePresent).toBe(true);
  expect(audit.leads[0]?.returnedUrlInSources).toBe(false);
  expect(audit.identityVerified).toBe(false);
});

test("parallel discovery uses only provider-executed search results with excerpts", () => {
  const result = {
    toolName: "parallel_search",
    toolCallId: "call-1",
    providerExecuted: true,
    output: {
      searchId: "search-1",
      results: [
        {
          url: "https://museum.example/",
          title: "Museum",
          excerpt: "Museum A at 1 Example Street.",
        },
      ],
    },
  };
  const sources = parallelVenueSources([result]);
  expect(sources).toHaveLength(1);
  expect(sources[0]?.retrievalToolCallId).toBe("call-1");
  for (const change of [
    { providerExecuted: false },
    { providerExecuted: undefined },
    { toolName: "other" },
    { toolCallId: "" },
    { output: { error: "timeout" } },
    {
      output: {
        searchId: "search-1",
        results: [{ url: "https://museum.example/", title: "Museum" }],
      },
    },
  ]) {
    expect(parallelVenueSources([{ ...result, ...change }])).toEqual([]);
  }
  expect(
    parallelVenueSources([
      {
        ...result,
        output: {
          ...result.output,
          results: [{ ...result.output.results[0], url: "http://127.0.0.1" }],
        },
      },
    ]),
  ).toEqual([]);
});

test("parallel discovery supports the observed raw Gateway response without guessing mixed formats", () => {
  const result = {
    toolName: "parallel_search",
    toolCallId: "call-raw",
    providerExecuted: true,
    output: {
      search_id: "search-raw",
      results: [
        {
          url: "https://museum.example/",
          title: "Museum",
          excerpts: ["Museum A", "1 Example Street."],
        },
      ],
    },
  };
  expect(parallelVenueSources([result])[0]?.excerpt).toBe(
    "Museum A\n\n1 Example Street.",
  );
  expect(
    parallelVenueSources([
      { ...result, output: { ...result.output, searchId: "different" } },
    ]),
  ).toEqual([]);
  for (const excerpts of [
    [],
    [null],
    [42],
    [""],
    ["x".repeat(20001)],
    ["a".repeat(15000), "b".repeat(15000)],
  ]) {
    expect(
      parallelVenueSources([
        {
          ...result,
          output: {
            ...result.output,
            results: [{ ...result.output.results[0], excerpts }],
          },
        },
      ]),
    ).toEqual([]);
  }
  expect(
    parallelVenueSources([
      {
        ...result,
        output: {
          ...result.output,
          results: [{ ...result.output.results[0], excerpt: "other" }],
        },
      },
    ]),
  ).toEqual([]);
});

test("discovery candidates cannot silently change names or present unlinked URLs", () => {
  const audit = (lead: typeof venueLead, sources: unknown[]) =>
    auditVenueSourceDiscovery({ venues: [lead] }, [publicVenue], sources);
  expect(
    audit(venueLead, [{ url: venueLead.officialUrl }]).candidateIssues,
  ).toEqual([]);
  expect(
    audit({ ...venueLead, matchedName: "Museum B" }, [
      { url: venueLead.officialUrl },
    ]).candidateIssues,
  ).toEqual(["identity_name_change_requires_review:venue-a"]);
  expect(
    audit(venueLead, [{ url: "https://other.example/" }]).candidateIssues,
  ).toEqual(["official_url_not_in_retrieved_sources:venue-a"]);
  expect(
    audit({ ...venueLead, matchedName: "Museum B" }, []).candidateIssues,
  ).toHaveLength(2);
  expect(
    audit({ ...venueLead, matchedName: "  MUSEUM A  " }, [
      { url: venueLead.officialUrl },
    ]).candidateIssues,
  ).toEqual([]);
});

import { auditVenueIdentityExcerpts } from "../uat/lib/venue-identity-excerpts";
import {
  prepareDiningReplay,
  bindDiningReplay,
} from "../uat/lib/dining-replay";
import {
  auditDiningDiscovery,
  validatePublicDiningBrief,
  parseDiningDiscovery,
  diningOptionsForReview,
  expandCompactDiningDiscovery,
} from "../uat/lib/dining-discovery";

test("dining JSON permits a complete code fence without recovering arbitrary prose", () => {
  for (const text of [
    '{"venues":[]}',
    '```json\n{"venues":[]}\n```',
    '```\n{"venues":[]}\n```',
  ])
    expect(parseDiningDiscovery(text)).toEqual({ venues: [] });
  for (const text of [
    'Here is {"venues":[]}',
    '```json\n{"venues":[]}\n```\nextra',
    '{"venues":[]} {"venues":[]}',
    '```json\n{"venues":[]}',
  ])
    expect(parseDiningDiscovery(text)).toBe(null);
});

test("source-first dining keeps missing service and location facts unknown", () => {
  const brief = validatePublicDiningBrief({
    destination: "Example City",
    area: "Centre",
    meal: "breakfast",
    maxCandidates: 3,
  });
  const venue = {
    name: "Cafe A",
    url: "https://cafe.example/",
    address: "12 Main Street",
    nameQuote: "Cafe A",
    addressQuote: "12 Main Street",
    mealQuote: "Breakfast daily",
  };
  const tool = {
    toolName: "parallel_search",
    providerExecuted: true,
    toolCallId: "call1",
    output: {
      search_id: "search1",
      results: [
        {
          url: venue.url,
          title: "Cafe A",
          excerpts: ["12 Main Street. Breakfast daily."],
        },
      ],
    },
  };
  const audit = auditDiningDiscovery({ venues: [venue] }, [tool], brief);
  const compact = {
    name: venue.name,
    url: venue.url,
    address: venue.address,
    mealQuote: venue.mealQuote,
  };
  expect(
    auditDiningDiscovery(
      expandCompactDiningDiscovery({ venues: [compact] }),
      [tool],
      brief,
    ).options,
  ).toHaveLength(1);
  for (const change of [
    { address: "13 Main Street" },
    { name: "Unpublished Name" },
    { url: "https://invented.example/" },
    { nameQuote: "Cafe A" },
    { mealQuote: "Dinner daily" },
  ])
    expect(
      auditDiningDiscovery(
        expandCompactDiningDiscovery({ venues: [{ ...compact, ...change }] }),
        [tool],
        brief,
      ).options,
    ).toHaveLength(0);
  const replay = prepareDiningReplay({
    status: "completed",
    brief,
    retrievalResults: [tool],
    text: "DO_NOT_REPLAY_PRIOR_ANSWER",
  });
  expect(replay.prompt.includes("DO_NOT_REPLAY_PRIOR_ANSWER")).toBe(false);
  const selected = {
    sourceId: "source-0",
    name: venue.name,
    address: venue.address,
    mealQuote: venue.mealQuote,
  };
  const screened = prepareDiningReplay(
    { status: "completed", brief, retrievalResults: [tool] },
    true,
  );
  for (const assessment of [
    {
      sourceId: "source-0",
      publisherKind: "third_party",
      mealSupport: "explicit",
    },
    {
      sourceId: "source-0",
      publisherKind: "uncertain",
      mealSupport: "explicit",
    },
    {
      sourceId: "source-0",
      publisherKind: "operator_page",
      mealSupport: "contradicted",
    },
    {
      sourceId: "source-0",
      publisherKind: "operator_page",
      mealSupport: "not_established",
    },
  ])
    expect(
      auditDiningDiscovery(
        bindDiningReplay(
          { venues: [selected], screening: [assessment] },
          screened,
        ),
        [tool],
        brief,
      ).options,
    ).toHaveLength(0);
  const assessment = {
    sourceId: "source-0",
    publisherKind: "operator_page",
    mealSupport: "explicit",
  };
  expect(
    auditDiningDiscovery(
      bindDiningReplay(
        { venues: [selected], screening: [assessment] },
        screened,
      ),
      [tool],
      brief,
    ).options,
  ).toHaveLength(1);
  for (const screening of [
    [],
    [assessment, assessment],
    [{ ...assessment, sourceId: "invented" }],
  ])
    expect(bindDiningReplay({ venues: [selected], screening }, screened)).toBe(
      null,
    );
  expect(
    auditDiningDiscovery(
      bindDiningReplay({ venues: [selected] }, replay),
      [tool],
      brief,
    ).options,
  ).toHaveLength(1);
  for (const change of [
    { sourceId: "source-99" },
    { url: "https://invented.example" },
    { address: "13 Main Street" },
    { name: "Another Cafe" },
    { mealQuote: "Dinner daily" },
  ])
    expect(
      auditDiningDiscovery(
        bindDiningReplay({ venues: [{ ...selected, ...change }] }, replay),
        [tool],
        brief,
      ).options,
    ).toHaveLength(0);
  expect(() =>
    prepareDiningReplay({ status: "started", brief, retrievalResults: [tool] }),
  ).toThrow();
  expect(() =>
    prepareDiningReplay({
      status: "completed",
      brief,
      retrievalResults: [{ ...tool, providerExecuted: false }],
    }),
  ).toThrow();
  expect(audit.options).toHaveLength(1);
  const [reviewOption] = diningOptionsForReview(audit, "2026-11-02");
  expect(reviewOption.planningIdea).toBe(true);
  expect(reviewOption.source?.url).toBe(venue.url);
  expect(reviewOption.mealTypes).toEqual([]);
  expect(reviewOption.location.lat).toBeUndefined();
  expect(reviewOption.priceLevel).toBeUndefined();
  expect(reviewOption.reservationUrl).toBeUndefined();
  expect(diningOptionsForReview(audit, "2026-02-30")).toEqual([]);
  expect(audit.options[0]).toMatchObject({
    name: "Cafe A",
    coordinates: null,
    priceStatus: "unknown",
    mealTypes: [],
    mealServiceVerified: false,
    schedulable: false,
    sourceAuthorityVerified: false,
  });
  expect(
    auditDiningDiscovery(
      { venues: [{ ...venue, mealQuote: null }] },
      [tool],
      brief,
    ).options[0]?.mealQuote,
  ).toBe(null);
  for (const change of [
    { address: "14 Main Street" },
    { url: "https://invented.example/" },
    { mealQuote: "Breakfast and dinner daily" },
    { rating: 4.9 },
  ])
    expect(
      auditDiningDiscovery({ venues: [{ ...venue, ...change }] }, [tool], brief)
        .options,
    ).toHaveLength(0);
  expect(
    auditDiningDiscovery({ venues: [venue, venue] }, [tool], brief).rejected,
  ).toHaveLength(1);
  expect(
    auditDiningDiscovery(
      { venues: [venue] },
      [{ ...tool, providerExecuted: false }],
      brief,
    ).options,
  ).toHaveLength(0);
  expect(
    auditDiningDiscovery(
      { venues: [venue, venue, venue, venue] },
      [tool],
      brief,
    ).shapeValid,
  ).toBe(false);
  expect(() =>
    validatePublicDiningBrief({ ...brief, dietaryNeeds: "private" }),
  ).toThrow();
});
const identityLead = {
  id: "museum",
  status: "candidate",
  officialUrl: "https://museum.example/visit",
  matchedName: "Museum A",
  matchedAddress: "12 Main Street",
  nameQuote: "Welcome to Museum A.",
  addressQuote: "Visit us at 12 Main Street.",
};
const identitySource = {
  url: identityLead.officialUrl,
  excerptSegments: ["Welcome to Museum A. Visit us at 12 Main Street."],
};
test("identity copy evidence binds both fields to the same unique source without verifying a branch", () => {
  const row = auditVenueIdentityExcerpts([identityLead], [identitySource])[0]!;
  expect(row.copiedIdentityTextLinked).toBe(true);
  expect(row.sourceContentSha256).toMatch(/^[a-f0-9]{64}$/);
  expect(row.branchIdentityVerified).toBe(false);
  expect(row.sourceAuthorityVerified).toBe(false);
  expect(row.qualityAccepted).toBe(false);
  for (const sources of [
    [],
    [identitySource, identitySource],
    [{ ...identitySource, url: "https://other.example/" }],
    [{ ...identitySource, excerptSegments: ["Welcome to Museum A."] }],
  ])
    expect(
      auditVenueIdentityExcerpts([identityLead], sources)[0]
        ?.copiedIdentityTextLinked,
    ).toBe(false);
});
test("identity copy audit rejects paraphrases, filled-in addresses and stitched snippets", () => {
  for (const change of [
    { matchedName: "Museum B" },
    { matchedAddress: "12 Main Street, 12345" },
    { nameQuote: "Welcome to the Museum A." },
    { addressQuote: "Visit us at 12 Main St." },
    { addressQuote: null },
    { status: "ambiguous" },
    { matchedAddress: null },
    { nameQuote: 42 },
  ])
    expect(
      auditVenueIdentityExcerpts(
        [{ ...identityLead, ...change }],
        [identitySource],
      )[0]?.copiedIdentityTextLinked,
    ).toBe(false);
  expect(
    auditVenueIdentityExcerpts(
      [
        {
          ...identityLead,
          nameQuote: "Welcome to Museum A.\n\nVisit us at 12 Main Street.",
        },
      ],
      [
        {
          ...identitySource,
          excerptSegments: [
            "Welcome to Museum A.",
            "Visit us at 12 Main Street.",
          ],
        },
      ],
    )[0]?.copiedIdentityTextLinked,
  ).toBe(false);
  const changed = {
    ...identitySource,
    excerptSegments: [
      identitySource.excerptSegments[0] + " Other branch at 15 Main Street.",
    ],
  };
  expect(
    auditVenueIdentityExcerpts([identityLead], [changed])[0]
      ?.sourceContentSha256,
  ).not.toBe(
    auditVenueIdentityExcerpts([identityLead], [identitySource])[0]
      ?.sourceContentSha256,
  );
});

test("identity copy audit requires identity and source references", () => {
  for (const change of [{ id: null }, { officialUrl: null }, { id: "" }])
    expect(
      auditVenueIdentityExcerpts(
        [{ ...identityLead, ...change }],
        [{ ...identitySource, url: change.officialUrl ?? identitySource.url }],
      )[0]?.copiedIdentityTextLinked,
    ).toBe(false);
});

test("retrieved titles can support names with explicit metadata provenance, never addresses", () => {
  const source = {
    ...identitySource,
    title: "🗺️ Access | Museum A",
    excerptSegments: ["Visit us at 12 Main Street."],
  };
  const lead = { ...identityLead, nameQuote: "Museum A" };
  const row = auditVenueIdentityExcerpts([lead], [source])[0]!;
  expect(row.copiedIdentityTextLinked).toBe(true);
  const name = row.bindings.find((b) => b.field === "matchedName")!;
  expect(name.sourceField).toBe("title");
  expect(name.segmentIndex).toBe(-1);
  expect(source.title.slice(name.startUtf16, name.endUtf16)).toBe("Museum A");
  expect(
    row.bindings.find((b) => b.field === "matchedAddress")?.sourceField,
  ).toBe("excerpt");
  expect(row.sourceAuthorityVerified).toBe(false);
  expect(row.branchIdentityVerified).toBe(false);
  expect(row.qualityAccepted).toBe(false);
  for (const badSource of [
    { ...source, title: "Access | Museum B" },
    {
      ...source,
      title: "Access | Museum A at 12 Main Street",
      excerptSegments: ["Welcome."],
    },
    { ...source, url: "https://other.example/" },
    {
      ...source,
      title: "Museum",
      excerptSegments: ["A. Visit us at 12 Main Street."],
    },
  ]) {
    expect(
      auditVenueIdentityExcerpts([lead], [badSource])[0]
        ?.copiedIdentityTextLinked,
    ).toBe(false);
  }
  expect(
    auditVenueIdentityExcerpts(
      [lead],
      [{ ...source, title: "Access | Museum A" }],
    )[0]?.sourceContentSha256,
  ).not.toBe(row.sourceContentSha256);
});

test("identity evidence recovers original spans for whitespace changes without rewriting words", () => {
  const source = {
    ...identitySource,
    excerptSegments: [
      "🗺️ Welcome to Museum A. Visit us at 12 Main Street.\nBranch details: 12 Main Street  \nExample City",
    ],
  };
  const lead = {
    ...identityLead,
    matchedAddress: "12 Main Street Example City",
    addressQuote: "Branch details: 12 Main Street\nExample City",
  };
  const row = auditVenueIdentityExcerpts([lead], [source])[0]!;
  expect(row.copiedIdentityTextLinked).toBe(true);
  const binding = row.bindings.find((b) => b.field === "matchedAddress")!;
  expect(binding.sourceText).toBe(
    "Branch details: 12 Main Street  \nExample City",
  );
  expect(binding.sourceValue).toBe("12 Main Street  \nExample City");
  expect(
    source.excerptSegments[binding.segmentIndex]!.slice(
      binding.startUtf16,
      binding.endUtf16,
    ),
  ).toBe(binding.sourceText);
  for (const address of [
    "12 Main St Example City",
    "12 Main Street, Example City",
    "15 Main Street Example City",
    "12 Main Street Example City 12345",
  ])
    expect(
      auditVenueIdentityExcerpts(
        [{ ...lead, matchedAddress: address }],
        [source],
      )[0]?.copiedIdentityTextLinked,
    ).toBe(false);
});

test("discovery preserves supplied address differences instead of resolving them silently", () => {
  const audit = (address: string | undefined, matchedAddress: string | null) =>
    auditVenueSourceDiscovery(
      { venues: [{ ...venueLead, matchedAddress }] },
      [{ ...publicVenue, address }],
      [{ url: venueLead.officialUrl }],
    );
  expect(audit("1 Example Street", "2 Example Street").candidateIssues).toEqual(
    ["identity_address_change_requires_review:venue-a"],
  );
  expect(audit("1 Example Street", null).candidateIssues).toEqual([
    "supplied_address_not_supported:venue-a",
  ]);
  expect(
    audit("1 Example Street", "  1 EXAMPLE   STREET ").candidateIssues,
  ).toEqual([]);
  expect(audit(undefined, "1 Example Street").leads[0]?.addressComparison).toBe(
    "not_supplied",
  );
  expect(
    audit("1 Example Street, Unit 2", "1 Example Street, Unit 3")
      .candidateIssues,
  ).toHaveLength(1);
  expect(
    audit("1 Example St", "1 Example Street").leads[0]?.addressComparison,
  ).toBe("different_text");
});

import {
  prepareVenueSourceSelection,
  bindVenueSourceSelection,
} from "../uat/lib/venue-source-selection";
const selectionReceipt = {
  status: "completed",
  provenance: { inputSha256: "a".repeat(64) },
  retrievalResults: [
    {
      toolName: "parallel_search",
      toolCallId: "search-call",
      providerExecuted: true,
      output: {
        search_id: "search-id",
        results: [
          {
            url: "https://museum.example/visit",
            title: "Museum A",
            excerpts: ["Museum A at 12 Main Street."],
          },
        ],
      },
    },
  ],
};
test("source selection requires retained retrieval bound to the exact candidate input", () => {
  const sources = prepareVenueSourceSelection(selectionReceipt, "a".repeat(64));
  expect(sources[0]?.selectionId).toBe("source_1");
  expect(sources[0]?.url).toBe("https://museum.example/visit");
  for (const receipt of [
    { ...selectionReceipt, status: "started" },
    { ...selectionReceipt, provenance: { inputSha256: "b".repeat(64) } },
    { ...selectionReceipt, retrievalResults: [] },
    {
      ...selectionReceipt,
      retrievalResults: [
        { ...selectionReceipt.retrievalResults[0], providerExecuted: false },
      ],
    },
  ])
    expect(() =>
      prepareVenueSourceSelection(receipt, "a".repeat(64)),
    ).toThrow();
  expect(() =>
    prepareVenueSourceSelection(selectionReceipt, "invalid"),
  ).toThrow();
});
test("source selection supplies URLs from retained records and rejects invented references", () => {
  const sources = prepareVenueSourceSelection(selectionReceipt, "a".repeat(64));
  const lead = {
    id: "venue-a",
    status: "candidate",
    sourceId: "source_1",
    matchedName: "Museum A",
    matchedAddress: "12 Main Street",
    nameQuote: "Museum A",
    addressQuote: "12 Main Street",
    note: "Retained source candidate.",
  };
  const bound = bindVenueSourceSelection(
    { venues: [lead] },
    "venue-a",
    sources,
  );
  expect(bound.issues).toEqual([]);
  expect(bound.extracted?.venues[0]?.officialUrl).toBe(sources[0]?.url);
  expect(bound.selectedSources).toEqual([sources[0]!]);
  for (const change of [
    { sourceId: "source_999" },
    { sourceId: null },
    { id: "other-candidate" },
    { officialUrl: "https://invented.example/" },
    { status: "ambiguous" },
  ])
    expect(
      bindVenueSourceSelection(
        { venues: [{ ...lead, ...change }] },
        "venue-a",
        sources,
      ).issues.length,
    ).toBeGreaterThan(0);
  expect(
    bindVenueSourceSelection({ venues: [lead] }, "venue-a", [
      ...sources,
      ...sources,
    ]).issues.length,
  ).toBeGreaterThan(0);
  const unresolved = bindVenueSourceSelection(
    {
      venues: [
        {
          ...lead,
          status: "unresolved",
          sourceId: null,
          matchedName: null,
          matchedAddress: null,
          nameQuote: null,
          addressQuote: null,
        },
      ],
    },
    "venue-a",
    sources,
  );
  expect(unresolved.issues).toEqual([]);
  expect(unresolved.extracted?.venues[0]?.officialUrl).toBe(null);
  expect(unresolved.selectedSources).toEqual([]);
});

import { auditMapsIdentityEvidence } from "../uat/lib/maps-identity-evidence";
const mapPlace = {
  placeId: "ChIJabcdefghijk_12345",
  uri: "https://maps.google.com/maps?cid=123456789",
  title: "Museum A - Google Maps",
};
const mapMetadata = (chunks: unknown[]) => ({
  google: { groundingMetadata: { groundingChunks: chunks } },
});
test("Maps IDs come only from provider Maps chunks and repeated review links do not create venues", () => {
  const audit = auditMapsIdentityEvidence(
    mapMetadata([
      { maps: mapPlace },
      { maps: { ...mapPlace, placeId: "places/" + mapPlace.placeId } },
      {
        maps: {
          ...mapPlace,
          uri: "https://www.google.com/maps/reviews/data=example",
        },
      },
      { web: { ...mapPlace } },
    ]),
  );
  expect(audit.uniquePlaceCount).toBe(1);
  expect(audit.directPlaceCount).toBe(1);
  expect(audit.candidates[0]?.sources).toHaveLength(2);
  expect(audit.retrievalEvidencePresent).toBe(true);
  expect(audit.inputIdentityVerified).toBe(false);
  expect(audit.addressVerified).toBe(false);
  expect(audit.qualityAccepted).toBe(false);
  expect(
    auditMapsIdentityEvidence({ text: JSON.stringify(mapPlace) })
      .uniquePlaceCount,
  ).toBe(0);
  expect(
    auditMapsIdentityEvidence(mapMetadata([{ web: mapPlace }]))
      .uniquePlaceCount,
  ).toBe(0);
});
test("Maps evidence rejects spoofed URLs, malformed IDs, conflicting source IDs and review-only evidence", () => {
  for (const change of [
    { placeId: "bad" },
    { placeId: null },
    { title: "" },
    { uri: "http://maps.google.com/maps?cid=1" },
    { uri: "https://maps.google.com.evil.example/maps?cid=1" },
    { uri: "https://user:secret@maps.google.com/maps?cid=1" },
    { uri: "https://www.google.com/search?q=Museum" },
    { uri: "https://www.google.com/maps/search?q=Museum" },
  ]) {
    const audit = auditMapsIdentityEvidence(
      mapMetadata([{ maps: { ...mapPlace, ...change } }]),
    );
    expect(audit.rejectedMapChunks).toBe(1);
    expect(audit.retrievalEvidencePresent).toBe(false);
  }
  const review = auditMapsIdentityEvidence(
    mapMetadata([
      {
        maps: {
          ...mapPlace,
          uri: "https://www.google.com/maps/reviews/data=example",
        },
      },
    ]),
  );
  expect(review.uniquePlaceCount).toBe(1);
  expect(review.directPlaceCount).toBe(0);
  expect(review.retrievalEvidencePresent).toBe(false);
  const conflict = auditMapsIdentityEvidence(
    mapMetadata([
      { maps: mapPlace },
      { maps: { ...mapPlace, placeId: "ChIJotherplace_98765" } },
    ]),
  );
  expect(conflict.conflictingSourceUrls).toEqual([mapPlace.uri]);
  expect(conflict.retrievalEvidencePresent).toBe(false);
});

test("Maps prose cannot supply a second place citation missing from provider metadata", () => {
  const metadata = mapMetadata([{ maps: mapPlace }]);
  const missing = "https://maps.google.com/maps?cid=999999";
  const audit = auditMapsIdentityEvidence(
    metadata,
    `[Museum](${mapPlace.uri}) and another: ${missing}.`,
  );
  expect(audit.modelMapCitationCount).toBe(2);
  expect(audit.unbackedModelMapUrls).toEqual([missing]);
  expect(audit.candidates).toHaveLength(1);
  expect(audit.inputIdentityVerified).toBe(false);
  expect(auditMapsIdentityEvidence(metadata).citationCoverageChecked).toBe(
    false,
  );
  expect(
    auditMapsIdentityEvidence(metadata, `Source: ${mapPlace.uri}`)
      .unbackedModelMapUrls,
  ).toEqual([]);
  expect(
    auditMapsIdentityEvidence(
      metadata,
      "https://www.google.com/search?q=museum",
    ).modelMapCitationCount,
  ).toBe(0);
});

import {
  validatePublicVenueBrief,
  publicVenueDiscoveryPrompt,
  retrievedVenueSeeds,
} from "../uat/lib/retrieved-venue-seeds";
const publicBrief = {
  destination: "Example City",
  category: "cafe" as const,
  maxCandidates: 3,
};
test("retrieval-first briefs accept only bounded public search fields", () => {
  expect(validatePublicVenueBrief(publicBrief)).toEqual(publicBrief);
  for (const value of [
    null,
    { ...publicBrief, dietaryNeeds: ["vegan"] },
    { ...publicBrief, userId: "private" },
    { ...publicBrief, maxCandidates: 0 },
    { ...publicBrief, maxCandidates: 9 },
    { ...publicBrief, maxCandidates: 1.5 },
    { ...publicBrief, category: "anything" },
    { ...publicBrief, area: "" },
  ])
    expect(() => validatePublicVenueBrief(value)).toThrow();
  expect(publicVenueDiscoveryPrompt(publicBrief)).toContain(
    "no preselected venue names",
  );
});
test("retrieval-first seeds preserve provider branches and never fill unknown planning fields", () => {
  const second = {
    ...mapPlace,
    placeId: "ChIJanotherbranch123",
    uri: "https://maps.google.com/maps?cid=987654321",
  };
  const seeds = retrievedVenueSeeds(
    publicBrief,
    mapMetadata([
      { maps: mapPlace },
      { maps: second },
      {
        maps: {
          ...mapPlace,
          uri: "https://www.google.com/maps/reviews/data=review",
        },
      },
    ]),
    `${mapPlace.uri} ${second.uri}`,
  );
  expect(seeds.candidates).toHaveLength(2);
  expect(seeds.candidates[0]?.name).toBe("Museum A");
  expect(seeds.candidates[0]?.id).not.toBe(seeds.candidates[1]?.id);
  expect(seeds.requestedCountReached).toBe(false);
  expect(seeds.candidates[0]).toMatchObject({
    address: null,
    coordinates: null,
    mealTypes: [],
    hours: null,
    priceStatus: "unknown",
    locationVerified: false,
    categoryVerified: false,
    schedulable: false,
  });
  expect(seeds.userSelectedOrLockedVenuesChanged).toBe(false);
  const limited = retrievedVenueSeeds(
    { ...publicBrief, maxCandidates: 1 },
    mapMetadata([{ maps: mapPlace }, { maps: second }]),
    `${mapPlace.uri} ${second.uri}`,
  );
  expect(limited.candidates).toHaveLength(1);
  expect(limited.omittedByLimit).toBe(1);
  expect(
    retrievedVenueSeeds(
      publicBrief,
      mapMetadata([
        { web: mapPlace },
        {
          maps: {
            ...mapPlace,
            uri: "https://www.google.com/maps/reviews/data=review",
          },
        },
      ]),
      mapPlace.uri,
    ).candidates,
  ).toEqual([]);
});

test("retrieved seed IDs remain bounded and conflicting provider records cannot be rescued by another URL", () => {
  const longId = retrievedVenueSeeds(
    publicBrief,
    mapMetadata([{ maps: { ...mapPlace, placeId: "x".repeat(255) } }]),
    mapPlace.uri,
  ).candidates[0]!;
  expect(longId.id.length <= 100).toBe(true);
  expect(longId.providerPlaceId).toHaveLength(255);
  const conflicting = mapMetadata([
    { maps: mapPlace },
    { maps: { ...mapPlace, placeId: "ChIJotherbranch123" } },
    { maps: { ...mapPlace, uri: "https://maps.google.com/maps?cid=456789" } },
  ]);
  expect(
    retrievedVenueSeeds(publicBrief, conflicting, mapPlace.uri).candidates,
  ).toEqual([]);
});

test("retrieved pool excludes uncited context records and model-only names", () => {
  const context = {
    ...mapPlace,
    placeId: "ChIJcontextoffice123",
    uri: "https://maps.google.com/maps?cid=987654",
    title: "Example Administration - Google Maps",
  };
  const metadata = mapMetadata([{ maps: context }, { maps: mapPlace }]);
  const result = retrievedVenueSeeds(
    publicBrief,
    metadata,
    `Invented Museum at ${mapPlace.uri}; another unbacked name at https://maps.google.com/maps?cid=00000`,
  );
  expect(result.retrievedPlaceCount).toBe(2);
  expect(result.candidates).toHaveLength(1);
  expect(result.candidates[0]?.name).toBe("Museum A");
  expect(
    retrievedVenueSeeds(publicBrief, metadata, "No source citations")
      .candidates,
  ).toEqual([]);
});

test("indexed meal evidence copies one source range and rejects invalid selectors", () => {
  const brief = {
    destination: "Example City",
    area: "Centre",
    meal: "lunch",
    maxCandidates: 3,
  };
  const tool = {
    toolName: "parallel_search",
    providerExecuted: true,
    toolCallId: "indexed",
    output: {
      search_id: "indexed",
      results: [
        {
          url: "https://cafe.example/",
          title: "Cafe A",
          excerpts: [
            "12 Main Street\nLunch menu\nWeekdays only\nReservations required",
            "Dinner is not served",
          ],
        },
      ],
    },
  };
  const input = { status: "completed", brief, retrievalResults: [tool] };
  const replay = prepareDiningReplay(input, true, true);
  const selection = {
    screening: [
      {
        sourceId: "source-0",
        publisherKind: "operator_page",
        mealSupport: "explicit",
      },
    ],
    venues: [
      {
        sourceId: "source-0",
        name: "Cafe A",
        address: "12 Main Street",
        mealEvidence: { excerpt: 0, startLine: 1, endLine: 3 },
      },
    ],
  };
  const audit = (value: unknown) =>
    auditDiningDiscovery(bindDiningReplay(value, replay), [tool], replay.brief);
  expect(audit(selection).options[0]?.mealQuote).toBe(
    "Lunch menu\nWeekdays only\nReservations required",
  );
  expect(audit(selection).options[0]?.schedulable).toBe(false);
  for (const span of [
    null,
    {},
    { excerpt: 0, startLine: -1, endLine: 1 },
    { excerpt: 0, startLine: 2, endLine: 1 },
    { excerpt: 1, startLine: 0, endLine: 1 },
    { excerpt: 99, startLine: 0, endLine: 0 },
    { excerpt: "__proto__", startLine: 0, endLine: 0 },
    { excerpt: 0, startLine: "1", endLine: 2 },
    { excerpt: 0, startLine: 1.5, endLine: 2 },
    { excerpt: 0, startLine: 1, endLine: 2, quote: "Lunch daily" },
  ])
    expect(
      audit({
        ...selection,
        venues: [{ ...selection.venues[0], mealEvidence: span }],
      }).options,
    ).toHaveLength(0);
  expect(
    audit({
      ...selection,
      venues: [{ ...selection.venues[0], mealQuote: "Lunch daily" }],
    }).options,
  ).toHaveLength(0);
  expect(
    audit({
      ...selection,
      screening: [{ ...selection.screening[0], publisherKind: "third_party" }],
    }).options,
  ).toHaveLength(0);
  expect(() => prepareDiningReplay(input, false, true)).toThrow();
});

test("area screening requires a grounded assessment and excludes uncertain or outside branches", () => {
  const brief = {
    destination: "Example City",
    area: "Old Town",
    meal: "dinner",
    maxCandidates: 3,
  };
  const excerpt =
    "Our Bistro A at 12 Main Street, Old Town, Example City serves dinner.";
  const tool = {
    toolName: "parallel_search",
    providerExecuted: true,
    toolCallId: "area",
    output: {
      search_id: "area",
      results: [
        {
          url: "https://bistro.example/",
          title: "Bistro A",
          excerpts: [excerpt],
        },
      ],
    },
  };
  const input = { status: "completed", brief, retrievalResults: [tool] };
  const replay = prepareDiningReplay(input, true, false, true);
  const assessment = {
    sourceId: "source-0",
    publisherKind: "operator_page",
    mealSupport: "explicit",
    areaFit: "supported",
    areaQuote: "12 Main Street, Old Town, Example City",
  };
  const venues = [
    {
      sourceId: "source-0",
      name: "Bistro A",
      address: "12 Main Street",
      mealQuote: "serves dinner",
    },
  ];
  const select = (a: unknown) =>
    bindDiningReplay({ screening: [a], venues }, replay);
  expect(
    auditDiningDiscovery(select(assessment), [tool], replay.brief).options,
  ).toHaveLength(1);
  for (const change of [
    { areaFit: "outside" },
    { areaFit: "uncertain", areaQuote: null },
  ])
    expect(
      auditDiningDiscovery(
        select({ ...assessment, ...change }),
        [tool],
        replay.brief,
      ).options,
    ).toHaveLength(0);
  for (const change of [
    { areaFit: "unknown" },
    { areaQuote: null },
    { areaQuote: "Title-only location" },
    { areaQuote: "Invented Old Town address" },
    { areaFit: "uncertain" },
  ])
    expect(select({ ...assessment, ...change })).toBe(null);
  expect(() => prepareDiningReplay(input, false, false, true)).toThrow();
});
