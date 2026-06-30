import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const executeTravelSearchMock = vi.fn();

vi.mock("@/lib/search/workflow", () => ({
  executeTravelSearch: (...args: unknown[]) => executeTravelSearchMock(...args),
}));

import { POST } from "@/app/api/itinerary/stream/route";

function makeReq(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/itinerary/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeRawReq(body: string) {
  return new NextRequest("http://localhost:3000/api/itinerary/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

describe("POST /api/itinerary/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    executeTravelSearchMock.mockResolvedValue({
      searchId: "search-stream-1",
      status: "completed",
      results: {
        searchId: "search-stream-1",
        hotels: [],
        activities: [],
        dining: [],
        transport: [],
        itinerary: [],
      },
    });
  });

  it("passes the requested end date to the parallel search workflow", async () => {
    const res = await POST(
      makeReq({
        destination: "Tokyo",
        startDate: "2026-06-01",
        endDate: "2026-06-05",
        travelers: 2,
        travelerType: "couple",
        originCity: "Los Angeles",
        originAirport: "LAX",
        vibes: ["foodie"],
        budget: "moderate",
      }),
    );

    await res.text();

    expect(res.status).toBe(200);
    expect(executeTravelSearchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^stream_/),
      expect.objectContaining({
        destination: "Tokyo",
        startDate: "2026-06-01",
        endDate: "2026-06-05",
        travelers: 2,
        travelerType: "couple",
        originCity: "Los Angeles",
        originAirport: "LAX",
      }),
      expect.objectContaining({
        onProgress: expect.any(Function),
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

  it("returns 400 when endDate is before startDate", async () => {
    const res = await POST(
      makeReq({
        destination: "Tokyo",
        startDate: "2026-06-05",
        endDate: "2026-06-01",
        travelers: 2,
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("Invalid request body");
    expect(executeTravelSearchMock).not.toHaveBeenCalled();
  });
});
