import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
let userId = "owner";
const rows = new Map<string, Record<string, unknown>>();
vi.mock("@/lib/supabase/server", () => ({
  createClientFromRequest: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: userId } } }) },
    from: () => {
      let insert: Record<string, unknown> | null = null;
      const filters: Record<string, unknown> = {};
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      chain.insert = vi.fn((value: Record<string, unknown>) => {
        insert = value;
        return chain;
      });
      chain.select = vi.fn(() => chain);
      chain.eq = vi.fn((key: string, value: unknown) => {
        filters[key] = value;
        return chain;
      });
      chain.single = vi.fn(async () => {
        if (insert) {
          if (rows.has(String(insert.id)))
            return { data: null, error: { code: "23505" } };
          rows.set(String(insert.id), insert);
          return { data: insert, error: null };
        }
        const row = rows.get(String(filters.id));
        return {
          data: row?.user_id === filters.user_id ? row : null,
          error: null,
        };
      });
      return chain;
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
describe("recoverable trip creation", () => {
  beforeEach(() => {
    rows.clear();
    userId = "owner";
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
