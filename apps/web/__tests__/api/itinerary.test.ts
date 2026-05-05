import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const executeTravelSearchMock = vi.fn();

vi.mock("@/lib/search/workflow", () => ({
  executeTravelSearch: (...args: unknown[]) => executeTravelSearchMock(...args),
}));

vi.mock("@/lib/security/rate-limit", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 9 })),
}));

const supabaseMock = {
  auth: {
    getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
  },
  from: vi.fn(() => ({
    insert: vi.fn(async () => ({ data: null, error: null })),
  })),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => supabaseMock),
}));

import { POST } from "@/app/api/itinerary/route";

function makeReq(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/itinerary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeRawReq(body: string) {
  return new NextRequest("http://localhost:3000/api/itinerary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("POST /api/itinerary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeTravelSearchMock.mockResolvedValue({
      searchId: "itinerary-1",
      status: "completed",
      results: {
        searchId: "itinerary-1",
        hotels: [],
        activities: [],
        dining: [],
        transport: [],
        itinerary: [
          {
            dayNumber: 1,
            date: "2026-06-01",
            title: "Tokyo arrival",
            summary: "A relaxed first day in Tokyo.",
            morning: { activities: [] },
            afternoon: { activities: [] },
            evening: { activities: [] },
            estimatedCost: 0,
            currency: "USD",
            tips: [],
          },
        ],
      },
    });
  });

  it("uses the parallel search workflow for non-streaming generation", async () => {
    const res = await POST(
      makeReq({
        destination: "Tokyo",
        startDate: "2026-06-01",
        endDate: "2026-06-05",
        travelers: { adults: 2, children: 1 },
        travelerType: "family",
        originCity: "San Francisco",
        originAirport: "SFO",
        vibes: ["foodie"],
        budget: "moderate",
        save: false,
      }),
    );

    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.destination).toBe("Tokyo");
    expect(json.days).toHaveLength(1);
    expect(executeTravelSearchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^itinerary_/),
      expect.objectContaining({
        destination: "Tokyo",
        startDate: "2026-06-01",
        endDate: "2026-06-05",
        travelers: 3,
        travelerType: "family",
        originCity: "San Francisco",
        originAirport: "SFO",
        vibes: ["foodie"],
        budget: "moderate",
      }),
    );
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await POST(makeRawReq("{"));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid request body");
    expect(executeTravelSearchMock).not.toHaveBeenCalled();
  });
});
