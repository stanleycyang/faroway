import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockUser = { id: "user-123", email: "test@example.com" };

let authReturn: { data: { user: unknown }; error: unknown };
let upsertReturn: { data: unknown; error: unknown };
let deleteReturn: { error: unknown };

const pushTokenChain: Record<string, ReturnType<typeof vi.fn>> = {
  upsert: vi.fn(() => pushTokenChain),
  select: vi.fn(() => pushTokenChain),
  single: vi.fn(() => upsertReturn),
  delete: vi.fn(() => pushTokenChain),
  eq: vi.fn(() => pushTokenChain),
};

Object.defineProperty(pushTokenChain, "error", {
  get: () => deleteReturn.error,
  configurable: true,
  enumerable: true,
});

const requestClient = {
  auth: {
    getUser: vi.fn(() => authReturn),
  },
};

const adminClient = {
  from: vi.fn(() => pushTokenChain),
};

vi.mock("@/lib/supabase/server", () => ({
  createClientFromRequest: vi.fn(async () => requestClient),
  getSupabase: vi.fn(() => adminClient),
}));

import { DELETE, POST } from "@/app/api/user/push-token/route";

function makeRequest(method: string, body?: object): NextRequest {
  const init: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer token",
    },
  };
  if (body) init.body = JSON.stringify(body);

  return new NextRequest(
    new URL("/api/user/push-token", "http://localhost:3000"),
    init as Record<string, unknown>,
  );
}

function makeRawRequest(method: string, body: string): NextRequest {
  return new NextRequest(
    new URL("/api/user/push-token", "http://localhost:3000"),
    {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer token",
      },
      body,
    },
  );
}

describe("/api/user/push-token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authReturn = { data: { user: mockUser }, error: null };
    upsertReturn = {
      data: {
        token: "ExpoPushToken[abc123]",
        platform: "ios",
        device_name: "iPhone",
        updated_at: "2026-05-12T00:00:00Z",
        last_seen_at: "2026-05-12T00:00:00Z",
      },
      error: null,
    };
    deleteReturn = { error: null };
  });

  it("registers a push token for the authenticated user", async () => {
    const res = await POST(
      makeRequest("POST", {
        token: "ExpoPushToken[abc123]",
        platform: "ios",
        deviceName: "iPhone",
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.token).toBe("ExpoPushToken[abc123]");
    expect(adminClient.from).toHaveBeenCalledWith("push_tokens");
    expect(pushTokenChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-123",
        token: "ExpoPushToken[abc123]",
        platform: "ios",
        device_name: "iPhone",
      }),
      { onConflict: "user_id,token" },
    );
  });

  it("accepts unknown platform for non-standard mobile runtimes", async () => {
    const res = await POST(
      makeRequest("POST", {
        token: "ExpoPushToken[abc123]",
        platform: "unknown",
      }),
    );

    expect(res.status).toBe(200);
    expect(pushTokenChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "unknown",
      }),
      { onConflict: "user_id,token" },
    );
  });

  it("rejects invalid token formats", async () => {
    const res = await POST(
      makeRequest("POST", {
        token: "not-a-token",
        platform: "ios",
      }),
    );

    expect(res.status).toBe(400);
    expect(pushTokenChain.upsert).not.toHaveBeenCalled();
  });

  it("rejects malformed registration JSON as a client error", async () => {
    const res = await POST(makeRawRequest("POST", "{not-json"));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid JSON body");
    expect(pushTokenChain.upsert).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    authReturn = {
      data: { user: null },
      error: { message: "No session" },
    };

    const res = await POST(
      makeRequest("POST", {
        token: "ExpoPushToken[abc123]",
      }),
    );

    expect(res.status).toBe(401);
  });

  it("deletes one token when a token is provided", async () => {
    const res = await DELETE(
      makeRequest("DELETE", {
        token: "ExpoPushToken[abc123]",
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deleted).toBe(true);
    expect(pushTokenChain.delete).toHaveBeenCalled();
    expect(pushTokenChain.eq).toHaveBeenCalledWith("user_id", "user-123");
    expect(pushTokenChain.eq).toHaveBeenCalledWith(
      "token",
      "ExpoPushToken[abc123]",
    );
  });

  it("rejects malformed delete JSON as a client error", async () => {
    const res = await DELETE(makeRawRequest("DELETE", "{not-json"));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid JSON body");
    expect(pushTokenChain.delete).not.toHaveBeenCalled();
  });
});
