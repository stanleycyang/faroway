import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  clickResult: {
    data: { id: "click-1", user_id: "user-1" } as Record<
      string,
      unknown
    > | null,
    error: null as unknown,
  },
  upsertResult: { error: null as unknown },
  updateResult: { error: null as unknown },
  upsertSpy: vi.fn(),
  updateSpy: vi.fn(),
  fromSpy: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => ({
    from: (table: string) => {
      mocks.fromSpy(table);
      if (table === "affiliate_conversions") {
        return {
          upsert: (row: unknown, opts: unknown) => {
            mocks.upsertSpy(row, opts);
            return Promise.resolve(mocks.upsertResult);
          },
        };
      }
      if (table === "affiliate_clicks") {
        return {
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve(mocks.clickResult),
            }),
          }),
          update: (values: unknown) => {
            mocks.updateSpy(values);
            return {
              eq: () => Promise.resolve(mocks.updateResult),
            };
          },
        };
      }
      return {};
    },
  }),
}));

import { POST } from "@/app/api/track/conversion/route";

function sign(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function makeWebhookReq(rawBody: string, signature?: string): NextRequest {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (signature !== undefined) {
    headers["x-webhook-signature"] = signature;
  }
  return new NextRequest("http://localhost:3000/api/track/conversion", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

describe("POST /api/track/conversion (expanded M2 webhooks)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.clickResult = {
      data: { id: "click-1", user_id: "user-1" },
      error: null,
    };
    mocks.upsertResult = { error: null };
    mocks.updateResult = { error: null };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    { partner: "viator", env: "VIATOR_WEBHOOK_SECRET" },
    { partner: "getyourguide", env: "GYG_WEBHOOK_SECRET" },
    { partner: "klook", env: "KLOOK_WEBHOOK_SECRET" },
    { partner: "travelpayouts", env: "TRAVELPAYOUTS_WEBHOOK_SECRET" },
    { partner: "stay22", env: "STAY22_WEBHOOK_SECRET" },
    { partner: "duffel", env: "DUFFEL_WEBHOOK_SECRET" },
    { partner: "safetywing", env: "SAFETYWING_WEBHOOK_SECRET" },
    { partner: "airalo", env: "AIRALO_WEBHOOK_SECRET" },
  ])(
    "verifies HMAC-SHA256 for $partner via $env and persists camelCase payload",
    async ({ partner, env }) => {
      const secret = `secret-${partner}-123`;
      vi.stubEnv(env, secret);

      const payload = JSON.stringify({
        partner,
        clickId: "click-1",
        externalTransactionId: `tx-${partner}-99`,
        status: "confirmed",
        bookingAmount: 220,
        commissionAmount: 19.8,
        occurredAt: "2026-06-01T12:00:00Z",
      });

      const res = await POST(
        makeWebhookReq(payload, `sha256=${sign(payload, secret)}`),
      );
      expect(res.status).toBe(200);
      expect(mocks.upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          click_id: "click-1",
          partner,
          order_id: `tx-${partner}-99`,
          currency: "USD",
          booking_value: 220,
          commission_value: 19.8,
          status: "confirmed",
        }),
        { onConflict: "partner,conversion_key" },
      );
      expect(mocks.updateSpy).toHaveBeenCalledWith({
        converted: true,
        conversion_value: 19.8,
      });
    },
  );

  it("fails closed 401 when secret is missing or partner has no webhook secret", async () => {
    vi.stubEnv("TRAVELPAYOUTS_WEBHOOK_SECRET", "");
    const payload = JSON.stringify({
      partner: "travelpayouts",
      clickId: "click-1",
      externalTransactionId: "tx-1",
    });
    const res1 = await POST(makeWebhookReq(payload, "a".repeat(64)));
    expect(res1.status).toBe(401);

    const nonWebhookPayload = JSON.stringify({
      partner: "booking",
      clickId: "click-1",
      externalTransactionId: "tx-2",
    });
    const res2 = await POST(makeWebhookReq(nonWebhookPayload, "a".repeat(64)));
    expect(res2.status).toBe(401);
    expect(mocks.upsertSpy).not.toHaveBeenCalled();
  });

  it.each(["canceled", "refunded"])(
    "maps %s status to DB 'cancelled' and clears click conversion state",
    async (status) => {
      vi.stubEnv("DUFFEL_WEBHOOK_SECRET", "duffel-sec");
      const payload = JSON.stringify({
        partner: "duffel",
        clickId: "click-1",
        externalTransactionId: "tx-cancel",
        status,
      });
      const res = await POST(
        makeWebhookReq(payload, sign(payload, "duffel-sec")),
      );
      expect(res.status).toBe(200);
      expect(mocks.upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "cancelled",
          currency: "USD",
          booking_value: 0,
          commission_value: 0,
        }),
        { onConflict: "partner,conversion_key" },
      );
      expect(mocks.updateSpy).toHaveBeenCalledWith({
        converted: false,
        conversion_value: null,
      });
    },
  );

  it("returns 400 on malformed JSON or invalid schema fields", async () => {
    const badJson = await POST(makeWebhookReq("{broken"));
    expect(badJson.status).toBe(400);

    const lowercaseCurrency = await POST(
      makeWebhookReq(
        JSON.stringify({
          partner: "viator",
          clickId: "click-1",
          externalTransactionId: "tx-1",
          currency: "usd",
        }),
      ),
    );
    expect(lowercaseCurrency.status).toBe(400);

    const invalidDate = await POST(
      makeWebhookReq(
        JSON.stringify({
          partner: "viator",
          clickId: "click-1",
          externalTransactionId: "tx-1",
          occurredAt: "2026-02-30",
        }),
      ),
    );
    expect(invalidDate.status).toBe(400);

    const whitespaceClickId = await POST(
      makeWebhookReq(
        JSON.stringify({
          partner: "viator",
          clickId: "   ",
          externalTransactionId: "tx-1",
        }),
      ),
    );
    expect(whitespaceClickId.status).toBe(400);
    expect(mocks.upsertSpy).not.toHaveBeenCalled();
  });

  it("trims clickId consistently and merges mixed camelCase + snake_case fields", async () => {
    vi.stubEnv("VIATOR_WEBHOOK_SECRET", "viator-mixed-sec");
    const payload = JSON.stringify({
      partner: "viator",
      clickId: "  click-1  ",
      externalTransactionId: "tx-mixed-1",
      booking_value: 250,
      commission_value: 25,
      conversion_date: "2026-06-15T10:00:00Z",
      status: "cancelled",
    });

    const res = await POST(
      makeWebhookReq(payload, sign(payload, "viator-mixed-sec")),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clickId).toBe("click-1");
    expect(mocks.upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        click_id: "click-1",
        order_id: "tx-mixed-1",
        booking_value: 250,
        commission_value: 25,
        status: "cancelled",
        conversion_date: "2026-06-15T10:00:00Z",
      }),
      { onConflict: "partner,conversion_key" },
    );
  });
});
