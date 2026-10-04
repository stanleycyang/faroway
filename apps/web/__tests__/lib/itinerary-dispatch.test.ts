import { beforeEach, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
const send = vi.hoisted(() => vi.fn());
let trip: unknown;
let deletion: unknown;
const from = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => ({ rpc, from }),
}));
vi.mock("@/lib/notifications/expo", () => ({ sendItineraryReadyPush: send }));
import { dispatchItineraryReady } from "@/lib/notifications/itinerary-dispatch";
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PUSH_DELIVERY_ENABLED", "true");
  vi.stubEnv("PUSH_CONSENT_V2_ENABLED", "true");
  rpc.mockResolvedValue({
    data: { userId: "owner", itineraryId: "saved-itinerary" },
    error: null,
  });
  send.mockResolvedValue({ sent: 1, failed: 0 });
  trip = { id: "trip" };
  deletion = null;
  from.mockImplementation((table: string) => {
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      update: vi.fn(),
      maybeSingle: vi.fn(async () => ({
        data: table === "trips" ? trip : deletion,
        error: null,
      })),
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.update.mockReturnValue(chain);
    return chain;
  });
});
it("makes no provider or database calls while disabled", async () => {
  vi.stubEnv("PUSH_DELIVERY_ENABLED", "false");
  expect(await dispatchItineraryReady("trip", "search")).toBe("disabled");
  expect(rpc).not.toHaveBeenCalled();
  expect(send).not.toHaveBeenCalled();
});
it("uses a durable current-generation claim before provider dispatch", async () => {
  expect(await dispatchItineraryReady("trip", "search")).toBe("accepted");
  expect(rpc).toHaveBeenCalledWith("claim_itinerary_push", {
    p_trip_id: "trip",
    p_search_id: "search",
  });
  expect(send).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      userId: "owner",
      itineraryId: "saved-itinerary",
    }),
  );
});
it.each(["duplicate", "opted-out", "stale"])(
  "skips a refused claim (%s)",
  async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await dispatchItineraryReady("trip", "search")).toBe("skipped");
    expect(send).not.toHaveBeenCalled();
  },
);
it("rechecks deletion and replaced itinerary after a successful claim", async () => {
  deletion = { user_id: "owner" };
  await dispatchItineraryReady("trip", "search");
  expect(send).not.toHaveBeenCalled();
  deletion = null;
  trip = null;
  await dispatchItineraryReady("trip", "search");
  expect(send).not.toHaveBeenCalled();
});
it("does not fail planning or resend after an ambiguous provider failure", async () => {
  send.mockRejectedValue(new Error("timeout"));
  expect(await dispatchItineraryReady("trip", "search")).toBe("unavailable");
  rpc.mockResolvedValue({ data: null, error: null });
  await dispatchItineraryReady("trip", "search");
  expect(send).toHaveBeenCalledTimes(1);
});
