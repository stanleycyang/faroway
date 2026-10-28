import { afterEach, expect, it, vi } from "vitest";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});
it("serializes children by age and adults by type without live supplier calls", async () => {
  vi.stubEnv("DUFFEL_API_TOKEN", "fixture-token");
  vi.resetModules();
  const fetch = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ data: { offers: [] } })));
  vi.stubGlobal("fetch", fetch);
  const { searchDuffelFlights } = await import("@/lib/affiliates/duffel");
  await searchDuffelFlights({
    origin: "LAX",
    destination: "JFK",
    departureDate: "2027-01-01",
    passengers: [
      { type: "adult", count: 2 },
      { age: 0, count: 1 },
      { age: 17, count: 1 },
    ],
  });
  expect(JSON.parse(fetch.mock.calls[0][1].body).data.passengers).toEqual([
    { type: "adult" },
    { type: "adult" },
    { age: 0 },
    { age: 17 },
  ]);
});
it.each(
  [
    [],
    [{ age: 18, count: 1 }],
    [{ type: "adult" as const, age: 5, count: 1 }],
    [{ type: "adult" as const, count: 0 }],
    [{ count: 1 }],
  ].map((passengers) => ({ passengers })),
)(
  "invalid passengers never reach the supplier (%j)",
  async ({ passengers }) => {
    vi.stubEnv("DUFFEL_API_TOKEN", "fixture-token");
    vi.resetModules();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { searchDuffelFlights } = await import("@/lib/affiliates/duffel");
    expect(
      await searchDuffelFlights({
        origin: "LAX",
        destination: "JFK",
        departureDate: "2027-01-01",
        passengers,
      }),
    ).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  },
);
