import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const rpc = vi.hoisted(() => vi.fn());
const from = vi.hoisted(() => vi.fn());
const getUserById = vi.hoisted(() => vi.fn());
const deleteUser = vi.hoisted(() => vi.fn());
const authUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  getSupabase: () => ({
    rpc,
    from,
    auth: { admin: { getUserById, deleteUser } },
  }),
  createClientFromRequest: async () => ({ auth: { getUser: authUser } }),
}));
import { POST, PATCH } from "@/app/api/user/account/route";
import { DELETE as legacyDelete } from "@/app/api/user/profile/route";
import { DELETE } from "@/app/api/user/account/route";
const request = () =>
  new NextRequest("https://test.invalid/api/user/account", {
    method: "POST",
    body: JSON.stringify({ recoveryToken: "a".repeat(64) }),
  });
let row: unknown;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ACCOUNT_DELETION_ENABLED", "true");
  row = { user_id: "owner", phase: "data_deleted" };
  rpc.mockImplementation(async () => ({ data: row ? [row] : [], error: null }));
  authUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  from.mockImplementation(() => {
    const chain = {
      select: vi.fn(),
      eq: vi.fn(),
      update: vi.fn(),
      maybeSingle: vi.fn(async () => ({ data: row, error: null })),
    };
    chain.select.mockReturnValue(chain);
    chain.eq.mockReturnValue(chain);
    chain.update.mockReturnValue(chain);
    return chain;
  });
  getUserById.mockResolvedValue({
    data: { user: null },
    error: { code: "user_not_found" },
  });
});
it("recovers a lost final Auth-deletion response with status-only proof", async () => {
  const response = await POST(request());
  expect(await response.json()).toEqual({ deleted: true });
  expect(deleteUser).not.toHaveBeenCalled();
  expect(getUserById).toHaveBeenCalledWith("owner");
});
it.each(["timeout", "unauthorized"])(
  "never mistakes an Auth lookup error for deleted (%s)",
  async (code) => {
    getUserById.mockResolvedValue({ error: { code } });
    expect(await (await POST(request())).json()).toEqual({ deleted: false });
    expect(deleteUser).not.toHaveBeenCalled();
  },
);
it("returns no owner information for an unknown proof", async () => {
  row = null;
  expect(await (await POST(request())).json()).toEqual({ deleted: false });
  expect(getUserById).not.toHaveBeenCalled();
});
it("keeps legacy profile deletion on exactly the same safe boundary", () => {
  expect(legacyDelete).toBe(DELETE);
});

it("cancels only the authenticated owner’s unlocked pending request", async () => {
  const eq = vi.fn();
  const is = vi.fn();
  const chain = {
    delete: vi.fn(),
    eq,
    is,
    select: vi.fn(async () => ({ data: [{ user_id: "owner" }], error: null })),
  };
  chain.delete.mockReturnValue(chain);
  eq.mockReturnValue(chain);
  is.mockReturnValue(chain);
  from.mockReturnValue(chain);
  const result = await PATCH(
    new NextRequest("https://test.invalid/api/user/account", {
      method: "PATCH",
      body: JSON.stringify({ recoveryToken: "a".repeat(64), cancel: true }),
    }),
  );
  expect(await result.json()).toEqual({ cancelled: true });
  expect(eq).toHaveBeenCalledWith("user_id", "owner");
  expect(eq).toHaveBeenCalledWith("phase", "pending");
  expect(is).toHaveBeenCalledWith("lease_id", null);
  expect(deleteUser).not.toHaveBeenCalled();
});

it("uses status-only lookup for every issued device proof", async () => {
  row = { user_id: "owner", phase: "completed" };
  for (const token of ["a", "b"]) {
    const response = await POST(
      new NextRequest("https://test.invalid/api/user/account", {
        method: "POST",
        body: JSON.stringify({ recoveryToken: token.repeat(64) }),
      }),
    );
    expect(await response.json()).toEqual({ deleted: true });
  }
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(
    rpc.mock.calls.every(([name]) => name === "lookup_account_deletion"),
  ).toBe(true);
  expect(deleteUser).not.toHaveBeenCalled();
});
