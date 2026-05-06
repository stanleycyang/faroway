import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const tripGenerateMock = vi.fn();
const streamGenerateMock = vi.fn();

vi.mock("@/app/api/trips/[id]/generate/route", () => ({
  POST: (...args: unknown[]) => tripGenerateMock(...args),
}));

vi.mock("@/app/api/itinerary/stream/route", () => ({
  POST: (...args: unknown[]) => streamGenerateMock(...args),
}));

import { POST } from "@/app/api/itinerary/generate/route";

function makeReq(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/itinerary/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/itinerary/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tripGenerateMock.mockResolvedValue(
      NextResponse.json({ success: true, searchId: "search-1" }),
    );
    streamGenerateMock.mockResolvedValue(
      new Response("data: ok\n\n", {
        headers: { "Content-Type": "text/event-stream" },
      }),
    );
  });

  it("delegates tripId requests to the durable parallel trip generator", async () => {
    const res = await POST(makeReq({ tripId: "trip-1" }));
    const body = await res.json();

    expect(body).toEqual({ success: true, searchId: "search-1" });
    expect(tripGenerateMock).toHaveBeenCalledTimes(1);
    expect(streamGenerateMock).not.toHaveBeenCalled();

    const [, ctx] = tripGenerateMock.mock.calls[0];
    await expect(ctx.params).resolves.toEqual({ id: "trip-1" });
  });

  it("delegates direct itinerary requests to the parallel stream generator", async () => {
    const res = await POST(
      makeReq({
        destination: "Tokyo",
        startDate: "2026-06-01",
        endDate: "2026-06-05",
        travelers: 2,
      }),
    );

    expect(await res.text()).toBe("data: ok\n\n");
    expect(streamGenerateMock).toHaveBeenCalledTimes(1);
    expect(tripGenerateMock).not.toHaveBeenCalled();
  });
});
