import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const startTripGenerationMock = vi.fn();

vi.mock("@/app/api/trips/[id]/generate/route", () => ({
  POST: (...args: unknown[]) => startTripGenerationMock(...args),
}));

import { POST } from "@/app/api/workflows/generate-itinerary/route";

const tripId = "11111111-1111-4111-8111-111111111111";

function makeReq(body: string | Record<string, unknown>) {
  return new NextRequest(
    "http://localhost:3000/api/workflows/generate-itinerary",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    },
  );
}

describe("POST /api/workflows/generate-itinerary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startTripGenerationMock.mockResolvedValue(
      Response.json({ success: true, tripId }),
    );
  });

  it("delegates valid legacy requests to canonical trip generation", async () => {
    startTripGenerationMock.mockImplementationOnce(
      async (forwardedRequest: NextRequest) => {
        await expect(forwardedRequest.json()).resolves.toMatchObject({
          tripId,
        });
        return Response.json({ success: true, tripId });
      },
    );
    const res = await POST(
      makeReq({
        tripId,
        destination: "client-controlled value is ignored",
        preferences: { vibes: ["foodie"] },
      }),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ success: true, tripId });
    expect(startTripGenerationMock).toHaveBeenCalledOnce();
    const [, context] = startTripGenerationMock.mock.calls[0] as [
      NextRequest,
      { params: Promise<{ id: string }> },
    ];
    await expect(context.params).resolves.toEqual({ id: tripId });
  });

  it("rejects invalid trip IDs before canonical generation", async () => {
    const res = await POST(makeReq({ tripId: "not-a-uuid" }));

    expect(res.status).toBe(400);
    expect(startTripGenerationMock).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON", async () => {
    const res = await POST(makeReq("{"));

    expect(res.status).toBe(400);
    expect(startTripGenerationMock).not.toHaveBeenCalled();
  });
});
