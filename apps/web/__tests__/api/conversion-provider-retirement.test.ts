import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const database = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({ getSupabase: database }));
import { POST } from "@/app/api/track/conversion/route";
it("rejects unknown supplier conversions before touching stored records", async () => {
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
  expect(response.status).toBe(400);
  expect(database).not.toHaveBeenCalled();
});
