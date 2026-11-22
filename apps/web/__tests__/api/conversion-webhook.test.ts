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
  conversionRows: [] as Array<Record<string, unknown>>,
  conversionsSelectError: null as unknown,
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
          upsert: (row: Record<string, unknown>, opts: unknown) => {
            mocks.upsertSpy(row, opts);
            if (!mocks.upsertResult.error) {
              const key = `${String(row.partner)}::${String(row.order_id ?? row.booking_reference ?? row.click_id)}`;
              const idx = mocks.conversionRows.findIndex((r) => r._key === key);
              const stored = { ...row, _key: key };
              if (idx >= 0) mocks.conversionRows[idx] = stored;
              else mocks.conversionRows.push(stored);
            }
            return Promise.resolve(mocks.upsertResult);
          },
          select: (cols?: string) => {
            if (cols === "status") {
              return {
                eq: (_col1: string, partnerVal: string) => ({
                  eq: (_col2: string, keyVal: string) => ({
                    limit: () => {
                      const matches = mocks.conversionRows.filter(
                        (r) =>
                          r.partner === partnerVal &&
                          (r.order_id ?? r.booking_reference ?? r.click_id) ===
                            keyVal,
                      );
                      return Promise.resolve({
                        data: matches.slice(0, 1),
                        error: null,
                      });
                    },
                  }),
                }),
              };
            }
            return {
              eq: (_col: string, clickId: string) =>
                Promise.resolve(
                  mocks.conversionsSelectError
                    ? { data: null, error: mocks.conversionsSelectError }
                    : {
                        data: mocks.conversionRows.filter(
                          (r) => r.click_id === clickId,
                        ),
                        error: null,
                      },
                ),
            };
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
            if (!mocks.updateResult.error && mocks.clickResult.data) {
              Object.assign(mocks.clickResult.data, values);
            }
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
    mocks.conversionRows = [];
    mocks.conversionsSelectError = null;
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

  it("rejects unsigned malformed JSON with 401 and returns 400 for signed malformed JSON or invalid schema fields", async () => {
    vi.stubEnv("VIATOR_WEBHOOK_SECRET", "viator-sec-validation");

    const unsignedBadJson = await POST(makeWebhookReq("{broken"));
    expect(unsignedBadJson.status).toBe(401);

    const badJson = await POST(
      makeWebhookReq("{broken", sign("{broken", "viator-sec-validation")),
    );
    expect(badJson.status).toBe(400);

    const badCurrencyBody = JSON.stringify({
      partner: "viator",
      clickId: "click-1",
      externalTransactionId: "tx-1",
      currency: "usd",
    });
    const lowercaseCurrency = await POST(
      makeWebhookReq(
        badCurrencyBody,
        sign(badCurrencyBody, "viator-sec-validation"),
      ),
    );
    expect(lowercaseCurrency.status).toBe(400);

    const invalidDateBody = JSON.stringify({
      partner: "viator",
      clickId: "click-1",
      externalTransactionId: "tx-1",
      occurredAt: "2026-02-30",
    });
    const invalidDate = await POST(
      makeWebhookReq(
        invalidDateBody,
        sign(invalidDateBody, "viator-sec-validation"),
      ),
    );
    expect(invalidDate.status).toBe(400);

    const whitespaceBody = JSON.stringify({
      partner: "viator",
      clickId: "   ",
      externalTransactionId: "tx-1",
    });
    const whitespaceClickId = await POST(
      makeWebhookReq(
        whitespaceBody,
        sign(whitespaceBody, "viator-sec-validation"),
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

  it("never clobbers an already-confirmed click when a subsequent pending webhook arrives", async () => {
    vi.stubEnv("VIATOR_WEBHOOK_SECRET", "viator-sec-pending");
    mocks.clickResult = {
      data: {
        id: "click-1",
        user_id: "user-1",
        converted: true,
        conversion_value: 25,
      },
      error: null,
    };
    mocks.conversionRows = [
      {
        _key: "viator::tx-1",
        click_id: "click-1",
        partner: "viator",
        order_id: "tx-1",
        status: "confirmed",
        commission_value: 25,
      },
    ];

    const payload = JSON.stringify({
      partner: "viator",
      clickId: "click-1",
      externalTransactionId: "tx-2",
      status: "pending",
      bookingAmount: 100,
      commissionAmount: 10,
      currency: "USD",
    });

    const res = await POST(
      makeWebhookReq(payload, sign(payload, "viator-sec-pending")),
    );
    expect(res.status).toBe(200);
    expect(mocks.updateSpy).toHaveBeenLastCalledWith({
      converted: true,
      conversion_value: 25,
    });
  });

  it("aggregates multi-transaction confirmed webhooks and preserves remaining confirmed revenue on partial cancellation", async () => {
    vi.stubEnv("VIATOR_WEBHOOK_SECRET", "viator-sec-multi");

    const send = async (body: Record<string, unknown>) => {
      const raw = JSON.stringify(body);
      const res = await POST(
        makeWebhookReq(raw, sign(raw, "viator-sec-multi")),
      );
      expect(res.status).toBe(200);
    };

    await send({
      partner: "viator",
      clickId: "click-1",
      externalTransactionId: "tx-1",
      status: "confirmed",
      bookingAmount: 200,
      commissionAmount: 25,
      currency: "USD",
    });
    expect(mocks.updateSpy).toHaveBeenLastCalledWith({
      converted: true,
      conversion_value: 25,
    });

    await send({
      partner: "viator",
      clickId: "click-1",
      externalTransactionId: "tx-2",
      status: "confirmed",
      bookingAmount: 100,
      commissionAmount: 10.5,
      currency: "USD",
    });
    expect(mocks.updateSpy).toHaveBeenLastCalledWith({
      converted: true,
      conversion_value: 35.5,
    });

    // Partial cancellation of tx-2 preserves tx-1's confirmed $25
    await send({
      partner: "viator",
      clickId: "click-1",
      externalTransactionId: "tx-2",
      status: "cancelled",
      bookingAmount: 100,
      commissionAmount: 10.5,
      currency: "USD",
    });
    expect(mocks.updateSpy).toHaveBeenLastCalledWith({
      converted: true,
      conversion_value: 25,
    });

    // Cancelling the final confirmed transaction clears click attribution
    await send({
      partner: "viator",
      clickId: "click-1",
      externalTransactionId: "tx-1",
      status: "refunded",
      bookingAmount: 200,
      commissionAmount: 25,
      currency: "USD",
    });
    expect(mocks.updateSpy).toHaveBeenLastCalledWith({
      converted: false,
      conversion_value: null,
    });
  });

  it("still records conversion with click_id=null when click lookup misses or errors", async () => {
    vi.stubEnv("STAY22_WEBHOOK_SECRET", "stay22-sec-miss");
    mocks.clickResult = {
      data: null,
      error: { code: "PGRST116", message: "No rows" },
    };

    const payload = JSON.stringify({
      partner: "stay22",
      clickId: "missing-click-99",
      externalTransactionId: "tx-orphan-1",
      status: "confirmed",
      bookingAmount: 180,
      commissionAmount: 14.4,
    });

    const res = await POST(
      makeWebhookReq(payload, sign(payload, "stay22-sec-miss")),
    );
    expect(res.status).toBe(200);
    expect(mocks.upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        click_id: null,
        user_id: null,
        partner: "stay22",
        order_id: "tx-orphan-1",
      }),
      { onConflict: "partner,conversion_key" },
    );
    expect(mocks.updateSpy).not.toHaveBeenCalled();
  });

  it("returns 500 when affiliate_conversions upsert fails without updating affiliate_clicks", async () => {
    vi.stubEnv("VIATOR_WEBHOOK_SECRET", "viator-sec-err");
    mocks.upsertResult = { error: { message: "unique violation or timeout" } };

    const payload = JSON.stringify({
      partner: "viator",
      clickId: "click-1",
      externalTransactionId: "tx-fail",
      status: "confirmed",
      commissionAmount: 15,
    });

    const res = await POST(
      makeWebhookReq(payload, sign(payload, "viator-sec-err")),
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Failed to record conversion" });
    expect(mocks.updateSpy).not.toHaveBeenCalled();
  });

  it("returns 400 when camelCase payload omits externalTransactionId", async () => {
    vi.stubEnv("VIATOR_WEBHOOK_SECRET", "viator-sec-tx");
    const payload = JSON.stringify({
      partner: "viator",
      clickId: "click-1",
      status: "confirmed",
      commissionAmount: 12,
    });
    const res = await POST(
      makeWebhookReq(payload, sign(payload, "viator-sec-tx")),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid webhook payload" });
    expect(mocks.upsertSpy).not.toHaveBeenCalled();
  });
});
