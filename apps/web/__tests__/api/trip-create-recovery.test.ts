import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
let userId = "owner";
const rows = new Map<string, Record<string, unknown>>();
const receipts = new Map<string, { id: string; hash: string }>();
let unavailable = false;
vi.mock("@/lib/supabase/server", () => ({
  createClientFromRequest: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
  }),
  getSupabase: () => ({
    rpc: async (
      _name: string,
      params: {
        p_user_id: string;
        p_request_key: string;
        p_input: Record<string, unknown>;
      },
    ) => {
      if (unavailable) return { error: { code: "PGRST202" }, data: null };
      const input = params.p_input;
      const key = `${params.p_user_id}:${params.p_request_key}`;
      const hash = (input.preferences as { creationRequestHash: string })
        .creationRequestHash;
      const saved = receipts.get(key);
      if (saved) {
        const trip = rows.get(saved.id);
        return {
          data: !trip
            ? { outcome: "gone" }
            : saved.hash !== hash
              ? { outcome: "key_conflict" }
              : { outcome: "replayed", trip },
          error: null,
        };
      }
      if (rows.has(String(input.id)))
        return { error: { code: "23505" }, data: null };
      rows.set(String(input.id), input);
      receipts.set(key, { id: String(input.id), hash });
      return { data: { outcome: "created", trip: input }, error: null };
    },
  }),
}));
import { POST } from "@/app/api/trips/route";
const payload = {
  requestId: "00000000-0000-4000-8000-000000000009",
  destination: "Paris",
  start_date: "2099-06-01",
  end_date: "2099-06-04",
  travelers: 2,
};
const post = (body = payload) =>
  POST(
    new NextRequest("http://localhost/api/trips", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
beforeEach(() => {
  rows.clear();
  receipts.clear();
  unavailable = false;
  userId = "owner";
});
describe("recoverable trip creation", () => {
  it("persists consented hotel guests through creation and replay", async () => {
    const hotelSearch = {
      countryCode: "FR",
      guestNationality: "CA",
      rooms: [{ adults: 2, children: [] }],
      consentVersion: "hotel-search-nuitee-v1",
    };
    const input = { ...payload, preferences: { hotelSearch } };
    expect((await post(input)).status).toBe(201);
    expect((await post(input)).status).toBe(200);
    expect(rows.get(payload.requestId)?.preferences).toMatchObject({
      hotelSearch,
    });
  });
  it("returns the same trip for simultaneous requests and lost-response replay", async () => {
    const responses = await Promise.all([post(), post(), post()]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 200, 201]);
    expect(rows.size).toBe(1);
    for (const response of responses)
      expect((await response.json()).trip.id).toBe(payload.requestId);
  });
  it("rejects changed inputs on the same request ID without modifying the saved trip", async () => {
    await post();
    expect((await post({ ...payload, destination: "Tokyo" })).status).toBe(409);
    expect(rows.get(payload.requestId)?.destination).toBe("Paris");
  });
  it("does not expose another user's trip when an ID is reused", async () => {
    await post();
    userId = "other-user";
    const response = await post();
    expect(response.status).toBe(409);
    expect((await response.json()).trip).toBeUndefined();
    expect(rows.size).toBe(1);
  });
});

it("does not recreate a deleted trip on a delayed retry", async () => {
  expect((await post()).status).toBe(201);
  rows.delete(payload.requestId);
  const replay = await post();
  expect(replay.status).toBe(410);
  expect((await replay.json()).code).toBe("CREATION_DELETED");
  expect(rows.size).toBe(0);
});
it("fails closed if the durable creation schema is unavailable", async () => {
  unavailable = true;
  expect((await post()).status).toBe(503);
  expect(rows.size).toBe(0);
});
it("rejects a destination containing only whitespace", async () => {
  expect((await post({ ...payload, destination: "   " })).status).toBe(400);
  expect(rows.size).toBe(0);
});
it("replays current trip state without overwriting a later edit", async () => {
  await post();
  rows.get(payload.requestId)!.destination = "Rome";
  const response = await post();
  expect(response.status).toBe(200);
  expect((await response.json()).trip.destination).toBe("Rome");
});
