import { beforeEach, expect, it, vi } from "vitest";
import {
  FLIGHT_SEARCH_CONSENT_VERSION,
  LITEAPI_FLIGHT_CONSENT_VERSION,
  flightSearchProvider,
  validateFlightSearchDetails,
  flightQuoteIsCurrent,
} from "@faroway/constants";
import {
  validBriefComposition,
  TravelerRequirementsSchema,
} from "@/lib/trips/brief";
import type { SearchPlan } from "@faroway/types";
const mocks = vi.hoisted(() => ({
  duffel: vi.fn(),
  liteapi: vi.fn(),
  link: vi.fn(),
}));
vi.mock("@/lib/affiliates/duffel", () => ({
  isDuffelConfigured: () => true,
  searchDuffelFlights: mocks.duffel,
  generateDuffelLink: mocks.link,
}));
vi.mock("@/lib/affiliates/liteapi-flights", () => ({
  searchLiteApiFlights: mocks.liteapi,
}));
import { runTransportAgent } from "@/lib/search/agents/transport";
const plan = {
  travelerType: "family",
  adults: 2,
  children: 1,
  childAges: [7],
  dates: { start: "2027-06-01", end: "2027-06-05", nights: 4 },
  transportCriteria: { originAirport: "LAX", destinationAirport: "JFK" },
} as SearchPlan;
beforeEach(() => {
  vi.clearAllMocks();
  mocks.duffel.mockResolvedValue([]);
  mocks.liteapi.mockResolvedValue({ sandbox: false, offers: [] });
});
it("requires versioned consent, numeric ages and exact party composition", () => {
  const details = {
    childAges: [0, 17],
    consentVersion: FLIGHT_SEARCH_CONSENT_VERSION,
  };
  expect(validateFlightSearchDetails(details, 2)).toBe(true);
  for (const invalid of [
    { ...details, consentVersion: "old" },
    { ...details, childAges: [18] },
    { ...details, childAges: ["7"] },
    { ...details, childAges: [2.5] },
  ])
    expect(validateFlightSearchDetails(invalid)).toBe(false);
  expect(
    validBriefComposition(4, { adults: 2, children: 2, flightSearch: details }),
  ).toBe(true);
  expect(
    validBriefComposition(3, { adults: 2, children: 1, flightSearch: details }),
  ).toBe(false);
});
it.each([
  { children: undefined, childAges: undefined },
  { childAges: undefined },
  { childAges: [] },
  { childAges: [18] },
  { adults: 1 },
])("never sends an incomplete family as adults (%j)", async (patch) => {
  expect(await runTransportAgent({ ...plan, ...patch }, 3)).toEqual([]);
  expect(mocks.duffel).not.toHaveBeenCalled();
});
it("sends exact child ages only to the supported supplier", async () => {
  await runTransportAgent(plan, 3);
  expect(mocks.duffel).toHaveBeenCalledWith(
    expect.objectContaining({
      passengers: [
        { type: "adult", count: 2 },
        { age: 7, count: 1 },
      ],
    }),
  );
});
it("discards expired and undated offers before generating links", async () => {
  mocks.duffel.mockResolvedValue([
    { offerId: "expired", expiresAt: "2000-01-01T00:00:00Z" },
    { offerId: "undated" },
  ]);
  expect(await runTransportAgent(plan, 3)).toEqual([]);
  expect(mocks.link).not.toHaveBeenCalled();
});
it("expires Duffel price references at the exact boundary", () => {
  const now = Date.parse("2027-01-01T00:00:00Z");
  for (const expiresAt of [
    undefined,
    "bad",
    "2027-01-01T00:00:00Z",
    "2026-12-31T23:59:59Z",
  ])
    expect(
      flightQuoteIsCurrent({ affiliatePartner: "duffel", expiresAt }, now),
    ).toBe(false);
  expect(
    flightQuoteIsCurrent(
      { affiliatePartner: "duffel", expiresAt: "2027-01-01T00:00:01Z" },
      now,
    ),
  ).toBe(true);
});
it("rejects unrecognized or unbounded traveler requirements", () => {
  const needs = {
    allergies: ["peanut"],
    dietaryPreferences: [],
    accessibility: ["step_free_entrance"],
    mobilityNotes: "",
  };
  expect(TravelerRequirementsSchema.safeParse(needs).success).toBe(true);
  expect(
    TravelerRequirementsSchema.safeParse({
      ...needs,
      accessibility: ["verified"],
    }).success,
  ).toBe(false);
  expect(
    TravelerRequirementsSchema.safeParse({
      ...needs,
      mobilityNotes: "x".repeat(501),
    }).success,
  ).toBe(false);
});

it("keeps consent scoped to the supplier and supports an adult-only LiteAPI party", async () => {
  expect(
    flightSearchProvider({
      childAges: [],
      consentVersion: FLIGHT_SEARCH_CONSENT_VERSION,
    }),
  ).toBe("duffel");
  expect(
    flightSearchProvider({
      childAges: [],
      consentVersion: LITEAPI_FLIGHT_CONSENT_VERSION,
    }),
  ).toBe("liteapi");
  expect(flightSearchProvider(null)).toBeUndefined();
  await runTransportAgent(
    { ...plan, flightProvider: "liteapi", children: 0, childAges: [] },
    2,
  );
  expect(mocks.liteapi).toHaveBeenCalledWith(
    expect.objectContaining({ adults: 2, childAges: [] }),
  );
  expect(mocks.duffel).not.toHaveBeenCalled();
});
it("does not share a LiteAPI-consented party with Duffel on failure", async () => {
  mocks.liteapi.mockRejectedValue(new Error("unapproved"));
  expect(
    await runTransportAgent({ ...plan, flightProvider: "liteapi" }, 3),
  ).toEqual([]);
  expect(mocks.duffel).not.toHaveBeenCalled();
});
it("does not call suppliers after explicit consent revocation", async () => {
  expect(
    await runTransportAgent({ ...plan, flightProvider: "none" }, 3),
  ).toEqual([]);
  expect(mocks.duffel).not.toHaveBeenCalled();
  expect(mocks.liteapi).not.toHaveBeenCalled();
});
it("never publishes sandbox offers into a saved itinerary", async () => {
  mocks.liteapi.mockResolvedValue({ sandbox: true, offers: [{ price: 1 }] });
  expect(
    await runTransportAgent({ ...plan, flightProvider: "liteapi" }, 3),
  ).toEqual([]);
});
it("applies the same expiry rule to LiteAPI prices", () => {
  expect(flightQuoteIsCurrent({ affiliatePartner: "liteapi" })).toBe(false);
  expect(
    flightQuoteIsCurrent({
      affiliatePartner: "liteapi",
      expiresAt: "2000-01-01T00:00:00Z",
    }),
  ).toBe(false);
});
