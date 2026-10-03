import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
const auth = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth/middleware", () => ({ requireUserIdFromRequest: auth }));
import { POST } from "@/app/api/workflows/generate-itinerary/route";
const tripId = "11111111-1111-4111-8111-111111111111";
const request = (body: unknown = { tripId }) =>
  new NextRequest("http://localhost/api/workflows/generate-itinerary", {
    method: "POST",
    body: JSON.stringify(body),
  });
describe("retired legacy generation route", () => {
  beforeEach(() => auth.mockResolvedValue({ userId: "owner" }));
  it("keeps authentication required", async () => {
    auth.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    expect((await POST(request())).status).toBe(401);
  });
  it("returns actionable migration guidance without starting work", async () => {
    const response = await POST(request());
    expect(response.status).toBe(410);
    expect((await response.json()).generationUrl).toBe(
      `/api/trips/${tripId}/generate`,
    );
  });
  it("rejects malformed trip IDs", async () =>
    expect((await POST(request({ tripId: "invalid" }))).status).toBe(400));
});
