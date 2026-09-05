import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  cookies: [] as Array<{ name: string; value: string }>,
  deleteRow: vi.fn(),
  deleteUser: vi.fn(),
  rateLimit: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => mocks.cookies, set: vi.fn() }),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    options: { cookies: { getAll: () => typeof mocks.cookies } },
  ) => ({
    auth: { getUser: () => mocks.getUser(options.cookies.getAll()[0]?.value) },
  }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (
    _url: string,
    _key: string,
    options?: { global?: { headers?: { Authorization?: string } } },
  ) => ({
    auth: {
      getUser: () =>
        mocks.getUser(
          options?.global?.headers?.Authorization?.replace("Bearer ", ""),
        ),
    },
  }),
}));
vi.mock("@/lib/supabase/server", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getSupabase: () => ({
    from: () => ({ delete: () => ({ eq: mocks.deleteRow }) }),
    auth: { admin: { deleteUser: mocks.deleteUser } },
  }),
}));
vi.mock("@/lib/security/rate-limit", () => ({
  checkRateLimitAsync: mocks.rateLimit,
}));

import { DELETE as deleteAccount } from "@/app/api/user/account/route";
import { DELETE as deleteProfile } from "@/app/api/user/profile/route";

describe.each([
  ["account", deleteAccount],
  ["profile", deleteProfile],
] as const)("DELETE /api/user/%s authentication", (path, handler) => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
    mocks.cookies = [];
    mocks.getUser.mockImplementation(async (token) => ({
      data: {
        user: token === "valid-session" ? { id: "verified-user" } : null,
      },
      error: null,
    }));
    mocks.deleteRow.mockResolvedValue({ error: null });
    mocks.deleteUser.mockResolvedValue({ error: null });
    mocks.rateLimit.mockResolvedValue({ allowed: true, resetIn: 1000 });
  });
  afterEach(() => vi.unstubAllEnvs());

  function request(token?: string) {
    return new NextRequest(`http://localhost:3000/api/user/${path}`, {
      method: "DELETE",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  }

  it.each(["cookie", "bearer"])(
    "deletes only the verified user with %s authentication",
    async (transport) => {
      if (transport === "cookie")
        mocks.cookies = [{ name: "sb-session", value: "valid-session" }];
      const response = await handler(
        request(transport === "bearer" ? "valid-session" : undefined),
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ deleted: true });
      expect(mocks.getUser).toHaveBeenCalledWith("valid-session");
      expect(mocks.deleteRow).toHaveBeenCalledWith("id", "verified-user");
      expect(mocks.deleteUser).toHaveBeenCalledWith("verified-user");
      expect(mocks.deleteRow.mock.invocationCallOrder[0]).toBeLessThan(
        mocks.deleteUser.mock.invocationCallOrder[0],
      );
      expect(mocks.rateLimit).toHaveBeenCalledWith(
        "account-delete:verified-user",
        expect.objectContaining({ maxRequests: 3, failClosed: true }),
      );
    },
  );

  it.each([undefined, "invalid-session"])(
    "rejects missing/invalid identity (%s) without deleting data",
    async (token) => {
      expect((await handler(request(token))).status).toBe(401);
      expect(mocks.deleteRow).not.toHaveBeenCalled();
      expect(mocks.deleteUser).not.toHaveBeenCalled();
    },
  );

  it("does not fall back to cookies when a supplied bearer token is invalid", async () => {
    mocks.cookies = [{ name: "sb-session", value: "valid-session" }];
    expect((await handler(request("invalid-session"))).status).toBe(401);
    expect(mocks.deleteRow).not.toHaveBeenCalled();
  });

  it("keeps rate limiting and Retry-After", async () => {
    mocks.rateLimit.mockResolvedValue({ allowed: false, resetIn: 1500 });
    const response = await handler(request("valid-session"));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("2");
    expect(mocks.deleteRow).not.toHaveBeenCalled();
  });

  it("does not delete credentials when account data deletion fails", async () => {
    mocks.deleteRow.mockResolvedValue({ error: { message: "db unavailable" } });
    expect((await handler(request("valid-session"))).status).toBe(500);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("does not report success when credential deletion fails", async () => {
    mocks.deleteUser.mockResolvedValue({
      error: { message: "auth unavailable" },
    });
    expect((await handler(request("valid-session"))).status).toBe(500);
  });
});
