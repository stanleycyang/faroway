import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  tripsSelect: vi.fn(),
  tripsEq: vi.fn(),
  tripsSingle: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabase: vi.fn(() => ({
    from: mocks.from,
  })),
}));

import { POST } from "@/app/api/content-reports/route";

function makeRequest(body: object | string, ip = "203.0.113.10"): NextRequest {
  return new NextRequest(
    new URL("/api/content-reports", "http://localhost:3000"),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": ip,
      },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
  );
}

describe("POST /api/content-reports", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const tripsQuery = {
      select: mocks.tripsSelect,
      eq: mocks.tripsEq,
      single: mocks.tripsSingle,
    };
    mocks.tripsSelect.mockReturnValue(tripsQuery);
    mocks.tripsEq.mockReturnValue(tripsQuery);
    mocks.tripsSingle.mockResolvedValue({
      data: {
        id: "00000000-0000-4000-8000-000000000001",
        user_id: "00000000-0000-4000-8000-000000000002",
      },
      error: null,
    });
    mocks.insert.mockResolvedValue({ error: null });
    mocks.from.mockImplementation((table: string) => {
      if (table === "trips") return tripsQuery;
      if (table === "content_reports") return { insert: mocks.insert };
      return {};
    });
  });

  it("records a report for a shared itinerary", async () => {
    const response = await POST(
      makeRequest({
        contentType: "shared_trip",
        token: "share_token_123",
        reason: "unsafe",
        details: "The advice looks unsafe.",
        reporterEmail: "reviewer@example.com",
      }),
    );

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.from).toHaveBeenCalledWith("trips");
    expect(mocks.from).toHaveBeenCalledWith("content_reports");
    expect(mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        content_type: "shared_trip",
        content_token: "share_token_123",
        content_url: "/s/share_token_123",
        reported_trip_id: "00000000-0000-4000-8000-000000000001",
        reported_user_id: "00000000-0000-4000-8000-000000000002",
        reason: "unsafe",
        status: "open",
      }),
    );
  });

  it("rejects malformed JSON", async () => {
    const response = await POST(makeRequest("{not-json", "203.0.113.11"));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid JSON body");
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("rejects invalid shared tokens", async () => {
    const response = await POST(
      makeRequest(
        {
          contentType: "shared_trip",
          token: "../bad",
          reason: "spam",
        },
        "203.0.113.12",
      ),
    );

    expect(response.status).toBe(400);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("returns 404 when the shared itinerary no longer exists", async () => {
    mocks.tripsSingle.mockResolvedValueOnce({ data: null, error: null });

    const response = await POST(
      makeRequest(
        {
          contentType: "shared_trip",
          token: "missing_token_123",
          reason: "other",
        },
        "203.0.113.13",
      ),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toBe("Shared itinerary not found");
    expect(mocks.insert).not.toHaveBeenCalled();
  });
});
