import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const rpc = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  createClientFromRequest: async () => ({ auth: { getUser } }),
  getSupabase: () => ({ rpc, from }),
}));
import { POST, DELETE } from "@/app/api/user/push-token/route";
const body = {
  token: "ExpoPushToken[synthetic_device]",
  revision: 100,
  consentVersion: "notifications-v2",
  platform: "ios",
};
const request = (method: string, value: unknown = body) =>
  new NextRequest("https://test.invalid/api/user/push-token", {
    method,
    body: JSON.stringify(value),
  });
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("PUSH_CONSENT_V2_ENABLED", "true");
  getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  rpc.mockResolvedValue({ data: true, error: null });
});
it("requires explicit versioned consent and a monotonic operation revision", async () => {
  expect((await POST(request("POST"))).status).toBe(200);
  expect(rpc).toHaveBeenCalledWith("set_device_push_consent", {
    p_user_id: "owner",
    p_token: body.token,
    p_revision: 100,
    p_enabled: true,
    p_platform: "ios",
  });
});
it.each([
  {},
  { ...body, revision: 0 },
  { ...body, consentVersion: undefined },
  { ...body, token: "bad" },
])(
  "rejects legacy or malformed registration without a write",
  async (value) => {
    expect((await POST(request("POST", value))).status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  },
);
it("rejects unauthenticated registration and revocation", async () => {
  getUser.mockResolvedValue({ data: { user: null }, error: new Error() });
  expect((await POST(request("POST"))).status).toBe(401);
  expect((await DELETE(request("DELETE"))).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});
it("fails closed without the rollout flag or schema", async () => {
  vi.stubEnv("PUSH_CONSENT_V2_ENABLED", "false");
  expect((await POST(request("POST"))).status).toBe(503);
  expect(rpc).not.toHaveBeenCalled();
  vi.stubEnv("PUSH_CONSENT_V2_ENABLED", "true");
  rpc.mockResolvedValue({ error: { code: "42883" } });
  expect((await POST(request("POST"))).status).toBe(503);
});
it("returns conflict for a stale operation or token owned by another user", async () => {
  rpc.mockResolvedValue({ data: false, error: null });
  expect((await POST(request("POST"))).status).toBe(409);
});
it("revokes through the same ordered atomic boundary, preserving a tombstone", async () => {
  expect(
    (await DELETE(request("DELETE", { ...body, revision: 101 }))).status,
  ).toBe(200);
  expect(rpc).toHaveBeenCalledWith(
    "set_device_push_consent",
    expect.objectContaining({
      p_user_id: "owner",
      p_revision: 101,
      p_enabled: false,
    }),
  );
  expect(from).not.toHaveBeenCalled();
});
