import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { HOTEL_SEARCH_CONSENT_VERSION } from "@faroway/constants";
const { auth, load, configured, search, limit } = vi.hoisted(() => ({
  auth: vi.fn(),
  load: vi.fn(),
  configured: vi.fn(),
  search: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("@/lib/auth/middleware", () => ({ requireUserIdFromRequest: auth }));
vi.mock("@/lib/trips/load-trip", () => ({ loadTripForUserUncached: load }));
vi.mock("@/lib/affiliates/liteapi", () => ({
  isLiteApiConfigured: configured,
  searchLiteApiHotels: search,
}));
vi.mock("@/lib/security/rate-limit", () => ({ checkRateLimitAsync: limit }));
import { POST } from "@/app/api/trips/[id]/hotels/route";
const trip = {
  id: "trip-1",
  destination: "Paris",
  start_date: "2026-11-08",
  end_date: "2026-11-10",
  travelers: 3,
  updated_at: "revision-1",
  preferences: {
    hotelSearch: {
      countryCode: "FR",
      guestNationality: "US",
      rooms: [{ adults: 2, children: [8] }],
      consentVersion: HOTEL_SEARCH_CONSENT_VERSION,
    },
  },
};
const request = (body: unknown = { expectedUpdatedAt: trip.updated_at }) =>
  new NextRequest("https://fixture.test/api/trips/trip-1/hotels", {
    method: "POST",
    body: JSON.stringify(body),
  });
const invoke = (body?: unknown) =>
  POST(request(body), { params: Promise.resolve({ id: trip.id }) });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VERCEL_ENV", "preview");
  auth.mockResolvedValue({ userId: "owner" });
  load.mockResolvedValue({ trip });
  configured.mockReturnValue(true);
  limit.mockResolvedValue({ allowed: true });
  search.mockResolvedValue({ sandbox: true, data: [] });
});
afterEach(() => vi.unstubAllEnvs());
it("rejects unauthenticated requests before reading private trips", async () => {
  auth.mockResolvedValue(NextResponse.json({}, { status: 401 }));
  expect((await invoke()).status).toBe(401);
  expect(load).not.toHaveBeenCalled();
});
it("does not call the supplier for a trip the requester cannot access", async () => {
  load.mockResolvedValue(null);
  expect((await invoke()).status).toBe(404);
  expect(search).not.toHaveBeenCalled();
  expect(load).toHaveBeenCalledWith(trip.id, "owner");
});
it("requires the current revision before sharing any guest data", async () => {
  expect((await invoke({ expectedUpdatedAt: "old" })).status).toBe(409);
  expect(search).not.toHaveBeenCalled();
});
it("rejects inconsistent saved guest counts", async () => {
  load.mockResolvedValue({ trip: { ...trip, travelers: 2 } });
  expect((await invoke()).status).toBe(400);
  expect(search).not.toHaveBeenCalled();
});
it("never activates sandbox searches in production", async () => {
  vi.stubEnv("VERCEL_ENV", "production");
  expect((await invoke()).status).toBe(503);
  expect(search).not.toHaveBeenCalled();
});
it("uses saved guest details instead of caller-supplied overrides", async () => {
  const response = await invoke({
    expectedUpdatedAt: trip.updated_at,
    guestNationality: "GB",
    occupancies: [{ adults: 8 }],
  });
  expect(response.status).toBe(200);
  expect(search).toHaveBeenCalledWith(
    expect.objectContaining({
      guestNationality: "US",
      occupancies: [{ adults: 2, children: [8] }],
    }),
  );
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toMatchObject({
    tripId: trip.id,
    tripUpdatedAt: trip.updated_at,
    sandbox: true,
    hotels: [],
  });
});
it("discards quotes if another device changes the brief during supplier search", async () => {
  load
    .mockResolvedValueOnce({ trip })
    .mockResolvedValueOnce({ trip: { ...trip, updated_at: "revision-2" } });
  expect((await invoke()).status).toBe(409);
});
