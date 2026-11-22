import crypto from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const database = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ getSupabase: database }));
import { POST } from "@/app/api/track/conversion/route";

afterEach(() => vi.unstubAllEnvs());

it("rejects unsigned unknown supplier conversions with 401 before touching stored records", async () => {
  const response = await POST(
    new NextRequest("http://localhost/api/track/conversion", {
      method: "POST",
      body: JSON.stringify({
        click_id: "historic-click",
        partner: "retired-provider",
        booking_value: 100,
        commission_value: 10,
        currency: "USD",
      }),
    }),
  );
  expect(response.status).toBe(401);
  expect(database).not.toHaveBeenCalled();
});

it("rejects signed unknown supplier conversions with 400 before touching stored records", async () => {
  vi.stubEnv("VIATOR_WEBHOOK_SECRET", "retired-check-secret");
  const payload = JSON.stringify({
    click_id: "historic-click",
    partner: "retired-provider",
    booking_value: 100,
    commission_value: 10,
    currency: "USD",
  });
  const signature = crypto
    .createHmac("sha256", "retired-check-secret")
    .update(payload)
    .digest("hex");
  const response = await POST(
    new NextRequest("http://localhost/api/track/conversion", {
      method: "POST",
      headers: { "x-webhook-signature": signature },
      body: payload,
    }),
  );
  expect(response.status).toBe(400);
  expect(database).not.toHaveBeenCalled();
});
