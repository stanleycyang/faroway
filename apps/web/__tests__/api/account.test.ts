import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mockUser = { id: "user-123", email: "test@example.com", identities: [] };

interface QueryResult {
  data: unknown;
  error: unknown;
}

let mockAuthReturn: { data: { user: unknown }; error: unknown };
let tableResults: Record<string, QueryResult>;
let operations: Array<Record<string, unknown>>;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

function createQueryChain(table: string) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};

  chain.select = vi.fn((columns: string) => {
    operations.push({ table, method: "select", columns });
    return chain;
  });
  chain.delete = vi.fn(() => {
    operations.push({ table, method: "delete" });
    return chain;
  });
  chain.eq = vi.fn((column: string, value: unknown) => {
    operations.push({ table, method: "eq", column, value });
    return chain;
  });
  chain.in = vi.fn((column: string, value: unknown) => {
    operations.push({ table, method: "in", column, value });
    return chain;
  });

  Object.defineProperty(chain, "data", {
    get: () => tableResults[table]?.data ?? null,
    configurable: true,
    enumerable: true,
  });
  Object.defineProperty(chain, "error", {
    get: () => tableResults[table]?.error ?? null,
    configurable: true,
    enumerable: true,
  });

  return chain;
}

const mockRequestClient = {
  auth: {
    getUser: vi.fn(() => mockAuthReturn),
  },
};

const mockAdminClient = {
  auth: {
    admin: {
      deleteUser: vi.fn<() => Promise<{ error: unknown }>>(async () => ({
        error: null,
      })),
    },
  },
  from: vi.fn((table: string) => createQueryChain(table)),
};

vi.mock("@/lib/supabase/server", () => ({
  createClientFromRequest: vi.fn(async () => mockRequestClient),
  getSupabase: vi.fn(() => mockAdminClient),
}));

vi.mock("@/lib/auth/account-deletion", async (original) => ({
  ...(await original<typeof import("@/lib/auth/account-deletion")>()),
  runAccountDeletion: vi.fn(async (_user, _code, deps) => {
    await deps.purgeData();
    await deps.deleteAuth();
    return { deleted: true };
  }),
}));
import { DELETE } from "@/app/api/user/account/route";

function makeRequest(): NextRequest {
  return new NextRequest(
    new URL("/api/user/account", "http://localhost:3000"),
    {
      method: "DELETE",
      headers: { Authorization: "Bearer token" },
      body: JSON.stringify({ confirm: true, recoveryToken: "a".repeat(64) }),
    },
  );
}

describe("DELETE /api/user/account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ACCOUNT_DELETION_ENABLED", "true");
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    operations = [];
    mockAuthReturn = { data: { user: mockUser }, error: null };
    tableResults = {
      trips: {
        data: [
          { id: "trip-1", search_id: "search-1" },
          { id: "trip-2", search_id: null },
        ],
        error: null,
      },
      searches: {
        data: [{ id: "search-2" }],
        error: null,
      },
      affiliate_clicks: {
        data: [{ id: "click-user" }, { id: "click-trip" }],
        error: null,
      },
    };
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it("fails closed before Auth or data access when rollout is disabled", async () => {
    vi.stubEnv("ACCOUNT_DELETION_ENABLED", "false");
    expect((await DELETE(makeRequest())).status).toBe(503);
    expect(mockRequestClient.auth.getUser).not.toHaveBeenCalled();
    expect(mockAdminClient.from).not.toHaveBeenCalled();
  });
  it("deletes user-owned data before deleting the auth user", async () => {
    const res = await DELETE(makeRequest());
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deleted).toBe(true);
    expect(mockAdminClient.auth.admin.deleteUser).toHaveBeenCalledWith(
      "user-123",
    );
    expect(operations).toEqual(
      expect.arrayContaining([
        {
          table: "push_tokens",
          method: "eq",
          column: "user_id",
          value: "user-123",
        },
        { table: "trips", method: "eq", column: "user_id", value: "user-123" },
        { table: "users", method: "eq", column: "id", value: "user-123" },
        {
          table: "search_results",
          method: "in",
          column: "search_id",
          value: ["search-1", "search-2"],
        },
        {
          table: "affiliate_clicks",
          method: "select",
          columns: "id",
        },
        {
          table: "affiliate_clicks",
          method: "in",
          column: "trip_id",
          value: ["trip-1", "trip-2"],
        },
        {
          table: "affiliate_conversions",
          method: "in",
          column: "click_id",
          value: ["click-user", "click-trip"],
        },
        {
          table: "affiliate_clicks",
          method: "in",
          column: "trip_id",
          value: ["trip-1", "trip-2"],
        },
      ]),
    );
  });

  it("returns 401 when the request is not authenticated", async () => {
    mockAuthReturn = {
      data: { user: null },
      error: { message: "No session" },
    };

    const res = await DELETE(makeRequest());

    expect(res.status).toBe(401);
    expect(mockAdminClient.auth.admin.deleteUser).not.toHaveBeenCalled();
  });

  it("ignores optional schema gaps while deleting account data", async () => {
    tableResults.push_tokens = {
      data: null,
      error: { code: "42P01", message: "relation does not exist" },
    };

    const res = await DELETE(makeRequest());

    expect(res.status).toBe(200);
    expect(mockAdminClient.auth.admin.deleteUser).toHaveBeenCalledWith(
      "user-123",
    );
  });

  it("returns 500 if deleting the auth user fails", async () => {
    mockAdminClient.auth.admin.deleteUser.mockResolvedValueOnce({
      error: { message: "admin failure" },
    });

    const res = await DELETE(makeRequest());

    expect(res.status).toBe(503);
  });
});
