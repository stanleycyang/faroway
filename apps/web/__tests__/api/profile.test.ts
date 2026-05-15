import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Mock Supabase ──────────────────────────────────────────────────────────────

const mockUser = { id: "user-123", email: "test@example.com" };

const mockProfile = {
  id: "user-123",
  email: "test@example.com",
  display_name: "Test User",
  avatar_url: "https://example.com/avatar.jpg",
  auth_provider: "google",
  subscription_tier: "free",
  preferences: { vibes: ["adventure", "foodie"], budget: "moderate" },
  notification_settings: {
    trip_reminders: true,
    deals: true,
    itinerary_updates: true,
    app_updates: false,
  },
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

let mockSelectReturn: { data: unknown; error: unknown };
let mockUpdateReturn: { data: unknown; error: unknown };

type DbError = { message: string } | null;
type DeleteUserResult = { error: DbError };
const mockDeleteUser = vi.fn(
  async (_userId: string): Promise<DeleteUserResult> => ({ error: null }),
);
const mockUsersDeleteEq = vi.fn(async () => ({ error: null as DbError }));
const mockTableDelete = vi.fn(() => ({ eq: mockUsersDeleteEq }));

const mockSupabase = {
  auth: {
    getUser: vi.fn(() => ({
      data: { user: mockUser },
      error: null,
    })),
    admin: {
      deleteUser: mockDeleteUser,
    },
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn(() => mockSelectReturn),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => mockUpdateReturn),
        })),
      })),
    })),
    delete: mockTableDelete,
  })),
};

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: vi.fn(() => mockSupabase),
}));

vi.mock("@/lib/auth/middleware", () => ({
  requireAuth: vi.fn(async () => ({
    authenticated: true,
    user: mockUser,
  })),
  validationErrorResponse: vi.fn(async (message: string, details?: unknown) => {
    const { NextResponse } = await import("next/server");
    return NextResponse.json(
      { error: message, code: "VALIDATION_ERROR", details },
      { status: 400 },
    );
  }),
}));

// ── Import route handlers after mocking ────────────────────────────────────────

import { GET, PATCH, DELETE } from "@/app/api/user/profile/route";

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeRequest(method: string, url: string, body?: object): NextRequest {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new NextRequest(
    new URL(url, "http://localhost:3000"),
    init as Record<string, unknown>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe("GET /api/user/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectReturn = { data: mockProfile, error: null };
  });

  it("returns full profile with preferences and notification settings", async () => {
    const req = makeRequest("GET", "/api/user/profile");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.id).toBe("user-123");
    expect(json.name).toBe("Test User");
    expect(json.avatar).toBe("https://example.com/avatar.jpg");
    expect(json.preferences).toEqual({
      vibes: ["adventure", "foodie"],
      budget: "moderate",
    });
    expect(json.notificationSettings).toEqual({
      trip_reminders: true,
      deals: true,
      itinerary_updates: true,
      app_updates: false,
    });
    expect(json.authProvider).toBe("google");
    expect(json.subscriptionTier).toBe("free");
  });

  it("returns empty preferences when null in DB", async () => {
    mockSelectReturn = {
      data: { ...mockProfile, preferences: null, notification_settings: null },
      error: null,
    };
    const req = makeRequest("GET", "/api/user/profile");
    const res = await GET(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.preferences).toEqual({});
    expect(json.notificationSettings).toEqual({});
  });

  it("returns 500 on database error", async () => {
    mockSelectReturn = { data: null, error: { message: "DB down" } };
    const req = makeRequest("GET", "/api/user/profile");
    const res = await GET(req);

    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/user/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates preferences", async () => {
    const updatedProfile = {
      ...mockProfile,
      preferences: { vibes: ["adventure"], budget: "luxury" },
    };
    mockUpdateReturn = { data: updatedProfile, error: null };

    const req = makeRequest("PATCH", "/api/user/profile", {
      preferences: { vibes: ["adventure"], budget: "luxury" },
    });
    const res = await PATCH(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.preferences).toEqual({
      vibes: ["adventure"],
      budget: "luxury",
    });
  });

  it("updates notification settings", async () => {
    const updatedProfile = {
      ...mockProfile,
      notification_settings: {
        trip_reminders: false,
        deals: false,
        itinerary_updates: true,
        app_updates: true,
      },
    };
    mockUpdateReturn = { data: updatedProfile, error: null };

    const req = makeRequest("PATCH", "/api/user/profile", {
      notification_settings: {
        trip_reminders: false,
        deals: false,
        itinerary_updates: true,
        app_updates: true,
      },
    });
    const res = await PATCH(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.notificationSettings.trip_reminders).toBe(false);
    expect(json.notificationSettings.app_updates).toBe(true);
  });

  it("returns 400 for invalid input", async () => {
    const req = makeRequest("PATCH", "/api/user/profile", {
      preferences: { budget: "invalid_value" },
    });
    const res = await PATCH(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when no fields to update", async () => {
    const req = makeRequest("PATCH", "/api/user/profile", {});
    const res = await PATCH(req);

    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/user/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteUser.mockResolvedValue({ error: null });
    mockUsersDeleteEq.mockResolvedValue({ error: null });
  });

  it("deletes the public.users row, then the auth identity, then returns deleted: true", async () => {
    const fromSpy = mockSupabase.from as ReturnType<typeof vi.fn>;
    const req = makeRequest("DELETE", "/api/user/profile");
    const res = await DELETE(req);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.deleted).toBe(true);

    // public.users row first — relies on FK cascade for trips/itineraries/workflows
    expect(fromSpy).toHaveBeenCalledWith("users");
    expect(mockTableDelete).toHaveBeenCalledTimes(1);
    expect(mockUsersDeleteEq).toHaveBeenCalledWith("id", "user-123");

    // auth identity last — cascades push_tokens, SET NULLs affiliate rows
    expect(mockDeleteUser).toHaveBeenCalledWith("user-123");
  });

  it("returns 500 and skips auth deletion if the public.users delete fails", async () => {
    mockUsersDeleteEq.mockResolvedValueOnce({
      error: { message: "db down" },
    });
    const req = makeRequest("DELETE", "/api/user/profile");
    const res = await DELETE(req);

    expect(res.status).toBe(500);
    // Auth identity must NOT have been deleted — leaves the user able to retry.
    expect(mockDeleteUser).not.toHaveBeenCalled();
  });

  it("returns 500 if auth admin deleteUser fails", async () => {
    mockDeleteUser.mockResolvedValueOnce({
      error: { message: "auth service down" },
    });
    const req = makeRequest("DELETE", "/api/user/profile");
    const res = await DELETE(req);

    expect(res.status).toBe(500);
  });
});
