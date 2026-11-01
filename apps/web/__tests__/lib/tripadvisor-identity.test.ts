import { beforeEach, afterEach, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("TRIPADVISOR_API_KEY", "test-only-placeholder");
  vi.stubEnv("TRIPADVISOR_ENRICHMENT_LIMIT", "6");
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
const item = {
  name: "Cafe North",
  location: {
    name: "Example City",
    address: "12 Main Street, Example City, 12345, Country",
  },
};
const match = {
  location_id: "123",
  name: item.name,
  address_obj: { address_string: item.location.address },
  rating: "4.5",
  num_reviews: "80",
  web_url: "https://www.tripadvisor.com/example",
};
async function enrich(results: unknown[], candidate = item) {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ data: results })),
  );
  const { enrichWithTripAdvisor } =
    await import("@/lib/affiliates/tripadvisor");
  return enrichWithTripAdvisor([candidate], "restaurants");
}
it("skips the unrelated first result and uses one exact name/address match without mutating input", async () => {
  const result = await enrich([
    { ...match, location_id: "wrong", name: "Cafe South" },
    match,
  ]);
  expect(result[0]).toMatchObject({
    tripadvisorRating: 4.5,
    tripadvisorReviewCount: 80,
  });
  expect(item).not.toHaveProperty("tripadvisorRating");
});
it.each([
  [{ ...match, name: "Cafe North Airport" }],
  [
    {
      ...match,
      address_obj: {
        address_string: "99 Main Street, Example City, 12345, Country",
      },
    },
  ],
  [
    {
      ...match,
      address_obj: {
        address_string: "12 Main Street, Other City, 12345, Country",
      },
    },
  ],
  [{ ...match, address_obj: undefined }],
  [{ ...match, location_id: "" }],
  [match, { ...match, location_id: "456" }],
])(
  "leaves missing, wrong-branch or ambiguous identity unenriched (%#)",
  async (...results) => {
    expect(await enrich(results)).toEqual([item]);
  },
);
it("accepts formatting differences while preserving street and postcode identity", async () => {
  const result = await enrich([
    {
      ...match,
      name: "  CAFE NORTH  ",
      address_obj: {
        address_string: "12 Main Street  Example City 12345 Country",
      },
    },
  ]);
  expect(result[0]).toHaveProperty("tripadvisorRating", 4.5);
});
it("does not spend a request when the candidate lacks an address", async () => {
  const candidate = { ...item, location: { ...item.location, address: "" } };
  expect(await enrich([match], candidate)).toEqual([candidate]);
  expect(globalThis.fetch).not.toHaveBeenCalled();
});
it("uses structured postal address fields when no complete address string is supplied", async () => {
  const result = await enrich([
    {
      ...match,
      address_obj: {
        street1: "12 Main Street",
        city: "Example City",
        postalcode: "12345",
        country: "Country",
      },
    },
  ]);
  expect(result[0]).toHaveProperty("tripadvisorRating", 4.5);
});
